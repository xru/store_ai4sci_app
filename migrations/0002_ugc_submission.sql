-- UGC app submission workflow
-- Users submit apps → admin reviews → published/rejected

CREATE TABLE IF NOT EXISTS app_submissions (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug            TEXT NOT NULL,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  category_id     TEXT REFERENCES categories(id),
  summary         TEXT NOT NULL,
  description     TEXT NOT NULL,
  deep_info       TEXT,
  tech_stack      TEXT,
  demo_url        TEXT,
  repo_url        TEXT,
  dataset_url     TEXT,
  report_url      TEXT,
  submitter_id    TEXT NOT NULL REFERENCES users(id),
  submitter_email TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  reviewer_notes  TEXT,
  reviewed_by     TEXT,
  reviewed_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_reviews (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  app_id          TEXT NOT NULL REFERENCES apps(id),
  user_id         TEXT REFERENCES users(id),
  rating          INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  comment         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON app_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON app_submissions(submitter_id);
CREATE INDEX IF NOT EXISTS idx_reviews_app ON app_reviews(app_id);
