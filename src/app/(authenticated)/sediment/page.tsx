import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { SedimentDashboard } from "./sediment-dashboard";

export default async function SedimentPage() {
  const user = await getSessionUser();
  if (!user) return null;

  // 統計情報
  const [activeCount, sedimentCount, compostedCount] = await Promise.all([
    prisma.observation.count({ where: { sedimentStatus: "active" } }),
    prisma.observation.count({ where: { sedimentStatus: "sediment" } }),
    prisma.observation.count({ where: { sedimentStatus: "composted" } }),
  ]);

  // 萌芽クラスタ
  const clusters = await prisma.emergingCluster.findMany({
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
              sedimentStatus: true,
              viewCount: true,
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
        take: 10,
      },
    },
  });

  // 沈殿データのうち最も参照されているもの（viewCount > 0）
  const referencedSediment = await prisma.observation.findMany({
    where: {
      sedimentStatus: { in: ["sediment", "composted"] },
      viewCount: { gt: 0 },
    },
    orderBy: { viewCount: "desc" },
    take: 10,
    select: {
      id: true,
      text: true,
      modelLayer: true,
      viewCount: true,
      lastReferencedAt: true,
      createdAt: true,
    },
  });

  const serialized = {
    stats: { activeCount, sedimentCount, compostedCount },
    clusters: clusters.map(c => ({
      id: c.id,
      label: c.label,
      modelLayer: c.modelLayer,
      primaryValueAxis: c.primaryValueAxis,
      keywords: JSON.parse(c.keywords),
      memberCount: c.memberCount,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      members: c.members.map(m => ({
        observationId: m.observation.id,
        text: m.observation.text.slice(0, 150),
        modelLayer: m.observation.modelLayer,
        provenance: m.observation.provenance,
        viewCount: m.observation.viewCount,
        createdAt: m.observation.createdAt.toISOString(),
        anonymizedSource: m.observation.project
          ? `${m.observation.project.client?.nameAnonymized || m.observation.project.client?.industryMajor || ""}`
          : null,
      })),
    })),
    referencedSediment: referencedSediment.map(o => ({
      id: o.id,
      text: o.text.slice(0, 120),
      modelLayer: o.modelLayer,
      viewCount: o.viewCount,
      lastReferencedAt: o.lastReferencedAt?.toISOString() || null,
      createdAt: o.createdAt.toISOString(),
    })),
    isAdmin: user.role === "admin",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Sediment Lab</h1>
        <p className="text-sm text-zinc-600 mt-1 font-medium">
          沈殿データ分析 &mdash; 死にデータから萌芽パターンを発見する
        </p>
      </div>
      <SedimentDashboard data={serialized} />
    </div>
  );
}
