import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "crypto";

// ─── API Key Generation ──────────────────────────────

/**
 * APIキーを生成し、ハッシュ化して保存用と表示用を返す
 */
export function generateApiKey(): { rawKey: string; hashedKey: string; prefix: string } {
  const rawKey = `tg_live_${randomBytes(32).toString("hex")}`;
  const hashedKey = hashApiKey(rawKey);
  const prefix = rawKey.substring(0, 16) + "...";
  return { rawKey, hashedKey, prefix };
}

/**
 * APIキーをSHA-256でハッシュ化（DB保存用）
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// ─── API Key Verification ────────────────────────────

export type ApiClientInfo = {
  id: string;
  name: string;
  status: string;
  allowedCategories: string[];
  allowedIndustries: string[];
  allowedEndpoints: string[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  monthlyQuota: number;
};

export type ApiAuthResult =
  | { success: true; client: ApiClientInfo }
  | { success: false; error: string; status: number };

/**
 * リクエストからAPIキーを検証し、クライアント情報を返す
 */
export async function verifyApiKey(request: Request): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { success: false, error: "Missing or invalid Authorization header", status: 401 };
  }

  const rawKey = authHeader.slice(7);
  const hashedKey = hashApiKey(rawKey);

  const client = await prisma.apiClient.findUnique({
    where: { apiKey: hashedKey },
  });

  if (!client) {
    return { success: false, error: "Invalid API key", status: 401 };
  }

  if (client.status !== "active") {
    return { success: false, error: `API key is ${client.status}`, status: 403 };
  }

  if (client.expiresAt && client.expiresAt < new Date()) {
    return { success: false, error: "API key has expired", status: 403 };
  }

  // レート制限チェック（簡易版：分間）
  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const recentCount = await prisma.apiAccessLog.count({
    where: {
      apiClientId: client.id,
      createdAt: { gte: oneMinuteAgo },
    },
  });

  if (recentCount >= client.rateLimitPerMinute) {
    return { success: false, error: "Rate limit exceeded (per minute)", status: 429 };
  }

  // 日次制限チェック
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = await prisma.apiAccessLog.count({
    where: {
      apiClientId: client.id,
      createdAt: { gte: todayStart },
    },
  });

  if (todayCount >= client.rateLimitPerDay) {
    return { success: false, error: "Rate limit exceeded (per day)", status: 429 };
  }

  // Parse JSON fields
  const allowedCategories = safeJsonArray(client.allowedCategories);
  const allowedIndustries = safeJsonArray(client.allowedIndustries);
  const allowedEndpoints = safeJsonArray(client.allowedEndpoints);

  return {
    success: true,
    client: {
      id: client.id,
      name: client.name,
      status: client.status,
      allowedCategories,
      allowedIndustries,
      allowedEndpoints,
      rateLimitPerMinute: client.rateLimitPerMinute,
      rateLimitPerDay: client.rateLimitPerDay,
      monthlyQuota: client.monthlyQuota,
    },
  };
}

// ─── Access Logging ──────────────────────────────────

export async function logApiAccess(params: {
  apiClientId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs?: number;
  requestParams?: Record<string, unknown>;
  resultCount?: number;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
}) {
  try {
    await prisma.apiAccessLog.create({
      data: {
        apiClientId: params.apiClientId,
        endpoint: params.endpoint,
        method: params.method,
        statusCode: params.statusCode,
        responseTimeMs: params.responseTimeMs,
        requestParams: params.requestParams ? JSON.stringify(params.requestParams) : null,
        resultCount: params.resultCount,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        errorMessage: params.errorMessage,
      },
    });

    // 累計リクエスト数と最終利用日時を更新
    await prisma.apiClient.update({
      where: { id: params.apiClientId },
      data: {
        totalRequests: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[ApiAccessLog] Failed to log:", err);
  }
}

// ─── Provenance Filter ──────────────────────────────

/**
 * 外部APIで提供可能なProvenanceレベルをフィルタリング
 * 固有知(FIELD_OBSERVED)は絶対に外部に出さない
 */
export function buildProvenanceFilter(allowedCategories: string[]): string[] {
  const NEVER_EXPOSE = ["FIELD_OBSERVED"];
  const SAFE_DEFAULTS = ["ANONYMIZED_DERIVED", "PUBLIC_CODIFIED"];

  if (allowedCategories.length === 0) {
    return SAFE_DEFAULTS;
  }

  return allowedCategories.filter((c) => !NEVER_EXPOSE.includes(c));
}

// ─── Helpers ──────────────────────────────────────────

function safeJsonArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
