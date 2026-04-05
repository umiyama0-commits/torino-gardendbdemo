import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  ctx: RouteContext
) {
  const { id } = await ctx.params;

  const logs = await prisma.auditLog.findMany({
    where: { entityType: "Observation", entityId: id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(logs);
}
