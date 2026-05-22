-- MetalLens tables — run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS metal_articles (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at       timestamptz DEFAULT now(),
  published_at     timestamptz DEFAULT now(),
  title            text        NOT NULL,
  summary          text,
  summary_zh       text,
  source_name      text,
  original_url     text,
  category         text,        -- gold | silver | oil | macro | ai
  importance_score numeric      DEFAULT 7,
  tags             text[]       DEFAULT '{}',
  is_pro           boolean      DEFAULT false,
  editor_note      text
);

CREATE TABLE IF NOT EXISTS metal_pulses (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at       timestamptz DEFAULT now(),
  sentiment        text        DEFAULT 'neutral',  -- bullish | bearish | neutral | mixed
  sentiment_score  numeric     DEFAULT 0,          -- -100 to 100
  article_count    integer     DEFAULT 0,
  summary_en       text,
  key_themes       text[]      DEFAULT '{}'
);

ALTER TABLE metal_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON metal_articles FOR SELECT USING (true);

ALTER TABLE metal_pulses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON metal_pulses FOR SELECT USING (true);

-- Sample data
INSERT INTO metal_pulses (sentiment, sentiment_score, article_count, summary_en, key_themes)
VALUES (
  'bullish', 38, 22,
  'Gold rallies on Fed rate cut expectations and safe-haven demand amid geopolitical tensions. Silver follows. Oil steady on OPEC+ production discipline.',
  ARRAY['XAU', 'Fed policy', 'safe-haven', 'OPEC+']
);

INSERT INTO metal_articles (title, summary, source_name, original_url, category, importance_score, tags)
VALUES
  ('Gold Hits $2,400 on Fed Rate Cut Bets',
   'Gold surged to $2,400/oz as traders priced in earlier Fed rate cuts following softer CPI data.',
   'Reuters', 'https://reuters.com', 'gold', 9, ARRAY['XAU', 'Fed', 'rate-cut']),
  ('Silver Outperforms on Industrial Demand Surge',
   'Silver gained 4% this week, driven by solar panel manufacturing demand and gold''s rally.',
   'Bloomberg', 'https://bloomberg.com', 'silver', 8, ARRAY['XAG', 'solar', 'industrial']),
  ('OPEC+ Extends Output Cuts Through Q3',
   'OPEC+ agrees to maintain production discipline, supporting Brent crude above $85/barrel.',
   'FT', 'https://ft.com', 'oil', 8, ARRAY['oil', 'OPEC', 'supply']),
  ('Central Banks Add Record Gold Reserves',
   'Global central banks purchased 290 tonnes of gold in Q1, the highest in decades.',
   'WSJ', 'https://wsj.com', 'gold', 8, ARRAY['XAU', 'central-banks', 'reserves']),
  ('Copper Rally Signals Global Growth Optimism',
   'Copper prices hit 2-year highs as China manufacturing PMI beats expectations.',
   'CNBC', 'https://cnbc.com', 'macro', 7, ARRAY['XCU', 'China', 'PMI']);
