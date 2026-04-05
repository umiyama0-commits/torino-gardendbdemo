import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { extractKeywords, sharedKeywordScore } from "@/lib/text-similarity";

/**
 * B. 再発見トリガー API
 * 投入されたテキストに類似する過去の観測を返す
 * GET /api/observations/similar?text=...&modelLayer=...&excludeProjectId=...
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text") || "";
  const modelLayer = searchParams.get("modelLayer") || "";
  const excludeProjectId = searchParams.get("excludeProjectId") || null;

  if (!text || text.length < 5) {
    return NextResponse.json({ similar: [], message: "Text too short" });
  }

  const inputKeywords = extractKeywords(text);
  if (inputKeywords.length < 2) {
    return NextResponse.json({ similar: [], message: "Not enough keywords" });
  }

  // 同じmodelLayerの観測を取得（直近1000件から探す）
  // 異なるプロジェクトの観測を優先して「再発見」する
  const candidates = await prisma.observation.findMany({
    where: {
      modelLayer: modelLayer || undefined,
      ...(excludeProjectId ? { NOT: { projectId: excludeProjectId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      text: true,
      modelLayer: true,
      primaryValueAxis: true,
      provenance: true,
      sedimentStatus: true,
      projectId: true,
      createdAt: true,
      project: { select: { nameAnonymized: true, client: { select: { nameAnonymized: true, industryMajor: true } } } },
    },
  });

  // キーワードマッチングでスコア計算
  const scored = candidates.map(obs => {
    const obsKeywords = extractKeywords(obs.text);
    const { score, shared } = sharedKeywordScore(inputKeywords, obsKeywords);
    return { ...obs, score, sharedKeywords: shared };
  });

  // スコア閾値以上を類似とみなす
  const similar = scored
    .filter(s => s.score >= 0.2 && s.sharedKeywords.length >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => ({
      id: s.id,
      text: s.text.slice(0, 100),
      modelLayer: s.modelLayer,
      primaryValueAxis: s.primaryValueAxis,
      provenance: s.provenance,
      sedimentStatus: s.sedimentStatus,
      createdAt: s.createdAt,
      sharedKeywords: s.sharedKeywords,
      score: Math.round(s.score * 100),
      anonymizedSource: s.project
        ? `${s.project.client?.nameAnonymized || s.project.client?.industryMajor || "不明"} / ${s.project.nameAnonymized || "PJ"}`
        : null,
    }));

  // 参照カウンタを更新（見つかった類似観測は"参照された"とみなす）
  if (similar.length > 0) {
    const ids = similar.map(s => s.id);
    await prisma.observation.updateMany({
      where: { id: { in: ids } },
      data: {
        viewCount: { increment: 1 },
        lastReferencedAt: new Date(),
      },
    });
  }

  return NextResponse.json({
    similar,
    inputKeywords,
    totalCandidates: candidates.length,
  });
}
