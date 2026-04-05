import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * A. 沈殿スキャン API
 * 90日以上前の観測で、パターンに紐付いていないものを「沈殿」ステータスに変更
 * POST /api/sediment/scan
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  // 90日以上前、まだactiveステータス、パターンクラスタに未所属の観測を沈殿化
  const sedimentCandidates = await prisma.observation.findMany({
    where: {
      sedimentStatus: "active",
      createdAt: { lt: cutoffDate },
      emergingClusterMembers: { none: {} },
    },
    select: { id: true },
  });

  const ids = sedimentCandidates.map(o => o.id);

  if (ids.length > 0) {
    await prisma.observation.updateMany({
      where: { id: { in: ids } },
      data: { sedimentStatus: "sediment" },
    });
  }

  return NextResponse.json({
    scanned: sedimentCandidates.length,
    sedimentedCount: ids.length,
    cutoffDate: cutoffDate.toISOString(),
  });
}

/**
 * GET /api/sediment/scan — 沈殿データの統計
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [activeCount, sedimentCount, compostedCount, totalClusters, emergingClusters] = await Promise.all([
    prisma.observation.count({ where: { sedimentStatus: "active" } }),
    prisma.observation.count({ where: { sedimentStatus: "sediment" } }),
    prisma.observation.count({ where: { sedimentStatus: "composted" } }),
    prisma.emergingCluster.count(),
    prisma.emergingCluster.count({ where: { status: "emerging" } }),
  ]);

  return NextResponse.json({
    activeCount,
    sedimentCount,
    compostedCount,
    totalClusters,
    emergingClusters,
  });
}
