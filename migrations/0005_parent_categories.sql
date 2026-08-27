-- 0005_parent_categories.sql
-- Two-level taxonomy: 大类 (parent) → 主类/小类 (children)
--
-- categories.parent_id links a category to its parent. NULL = top-level (大类).
-- This lets /admin attach new 小类 under an existing 大类 without any further
-- schema changes. Existing flat categories are unaffected (parent_id defaults NULL).

ALTER TABLE categories ADD COLUMN parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL;

-- Optional: speed up "children of X" lookups
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
