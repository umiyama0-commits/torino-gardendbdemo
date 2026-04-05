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
  const { text, textEn, modelLayer, primaryValueAxis, provenance, confidence, tagIds,
    subjectivity, estimatedImpactMin, estimatedImpactMax, impactKPI, observedAt, projectId } = body;

  if (!text || !modelLayer) {
    return NextResponse.json({ error: "text and modelLayer are required" }, { status: 400 });
  }

  // Permission check for consultants: must be assigned to the project
  if (user.role === "consultant" && projectId) {
    const assignment = await prisma.projectAssignment.findUnique({
      where: { userId_projectId: { userId: user.id, projectId } },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Not assigned to this project" }, { status: 403 });
    }
    // Verify project is active
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { status: true } });
    if (project?.status !== "active") {
      return NextResponse.json({ error: "Project is not active" }, { status: 403 });
    }
  }

  const observation = await prisma.observation.create({
    data: {
      text,
      textEn: textEn || null,
      modelLayer,
      primaryValueAxis: primaryValueAxis || null,
      provenance: provenance || "FIELD_OBSERVED",
      confidence: confidence || "MEDIUM",
      subjectivity: subjectivity || "objective",
      estimatedImpactMin: estimatedImpactMin ?? null,
      estimatedImpactMax: estimatedImpactMax ?? null,
      impactKPI: impactKPI || null,
      observedAt: observedAt ? new Date(observedAt) : null,
      projectId: projectId || null,
      createdById: user.id,
      tags: tagIds?.length
        ? { create: tagIds.map((tagId: string) => ({ tagId })) }
        : undefined,
    },
    include: { tags: { include: { tag: true } } },
  });

  await createAuditLog(user.id, "CREATE", "Observation", observation.id);

  return NextResponse.json(observation);
}
