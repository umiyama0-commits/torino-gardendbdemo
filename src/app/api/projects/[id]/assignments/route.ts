import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId: id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { assignedAt: "desc" },
  });

  return NextResponse.json(assignments);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { userId, role } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const assignment = await prisma.projectAssignment.upsert({
    where: { userId_projectId: { userId, projectId: id } },
    update: { role: role || "member" },
    create: { userId, projectId: id, role: role || "member" },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  await createAuditLog(user.id, "CREATE", "ProjectAssignment", assignment.id);
  return NextResponse.json(assignment);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  await prisma.projectAssignment.delete({
    where: { userId_projectId: { userId, projectId: id } },
  });

  return NextResponse.json({ success: true });
}
