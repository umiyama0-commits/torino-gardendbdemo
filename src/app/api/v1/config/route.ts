import { verifyApiKey, logApiAccess } from "@/lib/api-auth";
import { loadAppConfig } from "@/lib/master-config";
import { NextResponse } from "next/server";

/**
 * 外部API: マスター設定情報の取得
 * GET /api/v1/config
 *
 * MODEL_LAYER, VALUE_AXIS等のマスターデータを返す
 * （外部クライアントがフィルタUIを構築するために使用）
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  const auth = await verifyApiKey(request);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client } = auth;

  try {
    const config = await loadAppConfig();

    const responseTimeMs = Date.now() - startTime;

    await logApiAccess({
      apiClientId: client.id,
      endpoint: "/api/v1/config",
      method: "GET",
      statusCode: 200,
      responseTimeMs,
    });

    return NextResponse.json({
      data: {
        modelLayers: config.modelLayers,
        valueAxes: config.valueAxes,
        provenances: config.provenances,
        tagTypes: config.tagTypes,
      },
      meta: { responseTimeMs },
    });
  } catch (err) {
    console.error("[API v1] Config error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
