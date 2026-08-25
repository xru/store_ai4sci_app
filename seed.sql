-- Seed categories for AI for Science
INSERT OR IGNORE INTO categories (id, name, slug, icon, sort_order) VALUES
  ('cat-bio',  'Bioinformatics',    'bioinformatics',  '🧬', 1),
  ('cat-chem', 'Chemistry',         'chemistry',       '⚗️', 2),
  ('cat-phys', 'Physics Simulation','physics',         '🔬', 3),
  ('cat-climate','Climate Modeling','climate',         '🌍', 4),
  ('cat-materials','Materials Science','materials',    '🧱', 5),
  ('cat-data', 'Data Analysis',     'data-analysis',   '📊', 6),
  ('cat-nlp',  'Literature & NLP',  'literature-nlp',  '📚', 7);

-- Seed sample apps
INSERT OR IGNORE INTO apps (id, slug, title, subtitle, category_id, summary, description, deep_info, tech_stack, demo_url, repo_url, featured, status) VALUES
  ('app-1','protein-fold-ai','ProteinFold AI','AlphaFold-powered structure prediction',
   'cat-bio',
   'Predict 3D protein structures from amino acid sequences using AI.',
   'ProteinFold AI wraps state-of-the-art folding models with an interactive viewer. Supports batch prediction, confidence scoring (pLDDT), and export to PDB.',
   'Full notebook with model weights download, reproducibility script, benchmark dataset, and API docs for programmatic access.',
   'Python, PyTorch, Cloudflare Workers API', 'https://demo.ai4sci.app/protein-fold',
   '[PAID: github.com/example/protein-fold-ai]', 1, 'published'),

  ('app-2','mol-design-lab','MolDesign Lab','Generative molecular design',
   'cat-chem',
   'Generate novel molecular structures with desired chemical properties.',
   'MolDesign Lab uses diffusion models to propose drug-like molecules under property constraints (solubility, toxicity, binding affinity).',
   'Source code, training pipeline, dataset preparation scripts, and evaluation metrics included.',
   'Python, RDKit, DiffSBDD', 'https://demo.ai4sci.app/mol-design',
   '[PAID: github.com/example/mol-design]', 0, 'published'),

  ('app-3','climate-sim-lite','ClimateSim Lite','Regional climate modeling',
   'cat-climate',
   'Run lightweight regional climate simulations in the browser.',
   'ClimateSim Lite provides accessible climate scenario modeling with adjustable parameters for temperature, precipitation, and emission pathways.',
   'Full simulation engine, comparison tools, historical validation datasets, and publication-ready export.',
   'JavaScript, WebGL, Workers AI', 'https://demo.ai4sci.app/climate-sim',
   '[PAID: github.com/example/climate-sim]', 0, 'published');
