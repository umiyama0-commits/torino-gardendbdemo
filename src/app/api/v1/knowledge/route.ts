import { prisma } from "@/lib/prisma";
import { verifyApiKey, logApiAccess, buildProvenanceFilter } from "@/lib/api-auth";
import { NextResponse } from "next/server";

/**
 * 外部API: ナレッジ検索
 * GET /api/v1/knowledge?q=keyword&modelLayer=MOVEMENT&valueAxis=REVENUE_UP&limit=20&offset=0
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const url = new URL(request.url);

  // API認証
  const auth = await verifyApiKey(request);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client } = auth;

  // パラメータ取得
  const q = url.searchParams.get("q") || "";
  const modelLayer = url.searchParams.get("modelLayer");
  const valueAxis = url.searchParams.get("valueAxis");
  const industry = url.searchParams.get("industry");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Provenanceフィルタ（固有知は絶対に出さない）
  const allowedProvenance = buildProvenanceFilter(client.allowedCategories);

  // 業種フィルタ
  const industryFilter = client.allowedIndustries.length > 0
    ? client.allowedIndustries
    : (industry ? [industry] : undefined);

  try {
    const where: Record<string, unknown> = {
      provenance: { in: allowedProvenance },
      anonymizationVerified: true, // 匿名化チェック済みのみ
      sedimentStatus: { not: "composted" },
    };

    if (q) {
      where.text = { contains: q };
    }
    if (modelLayer) {
      where.modelLayer = modelLayer;
    }
    if (valueAxis) {
      where.primaryValueAxis = valueAxis;
    }
    if (industryFilter) {
      where.project = {
        client: {
          OR: [
            { industryMajor: { in: industryFilter } },
            { industryMajorEn: { in: industryFilter } },
          ],
        },
      };
    }

    const [observations, total] = await Promise.all([
      prisma.observation.findMany({
        where,
        select: {
          id: true,
          text: true,
          textEn: true,
          modelLayer: true,
          provenance: true,
          primaryValueAxis: true,
          confidence: true,
          trustScore: true,
          estimatedImpactMin: true,
          estimatedImpactMax: true,
          impactKPI: true,
          observedAt: true,
          createdAt: true,
          tags: {
            select: {
              tag: {
                select: { code: true, displayNameJa: true, displayNameEn: true, type: true },
              },
            },
          },
          // 固有知情報は出さない：project名、store名、client名は除外
          project: {
            select: {
              nameAnonymized: true,
              client: {
                select: {
                  nameAnonymized: true,
                  industryMajor: true,
                  industryMajorEn: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.observation.count({ where }),
    ]);

    // レスポンスを匿名化して整形
    const results = observations.map((obs) => ({
      id: obs.id,
      text: obs.text,
      textEn: obs.textEn,
      modelLayer: obs.modelLayer,
      provenance: obs.provenance,
      valueAxis: obs.primaryValueAxis,
      confidence: obs.confidence,
      trustScore: obs.trustScore,
      impact: obs.estimatedImpactMin || obs.estimatedImpactMax
        ? { min: obs.estimatedImpactMin, max: obs.estimatedImpactMax, kpi: obs.impactKPI }
        : null,
      industry: obs.project?.client?.industryMajorEn || obs.project?.client?.industryMajor || null,
      anonymizedProject: obs.project?.nameAnonymized || null,
      anonymizedClient: obs.project?.client?.nameAnonymized || null,
      tags: obs.tags.map((t) => ({
        code: t.tag.code,
        nameJa: t.tag.displayNameJa,
        nameEn: t.tag.displayNameEn,
        type: t.tag.type,
      })),
      observedAt: obs.observedAt,
      createdAt: obs.createdAt,
    }));

    const responseTimeMs = Date.now() - startTime;

    // アクセスログ記録
    await logApiAccess({
      apiClientId: client.id,
      endpoint: "/api/v1/knowledge",
      method: "GET",
      statusCode: 200,
      responseTimeMs,
      requestParams: { q, modelLayer, valueAxis, industry, limit, offset },
      resultCount: results.length,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      data: results,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      meta: {
        responseTimeMs,
        provenanceFilter: allowedProvenance,
      },
    });
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;
    console.error("[API v1] Knowledge search error:", err);

    await logApiAccess({
      apiClientId: client.id,
      endpoint: "/api/v1/knowledge",
      method: "GET",
      statusCode: 500,
      responseTimeMs,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
