import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { invalidateMasterConfigCache } from "@/lib/master-config";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { labelEn, labelJa, color, description, sortOrder, isActive } = body;

  const config = await prisma.masterConfig.update({
    where: { id },
    data: {
      ...(labelEn !== undefined && { labelEn }),
      ...(labelJa !== undefined && { labelJa }),
      ...(color !== undefined && { color }),
      ...(description !== undefined && { description }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  invalidateMasterConfigCache();
  return NextResponse.json(config);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;

  // Soft delete: set isActive = false
  const config = await prisma.masterConfig.update({
    where: { id },
    data: { isActive: false },
  });

  invalidateMasterConfigCache();
  return NextResponse.json(config);
}
