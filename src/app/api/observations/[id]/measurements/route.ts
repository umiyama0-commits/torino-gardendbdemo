import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * GET /api/observations/[id]/measurements — 計測データ一覧
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const measurements = await prisma.observationMeasurement.findMany({
    where: { observationId: id },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json(measurements);
}

/**
 * POST /api/observations/[id]/measurements — 計測データ追加
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { category, label, value, unit, sortOrder } = body;

  if (!category || !label || !value) {
    return NextResponse.json({ error: "category, label, value are required" }, { status: 400 });
  }

  const measurement = await prisma.observationMeasurement.create({
    data: {
      observationId: id,
      category,
      label,
      value,
      unit: unit || null,
      sortOrder: sortOrder ?? 0,
    },
  });

  return NextResponse.json(measurement);
}

/**
 * DELETE /api/observations/[id]/measurements — 計測データ削除
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const measurementId = searchParams.get("measurementId");
  if (!measurementId) {
    return NextResponse.json({ error: "measurementId is required" }, { status: 400 });
  }

  await prisma.observationMeasurement.delete({
    where: { id: measurementId },
  });

  return NextResponse.json({ success: true });
}
