import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const industry = searchParams.get("industry");
  const industryMinor = searchParams.get("industryMinor");
  const layer = searchParams.get("layer");
  const axis = searchParams.get("axis");
  const sort = searchParams.get("sort") || "impact";

  // Build where clauses
  const obsConditions: Prisma.ObservationWhereInput[] = [];
  const insConditions: Prisma.InsightWhereInput[] = [];

  if (q) {
    obsConditions.push({ OR: [{ text: { contains: q } }, { textEn: { contains: q } }] });
    insConditions.push({ OR: [{ text: { contains: q } }, { textEn: { contains: q } }] });
  }
  if (layer) {
    obsConditions.push({ modelLayer: layer });
    insConditions.push({ modelLayer: layer });
  }
  if (axis) {
    obsConditions.push({ primaryValueAxis: axis });
    insConditions.push({ primaryValueAxis: axis });
  }
  if (industry) {
    obsConditions.push({ store: { client: { industryMajor: { contains: industry } } } });
  }
  if (industryMinor) {
    obsConditions.push({ store: { client: { industryMinor: { contains: industryMinor } } } });
  }

  const obsWhere: Prisma.ObservationWhereInput = obsConditions.length > 0 ? { AND: obsConditions } : {};
  const insWhere: Prisma.InsightWhereInput = insConditions.length > 0 ? { AND: insConditions } : {};

  // Sort
  const obsOrder: Prisma.ObservationOrderByWithRelationInput[] =
    sort === "impact" ? [{ estimatedImpactMax: { sort: "desc", nulls: "last" } }, { trustScore: "desc" }]
    : sort === "trust" ? [{ trustScore: "desc" }, { estimatedImpactMax: { sort: "desc", nulls: "last" } }]
    : [{ createdAt: "desc" }];

  const insOrder: Prisma.InsightOrderByWithRelationInput[] =
    sort === "impact" ? [{ estimatedImpactMax: { sort: "desc", nulls: "last" } }, { trustScore: "desc" }]
    : sort === "trust" ? [{ trustScore: "desc" }, { estimatedImpactMax: { sort: "desc", nulls: "last" } }]
    : [{ createdAt: "desc" }];

  const [observations, insights] = await Promise.all([
    prisma.observation.findMany({
      where: obsWhere,
      include: {
        tags: { include: { tag: true } },
        store: { include: { client: { select: { name: true, industryMajor: true, industryMinor: true, industryMajorEn: true, industryMinorEn: true } } } },
        project: { select: { id: true, name: true } },
      },
      orderBy: obsOrder,
    }),
    prisma.insight.findMany({
      where: insWhere,
      include: { tags: { include: { tag: true } } },
      orderBy: insOrder,
    }),
  ]);

  // Industry-based recommendations
  let recommendations: Awaited<ReturnType<typeof prisma.crossIndustryPattern.findMany>> = [];
  if (industry) {
    const allPatterns = await prisma.crossIndustryPattern.findMany({
      orderBy: [{ estimatedImpactMax: { sort: "desc", nulls: "last" } }, { trustScore: "desc" }],
    });
    recommendations = allPatterns.filter((p) => {
      try {
        const industries: string[] = JSON.parse(p.industries);
        return industries.some((ind) => ind.includes(industry));
      } catch {
        return false;
      }
    });
  }

  // High-impact observations for industry
  let industryHighImpact: typeof observations = [];
  if (industry) {
    industryHighImpact = await prisma.observation.findMany({
      where: { estimatedImpactMax: { gte: 8 }, trustScore: { gte: 2 } },
      include: {
        tags: { include: { tag: true } },
        store: { include: { client: { select: { name: true, industryMajor: true, industryMinor: true, industryMajorEn: true, industryMinorEn: true } } } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ estimatedImpactMax: { sort: "desc", nulls: "last" } }, { trustScore: "desc" }],
      take: 10,
    });
  }

  return NextResponse.json({ observations, insights, recommendations, industryHighImpact });
}
