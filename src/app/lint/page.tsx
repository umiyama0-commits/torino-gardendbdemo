import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LintActions } from "./lint-actions";

export const dynamic = "force-dynamic";

const TYPE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  contradiction: { label: "矛盾", bg: "bg-red-50", color: "text-red-700" },
  gap: { label: "ギャップ", bg: "bg-amber-50", color: "text-amber-700" },
  connection: { label: "接続発見", bg: "bg-blue-50", color: "text-blue-700" },
  topic_suggestion: { label: "トピック提案", bg: "bg-violet-50", color: "text-violet-700" },
};

const SEVERITY_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  critical: { label: "重大", bg: "bg-red-100", color: "text-red-800" },
  warning: { label: "注意", bg: "bg-amber-100", color: "text-amber-800" },
  info: { label: "情報", bg: "bg-zinc-100", color: "text-zinc-600" },
};

const STATUS_CONFIG: Record<string, { label: string }> = {
  open: { label: "未対応" },
  resolved: { label: "解決済" },
  dismissed: { label: "却下" },
};

export default async function LintPage() {
  const [openResults, resolvedResults, compilationEvents, observationCount, insightCount] = await Promise.all([
    prisma.lintResult.findMany({
      where: { status: "open" },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.lintResult.findMany({
      where: { status: { in: ["resolved", "dismissed"] } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.compilationEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.observation.count(),
    prisma.insight.count(),
  ]);

  const typeCounts = openResults.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">品質検証（Linting）</h1>
          <p className="text-zinc-500 mt-1 text-sm">
            ナレッジベースの矛盾検出・ギャップ補完・接続発見・トピック提案
          </p>
        </div>
        <LintActions observationCount={observationCount} insightCount={insightCount} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(TYPE_CONFIG).map(([key, config]) => (
          <Card key={key} className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <p className={`text-xs font-medium ${config.color} uppercase tracking-wider`}>
                {config.label}
              </p>
              <p className="text-2xl font-bold tabular-nums mt-1">
                {typeCounts[key] || 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Open Results */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
            未対応の検出事項 ({openResults.length}件)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {openResults.length === 0 ? (
            <p className="text-zinc-400 text-sm py-4 text-center">
              未対応の検出事項はありません。「品質チェック実行」で検証を開始できます。
            </p>
          ) : (
            <div className="divide-y">
              {openResults.map((result) => {
                const typeConf = TYPE_CONFIG[result.type] || TYPE_CONFIG.gap;
                const sevConf = SEVERITY_CONFIG[result.severity] || SEVERITY_CONFIG.info;
                return (
                  <div key={result.id} className="py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={`${typeConf.bg} ${typeConf.color} text-[11px] px-1.5 py-0`}>
                        {typeConf.label}
                      </Badge>
                      <Badge className={`${sevConf.bg} ${sevConf.color} text-[11px] px-1.5 py-0`}>
                        {sevConf.label}
                      </Badge>
                      <span className="text-[11px] text-zinc-400">
                        対象: {result.targetType}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-700">{result.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Activity */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
            パイプライン稼働履歴
          </CardTitle>
        </CardHeader>
        <CardContent>
          {compilationEvents.length === 0 ? (
            <p className="text-zinc-400 text-sm py-4 text-center">
              まだパイプラインの稼働記録がありません。
            </p>
          ) : (
            <div className="divide-y">
              {compilationEvents.map((event) => (
                <div key={event.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-zinc-100 text-zinc-600 text-[11px] px-1.5 py-0">
                      {event.trigger}
                    </Badge>
                    <span className="text-zinc-600">
                      {event.sourceType && `${event.sourceType} → `}{event.resultType || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    {event.llmModel && <span>{event.llmModel}</span>}
                    <span>{new Date(event.createdAt).toLocaleString("ja-JP")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolved */}
      {resolvedResults.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
              対応済み ({resolvedResults.length}件)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {resolvedResults.map((result) => {
                const typeConf = TYPE_CONFIG[result.type] || TYPE_CONFIG.gap;
                const statusConf = STATUS_CONFIG[result.status] || STATUS_CONFIG.resolved;
                return (
                  <div key={result.id} className="py-2.5 flex items-center gap-2 text-sm text-zinc-400">
                    <Badge className={`${typeConf.bg} ${typeConf.color} text-[11px] px-1.5 py-0 opacity-60`}>
                      {typeConf.label}
                    </Badge>
                    <span className="line-through">{result.description}</span>
                    <Badge className="bg-zinc-100 text-zinc-500 text-[10px] px-1 py-0 ml-auto">
                      {statusConf.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
