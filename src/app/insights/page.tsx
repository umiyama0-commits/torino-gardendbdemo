import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MODEL_LAYER_CONFIG, VALUE_AXIS_CONFIG, PROVENANCE_CONFIG } from "@/lib/constants";
import { InsightActions } from "./insight-actions";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const insights = await prisma.insight.findMany({
    include: {
      tags: { include: { tag: true } },
      sourceObservations: {
        include: {
          observation: {
            select: { id: true, text: true, modelLayer: true, provenance: true },
          },
        },
      },
    },
    orderBy: { trustScore: "desc" },
    take: 100,
  });

  const observationCount = await prisma.observation.count();

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">洞察（Insight）</h1>
          <p className="text-zinc-500 mt-1 text-sm">
            複数の観測データから導出された一般化された知見。信頼スコア順に表示。
          </p>
        </div>
        <InsightActions observationCount={observationCount} />
      </div>

      {insights.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="text-zinc-400 text-sm">
              まだ洞察がありません。観測データが2件以上あれば「Insight生成」ボタンで自動導出できます。
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => {
            const layerConfig = insight.modelLayer
              ? MODEL_LAYER_CONFIG[insight.modelLayer]
              : null;
            const valueConfig = insight.primaryValueAxis
              ? VALUE_AXIS_CONFIG[insight.primaryValueAxis]
              : null;
            const provConfig = PROVENANCE_CONFIG[insight.provenance];

            return (
              <Card key={insight.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-5 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm leading-relaxed">{insight.text}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-zinc-400">信頼スコア</p>
                        <p className="text-xl font-bold tabular-nums">
                          {(insight.trustScore * 100).toFixed(0)}
                          <span className="text-xs text-zinc-400">%</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5">
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
                    {provConfig && (
                      <Badge className={`${provConfig.bg} ${provConfig.color} text-[11px] px-1.5 py-0`}>
                        {provConfig.shortLabel}
                      </Badge>
                    )}
                    <Badge className="bg-zinc-100 text-zinc-600 text-[11px] px-1.5 py-0">
                      根拠強度: {insight.evidenceStrength === "HIGH" ? "高" : insight.evidenceStrength === "MEDIUM" ? "中" : "低"}
                    </Badge>
                    <Badge className="bg-zinc-100 text-zinc-600 text-[11px] px-1.5 py-0">
                      汎用性: {insight.generalizability === "HIGH" ? "高" : insight.generalizability === "MEDIUM" ? "中" : "低"}
                    </Badge>
                  </div>

                  {/* Conditions */}
                  {(insight.applicableConditions || insight.counterConditions) && (
                    <div className="grid md:grid-cols-2 gap-3 text-xs">
                      {insight.applicableConditions && (
                        <div className="bg-emerald-50 rounded-md p-2.5">
                          <p className="font-medium text-emerald-700 mb-0.5">適用条件</p>
                          <p className="text-emerald-600">{insight.applicableConditions}</p>
                        </div>
                      )}
                      {insight.counterConditions && (
                        <div className="bg-amber-50 rounded-md p-2.5">
                          <p className="font-medium text-amber-700 mb-0.5">非適用条件</p>
                          <p className="text-amber-600">{insight.counterConditions}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Source Observations */}
                  {insight.sourceObservations.length > 0 && (
                    <div className="border-t border-zinc-100 pt-3">
                      <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
                        根拠となる観測データ ({insight.sourceObservations.length}件)
                      </p>
                      <div className="space-y-1.5">
                        {insight.sourceObservations.map((link) => {
                          const obsProvConfig = PROVENANCE_CONFIG[link.observation.provenance];
                          return (
                            <div key={link.id} className="flex items-start gap-2 text-xs">
                              {obsProvConfig && (
                                <Badge className={`${obsProvConfig.bg} ${obsProvConfig.color} text-[10px] px-1 py-0 shrink-0 mt-0.5`}>
                                  {obsProvConfig.shortLabel}
                                </Badge>
                              )}
                              <p className="text-zinc-600 line-clamp-2">{link.observation.text}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
