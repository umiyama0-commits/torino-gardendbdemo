// Linting API: 矛盾検出・ギャップ補完・接続発見・トピック提案 + 信頼スコア計算
// POST: LLMで品質チェック → LintResult保存
// POST ?action=recalc: 信頼スコア再計算（LLM不使用）
// POST ?action=resolve-gaps: gap検出 → Insight自動補完（self-improving loop）
// GET: LintResult一覧

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lintKnowledgeBase } from "@/lib/llm-lint";
import { generateInsights } from "@/lib/llm-insight";

export const dynamic = "force-dynamic";

// GET: Lint結果一覧
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "open";
  const type = url.searchParams.get("type");
  const limit = parseInt(url.searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {};
  if (status !== "all") where.status = status;
  if (type) where.type = type;

  const results = await prisma.lintResult.findMany({
    where,
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({ results, count: results.length });
}

// POST: Linting実行
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // 信頼スコア再計算（LLM不使用）
  if (action === "recalc") {
    return recalculateTrustScores();
  }

  // gap検出 → Insight自動補完（self-improving loop: Lint → Compilation）
  if (action === "resolve-gaps") {
    return resolveGaps();
  }

  // LLMによる品質チェック
  const body = await req.json().catch(() => ({}));
  const { modelLayer } = body as { modelLayer?: string };

  // Observation + Insight を取得
  const obsWhere: Record<string, unknown> = {};
  if (modelLayer) obsWhere.modelLayer = modelLayer;

  const observations = await prisma.observation.findMany({
    where: obsWhere,
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const insWhere: Record<string, unknown> = {};
  if (modelLayer) insWhere.modelLayer = modelLayer;

  const insights = await prisma.insight.findMany({
    where: insWhere,
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const items = [
    ...observations.map((o) => ({
      id: o.id,
      type: "observation" as const,
      text: o.text,
      modelLayer: o.modelLayer,
      primaryValueAxis: o.primaryValueAxis,
      provenance: o.provenance,
    })),
    ...insights.map((ins) => ({
      id: ins.id,
      type: "insight" as const,
      text: ins.text,
      modelLayer: ins.modelLayer || "",
      primaryValueAxis: ins.primaryValueAxis,
      provenance: ins.provenance,
    })),
  ];

  if (items.length < 2) {
    return NextResponse.json(
      { error: "Lintには2件以上のデータが必要です" },
      { status: 400 }
    );
  }

  const result = await lintKnowledgeBase(items);

  // LintResult保存
  const created = [];
  for (const suggestion of result.results) {
    const target = items[suggestion.targetIndex];
    const related = suggestion.relatedIndex != null ? items[suggestion.relatedIndex] : null;

    if (!target) continue;

    const lintResult = await prisma.lintResult.create({
      data: {
        type: suggestion.type,
        targetType: target.type,
        targetId: target.id,
        relatedType: related?.type || null,
        relatedId: related?.id || null,
        description: suggestion.description,
        severity: suggestion.severity,
        status: "open",
      },
    });

    created.push(lintResult);
  }

  // CompilationEvent記録
  await prisma.compilationEvent.create({
    data: {
      trigger: "linting",
      resultType: "lint_result",
      llmModel: process.env.LLM_PROVIDER === "anthropic" ? "claude-sonnet-4" : "gpt-4o",
    },
  });

  return NextResponse.json({
    created: created.length,
    results: created,
  });
}

// 信頼スコア再計算: Provenance多層裏付け + Lint結果で加減算
async function recalculateTrustScores() {
  // 1. 全Observationの基礎スコアを設定
  const observations = await prisma.observation.findMany({
    include: {
      tags: { include: { tag: true } },
      insightLinks: true,
    },
  });

  let obsUpdated = 0;
  for (const obs of observations) {
    let score = obs.confidence === "HIGH" ? 0.8 : obs.confidence === "MEDIUM" ? 0.5 : 0.2;

    // Insightにリンクされている → +0.1（知見導出に使われた実績）
    if (obs.insightLinks.length > 0) {
      score += 0.1;
    }

    score = Math.min(score, 1.0);

    if (Math.abs(score - obs.trustScore) > 0.01) {
      await prisma.observation.update({
        where: { id: obs.id },
        data: { trustScore: score },
      });
      obsUpdated++;
    }
  }

  // 2. 全Insightのスコアを計算
  const insights = await prisma.insight.findMany({
    include: {
      sourceObservations: {
        include: { observation: { select: { provenance: true } } },
      },
    },
  });

  let insUpdated = 0;
  for (const ins of insights) {
    let score = ins.evidenceStrength === "HIGH" ? 0.8 : ins.evidenceStrength === "MEDIUM" ? 0.5 : 0.2;

    // 多層Provenance裏付けボーナス
    const provenances = new Set(ins.sourceObservations.map((link) => link.observation.provenance));
    if (provenances.size >= 2) score += 0.15; // 2種以上のProvenanceで裏付け
    if (provenances.size >= 3) score += 0.1;  // 全3種で裏付け

    // ソースObservation数ボーナス
    if (ins.sourceObservations.length >= 3) score += 0.05;
    if (ins.sourceObservations.length >= 5) score += 0.05;

    score = Math.min(score, 1.0);

    if (Math.abs(score - ins.trustScore) > 0.01) {
      await prisma.insight.update({
        where: { id: ins.id },
        data: { trustScore: score },
      });
      insUpdated++;
    }
  }

  // 3. LintResultの矛盾によるスコア減算
  const contradictions = await prisma.lintResult.findMany({
    where: { type: "contradiction", status: "open" },
  });

  let contradictionPenalties = 0;
  for (const lint of contradictions) {
    const penalty = lint.severity === "critical" ? 0.2 : 0.1;

    if (lint.targetType === "observation") {
      await prisma.observation.update({
        where: { id: lint.targetId },
        data: { trustScore: { decrement: penalty } },
      }).catch(() => {});
    } else if (lint.targetType === "insight") {
      await prisma.insight.update({
        where: { id: lint.targetId },
        data: { trustScore: { decrement: penalty } },
      }).catch(() => {});
    }
    contradictionPenalties++;
  }

  return NextResponse.json({
    observationsUpdated: obsUpdated,
    insightsUpdated: insUpdated,
    contradictionPenalties,
  });
}

// gap検出 → 該当テーマのObservationからInsightを自動生成して補完
async function resolveGaps() {
  const gaps = await prisma.lintResult.findMany({
    where: { type: "gap", status: "open" },
    orderBy: { severity: "asc" },
    take: 5,
  });

  if (gaps.length === 0) {
    return NextResponse.json({ message: "未対応のギャップはありません", resolved: 0 });
  }

  let resolved = 0;
  const generatedInsights: { gapId: string; insightText: string }[] = [];

  for (const gap of gaps) {
    // gapのtarget Observationを起点にテーマ関連Observationを収集
    const targetObs = gap.targetType === "observation"
      ? await prisma.observation.findUnique({
          where: { id: gap.targetId },
          include: { tags: { include: { tag: true } } },
        })
      : null;

    // テーマ関連Observationを取得
    const relatedObs = await prisma.observation.findMany({
      where: targetObs?.modelLayer ? { modelLayer: targetObs.modelLayer } : {},
      include: { tags: { include: { tag: true } } },
      orderBy: { trustScore: "desc" },
      take: 15,
    });

    if (relatedObs.length < 2) continue;

    try {
      const obsForLLM = relatedObs.map((o) => ({
        id: o.id,
        text: o.text,
        modelLayer: o.modelLayer,
        primaryValueAxis: o.primaryValueAxis,
        provenance: o.provenance,
        tagCodes: o.tags.map((t) => t.tag.code),
      }));

      const result = await generateInsights(obsForLLM);

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

        for (const idx of suggestion.sourceObservationIndices || []) {
          if (idx >= 0 && idx < relatedObs.length) {
            await prisma.observationInsightLink.create({
              data: {
                observationId: relatedObs[idx].id,
                insightId: insight.id,
                role: "supporting",
              },
            }).catch(() => {});
          }
        }

        generatedInsights.push({ gapId: gap.id, insightText: insight.text });
      }

      // gapを解決済みにする
      await prisma.lintResult.update({
        where: { id: gap.id },
        data: { status: "resolved" },
      });

      // CompilationEvent記録
      await prisma.compilationEvent.create({
        data: {
          trigger: "linting",
          sourceType: "lint_result",
          sourceId: gap.id,
          resultType: "insight",
          llmModel: process.env.LLM_PROVIDER === "anthropic" ? "claude-sonnet-4" : "gpt-4o",
        },
      });

      resolved++;
    } catch (err) {
      console.error("Gap resolution error:", err);
    }
  }

  return NextResponse.json({
    resolved,
    totalGaps: gaps.length,
    generatedInsights,
  });
}
