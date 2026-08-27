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
-- Sample apps (one per 主类)
-- ════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO apps (id, slug, title, subtitle, category_id, summary, description, deep_info, tech_stack, demo_url, repo_url, featured, status) VALUES
  ('app-1','deploykit','DeployKit','网站建好后的零配置一键部署',
   'cat-deploy',
   '把你的网站一键部署到 Cloudflare，零配置上线。',
   'DeployKit 自动检测项目类型（React、Vue、纯静态），生成部署配置，一键推送到 Cloudflare Pages / Workers。附带自定义域名绑定、HTTPS 自动配置和部署状态实时监控。',
   '进阶部署模板（多环境、CI/CD、缓存策略）、自定义 Worker 脚本、CDN 配置指南，以及常见框架的完整适配教程。',
   'Node.js, Wrangler, Cloudflare Pages', 'https://demo.ai4sci.app/deploykit',
   '[PAID: github.com/example/deploykit]', 1, 'published'),

  ('app-2','nlp-skill-picker','NLP Skill Picker','按任务场景推荐 NLP 技能组合',
   'cat-nlp',
   '输入你的工作任务，自动推荐最合适的 NLP 技能（Skill）组合。',
   'NLP Skill Picker 内置文本分类、摘要、翻译、问答、实体抽取等技能库。根据你的具体场景（客服、写作、数据分析）智能匹配最佳 Skill 组合，附调用示例和成本估算。',
   '完整 Skill 目录、技能组合模板、批量调用脚本、性能基准对比，以及各模型 API 接入文档。',
   'Python, Transformers, LangChain', 'https://demo.ai4sci.app/nlp-skill-picker',
   '[PAID: github.com/example/nlp-skill-picker]', 0, 'published'),

  ('app-3','rl-gym-trainer','RL-Gym Trainer','强化学习 MVP 原型训练环境',
   'cat-rl',
   '快速搭建强化学习实验，从 DQN 到 PPO 一键跑通 MVP 原型。',
   'RL-Gym Trainer 封装了主流强化学习算法，提供标准 Gymnasium 接口、可视化训练曲线和自动超参搜索。适合研究生快速验证 RL 论文思路，不需要从零搭环境。',
   '完整训练 notebook、预训练模型权重、基准数据集、自动调参脚本，以及云端 GPU 训练接入文档。',
   'Python, PyTorch, Gymnasium', 'https://demo.ai4sci.app/rl-gym-trainer',
   '[PAID: github.com/example/rl-gym-trainer]', 0, 'published');

-- App ↔ Category relationships (join table — single source of truth)
INSERT OR IGNORE INTO app_categories (app_id, category_id) VALUES
  ('app-1', 'cat-deploy'),
  ('app-2', 'cat-nlp'),
  ('app-3', 'cat-rl');
