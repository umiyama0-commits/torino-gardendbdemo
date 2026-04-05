import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      observations: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { tags: { include: { tag: true } } },
      },
      _count: { select: { observations: true, uploadedFiles: true } },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { name, description, hypothesisTheme, primaryValueAxis, targetKPI,
    status, startDate, endDate } = body;

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(hypothesisTheme !== undefined && { hypothesisTheme }),
      ...(primaryValueAxis !== undefined && { primaryValueAxis }),
      ...(targetKPI !== undefined && { targetKPI }),
      ...(status !== undefined && { status }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
    },
    include: {
      client: { select: { id: true, name: true, industryMajor: true } },
    },
  });

  await createAuditLog(user.id, "UPDATE", "Project", project.id);
  return NextResponse.json(project);
}
