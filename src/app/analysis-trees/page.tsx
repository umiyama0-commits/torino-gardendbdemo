import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AnalysisTreesPage() {
  const trees = await prisma.analysisTree.findMany({
    include: {
      project: { select: { id: true, name: true, client: { select: { name: true } } } },
      template: { select: { id: true, title: true } },
      _count: { select: { nodes: true, instances: true } },
    },
    orderBy: [{ isTemplate: "desc" }, { updatedAt: "desc" }],
  });

  const templates = trees.filter((t) => t.isTemplate);
  const instances = trees.filter((t) => !t.isTemplate);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">PF分析ツリー</h1>
        <p className="text-zinc-500 mt-1 text-sm">
          パフォーマンス・ファクター分析フレームワーク。テンプレートからPJ毎にクローンして使用。
        </p>
      </div>

      {/* Templates */}
      <section>
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
          テンプレート ({templates.length})
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tree) => (
            <Link key={tree.id} href={`/analysis-trees/${tree.id}`}>
              <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                <CardContent className="pt-5 pb-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-base leading-tight">{tree.title}</h3>
                    <Badge className="bg-violet-50 border border-violet-200 text-violet-700 text-[11px] px-1.5 py-0 shrink-0">
                      テンプレート
                    </Badge>
                  </div>
                  {tree.description && (
                    <p className="text-sm text-zinc-500 leading-relaxed line-clamp-2">
                      {tree.description}
                    </p>
                  )}
                  <div className="flex gap-4 text-xs text-zinc-400">
                    <span>{tree._count.nodes}ノード</span>
                    <span>{tree._count.instances}クローン</span>
                    <StatusBadge status={tree.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {templates.length === 0 && (
            <p className="text-zinc-400 text-sm col-span-full">テンプレートがまだありません</p>
          )}
        </div>
      </section>

      {/* Project Instances */}
      <section>
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
          プロジェクト別ツリー ({instances.length})
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((tree) => (
            <Link key={tree.id} href={`/analysis-trees/${tree.id}`}>
              <Card className="shadow-sm hover:shadow-md transition-shadow h-full">
                <CardContent className="pt-5 pb-5 space-y-3">
                  <h3 className="font-semibold text-base leading-tight">{tree.title}</h3>
                  {tree.project && (
                    <div className="flex gap-1.5">
                      <Badge className="bg-blue-50 border border-blue-200 text-blue-700 text-[11px] px-1.5 py-0">
                        {tree.project.client.name}
                      </Badge>
                      <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                        {tree.project.name}
                      </Badge>
                    </div>
                  )}
                  {tree.template && (
                    <p className="text-xs text-zinc-400">
                      元: {tree.template.title}
                    </p>
                  )}
                  <div className="flex gap-4 text-xs text-zinc-400">
                    <span>{tree._count.nodes}ノード</span>
                    <StatusBadge status={tree.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {instances.length === 0 && (
            <p className="text-zinc-400 text-sm col-span-full">プロジェクト別ツリーがまだありません</p>
          )}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    draft: { label: "下書き", cls: "text-zinc-500" },
    published: { label: "公開中", cls: "text-emerald-600" },
    archived: { label: "アーカイブ", cls: "text-zinc-400" },
  };
  const c = config[status] || config.draft;
  return <span className={c.cls}>{c.label}</span>;
}
