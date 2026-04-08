import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const query = sp.get("q") || "";
  const industry = sp.get("industry") || "";
  const modelLayer = sp.get("modelLayer") || "";
  const valueAxis = sp.get("valueAxis") || "";
  const provenance = sp.get("provenance") || "";
  const tagCode = sp.get("tag") || "";

  // Build observation filter
  const obsAnd: Record<string, unknown>[] = [];
  const insAnd: Record<string, unknown>[] = [];

  if (query.trim()) {
    obsAnd.push({ text: { contains: query, mode: "insensitive" } });
    insAnd.push({ text: { contains: query, mode: "insensitive" } });
  }

  if (modelLayer) {
    obsAnd.push({ modelLayer });
    insAnd.push({ modelLayer });
  }

  if (valueAxis) {
    obsAnd.push({ primaryValueAxis: valueAxis });
    insAnd.push({ primaryValueAxis: valueAxis });
  }

  if (provenance) {
    obsAnd.push({ provenance });
    insAnd.push({ provenance });
  }

  if (tagCode) {
    obsAnd.push({ tags: { some: { tag: { code: tagCode } } } });
    insAnd.push({ tags: { some: { tag: { code: tagCode } } } });
  }

  if (industry.trim()) {
    obsAnd.push({
      OR: [
        { store: { client: { industryDetail: { contains: industry } } } },
        { store: { client: { industry: { contains: industry } } } },
        { project: { client: { industryDetail: { contains: industry } } } },
        { project: { client: { industry: { contains: industry } } } },
      ],
    });
  }

  // If no filters at all, return empty (require at least one)
  const hasFilter = obsAnd.length > 0;

  const obsWhere = hasFilter ? { AND: obsAnd } : undefined;
  const insWhere = insAnd.length > 0 ? { AND: insAnd } : undefined;

  const [observations, insights] = await Promise.all([
    obsWhere
      ? prisma.observation.findMany({
          where: obsWhere,
          include: {
            tags: { include: { tag: true } },
            store: { select: { client: { select: { industry: true, industryDetail: true } } } },
            project: { select: { client: { select: { industry: true, industryDetail: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    insWhere
      ? prisma.insight.findMany({
          where: insWhere,
          include: { tags: { include: { tag: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
  ]);

  // Extract industries from fetched observations
  const industrySet = new Set<string>();
  for (const obs of observations) {
    const ind =
      obs.store?.client?.industryDetail ||
      obs.store?.client?.industry ||
      obs.project?.client?.industryDetail ||
      obs.project?.client?.industry;
    if (ind) industrySet.add(ind);
  }

  return NextResponse.json({
    observations,
    insights,
    industries: [...industrySet],
  });
}
