// 管理者設定API: システム設定の取得・更新
// GET: 設定一覧（認証不要 — 表示用）
// PUT: 設定更新（管理者権限必須）

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// デフォルト設定値（初回起動時にDBに投入）
const DEFAULT_CONFIGS = [
  // LLM設定
  { key: "llm.provider", value: "openai", label: "LLMプロバイダー", category: "llm" },
  { key: "llm.model", value: "gpt-4o", label: "使用モデル", category: "llm" },
  { key: "llm.temperature", value: "0.3", label: "Temperature", category: "llm" },
  // 信頼スコア設定
  { key: "trust.halfLifeDays", value: "180", label: "信頼スコア半減期（日）", category: "trust" },
  { key: "trust.fieldWeight", value: "3.0", label: "固有知ウェイト", category: "trust" },
  { key: "trust.anonWeight", value: "2.0", label: "汎用知ウェイト", category: "trust" },
  { key: "trust.publicWeight", value: "0.5", label: "公知ウェイト", category: "trust" },
  // 表示設定
  { key: "display.defaultCountry", value: "JP", label: "デフォルト国コード", category: "display" },
  { key: "display.language", value: "ja", label: "表示言語", category: "display" },
  // Embedding設定
  { key: "embedding.model", value: "text-embedding-3-small", label: "Embeddingモデル", category: "llm" },
  { key: "embedding.dimensions", value: "512", label: "Embedding次元数", category: "llm" },
  // クラスタリング設定
  { key: "cluster.similarityThreshold", value: "0.7", label: "クラスタ類似度閾値", category: "trust" },
  { key: "cluster.minIndustries", value: "2", label: "パターン生成最低業種数", category: "trust" },
];

// GET: 設定一覧
export async function GET() {
  // 初回起動: デフォルト設定がなければ投入
  const count = await prisma.systemConfig.count();
  if (count === 0) {
    for (const config of DEFAULT_CONFIGS) {
      await prisma.systemConfig.create({ data: config });
    }
  }

  const configs = await prisma.systemConfig.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });

  return NextResponse.json({ configs });
}

// PUT: 設定更新（管理者権限必須）
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { key, value } = body as { key: string; value: string };

  if (!key || value === undefined) {
    return NextResponse.json({ error: "keyとvalueが必要です" }, { status: 400 });
  }

  const config = await prisma.systemConfig.upsert({
    where: { key },
    update: { value },
    create: {
      key,
      value,
      label: key,
      category: "general",
    },
  });

  return NextResponse.json({ config });
}
