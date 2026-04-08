import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  VALUE_AXIS_CONFIG,
  MODEL_LAYER_CONFIG,
  PROVENANCE_CONFIG,
} from "@/lib/constants";
import { TrustChainCard } from "@/components/trust-chain-card";

export const revalidate = 30;

type DashboardStats = {
  totalObs: number;
  fieldCount: number;
  anonCount: number;
  publicCount: number;
  // value axis
  revenueUp: number;
  costDown: number;
  retention: number;
  // model layer
  movement: number;
  approach: number;
  breakdown: number;
  transfer: number;
  // trust chain
  doubleBackedCount: number;
  tripleBackedCount: number;
};

export default async function Dashboard() {
  // Single raw SQL replaces 10 separate Prisma queries
  const [stats] = await prisma.$queryRawUnsafe<DashboardStats[]>(`
    SELECT
      (SELECT COUNT(*) FROM "Observation") as "totalObs",
      (SELECT COUNT(*) FROM "Observation" WHERE "provenance" = 'FIELD_OBSERVED') as "fieldCount",
      (SELECT COUNT(*) FROM "Observation" WHERE "provenance" = 'ANONYMIZED_DERIVED') as "anonCount",
      (SELECT COUNT(*) FROM "Observation" WHERE "provenance" = 'PUBLIC_CODIFIED') as "publicCount",
      (SELECT COUNT(*) FROM "Observation" WHERE "primaryValueAxis" = 'REVENUE_UP') as "revenueUp",
      (SELECT COUNT(*) FROM "Observation" WHERE "primaryValueAxis" = 'COST_DOWN') as "costDown",
      (SELECT COUNT(*) FROM "Observation" WHERE "primaryValueAxis" = 'RETENTION') as "retention",
      (SELECT COUNT(*) FROM "Observation" WHERE "modelLayer" = 'MOVEMENT') as "movement",
      (SELECT COUNT(*) FROM "Observation" WHERE "modelLayer" = 'APPROACH') as "approach",
      (SELECT COUNT(*) FROM "Observation" WHERE "modelLayer" = 'BREAKDOWN') as "breakdown",
      (SELECT COUNT(*) FROM "Observation" WHERE "modelLayer" = 'TRANSFER') as "transfer",
      (SELECT COUNT(*) FROM (
        SELECT ot."tagId" FROM "ObservationTag" ot
        JOIN "Observation" o ON o."id" = ot."observationId"
        GROUP BY ot."tagId" HAVING COUNT(DISTINCT o."provenance") >= 2
      ) AS _d) as "doubleBackedCount",
      (SELECT COUNT(*) FROM (
        SELECT ot."tagId" FROM "ObservationTag" ot
        JOIN "Observation" o ON o."id" = ot."observationId"
        GROUP BY ot."tagId" HAVING COUNT(DISTINCT o."provenance") >= 3
      ) AS _t) as "tripleBackedCount"
  `);

  const [insightCount, patternCount, clusters] = await Promise.all([
    prisma.insight.count(),
    prisma.crossIndustryPattern.count(),
    prisma.similarityCluster.findMany({
      orderBy: { memberCount: "desc" },
      take: 5,
    }),
  ]);

  const observationCount = Number(stats.totalObs);
  const fieldCount = Number(stats.fieldCount);
  const anonCount = Number(stats.anonCount);
  const publicCount = Number(stats.publicCount);
  const doubleBackedCount = Number(stats.doubleBackedCount);
  const tripleBackedCount = Number(stats.tripleBackedCount);

  const valueAxisMap: Record<string, number> = {
    REVENUE_UP: Number(stats.revenueUp),
    COST_DOWN: Number(stats.costDown),
    RETENTION: Number(stats.retention),
  };
  const modelLayerMap: Record<string, number> = {
    MOVEMENT: Number(stats.movement),
    APPROACH: Number(stats.approach),
    BREAKDOWN: Number(stats.breakdown),
    TRANSFER: Number(stats.transfer),
  };
  const maxObs = Math.max(...Object.values(valueAxisMap), 1);
  const maxLayer = Math.max(...Object.values(modelLayerMap), 1);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-zinc-500 mt-1 text-sm">
          ナレッジの蓄積状況と信頼度の概況
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Observations" value={observationCount} accent="blue" />
        <StatCard label="Insights" value={insightCount} accent="cyan" />
        <StatCard label="横断パターン" value={patternCount} accent="violet" />
        <StatCard
          label="多層裏付け"
          value={doubleBackedCount}
          sub={`うち3層: ${tripleBackedCount}`}
          accent="emerald"
        />
        <StatCard label="公知形式知" value={publicCount} accent="zinc" />
      </div>

      {/* Provenance summary bar */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">
            Provenance 分布
          </p>
          <div className="flex h-3 rounded-full overflow-hidden bg-zinc-100">
            {fieldCount > 0 && (
              <div
                className="bg-zinc-800 transition-all"
                style={{ width: `${(fieldCount / observationCount) * 100}%` }}
                title={`①固有知: ${fieldCount}`}
              />
            )}
            {anonCount > 0 && (
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${(anonCount / observationCount) * 100}%` }}
                title={`②汎用知: ${anonCount}`}
              />
            )}
            {publicCount > 0 && (
              <div
                className="bg-zinc-300 transition-all"
                style={{ width: `${(publicCount / observationCount) * 100}%` }}
                title={`③公知: ${publicCount}`}
              />
            )}
          </div>
          <div className="flex gap-6 mt-3">
            {Object.entries(PROVENANCE_CONFIG).map(([key, cfg]) => {
              const count =
                key === "FIELD_OBSERVED"
                  ? fieldCount
                  : key === "ANONYMIZED_DERIVED"
                  ? anonCount
                  : publicCount;
              return (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  <span className="text-zinc-600">{cfg.shortLabel}</span>
                  <span className="font-semibold tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Value Axis */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
              3価値軸
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(VALUE_AXIS_CONFIG).map(([key, config]) => {
              const count = valueAxisMap[key] || 0;
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-lg font-bold tabular-nums">
                      {count}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${config.bar} transition-all`}
                      style={{
                        width: `${(Number(count) / maxObs) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Model Layer */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
              4層モデル
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(MODEL_LAYER_CONFIG).map(([key, config]) => {
              const count = modelLayerMap[key] || 0;
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-lg font-bold tabular-nums">
                      {count}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${config.bar} transition-all`}
                      style={{
                        width: `${(Number(count) / maxLayer) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Trust Chain */}
      <TrustChainCard
        doubleBackedCount={doubleBackedCount}
        tripleBackedCount={tripleBackedCount}
        fieldCount={fieldCount}
        anonCount={anonCount}
        publicCount={publicCount}
      />

      {/* Similarity Clusters */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
            類似クラスター TOP5
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {clusters.map((cluster, i) => {
              const layerConfig = cluster.modelLayer
                ? MODEL_LAYER_CONFIG[cluster.modelLayer]
                : null;
              const valueConfig = cluster.primaryValueAxis
                ? VALUE_AXIS_CONFIG[cluster.primaryValueAxis]
                : null;
              return (
                <div
                  key={cluster.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-zinc-300 w-5 text-right tabular-nums">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{cluster.name}</p>
                      <div className="flex gap-1.5 mt-1">
                        {layerConfig && (
                          <Badge className={`${layerConfig.bg} ${layerConfig.color} text-[11px] px-1.5 py-0`}>
                            {layerConfig.label}
                          </Badge>
                        )}
                        {valueConfig && (
                          <Badge className={`${valueConfig.bg} ${valueConfig.color} text-[11px] px-1.5 py-0`}>
                            {valueConfig.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold tabular-nums">
                      {cluster.memberCount}
                    </span>
                    <span className="text-xs text-zinc-400 ml-0.5">件</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent: string;
}) {
  const gradients: Record<string, string> = {
    blue: "from-blue-500 to-blue-600",
    cyan: "from-cyan-500 to-cyan-600",
    violet: "from-violet-500 to-violet-600",
    emerald: "from-emerald-500 to-emerald-600",
    zinc: "from-zinc-500 to-zinc-600",
  };
  return (
    <Card className="shadow-sm overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${gradients[accent]}`} />
      <CardContent className="pt-4 pb-4">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-3xl font-bold tabular-nums mt-1">{value}</p>
        {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
