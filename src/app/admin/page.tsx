import { prisma } from "@/lib/prisma";
import { Suspense } from "react";
import { AdminPanel } from "./admin-panel";

export const dynamic = "force-dynamic";

async function AdminData() {
  const [users, configs, stats] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, apiKey: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.systemConfig.findMany({
      orderBy: [{ category: "asc" }, { key: "asc" }],
    }).catch(() => []),
    Promise.all([
      prisma.observation.count(),
      prisma.insight.count(),
      prisma.crossIndustryPattern.count(),
      prisma.compilationEvent.count(),
      prisma.qASession.count(),
      prisma.lintResult.count({ where: { status: "open" } }),
      prisma.similarityCluster.count(),
    ]).then(([obs, ins, pat, comp, qa, lint, cluster]) => ({
      observations: obs, insights: ins, patterns: pat,
      compilations: comp, qaSessions: qa, openLints: lint, clusters: cluster,
    })),
  ]);

  // 初回起動時にデフォルト設定を投入
  if (configs.length === 0) {
    await fetch(`${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/admin/config`).catch(() => {});
  }

  return (
    <AdminPanel
      users={users}
      configs={configs}
      stats={stats}
    />
  );
}

export default function AdminPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">管理設定</h1>
        <p className="text-zinc-500 text-sm mt-1">
          システム設定・ユーザー管理・稼働統計
        </p>
      </div>
      <Suspense fallback={<div className="text-zinc-400 text-sm">読み込み中...</div>}>
        <AdminData />
      </Suspense>
    </div>
  );
}
