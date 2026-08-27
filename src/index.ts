/**
 * ai4sci.app — Cloudflare Workers API entry
 * Routes: browse (public) / auth (Google OAuth) / UGC submission / waitlist / reviews
 *         + category management (admin CRUD) with multi-category (app_categories)
 */

import { Env, json, getUser, filterAppFields } from "./util";
import { handleUgc } from "./ugc";

// Fixed redirect_uri: localhost for dev, ai4sci.app for production
// This avoids Google OAuth rejecting http:// for non-localhost domains
function getRedirectUri(env: Env): string {
  const isProduction = env.ENVIRONMENT === "production";
  return isProduction
    ? "https://ai4sci.app/api/auth/callback"
    : "http://localhost:8787/api/auth/callback";
}

/** Resolve a comma-separated slug filter into a flat slug list, expanding any
 *  parent (大类) slug into all of its child slugs. This lets clicking a 大类
 *  filter by every descendant 小类 without changing the join query. */
async function expandCategorySlugs(env: Env, slugs: string[]): Promise<string[]> {
  if (!slugs.length) return [];
  const ph = slugs.map(() => "?").join(",");
  const parents = await env.DB.prepare(
    `SELECT id, slug FROM categories WHERE slug IN (${ph}) AND parent_id IS NULL`
  ).bind(...slugs).all<{ id: string }>();
  if (!parents.results.length) return slugs;
  const parentIds = parents.results.map((p) => p.id);
  const cph = parentIds.map(() => "?").join(",");
  const children = await env.DB.prepare(
    `SELECT slug FROM categories WHERE parent_id IN (${cph})`
  ).bind(...parentIds).all<{ slug: string }>();
  const childSlugs = children.results.map((c) => c.slug);
  // union original slugs + resolved child slugs (also match ids in case slug==id)
  return [...new Set([...slugs, ...childSlugs])];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // --- Static file serving via Workers Assets ---
      if (!path.startsWith("/api/")) {
        const htmlRoutes: Record<string, string> = {
          "/": "/index.html",
          "/pricing": "/pricing.html",
          "/submit": "/submit.html",
          "/dashboard": "/dashboard.html",
          "/apps": "/index.html",
          "/login": "/index.html",
          "/admin": "/admin.html",
        };
        let assetPath = htmlRoutes[path] || path;
        if (path.startsWith("/apps/") && !path.endsWith(".html")) {
          assetPath = "/app-detail.html";
        }
        const assetUrl = new URL(assetPath, url.origin);
        const assetResp = await env.STATIC.fetch(new Request(assetUrl.toString()));
        if (assetResp.status === 404) {
          const fallback = await env.STATIC.fetch(new URL("/index.html", url.origin).toString());
          return new Response(fallback.body, { status: 404, headers: fallback.headers });
        }
        return assetResp;
      }

      // --- UGC + waitlist + reviews ---
      const ugcResp = await handleUgc(request, env);
      if (ugcResp.status !== 404) return ugcResp;

      // --- Core API ---
      const user = await getUser(request, env);
      const method = request.method;

      // Categories (with live app_count + parent_id for hierarchical display)
      if (path === "/api/categories" && method === "GET") {
        const rows = await env.DB.prepare(
          `SELECT c.*,
                  (SELECT COUNT(*) FROM app_categories ac
                     JOIN apps a ON a.id = ac.app_id AND a.status='published'
                     WHERE ac.category_id = c.id) AS app_count
           FROM categories c ORDER BY c.sort_order`
        ).all();
        return json({ categories: rows.results });
      }

      // --- Admin: category management (CRUD) — admin-only ---
      if (path === "/api/admin/categories" && method === "POST") {
        if (user.role !== "admin") return json({ error: "forbidden" }, 403);
        const body = await request.json() as {
          name?: string; slug?: string; icon?: string;
          sort_order?: number; description?: string; parent_id?: string;
        };
        if (!body.name || !body.slug) return json({ error: "name_and_slug_required" }, 400);
        const dup = await env.DB.prepare("SELECT id FROM categories WHERE slug=?")
          .bind(body.slug).first();
        if (dup) return json({ error: "slug_exists" }, 400);
        if (body.parent_id) {
          const parent = await env.DB.prepare("SELECT id FROM categories WHERE id=?")
            .bind(body.parent_id).first();
          if (!parent) return json({ error: "parent_not_found" }, 400);
        }
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO categories (id, name, slug, icon, sort_order, description, parent_id) VALUES (?,?,?,?,?,?,?)"
        ).bind(id, body.name, body.slug, body.icon, body.sort_order ?? 0, body.description, body.parent_id ?? null).run();
        const created = await env.DB.prepare("SELECT * FROM categories WHERE id=?").bind(id).first();
        return json({ category: created }, 201);
      }

      const adminCatMatch = path.match(/^\/api\/admin\/categories\/([\w-]+)$/);
      if (adminCatMatch && (method === "PUT" || method === "DELETE")) {
        if (user.role !== "admin") return json({ error: "forbidden" }, 403);
        const catId = adminCatMatch[1];

        if (method === "PUT") {
          const body = await request.json() as {
            name?: string; slug?: string; icon?: string;
            sort_order?: number; description?: string; parent_id?: string;
          };
          if (body.slug) {
            const dupS = await env.DB.prepare("SELECT id FROM categories WHERE slug=? AND id<>?")
              .bind(body.slug, catId).first();
            if (dupS) return json({ error: "slug_exists" }, 400);
          }
          if (body.name) {
            const dupN = await env.DB.prepare("SELECT id FROM categories WHERE name=? AND id<>?")
              .bind(body.name, catId).first();
            if (dupN) return json({ error: "name_exists" }, 400);
          }
          if (body.parent_id === catId) return json({ error: "parent_cannot_be_self" }, 400);
          await env.DB.prepare(
            `UPDATE categories SET name=COALESCE(?,name), slug=COALESCE(?,slug),
               icon=COALESCE(?,icon), sort_order=COALESCE(?,sort_order),
               description=COALESCE(?,description), parent_id=COALESCE(?,parent_id) WHERE id=?`
          ).bind(body.name, body.slug, body.icon, body.sort_order ?? null, body.description, body.parent_id ?? null, catId).run();
          const updated = await env.DB.prepare("SELECT * FROM categories WHERE id=?").bind(catId).first();
          return json({ category: updated });
        }

        // DELETE — refuse if any app still uses this category
        const countRow = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM app_categories WHERE category_id=?"
        ).bind(catId).first<{ n: number }>();
        const inUse = countRow?.n ?? 0;
        if (inUse > 0) return json({ error: "category_in_use", app_count: inUse }, 400);
        await env.DB.prepare("DELETE FROM categories WHERE id=?").bind(catId).run();
        return json({ deleted: catId });
      }

      // App list (supports category filter by slug(s); expands parent 大类 slugs)
      if (path === "/api/apps" && method === "GET") {
        const category = url.searchParams.get("category");
        const q = url.searchParams.get("q");
        const binds: unknown[] = [];
        let stmt: string;
        if (category) {
          const rawSlugs = category.split(",").map((s) => s.trim()).filter(Boolean);
          const slugs = await expandCategorySlugs(env, rawSlugs);
          const ph = slugs.map(() => "?").join(",");
          stmt =
            `SELECT DISTINCT a.* FROM apps a
             JOIN app_categories ac ON ac.app_id = a.id
             JOIN categories c ON c.id = ac.category_id
             WHERE a.status='published' AND (c.slug IN (${ph}) OR c.id IN (${ph}))`;
          binds.push(...slugs, ...slugs);
        } else {
          stmt = "SELECT a.* FROM apps a WHERE a.status='published'";
        }
        if (q) {
          stmt += " AND (a.title LIKE ? OR a.summary LIKE ?)";
          binds.push(`%${q}%`, `%${q}%`);
        }
        stmt += " ORDER BY a.featured DESC, a.created_at DESC";
        const rows = await env.DB.prepare(stmt).bind(...binds).all();
        return json({
          apps: rows.results.map((a) => filterAppFields(a as Record<string, unknown>, user.tier)),
          user_tier: user.tier,
        });
      }

      // App detail (returns a categories[] array from the join table)
      const appMatch = path.match(/^\/api\/apps\/([\w-]+)$/);
      if (appMatch && method === "GET") {
        const app = await env.DB.prepare(
          "SELECT * FROM apps WHERE slug=? AND status='published'"
        ).bind(appMatch[1]).first<{ id: string }>();
        if (!app) return json({ error: "not_found" }, 404);
        const catRows = await env.DB.prepare(
          `SELECT c.id, c.name, c.slug, c.icon, c.parent_id FROM app_categories ac
             JOIN categories c ON c.id = ac.category_id
             WHERE ac.app_id = ? ORDER BY c.sort_order`
        ).bind(app.id).all();
        const filtered = filterAppFields(app as Record<string, unknown>, user.tier);
        filtered.categories = catRows.results;
        return json({ app: filtered, user_tier: user.tier });
      }

      // Debug: show exact redirect_uri being sent
      if (path === "/api/auth/debug" && method === "GET") {
        const redirectUri = getRedirectUri(env);
        return json({
          redirect_uri: redirectUri,
          note: "Add this EXACTLY to Google Console > Credentials > OAuth Client > Authorized redirect URIs",
          client_id_present: !!env.GOOGLE_CLIENT_ID,
        });
      }

      // Auth: login
      if (path === "/api/auth/login" && method === "GET") {
        const redirectUri = getRedirectUri(env);
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env.GOOGLE_CLIENT_ID}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code` +
          `&scope=openid+email+profile&prompt=consent`;
        return Response.redirect(authUrl, 302);
      }

      // Auth: callback
      if (path === "/api/auth/callback" && method === "GET") {
        const code = url.searchParams.get("code");
        if (!code) return json({ error: "no_code" }, 400);
        const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: getRedirectUri(env), grant_type: "authorization_code",
          }),
        });
        const tokens = await tokenResp.json() as { id_token?: string; error?: string; error_description?: string };
        if (!tokens.id_token) return json({
          error: "token_exchange_failed",
          google_error: tokens.error,
          google_detail: tokens.error_description,
          status: tokenResp.status,
        }, 400);
        const payload = JSON.parse(atob(tokens.id_token.split(".")[1])) as {
          sub: string; email: string; name?: string; picture?: string;
        };
        await env.DB.prepare(
          "INSERT INTO users (google_sub, email, name, avatar_url) VALUES (?,?,?,?) " +
          "ON CONFLICT(google_sub) DO UPDATE SET updated_at=datetime('now')"
        ).bind(payload.sub, payload.email, payload.name, payload.picture).run();
        const dbUser = await env.DB.prepare("SELECT id FROM users WHERE google_sub=?")
          .bind(payload.sub).first<{ id: string }>();
        const token = crypto.randomUUID();
        const expires = new Date(Date.now() + 7 * 864e5).toISOString();
        await env.DB.prepare(
          "INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)"
        ).bind(token, dbUser!.id, expires).run();
        return new Response(null, {
          status: 302,
          headers: {
            "set-cookie": `session=${token}; HttpOnly; Secure; Path=/; Max-Age=604800`,
            location: "/dashboard",
          },
        });
      }

      // Auth: logout
      if (path === "/api/auth/logout" && method === "POST") {
        const cookie = request.headers.get("cookie") || "";
        const token = cookie.match(/session=([^;]+)/)?.[1];
        if (token) await env.DB.prepare("DELETE FROM sessions WHERE token=?").bind(token).run();
        return new Response(null, {
          status: 302,
          headers: {
            "set-cookie": "session=; HttpOnly; Secure; Path=/; Max-Age=0",
            location: "/",
          },
        });
      }

      // Current user
      if (path === "/api/me" && method === "GET") {
        return json({ user: user.tier > 0 ? { email: user.email, tier: user.tier, role: user.role } : null });
      }

      return json({ error: "not_found", path }, 404);
    } catch (err) {
      return json({ error: "server_error", message: String(err) }, 500);
    }
  },
};
