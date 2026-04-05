import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [
    totalAll,
    totalToday,
    totalThisWeek,
    myTotal,
    myToday,
    layerCounts,
    recentObservations,
  ] = await Promise.all([
    prisma.observation.count(),
    prisma.observation.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.observation.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.observation.count({ where: { createdById: user.id } }),
    prisma.observation.count({ where: { createdById: user.id, createdAt: { gte: todayStart } } }),
    prisma.observation.groupBy({
      by: ["modelLayer"],
      _count: { id: true },
    }),
    prisma.observation.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        text: true,
        modelLayer: true,
        primaryValueAxis: true,
        provenance: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  // Coverage calculation
  const layers = ["MOVEMENT", "APPROACH", "BREAKDOWN", "TRANSFER"];
  const coveredLayers = layerCounts.filter(l => l._count.id > 0).length;
  const coveragePercent = Math.round((coveredLayers / layers.length) * 100);

  // Streak - consecutive days with observations
  const recentDays = await prisma.observation.findMany({
    where: { createdById: user.id },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  let streak = 0;
  if (recentDays.length > 0) {
    const daySet = new Set(recentDays.map(r => r.createdAt.toISOString().slice(0, 10)));
    const checkDate = new Date(todayStart);
    // If nothing today, start from yesterday
    if (!daySet.has(checkDate.toISOString().slice(0, 10))) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (daySet.has(checkDate.toISOString().slice(0, 10))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  return NextResponse.json({
    totalAll,
    totalToday,
    totalThisWeek,
    myTotal,
    myToday,
    coveragePercent,
    streak,
    recent: recentObservations.map(o => ({
      id: o.id,
      text: o.text.slice(0, 60),
      modelLayer: o.modelLayer,
      primaryValueAxis: o.primaryValueAxis,
      provenance: o.provenance,
      createdAt: o.createdAt,
      createdBy: o.createdBy?.name || "—",
    })),
  });
}
