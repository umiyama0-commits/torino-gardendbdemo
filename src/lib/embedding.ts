// Embedding生成: OpenAI text-embedding-3-small でベクトル化
// pgvector使用: NeonDBはpgvector拡張を標準サポート

import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 512; // コスト最適化: 1536→512に次元削減

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for embeddings");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/** テキストからembeddingベクトルを生成 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const truncated = text.slice(0, 8000);

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncated,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
}

/** 複数テキストのembeddingを一括生成（バッチ効率化） */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();
  const truncated = texts.map((t) => t.slice(0, 8000));

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncated,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data.map((d) => d.embedding);
}

/** Observation保存時にembeddingを生成・保存 */
export async function saveObservationEmbedding(observationId: string, text: string): Promise<void> {
  const embedding = await generateEmbedding(text);
  const vectorStr = `[${embedding.join(",")}]`;

  await prisma.$executeRawUnsafe(
    `UPDATE "Observation" SET embedding = $1::vector WHERE id = $2`,
    vectorStr,
    observationId
  );
}

/** Insight保存時にembeddingを生成・保存 */
export async function saveInsightEmbedding(insightId: string, text: string): Promise<void> {
  const embedding = await generateEmbedding(text);
  const vectorStr = `[${embedding.join(",")}]`;

  await prisma.$executeRawUnsafe(
    `UPDATE "Insight" SET embedding = $1::vector WHERE id = $2`,
    vectorStr,
    insightId
  );
}

/** embeddingベクトルで類似Observationを検索（コサイン類似度） */
export async function searchSimilarObservations(
  queryText: string,
  limit: number = 20,
  threshold: number = 0.3
): Promise<{ id: string; text: string; modelLayer: string; provenance: string; trustScore: number; similarity: number }[]> {
  const queryEmbedding = await generateEmbedding(queryText);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const results = await prisma.$queryRawUnsafe<
    { id: string; text: string; modelLayer: string; provenance: string; trustScore: number; similarity: number }[]
  >(
    `SELECT id, text, "modelLayer", provenance, "trustScore",
            1 - (embedding <=> $1::vector) as similarity
     FROM "Observation"
     WHERE embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) > $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    vectorStr,
    threshold,
    limit
  );

  return results;
}

/** embeddingベクトルで類似Insightを検索 */
export async function searchSimilarInsights(
  queryText: string,
  limit: number = 15,
  threshold: number = 0.3
): Promise<{ id: string; text: string; modelLayer: string | null; provenance: string; trustScore: number; similarity: number }[]> {
  const queryEmbedding = await generateEmbedding(queryText);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const results = await prisma.$queryRawUnsafe<
    { id: string; text: string; modelLayer: string | null; provenance: string; trustScore: number; similarity: number }[]
  >(
    `SELECT id, text, "modelLayer", provenance, "trustScore",
            1 - (embedding <=> $1::vector) as similarity
     FROM "Insight"
     WHERE embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) > $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    vectorStr,
    threshold,
    limit
  );

  return results;
}

/** 既存データにembeddingをバックフィル */
export async function backfillEmbeddings(): Promise<{ observations: number; insights: number }> {
  // embedding未設定のObservationを取得
  const observations = await prisma.$queryRawUnsafe<{ id: string; text: string }[]>(
    `SELECT id, text FROM "Observation" WHERE embedding IS NULL`
  );

  let obsCount = 0;
  // バッチ処理（20件ずつ）
  for (let i = 0; i < observations.length; i += 20) {
    const batch = observations.slice(i, i + 20);
    const embeddings = await generateEmbeddings(batch.map((o) => o.text));

    for (let j = 0; j < batch.length; j++) {
      const vectorStr = `[${embeddings[j].join(",")}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE "Observation" SET embedding = $1::vector WHERE id = $2`,
        vectorStr,
        batch[j].id
      );
      obsCount++;
    }
  }

  // embedding未設定のInsightを取得
  const insights = await prisma.$queryRawUnsafe<{ id: string; text: string }[]>(
    `SELECT id, text FROM "Insight" WHERE embedding IS NULL`
  );

  let insCount = 0;
  for (let i = 0; i < insights.length; i += 20) {
    const batch = insights.slice(i, i + 20);
    const embeddings = await generateEmbeddings(batch.map((ins) => ins.text));

    for (let j = 0; j < batch.length; j++) {
      const vectorStr = `[${embeddings[j].join(",")}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE "Insight" SET embedding = $1::vector WHERE id = $2`,
        vectorStr,
        batch[j].id
      );
      insCount++;
    }
  }

  return { observations: obsCount, insights: insCount };
}

/** 2つのObservation/Insight間のコサイン類似度を計算 */
export async function computeSimilarity(
  table1: "Observation" | "Insight",
  id1: string,
  table2: "Observation" | "Insight",
  id2: string
): Promise<number | null> {
  const result = await prisma.$queryRawUnsafe<{ similarity: number }[]>(
    `SELECT 1 - (a.embedding <=> b.embedding) as similarity
     FROM "${table1}" a, "${table2}" b
     WHERE a.id = $1 AND b.id = $2
       AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL`,
    id1,
    id2
  );

  return result[0]?.similarity ?? null;
}
