import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-auth";
import { NextResponse } from "next/server";

/**
 * Admin: APIクライアント一覧取得
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const clients = await prisma.apiClient.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      apiKeyPrefix: true,
      status: true,
      allowedCategories: true,
      allowedIndustries: true,
      allowedEndpoints: true,
      rateLimitPerMinute: true,
      rateLimitPerDay: true,
      monthlyQuota: true,
      totalRequests: true,
      lastUsedAt: true,
      contactName: true,
      contactEmail: true,
      createdAt: true,
      expiresAt: true,
      _count: { select: { accessLogs: true } },
    },
  });

  return NextResponse.json(clients);
}

/**
 * Admin: APIクライアント新規作成
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    description,
    allowedCategories = [],
    allowedIndustries = [],
    allowedEndpoints = [],
    rateLimitPerMinute = 60,
    rateLimitPerDay = 10000,
    monthlyQuota = 100000,
    contactName,
    contactEmail,
    expiresAt,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // APIキー生成
  const { rawKey, hashedKey, prefix } = generateApiKey();

  const client = await prisma.apiClient.create({
    data: {
      name,
      description: description || null,
      apiKey: hashedKey,
      apiKeyPrefix: prefix,
      allowedCategories: JSON.stringify(allowedCategories),
      allowedIndustries: JSON.stringify(allowedIndustries),
      allowedEndpoints: JSON.stringify(allowedEndpoints),
      rateLimitPerMinute,
      rateLimitPerDay,
      monthlyQuota,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  // 生のAPIキーは作成時のみ返す（以後はハッシュのみDB保存）
  return NextResponse.json({
    ...client,
    apiKeyRaw: rawKey,
    message: "API key is shown only once. Please save it securely.",
  });
}
