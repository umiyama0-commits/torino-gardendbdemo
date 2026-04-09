// 公知(PUBLIC_CODIFIED)自動取込エンドポイント
// GET: Vercel Cronから毎日自動実行
// POST: 管理画面からの手動実行

import { NextRequest, NextResponse } from "next/server";
import { runAutoIngest } from "@/lib/auto-ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5分（LLM + Web検索で時間がかかる）

// Vercel Cron Job → GET
export async function GET(req: NextRequest) {
  // Vercel Cron認証: CRON_SECRET が設定されている場合のみチェック
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runAutoIngest({ batchSize: 10 });

  return NextResponse.json({
    success: true,
    ...result,
  });
}

// 管理画面からの手動実行 → POST
export async function POST(req: NextRequest) {
  let batchSize = 10;

  try {
    const body = await req.json();
    if (body.batchSize && typeof body.batchSize === "number") {
      batchSize = Math.min(body.batchSize, 20); // 最大20件
    }
  } catch {
    // bodyなしでもOK
  }

  const result = await runAutoIngest({ batchSize });

  return NextResponse.json({
    success: true,
    ...result,
  });
}
