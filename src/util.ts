/** Shared types and helpers for ai4sci Workers API */

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  STATIC: Fetcher;
  SITE_NAME: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
}

export type AccessTier = 0 | 1 | 2;

export interface SessionUser {
  userId: string;
  email: string;
  tier: AccessTier;
  role: string;
}

const JSON_TYPE = { "content-type": "application/json" };

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...JSON_TYPE, "Access-Control-Allow-Origin": "*" },
  });
}

export async function getUser(request: Request, env: Env): Promise<SessionUser> {
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.match(/session=([^;]+)/)?.[1];
  if (!token) return { userId: "", email: "", tier: 0, role: "guest" };
  const row = await env.DB.prepare(
    "SELECT u.id, u.email, u.access_tier, u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND s.expires_at > datetime('now')"
  ).bind(token).first<{ id: string; email: string; access_tier: number; role: string }>();
  if (!row) return { userId: "", email: "", tier: 0, role: "guest" };
  return { userId: row.id, email: row.email, tier: row.access_tier as AccessTier, role: row.role || "user" };
}

export function filterAppFields(app: Record<string, unknown>, tier: AccessTier) {
  const base: Record<string, unknown> = {
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
