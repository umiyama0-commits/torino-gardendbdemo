import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAuditLog, diffChanges } from "@/lib/audit";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  ctx: RouteContext
) {
  const { id } = await ctx.params;

  const observation = await prisma.observation.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      store: { include: { client: true } },
      bookmarks: true,
      comments: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!observation) {
    return NextResponse.json({ error: "Observation not found" }, { status: 404 });
  }

  return NextResponse.json(observation);
}

export async function PUT(
  request: Request,
  ctx: RouteContext
) {
  const { id } = await ctx.params;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.observation.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Observation not found" }, { status: 404 });
  }

  const body = await request.json();
  const updatableFields = [
    "text", "textEn", "modelLayer", "provenance",
    "primaryValueAxis", "confidence",
    "estimatedImpactMin", "estimatedImpactMax",
    "impactKPI", "trustScore",
  ] as const;

  const data: Record<string, unknown> = {};
  for (const field of updatableFields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }
  // Handle observedAt separately (date conversion)
  if (body.observedAt !== undefined) {
    data.observedAt = body.observedAt ? new Date(body.observedAt) : null;
  }

  const observation = await prisma.observation.update({
    where: { id },
    data,
    include: { tags: { include: { tag: true } } },
  });

  const diff = diffChanges(
    existing as unknown as Record<string, unknown>,
    data
  );
  if (Object.keys(diff).length > 0) {
    await createAuditLog(user.id, "UPDATE", "Observation", id, diff);
  }

  return NextResponse.json(observation);
}

export async function DELETE(
  request: Request,
  ctx: RouteContext
) {
  const { id } = await ctx.params;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin" && user.role !== "consultant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.observation.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Observation not found" }, { status: 404 });
  }

  await createAuditLog(user.id, "DELETE", "Observation", id);
  await prisma.observation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
