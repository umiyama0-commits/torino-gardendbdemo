import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VALUE_AXIS_CONFIG, MODEL_LAYER_CONFIG, PROVENANCE_CONFIG, TRUST_LABELS } from "@/lib/constants";
import { TrustBadge, ImpactBadge } from "@/components/trust-badge";
import DashboardCharts from "./dashboard-charts";
import AIChat from "./ai-chat";

export default async function DashboardPage() {
  const [observationCount, insightCount, patternCount, publicCount, highTrustCount] = await Promise.all([
    prisma.observation.count(),
    prisma.insight.count(),
    prisma.crossIndustryPattern.count(),
    prisma.observation.count({ where: { provenance: "PUBLIC_CODIFIED" } }),
    prisma.observation.count({ where: { trustScore: { gte: 2 } } }),
  ]);

  const observations = await prisma.observation.findMany({
    select: { primaryValueAxis: true, modelLayer: true, provenance: true, trustScore: true },
  });

  const valueAxisCounts = { REVENUE_UP: 0, COST_DOWN: 0, RETENTION: 0, CSAT_UP: 0 };
  const modelLayerCounts = { MOVEMENT: 0, APPROACH: 0, BREAKDOWN: 0, TRANSFER: 0 };
  const provenanceCounts = { FIELD_OBSERVED: 0, ANONYMIZED_DERIVED: 0, PUBLIC_CODIFIED: 0 };
  const trustCounts = { 1: 0, 2: 0, 3: 0 };

  for (const obs of observations) {
    if (obs.primaryValueAxis && obs.primaryValueAxis in valueAxisCounts) valueAxisCounts[obs.primaryValueAxis as keyof typeof valueAxisCounts]++;
    if (obs.modelLayer in modelLayerCounts) modelLayerCounts[obs.modelLayer as keyof typeof modelLayerCounts]++;
    if (obs.provenance in provenanceCounts) provenanceCounts[obs.provenance as keyof typeof provenanceCounts]++;
    trustCounts[obs.trustScore as 1 | 2 | 3]++;
  }

  const clusters = await prisma.similarityCluster.findMany({ orderBy: { memberCount: "desc" }, take: 5 });
  const topInsights = await prisma.insight.findMany({ where: { trustScore: { gte: 2 } }, orderBy: { trustScore: "desc" }, take: 5 });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-600 mt-1 font-medium">ダッシュボード &mdash; Knowledge overview at a glance</p>
      </div>

      {/* AI Chat - Main Feature */}
      <AIChat />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard value={observationCount} labelJa="観測事実" labelEn="Observations" accent="#18181b" />
        <StatCard value={insightCount} labelJa="インサイト" labelEn="Insights" accent="#6366f1" />
        <StatCard value={patternCount} labelJa="業種横断パターン" labelEn="Cross-Industry" accent="#0891b2" />
        <StatCard value={publicCount} labelJa="公知形式知" labelEn="Public Knowledge" accent="#71717a" />
        <StatCard value={highTrustCount} labelJa="多層裏付あり" labelEn="Multi-backed" accent="#22c55e" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Value Axis */}
        <Card className="border border-zinc-200 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              4 Value Axes <span className="text-zinc-300">/</span> 4価値軸
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.entries(VALUE_AXIS_CONFIG) as [string, (typeof VALUE_AXIS_CONFIG)[keyof typeof VALUE_AXIS_CONFIG]][]).map(([key, cfg]) => {
              const count = valueAxisCounts[key as keyof typeof valueAxisCounts];
              const pct = Math.round((count / (observations.length || 1)) * 100);
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cfg.color }} />
                      <span className="text-sm font-medium">{cfg.labelJa}</span>
                      <span className="text-xs text-zinc-400">{cfg.label}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-200">
                    <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Model Layer Distribution */}
        <Card className="border border-zinc-200 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              4-Layer Model <span className="text-zinc-300">/</span> 4層モデル
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {(Object.entries(MODEL_LAYER_CONFIG) as [string, (typeof MODEL_LAYER_CONFIG)[keyof typeof MODEL_LAYER_CONFIG]][]).map(([key, cfg]) => {
                const count = modelLayerCounts[key as keyof typeof modelLayerCounts];
                const pct = Math.round((count / (observations.length || 1)) * 100);
                return (
                  <div key={key} className="rounded-xl border p-4 space-y-3" style={{ borderColor: cfg.color + "30" }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                        <span className="text-xs font-medium text-zinc-500">{cfg.label}</span>
                      </div>
                      <span className="text-xs text-zinc-400">{pct}%</span>
                    </div>
                    <div className="text-2xl font-bold" style={{ color: cfg.color }}>{count}</div>
                    <div className="text-xs text-zinc-400">{cfg.labelJa}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Trust Distribution */}
        <Card className="border border-zinc-200 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Trust Chain <span className="text-zinc-300">/</span> 信頼度分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {([3, 2, 1] as const).map((score) => {
                const cfg = TRUST_LABELS[score];
                const count = trustCounts[score];
                const pct = Math.round((count / (observations.length || 1)) * 100);
                return (
                  <div key={score} className="flex items-center gap-4">
                    <div className="w-20">
                      <TrustBadge score={score} />
                    </div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-zinc-100">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold tabular-nums w-8 text-right">{count}</span>
                  </div>
                );
              })}
              <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
                固有知・汎用知・公知が重複して同じ知見を裏付ける場合、信頼度が高まります。<br />
                When proprietary, anonymized, and public sources corroborate the same finding, trust increases.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Provenance Breakdown */}
        <Card className="border border-zinc-200 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Provenance <span className="text-zinc-300">/</span> 知見出自
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.entries(PROVENANCE_CONFIG) as [string, (typeof PROVENANCE_CONFIG)[keyof typeof PROVENANCE_CONFIG]][]).map(([key, cfg]) => {
              const count = provenanceCounts[key as keyof typeof provenanceCounts];
              return (
                <div key={key} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Badge className="text-white border-0 text-[10px] font-semibold" style={{ backgroundColor: cfg.color }}>
                      {cfg.labelJa}
                    </Badge>
                    <span className="text-xs text-zinc-400">{cfg.label}</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* High-Trust Insights */}
      <Card className="border border-zinc-200 shadow-md">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">
            High-Trust Insights <span className="text-zinc-300">/</span> 高信頼インサイト
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {topInsights.map((ins) => (
            <div key={ins.id} className="flex items-start gap-3 rounded-lg border p-4">
              <TrustBadge score={ins.trustScore} />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{ins.text}</p>
                {ins.textEn && <p className="text-xs text-zinc-400">{ins.textEn}</p>}
              </div>
              <ImpactBadge min={ins.estimatedImpactMin} max={ins.estimatedImpactMax} kpi={ins.impactKPI} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Charts */}
      <DashboardCharts />

      {/* Top Clusters */}
      <Card className="border border-zinc-200 shadow-md">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">
            Similarity Clusters <span className="text-zinc-300">/</span> 類似クラスタ TOP5
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {clusters.map((c, i) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-zinc-50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 text-[10px] font-bold text-zinc-500">{i + 1}</span>
                <div>
                  <span className="text-sm font-medium">{c.name}</span>
                  {c.nameEn && <span className="text-xs text-zinc-400 ml-2">{c.nameEn}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.modelLayer && (
                  <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: MODEL_LAYER_CONFIG[c.modelLayer as keyof typeof MODEL_LAYER_CONFIG]?.color }}>
                    {c.modelLayer}
                  </Badge>
                )}
                <span className="text-sm font-bold tabular-nums">{c.memberCount}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ value, labelJa, labelEn, accent }: { value: number; labelJa: string; labelEn: string; accent: string }) {
  return (
    <Card className="border border-zinc-200 shadow-md overflow-hidden">
      <CardContent className="pt-5 pb-4 relative">
        <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: accent }} />
        <div className="text-3xl font-black tabular-nums" style={{ color: accent }}>{value}</div>
        <div className="text-xs font-bold text-zinc-700 mt-1">{labelJa}</div>
        <div className="text-[10px] text-zinc-500 font-medium">{labelEn}</div>
      </CardContent>
    </Card>
  );
}
