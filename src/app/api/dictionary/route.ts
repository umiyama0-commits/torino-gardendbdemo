// 公知辞書API: PUBLIC_CODIFIED データの独立参照エンドポイント
// 分析パイプラインの比率キャップとは独立 — 全件アクセス可能
// GET: カテゴリ別・タグ別・国別にブラウズ + テキスト検索

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") || "";
  const modelLayer = sp.get("modelLayer") || "";
  const valueAxis = sp.get("valueAxis") || "";
  const tagCode = sp.get("tag") || "";
  const country = sp.get("country") || "";
  const sort = sp.get("sort") || "newest"; // newest | oldest | trust | alpha
  const page = parseInt(sp.get("page") || "1", 10);
  const limit = Math.min(parseInt(sp.get("limit") || "50", 10), 200);
  const offset = (page - 1) * limit;

  // 公知のみ
  const where: Record<string, unknown> = { provenance: "PUBLIC_CODIFIED" };

  if (q.trim()) {
    where.text = { contains: q, mode: "insensitive" };
  }
  if (modelLayer) where.modelLayer = modelLayer;
  if (valueAxis) where.primaryValueAxis = valueAxis;
  if (country) where.country = country;
  if (tagCode) {
    // 階層検索: 親タグの場合は子タグも含む
    const tag = await prisma.ontologyTag.findUnique({
      where: { code: tagCode },
      include: { children: { select: { code: true } } },
    });
    const allCodes = tag?.children?.length
      ? [tagCode, ...tag.children.map((c) => c.code)]
      : [tagCode];
    where.tags = { some: { tag: { code: { in: allCodes } } } };
  }

  // ソート
  const orderBy =
    sort === "oldest" ? { createdAt: "asc" as const } :
    sort === "trust" ? { trustScore: "desc" as const } :
    sort === "alpha" ? { text: "asc" as const } :
    { createdAt: "desc" as const };

  const [entries, total, stats] = await Promise.all([
    prisma.observation.findMany({
      where,
      include: {
        tags: { include: { tag: true } },
      },
      orderBy,
      skip: offset,
      take: limit,
    }),
    prisma.observation.count({ where }),
    // 統計: モデル層・国・タグ別の件数
    Promise.all([
      prisma.observation.groupBy({
        by: ["modelLayer"],
        where: { provenance: "PUBLIC_CODIFIED" },
        _count: { id: true },
      }),
      prisma.observation.groupBy({
        by: ["country"],
        where: { provenance: "PUBLIC_CODIFIED" },
        _count: { id: true },
      }),
      prisma.observation.groupBy({
        by: ["primaryValueAxis"],
        where: { provenance: "PUBLIC_CODIFIED" },
        _count: { id: true },
      }),
    ]).then(([byLayer, byCountry, byAxis]) => ({
      byModelLayer: byLayer.map((g) => ({ key: g.modelLayer, count: g._count.id })),
      byCountry: byCountry.map((g) => ({ key: g.country, count: g._count.id })),
      byValueAxis: byAxis.filter((g) => g.primaryValueAxis).map((g) => ({ key: g.primaryValueAxis!, count: g._count.id })),
    })),
  ]);

  return NextResponse.json({
    entries,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    stats,
  });
}
