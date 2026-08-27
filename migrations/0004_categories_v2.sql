-- 0004_categories_v2.sql
-- Multi-category support + category management (fused from reference projects)
--
-- What changes:
--   1. categories.description       — aligns with the Flask Category model (SEO/blurb)
--   2. users.role                   — 'user' | 'admin' for gating category management
--   3. app_categories               — many-to-many join table, the SINGLE source of
--                                     truth for which apps belong to which categories
--   4. backfill                     — migrate every app's legacy single category_id into
--                                     the join table (idempotent via INSERT OR IGNORE)
--   5. app_submissions.category_ids — store a JSON array so submissions can request
--                                     multiple categories; applied to the join table on
--                                     admin approval
--
-- Note: apps.category_id is RETAINED but DEPRECATED — read queries no longer use it for
-- filtering. It is kept (nullable) to avoid a destructive change this round.

-- 1) categories: add a description column
ALTER TABLE categories ADD COLUMN description TEXT;

-- 2) users: add a role column for admin authorization
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- 3) submissions: allow storing multiple requested categories as a JSON array
ALTER TABLE app_submissions ADD COLUMN category_ids TEXT;

-- 4) join table — single source of truth for app <-> category
CREATE TABLE IF NOT EXISTS app_categories (
  app_id       TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  category_id  TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (app_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_app_categories_cat ON app_categories(category_id);

-- 5) backfill legacy single-category assignments into the join table
INSERT OR IGNORE INTO app_categories (app_id, category_id)
  SELECT id, category_id FROM apps WHERE category_id IS NOT NULL;
