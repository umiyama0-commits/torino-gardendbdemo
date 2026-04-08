// 認証・認可: APIキーベースの簡易認証
// 管理者権限チェック用ユーティリティ

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

/** APIキーからユーザーを認証。未認証ならnull */
export async function authenticateRequest(req: NextRequest): Promise<AuthUser | null> {
  const apiKey = req.headers.get("x-api-key") || req.nextUrl.searchParams.get("apiKey");

  if (!apiKey) return null;

  const user = await prisma.user.findUnique({
    where: { apiKey },
    select: { id: true, name: true, email: true, role: true },
  });

  return user;
}

/** 管理者権限チェック。認証失敗 or 権限不足なら即座にエラーレスポンスを返す */
export async function requireAdmin(req: NextRequest): Promise<AuthUser | NextResponse> {
  // 開発モードではADMIN_API_KEYでバイパス可能
  const masterKey = process.env.ADMIN_API_KEY;
  const providedKey = req.headers.get("x-api-key") || req.nextUrl.searchParams.get("apiKey");

  if (masterKey && providedKey === masterKey) {
    return { id: "system", name: "System Admin", email: "admin@system", role: "admin" };
  }

  const user = await authenticateRequest(req);

  if (!user) {
    return NextResponse.json({ error: "認証が必要です（x-api-keyヘッダー）" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  return user;
}

/** 認証任意: 認証されていればユーザー情報を返す。されていなくてもnull */
export async function optionalAuth(req: NextRequest): Promise<AuthUser | null> {
  return authenticateRequest(req);
}
