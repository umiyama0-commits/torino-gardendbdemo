import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // active, completed, paused
  const clientId = searchParams.get("clientId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (clientId) where.clientId = clientId;

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true, nameAnonymized: true, industryMajor: true } },
      _count: { select: { observations: true, uploadedFiles: true } },
    },
  });

  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { clientId, name, description, hypothesisTheme, primaryValueAxis, targetKPI,
    status, startDate, endDate } = body;

  if (!clientId || !name) {
    return NextResponse.json({ error: "clientId and name are required" }, { status: 400 });
  }

  // Auto-generate anonymized project name
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  const projCount = await prisma.project.count({ where: { clientId } });
  const nameAnonymized = `${client?.nameAnonymized || "企業"}PJ-${projCount + 1}`;

  const project = await prisma.project.create({
    data: {
      clientId, name, nameAnonymized, description, hypothesisTheme, primaryValueAxis, targetKPI,
      status: status || "active",
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
    include: {
      client: { select: { id: true, name: true, industryMajor: true } },
    },
  });

  await createAuditLog(user.id, "CREATE", "Project", project.id);
  return NextResponse.json(project);
}
