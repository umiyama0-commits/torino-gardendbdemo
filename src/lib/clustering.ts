// SimilarityCluster自動生成: embeddingコサイン類似度でInsightをクラスタリング
// 改善点3: シードデータのみだったSimilarityClusterを自動生成

import { prisma } from "@/lib/prisma";

/** コサイン類似度の閾値 */
const SIMILARITY_THRESHOLD = 0.7;

type InsightWithSimilarity = {
  id: string;
  text: string;
  modelLayer: string | null;
  primaryValueAxis: string | null;
};

/** Insight間のコサイン類似度行列を取得し、クラスタを自動生成 */
export async function autoClusterInsights(): Promise<{
  clustersCreated: number;
  insightsAssigned: number;
}> {
  // embedding付きInsightを全取得
  const insights = await prisma.$queryRawUnsafe<
    (InsightWithSimilarity & { embedding: string })[]
  >(
    `SELECT id, text, "modelLayer", "primaryValueAxis"
     FROM "Insight"
     WHERE embedding IS NOT NULL`
  );

  if (insights.length < 2) {
    return { clustersCreated: 0, insightsAssigned: 0 };
  }

  // ペア類似度を計算してグラフを構築
  const pairs = await prisma.$queryRawUnsafe<
    { id1: string; id2: string; similarity: number }[]
  >(
    `SELECT a.id as id1, b.id as id2,
            1 - (a.embedding <=> b.embedding) as similarity
     FROM "Insight" a
     CROSS JOIN "Insight" b
     WHERE a.id < b.id
       AND a.embedding IS NOT NULL
       AND b.embedding IS NOT NULL
       AND 1 - (a.embedding <=> b.embedding) > $1`,
    SIMILARITY_THRESHOLD
  );

  // Union-Findでクラスタリング
  const parent = new Map<string, string>();
  const insightMap = new Map(insights.map((i) => [i.id, i]));

  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  }

  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const pair of pairs) {
    union(pair.id1, pair.id2);
  }

  // クラスタをグループ化
  const clusters = new Map<string, string[]>();
  for (const insight of insights) {
    const root = find(insight.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(insight.id);
  }

  // 既存クラスタを削除して再生成
  await prisma.similarityClusterMember.deleteMany({});
  await prisma.similarityCluster.deleteMany({});

  let clustersCreated = 0;
  let insightsAssigned = 0;

  for (const [, memberIds] of clusters) {
    // 2件以上のグループのみクラスタ化
    if (memberIds.length < 2) continue;

    const members = memberIds.map((id) => insightMap.get(id)!).filter(Boolean);

    // クラスタの代表的なmodelLayer・valueAxisを決定
    const layerCounts = new Map<string, number>();
    const axisCounts = new Map<string, number>();
    for (const m of members) {
      if (m.modelLayer) layerCounts.set(m.modelLayer, (layerCounts.get(m.modelLayer) || 0) + 1);
      if (m.primaryValueAxis) axisCounts.set(m.primaryValueAxis, (axisCounts.get(m.primaryValueAxis) || 0) + 1);
    }

    const topLayer = [...layerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const topAxis = [...axisCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // クラスタ名: 先頭メンバーのテキストを要約
    const name = members[0].text.slice(0, 60) + (members[0].text.length > 60 ? "..." : "");

    const cluster = await prisma.similarityCluster.create({
      data: {
        name,
        description: `${members.length}件の類似Insightを自動グルーピング`,
        memberCount: members.length,
        modelLayer: topLayer,
        primaryValueAxis: topAxis,
        members: {
          create: memberIds.map((insightId) => ({ insightId })),
        },
      },
    });

    clustersCreated++;
    insightsAssigned += members.length;
  }

  return { clustersCreated, insightsAssigned };
}

/** CrossIndustryPatternを自動生成: 2つ以上の業種にまたがるInsightクラスタをパターン化 */
export async function autoGeneratePatterns(): Promise<{
  patternsCreated: number;
}> {
  // クラスタメンバーのInsightから業種情報を取得
  const clusters = await prisma.similarityCluster.findMany({
    where: { memberCount: { gte: 2 } },
    include: {
      members: {
        include: {
          insight: {
            include: {
              sourceObservations: {
                include: {
                  observation: {
                    include: {
                      store: { include: { client: { select: { industry: true, industryDetail: true } } } },
                      project: { include: { client: { select: { industry: true, industryDetail: true } } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  let patternsCreated = 0;

  for (const cluster of clusters) {
    // クラスタ内のInsightが関連する業種を収集
    const industries = new Set<string>();
    const insightIds: string[] = [];

    for (const member of cluster.members) {
      insightIds.push(member.insightId);
      for (const link of member.insight.sourceObservations) {
        const obs = link.observation;
        const ind = obs.store?.client?.industryDetail || obs.store?.client?.industry
          || obs.project?.client?.industryDetail || obs.project?.client?.industry;
        if (ind) industries.add(ind);
      }
    }

    // 2つ以上の業種にまたがる場合のみパターン化
    if (industries.size < 2) continue;

    // 既存パターンと重複チェック
    const existingPattern = await prisma.crossIndustryPattern.findFirst({
      where: {
        insightLinks: {
          some: { insightId: { in: insightIds } },
        },
      },
    });

    if (existingPattern) continue;

    const pattern = await prisma.crossIndustryPattern.create({
      data: {
        name: cluster.name,
        description: `${industries.size}業種横断パターン: ${[...industries].join(", ")}`,
        industries: [...industries].join(","),
        modelLayer: cluster.modelLayer,
        primaryValueAxis: cluster.primaryValueAxis,
        insightCount: insightIds.length,
        trustScore: 0.6,
        insightLinks: {
          create: insightIds.map((insightId) => ({ insightId })),
        },
      },
    });

    patternsCreated++;
  }

  return { patternsCreated };
}
