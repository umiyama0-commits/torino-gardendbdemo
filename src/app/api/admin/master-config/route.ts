import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { invalidateMasterConfigCache } from "@/lib/master-config";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const configs = await prisma.masterConfig.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json(configs);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const { category, key, labelEn, labelJa, color, description, sortOrder } = body;

  if (!category || !key || !labelEn || !labelJa || !color) {
    return NextResponse.json({ error: "category, key, labelEn, labelJa, color are required" }, { status: 400 });
  }

  const config = await prisma.masterConfig.create({
    data: {
      category,
      key: key.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
      labelEn,
      labelJa,
      color,
      description: description || null,
      sortOrder: sortOrder ?? 0,
    },
  });

  invalidateMasterConfigCache();
  return NextResponse.json(config);
}
