import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MODEL_LAYER_CONFIG, VALUE_AXIS_CONFIG } from "@/lib/constants";
import { TrustBadge, ImpactBadge } from "@/components/trust-badge";

export default async function PatternsPage() {
  const patterns = await prisma.crossIndustryPattern.findMany({ orderBy: { insightCount: "desc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Cross-Industry Patterns</h1>
        <p className="text-sm text-zinc-600 mt-1 font-medium">業種横断パターン &mdash; Universal patterns validated across industries</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {patterns.map((pattern) => {
          const layerCfg = pattern.modelLayer ? MODEL_LAYER_CONFIG[pattern.modelLayer as keyof typeof MODEL_LAYER_CONFIG] : null;
          const axisCfg = pattern.primaryValueAxis ? VALUE_AXIS_CONFIG[pattern.primaryValueAxis as keyof typeof VALUE_AXIS_CONFIG] : null;

          let industries: string[] = [];
          try { industries = JSON.parse(pattern.industries); } catch { industries = [pattern.industries]; }

          return (
            <Card key={pattern.id} className="border border-zinc-200 shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden flex flex-col">
              <div className="h-1" style={{ backgroundColor: layerCfg?.color || "#e4e4e7" }} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{pattern.name}</CardTitle>
                  <TrustBadge score={pattern.trustScore} />
                </div>
                {pattern.nameEn && <p className="text-xs text-zinc-400">{pattern.nameEn}</p>}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <p className="text-sm text-zinc-700 leading-relaxed">{pattern.description}</p>
                  {pattern.descriptionEn && <p className="text-xs text-zinc-400 leading-relaxed">{pattern.descriptionEn}</p>}

                  {/* Industries with taxonomy */}
                  <div className="flex flex-wrap gap-1.5">
                    {industries.map((ind) => {
                      const parts = ind.split("/");
                      return (
                        <Badge key={ind} variant="outline" className="text-[10px] font-normal">
                          {parts.length > 1 ? (
                            <><span className="font-medium">{parts[0]}</span><span className="text-zinc-300 mx-0.5">›</span>{parts[1]}</>
                          ) : ind}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                  <div className="flex items-center gap-1.5">
                    {layerCfg && <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: layerCfg.color }}>{layerCfg.label}</Badge>}
                    {axisCfg && <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: axisCfg.color }}>{axisCfg.labelJa}</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    <ImpactBadge min={pattern.estimatedImpactMin} max={pattern.estimatedImpactMax} kpi={pattern.impactKPI} />
                    <div className="text-right">
                      <span className="text-lg font-bold tabular-nums">{pattern.insightCount}</span>
                      <span className="text-[10px] text-zinc-400 ml-1">裏付け</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
