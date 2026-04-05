import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { projects: true, stores: true } },
    },
  });

  return NextResponse.json(clients);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, industryMajor, industryMajorEn, industryMinor, industryMinorEn,
    scale, contactPerson, contactEmail, contactPhone, address, notes } = body;

  if (!name || !industryMajor) {
    return NextResponse.json({ error: "name and industryMajor are required" }, { status: 400 });
  }

  // Auto-generate anonymized name
  const count = await prisma.client.count({ where: { industryMajor } });
  const nameAnonymized = `${industryMajor}${String.fromCharCode(65 + count)}社`;

  const client = await prisma.client.create({
    data: {
      name, nameAnonymized, industryMajor, industryMajorEn, industryMinor, industryMinorEn,
      scale, contactPerson, contactEmail, contactPhone, address, notes,
    },
  });

  await createAuditLog(user.id, "CREATE", "Client", client.id);
  return NextResponse.json(client);
}
