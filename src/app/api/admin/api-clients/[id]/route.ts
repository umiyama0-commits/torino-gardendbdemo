import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Admin: APIクライアント更新
 */
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
  const {
    name,
    description,
    status,
    allowedCategories,
    allowedIndustries,
    allowedEndpoints,
    rateLimitPerMinute,
    rateLimitPerDay,
    monthlyQuota,
    contactName,
    contactEmail,
    expiresAt,
  } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (status !== undefined) data.status = status;
  if (allowedCategories !== undefined) data.allowedCategories = JSON.stringify(allowedCategories);
  if (allowedIndustries !== undefined) data.allowedIndustries = JSON.stringify(allowedIndustries);
  if (allowedEndpoints !== undefined) data.allowedEndpoints = JSON.stringify(allowedEndpoints);
  if (rateLimitPerMinute !== undefined) data.rateLimitPerMinute = rateLimitPerMinute;
  if (rateLimitPerDay !== undefined) data.rateLimitPerDay = rateLimitPerDay;
  if (monthlyQuota !== undefined) data.monthlyQuota = monthlyQuota;
  if (contactName !== undefined) data.contactName = contactName;
  if (contactEmail !== undefined) data.contactEmail = contactEmail;
  if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;

  const client = await prisma.apiClient.update({
    where: { id },
    data,
  });

  return NextResponse.json(client);
}

/**
 * Admin: APIクライアントの利用ログ取得
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "50");

  const [client, logs] = await Promise.all([
    prisma.apiClient.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        apiKeyPrefix: true,
        status: true,
        totalRequests: true,
        lastUsedAt: true,
      },
    }),
    prisma.apiAccessLog.findMany({
      where: { apiClientId: id },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ client, logs });
}
