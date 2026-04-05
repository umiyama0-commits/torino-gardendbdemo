import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { extractKeywords, clusterTexts } from "@/lib/text-similarity";

/**
 * A. 自動クラスタリング API
 * POST /api/sediment/clusters — 沈殿データをクラスタリングして萌芽パターンを検出
 * GET  /api/sediment/clusters — 既存の萌芽クラスタ一覧を取得
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // 沈殿データをモデルレイヤー別に取得
  const sedimentObs = await prisma.observation.findMany({
    where: {
      sedimentStatus: { in: ["sediment", "active"] },
      emergingClusterMembers: { none: {} },
    },
    select: {
      id: true,
      text: true,
      modelLayer: true,
      primaryValueAxis: true,
    },
  });

  if (sedimentObs.length === 0) {
    return NextResponse.json({ message: "No observations to cluster", newClusters: 0 });
  }

  // モデルレイヤー別にグループ化してクラスタリング
  const byLayer = new Map<string, typeof sedimentObs>();
  for (const obs of sedimentObs) {
    const group = byLayer.get(obs.modelLayer) || [];
    group.push(obs);
    byLayer.set(obs.modelLayer, group);
  }

  let newClusterCount = 0;

  for (const [layer, observations] of byLayer) {
    if (observations.length < 3) continue; // 3件未満はスキップ

    const items = observations.map(o => ({
      id: o.id,
      text: o.text,
      keywords: extractKeywords(o.text),
    }));

    const clusters = clusterTexts(items, 0.2);

    for (const cluster of clusters) {
      if (cluster.members.length < 3) continue; // 3件以上で萌芽パターン

      // 代表的なvalueAxisを決定
      const axisFreq = new Map<string, number>();
      for (const memberId of cluster.members) {
        const obs = observations.find(o => o.id === memberId);
        if (obs?.primaryValueAxis) {
          axisFreq.set(obs.primaryValueAxis, (axisFreq.get(obs.primaryValueAxis) || 0) + 1);
        }
      }
      const topAxis = axisFreq.size > 0
        ? Array.from(axisFreq.entries()).sort((a, b) => b[1] - a[1])[0][0]
        : null;

      // ラベルをキーワードから生成
      const label = `${cluster.keywords.slice(0, 3).join("・")}に関する観測群`;

      // DB保存
      const created = await prisma.emergingCluster.create({
        data: {
          label,
          modelLayer: layer,
          primaryValueAxis: topAxis,
          keywords: JSON.stringify(cluster.keywords),
          memberCount: cluster.members.length,
          members: {
            create: cluster.members.map((obsId, idx) => ({
              observationId: obsId,
              similarity: 1.0 - idx * 0.05, // 順序に応じた擬似スコア
            })),
          },
        },
      });

      // メンバー観測のステータスを「composted」に更新
      await prisma.observation.updateMany({
        where: { id: { in: cluster.members } },
        data: { sedimentStatus: "composted" },
      });

      newClusterCount++;
    }
  }

  return NextResponse.json({
    totalObservations: sedimentObs.length,
    newClusters: newClusterCount,
  });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clusters = await prisma.emergingCluster.findMany({
    where: { status: "emerging" },
    orderBy: { memberCount: "desc" },
    include: {
      members: {
        include: {
          observation: {
            select: {
              id: true,
              text: true,
              modelLayer: true,
              primaryValueAxis: true,
              provenance: true,
              createdAt: true,
              project: {
                select: {
                  nameAnonymized: true,
                  client: { select: { nameAnonymized: true, industryMajor: true } },
                },
              },
            },
          },
        },
        orderBy: { similarity: "desc" },
      },
    },
  });

  return NextResponse.json(
    clusters.map(c => ({
      id: c.id,
      label: c.label,
      modelLayer: c.modelLayer,
      primaryValueAxis: c.primaryValueAxis,
      keywords: JSON.parse(c.keywords),
      memberCount: c.memberCount,
      status: c.status,
      createdAt: c.createdAt,
      members: c.members.map(m => ({
        id: m.observation.id,
        text: m.observation.text.slice(0, 120),
        modelLayer: m.observation.modelLayer,
        provenance: m.observation.provenance,
        createdAt: m.observation.createdAt,
        similarity: m.similarity,
        anonymizedSource: m.observation.project
          ? `${m.observation.project.client?.nameAnonymized || m.observation.project.client?.industryMajor || ""}`
          : null,
      })),
    }))
  );
}
