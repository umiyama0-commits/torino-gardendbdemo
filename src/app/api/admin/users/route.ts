// ユーザー管理API: 一覧・作成・APIキー発行
// GET: ユーザー一覧
// POST: ユーザー作成 + APIキー自動発行

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

// GET: ユーザー一覧
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      apiKey: true,
      lastLoginAt: true,
      createdAt: true,
      _count: { select: { analysisTrees: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

// POST: ユーザー作成
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { name, email, role } = body as { name: string; email: string; role?: string };

  if (!name || !email) {
    return NextResponse.json({ error: "nameとemailが必要です" }, { status: 400 });
  }

  // APIキー自動生成
  const apiKey = `tg_${randomBytes(24).toString("hex")}`;

  const user = await prisma.user.create({
    data: {
      name,
      email,
      role: role || "consultant",
      apiKey,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
