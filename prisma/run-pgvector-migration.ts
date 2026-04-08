// pgvector拡張有効化 + embeddingカラム追加 + インデックス作成
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  console.log("Running pgvector migration...");

  // 1. pgvector拡張を有効化
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
  console.log("pgvector extension enabled");

  // 2. Observationにembeddingカラムを追加
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Observation" ADD COLUMN embedding vector(512)`
    );
    console.log("Observation.embedding column added");
  } catch (e: unknown) {
    const msg = (e as Error).message || "";
    if (msg.includes("already exists")) {
      console.log("Observation.embedding already exists");
    } else {
      throw e;
    }
  }

  // 3. Insightにembeddingカラムを追加
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Insight" ADD COLUMN embedding vector(512)`
    );
    console.log("Insight.embedding column added");
  } catch (e: unknown) {
    const msg = (e as Error).message || "";
    if (msg.includes("already exists")) {
      console.log("Insight.embedding already exists");
    } else {
      throw e;
    }
  }

  // 4. IVFFlatインデックス作成（データ投入後に実行推奨だが、先に作成）
  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_observation_embedding ON "Observation" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20)`
    );
    console.log("Observation embedding index created");
  } catch (e: unknown) {
    console.log("Observation index:", (e as Error).message);
  }

  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_insight_embedding ON "Insight" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10)`
    );
    console.log("Insight embedding index created");
  } catch (e: unknown) {
    console.log("Insight index:", (e as Error).message);
  }

  // 5. OntologyTagの階層用インデックス
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_ontology_parent ON "OntologyTag" ("parentId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_ontology_level ON "OntologyTag" ("level")`
  );
  console.log("OntologyTag hierarchy indexes created");

  console.log("Migration complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
