import { verifyApiKey, logApiAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * 外部API: 利用状況 & ヘルスチェック
 * GET /api/v1/status
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  const auth = await verifyApiKey(request);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client } = auth;

  try {
    // 当月の利用状況を取得
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [monthlyUsage, dailyUsage, dbClient] = await Promise.all([
      prisma.apiAccessLog.count({
        where: { apiClientId: client.id, createdAt: { gte: monthStart } },
      }),
      prisma.apiAccessLog.count({
        where: { apiClientId: client.id, createdAt: { gte: todayStart } },
      }),
      prisma.apiClient.findUnique({
        where: { id: client.id },
        select: { totalRequests: true, lastUsedAt: true, expiresAt: true, monthlyQuota: true },
      }),
    ]);

    const responseTimeMs = Date.now() - startTime;

    await logApiAccess({
      apiClientId: client.id,
      endpoint: "/api/v1/status",
      method: "GET",
      statusCode: 200,
      responseTimeMs,
    });

    return NextResponse.json({
      status: "ok",
      client: {
        name: client.name,
        rateLimit: {
          perMinute: client.rateLimitPerMinute,
          perDay: client.rateLimitPerDay,
          monthlyQuota: client.monthlyQuota,
        },
      },
      usage: {
        today: dailyUsage,
        thisMonth: monthlyUsage,
        monthlyQuotaRemaining: client.monthlyQuota - monthlyUsage,
        totalAllTime: dbClient?.totalRequests || 0,
      },
      meta: {
        expiresAt: dbClient?.expiresAt,
        lastUsedAt: dbClient?.lastUsedAt,
        responseTimeMs,
      },
    });
  } catch (err) {
    console.error("[API v1] Status error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
