// Insight生成API: Observation群からInsightを自動導出
// POST: LLMで生成 → DB保存 → ObservationInsightLink作成 → CompilationEvent記録
// GET: Insight一覧取得

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInsights } from "@/lib/llm-insight";

export const dynamic = "force-dynamic";

// GET: Insight一覧（フィルター付き）
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const modelLayer = url.searchParams.get("modelLayer");
  const valueAxis = url.searchParams.get("valueAxis");
  const provenance = url.searchParams.get("provenance");
  const limit = parseInt(url.searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {};
  if (modelLayer) where.modelLayer = modelLayer;
  if (valueAxis) where.primaryValueAxis = valueAxis;
  if (provenance) where.provenance = provenance;

  const insights = await prisma.insight.findMany({
    where,
    include: {
      tags: { include: { tag: true } },
      sourceObservations: {
        include: { observation: { select: { id: true, text: true, modelLayer: true, provenance: true } } },
      },
    },
    orderBy: { trustScore: "desc" },
    take: limit,
  });

  return NextResponse.json({ insights, count: insights.length });
}

// POST: Observation群からInsightを自動生成
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { observationIds, modelLayer } = body as {
    observationIds?: string[];
    modelLayer?: string;
  };

  // observationIds指定 or modelLayer指定でObservationを取得
  let observations;
  if (observationIds && observationIds.length > 0) {
    observations = await prisma.observation.findMany({
      where: { id: { in: observationIds } },
      include: { tags: { include: { tag: true } } },
    });
  } else if (modelLayer) {
    observations = await prisma.observation.findMany({
      where: { modelLayer },
      include: { tags: { include: { tag: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  } else {
    // 全体から最新20件
    observations = await prisma.observation.findMany({
      include: { tags: { include: { tag: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  if (observations.length < 2) {
    return NextResponse.json(
      { error: "Insight導出には2件以上のObservationが必要です" },
      { status: 400 }
    );
  }

  // LLMでInsight生成
  const obsForLLM = observations.map((o) => ({
    id: o.id,
    text: o.text,
    modelLayer: o.modelLayer,
    primaryValueAxis: o.primaryValueAxis,
    provenance: o.provenance,
    tagCodes: o.tags.map((t) => t.tag.code),
  }));

  const result = await generateInsights(obsForLLM);

  // DB保存
  const created = [];
  for (const suggestion of result.insights) {
    const insight = await prisma.insight.create({
      data: {
        text: suggestion.text,
        evidenceStrength: suggestion.evidenceStrength,
        generalizability: suggestion.generalizability,
        modelLayer: suggestion.modelLayer,
        primaryValueAxis: suggestion.primaryValueAxis,
        provenance: suggestion.provenance || "ANONYMIZED_DERIVED",
        applicableConditions: suggestion.applicableConditions,
        counterConditions: suggestion.counterConditions,
        trustScore: suggestion.evidenceStrength === "HIGH" ? 0.8 : suggestion.evidenceStrength === "MEDIUM" ? 0.5 : 0.2,
      },
    });

    // ObservationInsightLink作成
    const sourceIndices = suggestion.sourceObservationIndices || [];
    for (const idx of sourceIndices) {
      if (idx >= 0 && idx < observations.length) {
        await prisma.observationInsightLink.create({
          data: {
            observationId: observations[idx].id,
            insightId: insight.id,
            role: "supporting",
          },
        });
      }
    }

    // CompilationEvent記録
    await prisma.compilationEvent.create({
      data: {
        trigger: "ingest",
        sourceType: "observation",
        sourceId: observations[0].id,
        resultType: "insight",
        resultId: insight.id,
        llmModel: process.env.LLM_PROVIDER === "anthropic" ? "claude-sonnet-4" : "gpt-4o",
      },
    });

    created.push(insight);
  }

  return NextResponse.json({
    created: created.length,
    insights: created,
  });
}
