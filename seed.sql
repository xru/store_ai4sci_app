-- ════════════════════════════════════════════════════════════
-- Seed data — two-level taxonomy (大类 → 主类 → future 小类)
-- 大类 order: 1=小白  2=打工人  3=研究生
-- ════════════════════════════════════════════════════════════

-- 3 大类 (top-level parent categories; parent_id = NULL)
INSERT OR IGNORE INTO categories (id, name, slug, icon, sort_order, parent_id, description) VALUES
  ('cat-newbie', '小白',    'beginners',      '🌱', 1, NULL, '面向新手的上手与部署教程——零基础也能把网站上线。'),
  ('cat-worker', '打工人',  'professionals',  '💼', 2, NULL, '面向职场人的 AI 效率工具——选对 Skill，事半功倍。'),
  ('cat-grad',   '研究生',  'grad-students',  '📚', 3, NULL, '面向研究生的 AI 原型研发工具集——从想法到 MVP 原型快速验证。');

-- 主类 (main child categories, one per 大类; parent_id points to the 大类)
INSERT OR IGNORE INTO categories (id, name, slug, icon, sort_order, parent_id, description) VALUES
  ('cat-deploy', '网站部署',     'web-deployment',         '🚀', 1, 'cat-newbie', '侧重网站建好后如何部署上线：零配置一键发布到 Cloudflare。'),
  ('cat-nlp',    '自然语言处理', 'nlp',                    '💬', 1, 'cat-worker', '侧重 SKILL 的选择与组合：文本分类、摘要、翻译、问答技能库。'),
  ('cat-rl',     '强化学习',     'reinforcement-learning', '🎮', 1, 'cat-grad',   '侧重 MVP 原型的研发与训练：DQN、PPO 等算法一站式实验环境。');

-- ════════════════════════════════════════════════════════════
-- Sample apps (one per 主类) — English content is the DB source of truth;
-- Chinese equivalents are overlaid client-side via the APP_ZH map (by slug).
-- ════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO apps (id, slug, title, subtitle, category_id, summary, description, deep_info, tech_stack, demo_url, repo_url, featured, status) VALUES
  ('app-1','deploykit','DeployKit','Zero-config one-click deployment after your site is built',
   'cat-deploy',
   'Deploy your website to Cloudflare with one click — zero config.',
   'DeployKit auto-detects your project type (React, Vue, plain static), generates deploy config, and pushes to Cloudflare Pages / Workers in one click. Bundles custom domain binding, automatic HTTPS, and real-time deploy status monitoring.',
   'Advanced deploy templates (multi-environment, CI/CD, caching strategy), custom Worker scripts, CDN config guide, and full adapter tutorials for common frameworks.',
   'Node.js, Wrangler, Cloudflare Pages', 'https://demo.ai4sci.app/deploykit',
   '[PAID: github.com/example/deploykit]', 1, 'published'),

  ('app-2','nlp-skill-picker','NLP Skill Picker','Recommends NLP skill combos by task scenario',
   'cat-nlp',
   'Enter your work task and get the best-fit NLP skill (Skill) combination.',
   'NLP Skill Picker ships a skill library for text classification, summarization, translation, QA, and entity extraction. It smart-matches the best Skill combo for your scenario (customer service, writing, data analysis) with call examples and cost estimates.',
   'Full skill catalog, skill-combo templates, batch-call scripts, performance benchmarks, and API integration docs for each model.',
   'Python, Transformers, LangChain', 'https://demo.ai4sci.app/nlp-skill-picker',
   '[PAID: github.com/example/nlp-skill-picker]', 0, 'published'),

  ('app-3','rl-gym-trainer','RL-Gym Trainer','Reinforcement-learning MVP training sandbox',
   'cat-rl',
   'Spin up reinforcement-learning experiments fast — run DQN to PPO in one click.',
   'RL-Gym Trainer wraps mainstream RL algorithms with a standard Gymnasium interface, visualized training curves, and automatic hyperparameter search. Great for grad students validating RL paper ideas without building an environment from scratch.',
   'Full training notebooks, pretrained model weights, benchmark datasets, auto-tuning scripts, and cloud GPU training integration docs.',
   'Python, PyTorch, Gymnasium', 'https://demo.ai4sci.app/rl-gym-trainer',
   '[PAID: github.com/example/rl-gym-trainer]', 0, 'published');

-- App ↔ Category relationships (join table — single source of truth)
INSERT OR IGNORE INTO app_categories (app_id, category_id) VALUES
  ('app-1', 'cat-deploy'),
  ('app-2', 'cat-nlp'),
  ('app-3', 'cat-rl');
