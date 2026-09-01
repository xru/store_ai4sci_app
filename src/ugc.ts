/**
 * UGC submission + admin review + waitlist endpoints
 */

import { json, getUser, Env, SessionUser } from "./util";

/** Resolve the requested category ids into a clean array, accepting both the new
 *  category_ids array and the legacy single category_id. */
function resolveCategoryIds(body: { category_id?: string; category_ids?: string[] }): string[] {
  if (Array.isArray(body.category_ids) && body.category_ids.length) {
    return body.category_ids.filter(Boolean);
  }
  if (body.category_id) return [body.category_id];
  return [];
}

export async function handleUgc(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // --- Submit a new app (requires login) ---
  if (path === "/api/submit" && method === "POST") {
    const user = await getUser(request, env);
    if (user.tier < 1) return json({ error: "login_required" }, 401);
    const body = await request.json() as {
      title: string; slug: string; summary: string; description: string;
      category_id?: string; category_ids?: string[];
      subtitle?: string; deep_info?: string;
      tech_stack?: string; demo_url?: string; repo_url?: string;
      dataset_url?: string; report_url?: string;
    };
    const catIds = resolveCategoryIds(body);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO app_submissions
        (id, slug, title, subtitle, category_id, category_ids, summary, description, deep_info,
         tech_stack, demo_url, repo_url, dataset_url, report_url, submitter_id, submitter_email)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, body.slug, body.title, body.subtitle, catIds[0] ?? null, JSON.stringify(catIds),
      body.summary, body.description, body.deep_info, body.tech_stack,
      body.demo_url, body.repo_url, body.dataset_url, body.report_url,
      user.userId, user.email).run();
    return json({ id, status: "pending" }, 201);
  }

  // --- List my submissions (requires login) ---
  if (path === "/api/my-submissions" && method === "GET") {
    const user = await getUser(request, env);
    if (user.tier < 1) return json({ error: "login_required" }, 401);
    const rows = await env.DB.prepare(
      "SELECT * FROM app_submissions WHERE submitter_id=? ORDER BY created_at DESC"
    ).bind(user.userId).all();
    return json({ submissions: rows.results });
  }

  // --- Admin: list pending submissions ---
  if (path === "/api/admin/submissions" && method === "GET") {
    const user = await getUser(request, env);
    if (!isAdmin(user)) return json({ error: "forbidden" }, 403);
    const rows = await env.DB.prepare(
      "SELECT * FROM app_submissions WHERE status='pending' ORDER BY created_at DESC"
    ).all();
    return json({ submissions: rows.results });
  }

  // --- Admin: approve/reject submission ---
  const reviewMatch = path.match(/^\/api\/admin\/submissions\/([\w-]+)\/(approve|reject)$/);
  if (reviewMatch && method === "POST") {
    const user = await getUser(request, env);
    if (!isAdmin(user)) return json({ error: "forbidden" }, 403);
    const [, subId, action] = reviewMatch;
    if (action === "approve") {
      const sub = await env.DB.prepare("SELECT * FROM app_submissions WHERE id=?")
        .bind(subId).first<{
          slug: string; title: string; subtitle: string | null;
          category_id: string | null; category_ids: string | null;
          summary: string; description: string; deep_info: string | null;
          tech_stack: string | null; demo_url: string | null; repo_url: string | null;
          dataset_url: string | null; report_url: string | null;
        }>();
      if (!sub) return json({ error: "not_found" }, 404);
      await env.DB.prepare(
        `INSERT INTO apps (slug, title, subtitle, category_id, summary, description, deep_info,
           tech_stack, demo_url, repo_url, dataset_url, report_url, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'published')`
      ).bind(sub.slug, sub.title, sub.subtitle, sub.category_id, sub.summary,
        sub.description, sub.deep_info, sub.tech_stack, sub.demo_url,
        sub.repo_url, sub.dataset_url, sub.report_url).run();
      // attach categories via the join table (multi-category)
      const newApp = await env.DB.prepare("SELECT id FROM apps WHERE slug=?")
        .bind(sub.slug).first<{ id: string }>();
      if (newApp) {
        let catIds: string[] = [];
        try { catIds = sub.category_ids ? JSON.parse(sub.category_ids) : []; } catch { catIds = []; }
        if (!catIds.length && sub.category_id) catIds = [sub.category_id];
        for (const cid of catIds) {
          await env.DB.prepare(
            "INSERT OR IGNORE INTO app_categories (app_id, category_id) VALUES (?,?)"
          ).bind(newApp.id, cid).run();
        }
      }
      await env.DB.prepare(
        "UPDATE app_submissions SET status='published', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?"
      ).bind(user.userId, subId).run();
    } else {
      const body = await request.json() as { reason?: string };
      await env.DB.prepare(
        "UPDATE app_submissions SET status='rejected', reviewer_notes=?, reviewed_by=?, reviewed_at=datetime('now') WHERE id=?"
      ).bind(body.reason, user.userId, subId).run();
    }
    return json({ status: action === "approve" ? "published" : "rejected" });
  }

  // --- Waitlist: join Pro+ list, or a per-listing list that unlocks downloads ---
  if (path === "/api/waitlist" && method === "POST") {
    const user = await getUser(request, env);
    const body = await request.json() as { email?: string; source?: string; app_slug?: string };
    const appSlug = (body.app_slug || "").trim() || null;
    if (appSlug && user.tier < 1) return json({ error: "login_required" }, 401);
    const email = (user.email || body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return json({ error: "invalid_email" }, 400);
    try {
      await env.DB.prepare(
        "INSERT INTO waitlist (email, source, user_id, app_slug) VALUES (?, ?, ?, ?)"
      ).bind(email, body.source || "pricing", user.userId || null, appSlug).run();
    } catch {
      return json({ ok: true, message: "already_on_waitlist", joined_waitlist: true });
    }
    return json({ ok: true, message: "joined", joined_waitlist: true }, 201);
  }

  // --- Reviews: list + post ---
  const reviewMatch2 = path.match(/^\/api\/apps\/([\w-]+)\/reviews$/);
  if (reviewMatch2) {
    const appSlug = reviewMatch2[1];
    if (method === "GET") {
      const rows = await env.DB.prepare(
        `SELECT r.*, u.email FROM app_reviews r JOIN users u ON r.user_id=u.id
         JOIN apps a ON r.app_id=a.id WHERE a.slug=? ORDER BY r.created_at DESC`
      ).bind(appSlug).all();
      return json({ reviews: rows.results });
    }
    if (method === "POST") {
      const user = await getUser(request, env);
      if (user.tier < 1) return json({ error: "login_required" }, 401);
      const body = await request.json() as { rating: number; comment?: string };
      const app = await env.DB.prepare("SELECT id FROM apps WHERE slug=?").bind(appSlug).first();
      if (!app) return json({ error: "not_found" }, 404);
      await env.DB.prepare(
        "INSERT INTO app_reviews (app_id, user_id, rating, comment) VALUES (?,?,?,?)"
      ).bind(app.id, user.userId, body.rating, body.comment).run();
      return json({ status: "reviewed" }, 201);
    }
  }

  return json({ error: "not_found", path }, 404);
}

/** Admin gate: based on the users.role column ('admin'). */
function isAdmin(user: SessionUser): boolean {
  return user.role === "admin";
}
