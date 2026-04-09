import { prisma } from "@/lib/prisma";
import { Suspense } from "react";
import { DictionaryBrowser } from "./dictionary-browser";

export const dynamic = "force-dynamic";

async function DictionaryData() {
  const [entries, total, stats, tags] = await Promise.all([
    prisma.observation.findMany({
      where: { provenance: "PUBLIC_CODIFIED" },
      include: { tags: { include: { tag: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.observation.count({ where: { provenance: "PUBLIC_CODIFIED" } }),
    Promise.all([
      prisma.observation.groupBy({
        by: ["modelLayer"],
        where: { provenance: "PUBLIC_CODIFIED" },
        _count: { id: true },
      }),
      prisma.observation.groupBy({
        by: ["country"],
        where: { provenance: "PUBLIC_CODIFIED" },
        _count: { id: true },
      }),
      prisma.observation.groupBy({
        by: ["primaryValueAxis"],
        where: { provenance: "PUBLIC_CODIFIED" },
        _count: { id: true },
      }),
    ]).then(([byLayer, byCountry, byAxis]) => ({
      byModelLayer: byLayer.map((g) => ({ key: g.modelLayer, count: g._count.id })),
      byCountry: byCountry.map((g) => ({ key: g.country, count: g._count.id })),
      byValueAxis: byAxis.filter((g) => g.primaryValueAxis).map((g) => ({ key: g.primaryValueAxis!, count: g._count.id })),
    })),
    // よく使われているタグ上位20
    prisma.$queryRawUnsafe<{ code: string; name: string; count: bigint }[]>(`
      SELECT t.code, t."displayNameJa" as name, COUNT(*) as count
      FROM "ObservationTag" ot
      JOIN "OntologyTag" t ON ot."tagId" = t.id
      JOIN "Observation" o ON ot."observationId" = o.id
      WHERE o.provenance = 'PUBLIC_CODIFIED'
      GROUP BY t.code, t."displayNameJa"
      ORDER BY count DESC
      LIMIT 20
    `).catch(() => []),
  ]);

  return (
    <DictionaryBrowser
      initialEntries={entries}
      total={total}
      stats={stats}
      topTags={tags.map((t) => ({ code: t.code, name: t.name, count: Number(t.count) }))}
    />
  );
}

export default function DictionaryPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          公知辞書
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          学術研究・業界レポート・理論に基づく公知形式知のリファレンス。分析パイプラインとは独立した参照用辞書。
        </p>
      </div>
      <Suspense fallback={<div className="text-zinc-400 text-sm">読み込み中...</div>}>
        <DictionaryData />
      </Suspense>
    </div>
  );
}
