/** Shared types and helpers for ai4sci Workers API */

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  STATIC: Fetcher;
  SITE_NAME: string;
  ENVIRONMENT?: string;
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

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...JSON_TYPE, "Access-Control-Allow-Origin": "*", ...extraHeaders },
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

export function isAdmin(user: SessionUser): boolean {
  return user.role === "admin";
}

/** Strip raw file URLs from client-facing app payloads.
 *  demo_url / dataset_url are never returned — serve via Worker download paths. */
export function filterAppFields(app: Record<string, unknown>, tier: AccessTier) {
  const base: Record<string, unknown> = {
    id: app.id, slug: app.slug, title: app.title, subtitle: app.subtitle,
    summary: app.summary, category_id: app.category_id, cover_r2_key: app.cover_r2_key,
    featured: app.featured,
  };
  if (tier >= 1) {
    Object.assign(base, {
      description: app.description, tech_stack: app.tech_stack,
    });
  }
  if (tier >= 2) {
    Object.assign(base, {
      deep_info: app.deep_info, repo_url: app.repo_url, report_url: app.report_url,
    });
  }
  return base;
}

/** True when the stored ref looks like a downloadable file (R2 key or http URL). */
export function hasFileRef(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  return v.startsWith("r2:") || /^https?:\/\//i.test(v);
}

/** Check whether the logged-in user has joined the waitlist for a listing. */
export async function hasJoinedListingWaitlist(
  env: Env, user: SessionUser, appSlug: string
): Promise<boolean> {
  if (!user.userId || !appSlug) return false;
  const row = await env.DB.prepare(
    "SELECT 1 AS ok FROM waitlist WHERE user_id=? AND app_slug=? LIMIT 1"
  ).bind(user.userId, appSlug).first();
  return !!row;
}

/**
 * Resolve a stored demo_url / dataset_url into either an R2 object key or an
 * upstream http(s) URL that the Worker will fetch server-side.
 * Never expose the resolved URL to clients.
 */
export function resolveFileSource(stored: string): { kind: "r2"; key: string } | { kind: "http"; url: string } | null {
  const v = stored.trim();
  if (!v) return null;
  if (v.startsWith("r2:")) {
    const key = v.slice(3).replace(/^\/+/, "");
    return key ? { kind: "r2", key } : null;
  }
  // Prefer binding for known public r2.dev / R2 public URLs under listings/
  const r2Dev = v.match(/^https?:\/\/[^/]+\.r2\.dev\/(.+)$/i);
  if (r2Dev?.[1]) {
    return { kind: "r2", key: decodeURIComponent(r2Dev[1]) };
  }
  if (/^https?:\/\//i.test(v)) {
    return { kind: "http", url: v };
  }
  // Bare key fallback (e.g. listings/wcm/wcm-website.zip)
  if (!v.includes("://") && v.includes("/")) {
    return { kind: "r2", key: v.replace(/^\/+/, "") };
  }
  return null;
}

function filenameFromKeyOrUrl(ref: string, fallback: string): string {
  try {
    const path = ref.includes("://") ? new URL(ref).pathname : ref.replace(/^r2:/, "");
    const base = path.split("/").filter(Boolean).pop();
    return base || fallback;
  } catch {
    return fallback;
  }
}

function attachmentHeaders(filename: string, contentType?: string | null, contentLength?: string | null): Headers {
  const h = new Headers();
  h.set("content-disposition", `attachment; filename="${filename}"`);
  h.set("cache-control", "private, no-store");
  h.set("content-type", contentType || "application/octet-stream");
  if (contentLength) h.set("content-length", contentLength);
  return h;
}

/** Stream a listing file from R2 (preferred) or server-side HTTP fetch. Never 302. */
export async function streamListingFile(
  env: Env, stored: string, downloadName: string
): Promise<Response> {
  const raw = stored.trim();
  const source = resolveFileSource(raw);
  if (!source) return json({ error: "file_not_found" }, 404);

  const filename = filenameFromKeyOrUrl(
    source.kind === "r2" ? source.key : source.url,
    downloadName
  );

  // Prefer R2 binding whenever we have a key (incl. keys extracted from r2.dev URLs)
  if (source.kind === "r2") {
    const obj = await env.BUCKET.get(source.key);
    if (obj) {
      return new Response(obj.body, {
        status: 200,
        headers: attachmentHeaders(
          filename,
          obj.httpMetadata?.contentType,
          obj.size != null ? String(obj.size) : null
        ),
      });
    }
    // If the DB still has a public http(s) URL, fall back to server-side fetch
    if (/^https?:\/\//i.test(raw)) {
      const upstream = await fetch(raw);
      if (!upstream.ok || !upstream.body) {
        return json({ error: "upstream_fetch_failed", status: upstream.status }, 502);
      }
      return new Response(upstream.body, {
        status: 200,
        headers: attachmentHeaders(
          filename,
          upstream.headers.get("content-type"),
          upstream.headers.get("content-length")
        ),
      });
    }
    return json({ error: "file_not_found" }, 404);
  }

  const upstream = await fetch(source.url);
  if (!upstream.ok || !upstream.body) {
    return json({ error: "upstream_fetch_failed", status: upstream.status }, 502);
  }
  return new Response(upstream.body, {
    status: 200,
    headers: attachmentHeaders(
      filename,
      upstream.headers.get("content-type"),
      upstream.headers.get("content-length")
    ),
  });
}
