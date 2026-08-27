-- Waiting list for Pro+ early access
CREATE TABLE IF NOT EXISTS waitlist (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email        TEXT NOT NULL,
  source       TEXT,              -- which page/button they signed up from
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
