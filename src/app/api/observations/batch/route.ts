import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { observations } = body;

  if (!Array.isArray(observations) || observations.length === 0) {
    return NextResponse.json({ error: "observations array is required" }, { status: 400 });
  }

  const created = [];

  for (const obs of observations) {
    const observation = await prisma.observation.create({
      data: {
        text: obs.text,
        textEn: obs.textEn || null,
        modelLayer: obs.modelLayer,
        primaryValueAxis: obs.primaryValueAxis || null,
        provenance: obs.provenance || "FIELD_OBSERVED",
        confidence: obs.confidence || "MEDIUM",
        subjectivity: obs.subjectivity || "objective",
        estimatedImpactMin: obs.estimatedImpactMin ?? null,
        estimatedImpactMax: obs.estimatedImpactMax ?? null,
        impactKPI: obs.impactKPI || null,
        storeId: obs.storeId || null,
        projectId: obs.projectId || null,
        createdById: user.id,
        tags: obs.tagIds?.length
          ? { create: obs.tagIds.map((tagId: string) => ({ tagId })) }
          : undefined,
      },
      include: { tags: { include: { tag: true } } },
    });

    await createAuditLog(user.id, "CREATE", "Observation", observation.id);
    created.push(observation);
  }

  return NextResponse.json(created);
}
