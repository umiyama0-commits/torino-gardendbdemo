-- pgvector拡張を有効化（NeonDBは標準サポート）
CREATE EXTENSION IF NOT EXISTS vector;

-- Observationにembeddingカラムを追加（512次元）
ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS embedding vector(512);

-- Insightにembeddingカラムを追加（512次元）
ALTER TABLE "Insight" ADD COLUMN IF NOT EXISTS embedding vector(512);

-- IVFFlat インデックス（高速な近似最近傍検索）
-- lists数はデータ量に応じて調整: sqrt(行数) が目安
CREATE INDEX IF NOT EXISTS idx_observation_embedding ON "Observation"
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);

CREATE INDEX IF NOT EXISTS idx_insight_embedding ON "Insight"
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- OntologyTagの階層構造用インデックス
CREATE INDEX IF NOT EXISTS idx_ontology_parent ON "OntologyTag" ("parentId");
CREATE INDEX IF NOT EXISTS idx_ontology_level ON "OntologyTag" ("level");
