-- Per-listing waitlist (purchase stand-in) so downloads can be gated
ALTER TABLE waitlist ADD COLUMN user_id TEXT;
ALTER TABLE waitlist ADD COLUMN app_slug TEXT;
DROP INDEX IF EXISTS idx_waitlist_email;
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email_app ON waitlist(email, ifnull(app_slug, ''));
