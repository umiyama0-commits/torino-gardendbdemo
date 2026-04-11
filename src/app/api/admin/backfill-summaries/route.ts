// 既存ObservationにsummaryをバックフィルするワンショットAPI
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { generateSummary } from "@/lib/summary";

export async function POST() {
  const observations = await prisma.observation.findMany({
    where: { summary: null },
    select: { id: true, text: true },
  });

  let updated = 0;
  for (const obs of observations) {
    await prisma.observation.update({
      where: { id: obs.id },
      data: { summary: generateSummary(obs.text) },
    });
    updated++;
  }

  return NextResponse.json({ updated, total: observations.length });
}
