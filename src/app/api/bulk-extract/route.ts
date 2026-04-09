// 一括テキスト抽出API: 日報・報告書からLLMが複数の観測データを自動抽出
// POST: { text: string } → { observations: Array<...> }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bulkExtractObservations } from "@/lib/llm";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body as { text: string };

    if (!text?.trim()) {
      return NextResponse.json({ error: "テキストが空です" }, { status: 400 });
    }

    // LLMで一括抽出
    const result = await bulkExtractObservations(text.trim());

    // tagCodes → tagIds を一括解決
    const allTagCodes = [
      ...new Set(result.observations.flatMap((o) => o.tagCodes)),
    ];

    const tags = allTagCodes.length > 0
      ? await prisma.ontologyTag.findMany({
          where: { code: { in: allTagCodes } },
          select: { id: true, code: true, displayNameJa: true },
        })
      : [];

    const tagMap = new Map(tags.map((t) => [t.code, t]));

    // 各観測にtagIdsとtagNames付与
    const observations = result.observations.map((obs) => ({
      ...obs,
      tagIds: obs.tagCodes
        .map((code) => tagMap.get(code)?.id)
        .filter(Boolean) as string[],
      tagNames: obs.tagCodes
        .map((code) => tagMap.get(code)?.displayNameJa)
        .filter(Boolean) as string[],
    }));

    return NextResponse.json({ observations });
  } catch (err) {
    console.error("Bulk extract error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "抽出に失敗しました" },
      { status: 500 },
    );
  }
}
