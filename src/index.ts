/**
 * ai4sci.app — Cloudflare Workers API
 * Tiered access: guest (L1) → gmail login (L2) → paid (L3)
 */

export interface Env {
  DB: D1Database;
  ASSETS: R2Bucket;
  SITE_NAME: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SESSION_SECRET: string;
}

type AccessTier = 0 | 1 | 2;

interface SessionUser {
  userId: string;
  email: string;
  tier: AccessTier;
}

const JSON_TYPE = { "content-type": "application/json" };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...JSON_TYPE, "Access-Control-Allow-Origin": "*" },
  });
}

async function getUser(request: Request, env: Env): Promise<SessionUser> {
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.match(/session=([^;]+)/)?.[1];
  if (!token) return { userId: "", email: "", tier: 0 };
  const row = await env.DB.prepare(
    "SELECT u.id, u.email, u.access_tier FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND s.expires_at > datetime('now')"
  ).bind(token).first<{ id: string; email: string; access_tier: number }>();
  if (!row) return { userId: "", email: "", tier: 0 };
  return { userId: row.id, email: row.email, tier: row.access_tier as AccessTier };
}

/** Strip paid-only fields if user tier is insufficient */
function filterAppFields(app: Record<string, unknown>, tier: AccessTier) {
  const base = {
    id: app.id, slug: app.slug, title: app.title, subtitle: app.subtitle,
    summary: app.summary, category_id: app.category_id, cover_r2_key: app.cover_r2_key,
    featured: app.featured,
  };
  if (tier >= 1) {
    Object.assign(base, {
      description: app.description, tech_stack: app.tech_stack, demo_url: app.demo_url,
    });
  }
  if (tier >= 2) {
    Object.assign(base, {
      deep_info: app.deep_info, repo_url: app.repo_url, dataset_url: app.dataset_url,
      report_url: app.report_url,
    });
  }
  return base;
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const user = await getUser(request, env);
  const method = request.method;

  // --- Categories ---
  if (path === "/api/categories" && method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT * FROM categories ORDER BY sort_order"
    ).all();
    return json({ categories: rows.results });
  }

  // --- App list (public, guest can see summaries) ---
  if (path === "/api/apps" && method === "GET") {
    const category = url.searchParams.get("category");
    const q = url.searchParams.get("q");
    let stmt = "SELECT * FROM apps WHERE status='published'";
    const binds: unknown[] = [];
    if (category) { stmt += " AND category_id=?"; binds.push(category); }
    if (q) { stmt += " AND (title LIKE ? OR summary LIKE ?)"; binds.push(`%${q}%`, `%${q}%`); }
    stmt += " ORDER BY featured DESC, created_at DESC";
    const rows = await env.DB.prepare(stmt).bind(...binds).all();
    return json({
      apps: rows.results.map((a) => filterAppFields(a as Record<string, unknown>, user.tier)),
      user_tier: user.tier,
    });
  }

  // --- App detail (tiered) ---
  const appMatch = path.match(/^\/api\/apps\/([\w-]+)$/);
  if (appMatch && method === "GET") {
    const slug = appMatch[1];
    const app = await env.DB.prepare(
      "SELECT * FROM apps WHERE slug=? AND status='published'"
    ).bind(slug).first();
    if (!app) return json({ error: "not_found" }, 404);
    return json({
      app: filterAppFields(app as Record<string, unknown>, user.tier),
      user_tier: user.tier,
    });
  }

  // --- Auth: Google OAuth login ---
  if (path === "/api/auth/login" && method === "GET") {
    const redirectUri = `${url.origin}/api/auth/callback`;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${env.GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code&scope=openid+email+profile&prompt=consent`;
    return Response.redirect(authUrl, 302);
  }

  // --- Auth: OAuth callback ---
  if (path === "/api/auth/callback" && method === "GET") {
    const code = url.searchParams.get("code");
    if (!code) return json({ error: "no_code" }, 400);
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${url.origin}/api/auth/callback`,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenResp.json() as { id_token?: string };
    if (!tokens.id_token) return json({ error: "token_exchange_failed" }, 400);
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

  // --- Auth: logout ---
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

  // --- Current user ---
  if (path === "/api/me" && method === "GET") {
    return json({ user: user.tier > 0 ? { email: user.email, tier: user.tier } : null });
  }

  return json({ error: "not_found", path }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleApi(request, env);
    } catch (err) {
      return json({ error: "server_error", message: String(err) }, 500);
    }
  },
};
