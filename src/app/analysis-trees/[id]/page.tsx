import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NODE_TYPE_CONFIG } from "@/lib/constants";
import { TreeActions } from "./tree-actions";

export const dynamic = "force-dynamic";

type Metric = {
  id: string;
  label: string;
  unit: string | null;
  valueBefore: string | null;
  valueAfter: string | null;
  colorBefore: string | null;
  colorAfter: string | null;
  trend: string | null;
  sortOrder: number;
};

type NodeLink = {
  id: string;
  linkType: string;
  note: string | null;
  targetNode?: { id: string; label: string; nodeType: string };
  sourceNode?: { id: string; label: string; nodeType: string };
};

type TreeNode = {
  id: string;
  parentId: string | null;
  templateNodeId: string | null;
  nodeType: string;
  label: string;
  description: string | null;
  sortOrder: number;
  linkedObservationIds: string | null;
  metrics: Metric[];
  outgoingLinks: NodeLink[];
  incomingLinks: NodeLink[];
};

export default async function AnalysisTreeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tree = await prisma.analysisTree.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, client: { select: { name: true } } } },
      template: { select: { id: true, title: true } },
      _count: { select: { instances: true } },
      nodes: {
        include: {
          metrics: { orderBy: { sortOrder: "asc" } },
          outgoingLinks: {
            include: { targetNode: { select: { id: true, label: true, nodeType: true } } },
          },
          incomingLinks: {
            include: { sourceNode: { select: { id: true, label: true, nodeType: true } } },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!tree) notFound();

  // Build tree hierarchy
  const rootNodes = tree.nodes.filter((n) => !n.parentId);
  const childMap = new Map<string, TreeNode[]>();
  for (const node of tree.nodes) {
    if (node.parentId) {
      const siblings = childMap.get(node.parentId) || [];
      siblings.push(node);
      childMap.set(node.parentId, siblings);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tree.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            {tree.isTemplate && (
              <Badge className="bg-violet-50 border border-violet-200 text-violet-700 text-xs">
                テンプレート
              </Badge>
            )}
            <StatusBadge status={tree.status} />
            {tree.project && (
              <span className="text-sm text-zinc-500">
                {tree.project.client.name} / {tree.project.name}
              </span>
            )}
            {tree.template && (
              <span className="text-xs text-zinc-400">
                元: {tree.template.title}
              </span>
            )}
          </div>
          {tree.description && (
            <p className="text-sm text-zinc-500 mt-2 max-w-2xl">{tree.description}</p>
          )}
        </div>
        <TreeActions treeId={tree.id} isTemplate={tree.isTemplate} instanceCount={tree._count.instances} />
      </div>

      {/* Stats */}
      <div className="flex gap-6">
        {Object.entries(NODE_TYPE_CONFIG).map(([type, config]) => {
          const count = tree.nodes.filter((n) => n.nodeType === type).length;
          if (count === 0) return null;
          return (
            <div key={type} className="flex items-center gap-2">
              <Badge className={`${config.bg} ${config.color} text-[11px] px-1.5 py-0`}>
                {config.label}
              </Badge>
              <span className="text-sm font-semibold tabular-nums">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Tree Structure */}
      <div className="space-y-6">
        {rootNodes.map((root) => (
          <CategorySection key={root.id} node={root} childMap={childMap} />
        ))}
      </div>
    </div>
  );
}

function CategorySection({
  node,
  childMap,
}: {
  node: TreeNode;
  childMap: Map<string, TreeNode[]>;
}) {
  const children = childMap.get(node.id) || [];
  const config = NODE_TYPE_CONFIG[node.nodeType];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Badge className={`${config.bg} ${config.color} text-xs px-2 py-0.5`}>
            {config.label}
          </Badge>
          <CardTitle className="text-lg">{node.label}</CardTitle>
        </div>
        {node.description && (
          <p className="text-sm text-zinc-500 mt-1">{node.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {children.map((child) => (
          <PerformanceBlock key={child.id} node={child} childMap={childMap} />
        ))}
      </CardContent>
    </Card>
  );
}

function PerformanceBlock({
  node,
  childMap,
}: {
  node: TreeNode;
  childMap: Map<string, TreeNode[]>;
}) {
  const children = childMap.get(node.id) || [];
  const config = NODE_TYPE_CONFIG[node.nodeType];

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <Badge className={`${config.bg} ${config.color} text-[11px] px-1.5 py-0`}>
          {config.label}
        </Badge>
        <span className="font-medium text-sm">{node.label}</span>
      </div>

      {/* Metrics for this node */}
      {node.metrics.length > 0 && <MetricsTable metrics={node.metrics} />}

      {/* Links */}
      {node.outgoingLinks.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {node.outgoingLinks.map((link) => (
            <Badge key={link.id} variant="outline" className="text-[11px] px-1.5 py-0">
              {link.linkType === "addresses" ? "→対策:" : link.linkType === "supports" ? "→補強:" : "→矛盾:"}
              {link.targetNode?.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Child nodes */}
      {children.length > 0 && (
        <div className="mt-3 ml-4 space-y-2 border-l-2 border-zinc-100 pl-4">
          {children.map((child) => (
            <NodeItem key={child.id} node={child} childMap={childMap} />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeItem({
  node,
  childMap,
}: {
  node: TreeNode;
  childMap: Map<string, TreeNode[]>;
}) {
  const children = childMap.get(node.id) || [];
  const config = NODE_TYPE_CONFIG[node.nodeType];

  return (
    <div>
      <div className="flex items-center gap-2">
        <Badge className={`${config.bg} ${config.color} text-[11px] px-1.5 py-0`}>
          {config.label}
        </Badge>
        <span className="text-sm">{node.label}</span>
      </div>

      {node.metrics.length > 0 && (
        <div className="mt-1.5 ml-1">
          <MetricsTable metrics={node.metrics} />
        </div>
      )}

      {node.outgoingLinks.length > 0 && (
        <div className="mt-1 ml-1 flex flex-wrap gap-1">
          {node.outgoingLinks.map((link) => (
            <Badge key={link.id} variant="outline" className="text-[10px] px-1 py-0">
              → {link.targetNode?.label}
            </Badge>
          ))}
        </div>
      )}

      {children.length > 0 && (
        <div className="mt-2 ml-4 space-y-2 border-l-2 border-zinc-50 pl-3">
          {children.map((child) => (
            <NodeItem key={child.id} node={child} childMap={childMap} />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricsTable({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="inline-flex flex-wrap gap-2">
      {metrics.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-1.5 text-xs bg-zinc-50 rounded px-2 py-1"
        >
          <span className="text-zinc-500">{m.label}</span>
          {m.valueBefore != null && (
            <span
              className="font-mono font-medium"
              style={{ color: m.colorBefore || undefined }}
            >
              {m.valueBefore}
            </span>
          )}
          {m.valueBefore != null && m.valueAfter != null && (
            <span className="text-zinc-300">→</span>
          )}
          {m.valueAfter != null && (
            <span
              className="font-mono font-medium"
              style={{ color: m.colorAfter || undefined }}
            >
              {m.valueAfter}
            </span>
          )}
          {m.unit && <span className="text-zinc-400">{m.unit}</span>}
          {m.trend === "improved" && <span className="text-emerald-500">&#9650;</span>}
          {m.trend === "worsened" && <span className="text-red-500">&#9660;</span>}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    draft: { label: "下書き", cls: "bg-zinc-100 text-zinc-600 border border-zinc-200" },
    published: { label: "公開中", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    archived: { label: "アーカイブ", cls: "bg-zinc-50 text-zinc-400 border border-zinc-200" },
  };
  const c = config[status] || config.draft;
  return <Badge className={`${c.cls} text-xs`}>{c.label}</Badge>;
}
