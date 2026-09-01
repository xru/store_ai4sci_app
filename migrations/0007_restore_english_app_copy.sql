-- Restore the canonical English catalog copy for the initial sample apps.
-- The seed file uses INSERT OR IGNORE, so existing rows created by an older
-- Chinese seed are not changed by re-running the seed.

UPDATE apps
SET subtitle = 'Zero-config one-click deployment after your site is built',
    summary = 'Deploy your website to Cloudflare with one click — zero config.',
    description = 'DeployKit auto-detects your project type (React, Vue, plain static), generates deploy config, and pushes to Cloudflare Pages / Workers in one click. Bundles custom domain binding, automatic HTTPS, and real-time deploy status monitoring.',
    deep_info = 'Advanced deploy templates (multi-environment, CI/CD, caching strategy), custom Worker scripts, CDN config guide, and full adapter tutorials for common frameworks.'
WHERE slug = 'deploykit';

UPDATE apps
SET subtitle = 'Recommends NLP skill combos by task scenario',
    summary = 'Enter your work task and get the best-fit NLP skill (Skill) combination.',
    description = 'NLP Skill Picker ships a skill library for text classification, summarization, translation, QA, and entity extraction. It smart-matches the best Skill combo for your scenario (customer service, writing, data analysis) with call examples and cost estimates.',
    deep_info = 'Full skill catalog, skill-combo templates, batch-call scripts, performance benchmarks, and API integration docs for each model.'
WHERE slug = 'nlp-skill-picker';

UPDATE apps
SET subtitle = 'Reinforcement-learning MVP training sandbox',
    summary = 'Spin up reinforcement-learning experiments fast — run DQN to PPO in one click.',
    description = 'RL-Gym Trainer wraps mainstream RL algorithms with a standard Gymnasium interface, visualized training curves, and automatic hyperparameter search. Great for grad students validating RL paper ideas without building an environment from scratch.',
    deep_info = 'Full training notebooks, pretrained model weights, benchmark datasets, auto-tuning scripts, and cloud GPU training integration docs.'
WHERE slug = 'rl-gym-trainer';
