-- Per-listing waitlist join (purchase stand-in for download unlock)
-- Adds user_id + app_slug; unique per (email, app_slug) so pricing joins
-- (no app_slug) and listing joins can coexist for the same email.

ALTER TABLE waitlist ADD COLUMN user_id TEXT;
ALTER TABLE waitlist ADD COLUMN app_slug TEXT;

DROP INDEX IF EXISTS idx_waitlist_email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email_app
  ON waitlist(email, ifnull(app_slug, ''));

CREATE INDEX IF NOT EXISTS idx_waitlist_user_app
  ON waitlist(user_id, app_slug);
