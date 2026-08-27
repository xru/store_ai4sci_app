-- ai4sci.app D1 schema — tiered access model
-- Access tiers: guest=0, gmail=1, paid=2

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  google_sub    TEXT UNIQUE,
  email         TEXT NOT NULL,
  name          TEXT,
  avatar_url    TEXT,
  access_tier   INTEGER NOT NULL DEFAULT 1,  -- 1=login, 2=paid
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id       TEXT NOT NULL REFERENCES users(id),
  stripe_customer_id  TEXT,
  stripe_sub_id       TEXT,
  status        TEXT NOT NULL DEFAULT 'active',  -- active|past_due|canceled
  current_period_end   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  icon          TEXT,
  sort_order    INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS apps (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug          TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  subtitle      TEXT,
  category_id   TEXT REFERENCES categories(id),
  summary       TEXT NOT NULL,
  description   TEXT NOT NULL,
  deep_info     TEXT,
  tech_stack    TEXT,
  demo_url      TEXT,
  repo_url      TEXT,
  dataset_url   TEXT,
  report_url    TEXT,
  cover_r2_key  TEXT,
  featured      INTEGER DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_screenshots (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  app_id        TEXT NOT NULL REFERENCES apps(id),
  r2_key        TEXT NOT NULL,
  sort_order    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token         TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_apps_slug ON apps(slug);
CREATE INDEX IF NOT EXISTS idx_apps_category ON apps(category_id);
CREATE INDEX IF NOT EXISTS idx_apps_featured ON apps(featured);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
