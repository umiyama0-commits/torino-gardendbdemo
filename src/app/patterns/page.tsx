import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MODEL_LAYER_CONFIG, VALUE_AXIS_CONFIG } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PatternsPage() {
  const patterns = await prisma.crossIndustryPattern.findMany({
    orderBy: { insightCount: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Cross-Industry Patterns
        </h1>
        <p className="text-zinc-500 mt-1 text-sm">
          業種を横断して確認された共通パターン。裏付け件数が多いほど再現性が高い。
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {patterns.map((pattern) => {
          const industries: string[] = JSON.parse(pattern.industries);
          const layerConfig = pattern.modelLayer
            ? MODEL_LAYER_CONFIG[pattern.modelLayer]
            : null;
          const valueConfig = pattern.primaryValueAxis
            ? VALUE_AXIS_CONFIG[pattern.primaryValueAxis]
            : null;

          return (
            <Card
              key={pattern.id}
              className="shadow-sm hover:shadow-md transition-shadow group"
            >
              <CardContent className="pt-5 pb-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-base leading-tight">
                    {pattern.name}
                  </h3>
                  <div className="flex items-baseline gap-0.5 shrink-0 ml-3">
                    <span className="text-2xl font-bold tabular-nums">
                      {pattern.insightCount}
                    </span>
                    <span className="text-xs text-zinc-400">件</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-zinc-600 leading-relaxed">
                  {pattern.description}
                </p>

                {/* Industries */}
                <div>
                  <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                    確認業種
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {industries.map((ind) => (
                      <Badge
                        key={ind}
                        className="bg-violet-50 border border-violet-200 text-violet-700 text-[11px] px-2 py-0.5"
                      >
                        {ind}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Meta badges */}
                <div className="flex gap-1.5 pt-1 border-t border-zinc-100">
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
