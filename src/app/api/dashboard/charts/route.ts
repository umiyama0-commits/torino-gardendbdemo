import { prisma } from "@/lib/prisma";
import { PROVENANCE_CONFIG } from "@/lib/constants";
import { NextResponse } from "next/server";

export async function GET() {
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const observations = await prisma.observation.findMany({
    where: { createdAt: { gte: twelveMonthsAgo } },
    select: {
      id: true,
      modelLayer: true,
      provenance: true,
      estimatedImpactMax: true,
      createdAt: true,
    },
  });

  // Build ordered month keys
  const monthKeys: string[] = [];
  const monthLabels: Record<string, string> = {};
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthKeys.push(key);
    monthLabels[key] = `${d.getMonth() + 1}月`;
  }

  // Monthly observation counts
  const monthlyCountMap = new Map<string, number>();
  for (const k of monthKeys) monthlyCountMap.set(k, 0);
  for (const obs of observations) {
    const key = `${obs.createdAt.getFullYear()}-${String(obs.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyCountMap.has(key)) {
      monthlyCountMap.set(key, monthlyCountMap.get(key)! + 1);
    }
  }
  const monthlyObservations = monthKeys.map((k) => ({
    month: monthLabels[k],
    count: monthlyCountMap.get(k) || 0,
  }));

  // Impact distribution
  const buckets = [
    { range: "0-2%", min: 0, max: 2, count: 0 },
    { range: "2-5%", min: 2, max: 5, count: 0 },
    { range: "5-10%", min: 5, max: 10, count: 0 },
    { range: "10-20%", min: 10, max: 20, count: 0 },
    { range: "20%+", min: 20, max: Infinity, count: 0 },
  ];
  for (const obs of observations) {
    if (obs.estimatedImpactMax == null) continue;
    const val = obs.estimatedImpactMax;
    for (const bucket of buckets) {
      if (val >= bucket.min && val < bucket.max) {
        bucket.count++;
        break;
      }
    }
  }
  const impactDistribution = buckets.map(({ range, count }) => ({ range, count }));

  // Layer trend (stacked: month -> { MOVEMENT, APPROACH, BREAKDOWN, TRANSFER })
  const layerMonthCounts: Record<string, Record<string, number>> = {};
  for (const k of monthKeys) {
    layerMonthCounts[k] = { MOVEMENT: 0, APPROACH: 0, BREAKDOWN: 0, TRANSFER: 0 };
  }
  for (const obs of observations) {
    const key = `${obs.createdAt.getFullYear()}-${String(obs.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (key in layerMonthCounts && obs.modelLayer in layerMonthCounts[key]) {
      layerMonthCounts[key][obs.modelLayer]++;
    }
  }
  const layerTrend = monthKeys.map((k) => ({
    month: monthLabels[k],
    ...layerMonthCounts[k],
  }));

  // Provenance distribution
  const provenanceMap = new Map<string, number>();
  for (const obs of observations) {
    provenanceMap.set(obs.provenance, (provenanceMap.get(obs.provenance) || 0) + 1);
  }
  const provenanceDistribution = Object.entries(PROVENANCE_CONFIG).map(([key, cfg]) => ({
    name: cfg.label,
    nameJa: cfg.labelJa,
    value: provenanceMap.get(key) || 0,
    color: cfg.color,
  }));

  return NextResponse.json({
    monthlyObservations,
    impactDistribution,
    layerTrend,
    provenanceDistribution,
  });
}
