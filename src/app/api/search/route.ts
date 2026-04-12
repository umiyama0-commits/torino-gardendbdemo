import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { searchSimilarObservations, searchSimilarInsights } from "@/lib/embedding";
import { applyProvenanceCap, getPublicRatioCap } from "@/lib/trust-score";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const query = sp.get("q") || "";
  const industry = sp.get("industry") || "";
  const modelLayer = sp.get("modelLayer") || "";
  const valueAxis = sp.get("valueAxis") || "";
  const provenance = sp.get("provenance") || "";
  const tagCode = sp.get("tag") || "";
  const country = sp.get("country") || "";
  const semantic = sp.get("semantic") === "true"; // セマンティック検索フラグ

  // セマンティック検索: embeddingベクトル類似度で検索
  if (semantic && query.trim()) {
    try {
      const [obsResults, insResults] = await Promise.all([
        searchSimilarObservations(query, 50, 0.25),
        searchSimilarInsights(query, 30, 0.25),
      ]);

      // フィルターID収集してPrismaで詳細取得
      const obsIds = obsResults.map((o) => o.id);
      const insIds = insResults.map((i) => i.id);

      const observations = obsIds.length > 0 ? await prisma.observation.findMany({
        where: { id: { in: obsIds } },
        include: {
          tags: { include: { tag: true } },
          store: { select: { client: { select: { industry: true, industryDetail: true } } } },
          project: { select: { client: { select: { industry: true, industryDetail: true } } } },
        },
      }) : [];

      const insights = insIds.length > 0 ? await prisma.insight.findMany({
        where: { id: { in: insIds } },
        include: { tags: { include: { tag: true } } },
      }) : [];

      // 類似度スコア × trustScore でランキング（タグ充実度が高いデータを優先）
      const obsWithScore = observations.map((obs) => {
        const similarity = obsResults.find((r) => r.id === obs.id)?.similarity || 0;
        return { ...obs, _similarity: similarity, _rankScore: similarity * (0.5 + 0.5 * obs.trustScore) };
      }).sort((a, b) => b._rankScore - a._rankScore);

      const insWithScore = insights.map((ins) => {
        const similarity = insResults.find((r) => r.id === ins.id)?.similarity || 0;
        return { ...ins, _similarity: similarity, _rankScore: similarity * (0.5 + 0.5 * ins.trustScore) };
      }).sort((a, b) => b._rankScore - a._rankScore);

      const industrySet = new Set<string>();
      for (const obs of observations) {
        const ind = obs.store?.client?.industryDetail || obs.store?.client?.industry
          || obs.project?.client?.industryDetail || obs.project?.client?.industry;
        if (ind) industrySet.add(ind);
      }

      // 公知比率キャップ適用
      const searchCap = await getPublicRatioCap();
      const cappedObs = applyProvenanceCap(obsWithScore, 50, searchCap);
      const cappedIns = applyProvenanceCap(insWithScore, 30, searchCap);

      return NextResponse.json({
        observations: cappedObs,
        insights: cappedIns,
        industries: [...industrySet],
        searchMode: "semantic",
      });
    } catch {
      // embedding未設定時はフォールバック
    }
  }

  // 従来のキーワード検索
  const obsAnd: Record<string, unknown>[] = [];
  const insAnd: Record<string, unknown>[] = [];

  if (query.trim()) {
    obsAnd.push({ text: { contains: query, mode: "insensitive" } });
    insAnd.push({ text: { contains: query, mode: "insensitive" } });
  }

  if (modelLayer) {
    obsAnd.push({ modelLayer });
    insAnd.push({ modelLayer });
  }

  if (country) {
    obsAnd.push({ country });
    // Insightは複数国を含むのでcontainsで検索
    insAnd.push({ countries: { contains: country } });
  }

  if (valueAxis) {
    obsAnd.push({ primaryValueAxis: valueAxis });
    insAnd.push({ primaryValueAxis: valueAxis });
  }

  if (provenance) {
    obsAnd.push({ provenance });
    insAnd.push({ provenance });
  }

  if (tagCode) {
    // 階層検索: 親タグが指定された場合、子タグも含めて検索
    const tag = await prisma.ontologyTag.findUnique({
      where: { code: tagCode },
      include: { children: { select: { code: true } } },
    });

    if (tag && tag.children.length > 0) {
      // 親タグ → 子タグ全てで検索
      const allCodes = [tagCode, ...tag.children.map((c) => c.code)];
      obsAnd.push({ tags: { some: { tag: { code: { in: allCodes } } } } });
      insAnd.push({ tags: { some: { tag: { code: { in: allCodes } } } } });
    } else {
      obsAnd.push({ tags: { some: { tag: { code: tagCode } } } });
      insAnd.push({ tags: { some: { tag: { code: tagCode } } } });
    }
  }

  if (industry.trim()) {
    obsAnd.push({
      OR: [
        { store: { client: { industryDetail: { contains: industry } } } },
        { store: { client: { industry: { contains: industry } } } },
        { project: { client: { industryDetail: { contains: industry } } } },
        { project: { client: { industry: { contains: industry } } } },
      ],
    });
  }

  // If no filters at all, return empty (require at least one)
  const hasFilter = obsAnd.length > 0;

  const obsWhere = hasFilter ? { AND: obsAnd } : undefined;
  const insWhere = insAnd.length > 0 ? { AND: insAnd } : undefined;

  const [observations, insights] = await Promise.all([
    obsWhere
      ? prisma.observation.findMany({
          where: obsWhere,
          include: {
            tags: { include: { tag: true } },
            store: { select: { client: { select: { industry: true, industryDetail: true } } } },
            project: { select: { client: { select: { industry: true, industryDetail: true } } } },
          },
          orderBy: [{ trustScore: "desc" }, { createdAt: "desc" }],
          take: 100,
        })
      : Promise.resolve([]),
    insWhere
      ? prisma.insight.findMany({
          where: insWhere,
          include: { tags: { include: { tag: true } } },
          orderBy: [{ trustScore: "desc" }, { createdAt: "desc" }],
          take: 100,
        })
      : Promise.resolve([]),
  ]);

  // Extract industries from fetched observations
  const industrySet = new Set<string>();
  for (const obs of observations) {
    const ind =
      obs.store?.client?.industryDetail ||
      obs.store?.client?.industry ||
      obs.project?.client?.industryDetail ||
      obs.project?.client?.industry;
    if (ind) industrySet.add(ind);
  }

  // キーワード検索結果にも公知比率キャップ適用
  const kwCap = await getPublicRatioCap();
  const cappedObservations = applyProvenanceCap(observations, 100, kwCap);
  const cappedInsights = applyProvenanceCap(insights, 100, kwCap);

  return NextResponse.json({
    observations: cappedObservations,
    insights: cappedInsights,
    industries: [...industrySet],
  });
}
