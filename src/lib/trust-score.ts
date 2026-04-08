// 信頼スコア計算: 時間減衰 + Provenance多層裏付け + Lint矛盾ペナルティ
// 改善点4: 時間減衰を導入し、古いデータのスコアを自動的に下げる

import { prisma } from "@/lib/prisma";

/** 時間減衰関数: 半減期900日（約2.5年で信頼度が半分に） — 人の行動原理は急には変わらない */
const HALF_LIFE_DAYS = 900;

function timeDecay(createdAt: Date): number {
  const ageMs = Date.now() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  // 指数減衰: e^(-λt), λ = ln(2) / halfLife
  const lambda = Math.LN2 / HALF_LIFE_DAYS;
  return Math.exp(-lambda * ageDays);
}

/** Observationの信頼スコアを計算 */
export function computeObservationTrustScore(obs: {
  confidence: string;
  createdAt: Date;
  insightLinkCount: number;
}): number {
  // 基礎スコア: confidence
  let base = obs.confidence === "HIGH" ? 0.8 : obs.confidence === "MEDIUM" ? 0.5 : 0.2;

  // Insightにリンクされている → +0.1（知見導出に使われた実績）
  if (obs.insightLinkCount > 0) base += 0.1;

  // 時間減衰を適用
  const decay = timeDecay(obs.createdAt);
  let score = base * decay;

  return Math.min(Math.max(score, 0), 1.0);
}

/** Insightの信頼スコアを計算 */
export function computeInsightTrustScore(ins: {
  evidenceStrength: string;
  createdAt: Date;
  provenanceSet: Set<string>;
  sourceCount: number;
}): number {
  // 基礎スコア: evidenceStrength
  let base = ins.evidenceStrength === "HIGH" ? 0.8 : ins.evidenceStrength === "MEDIUM" ? 0.5 : 0.2;

  // 多層Provenance裏付けボーナス
  if (ins.provenanceSet.size >= 2) base += 0.15;
  if (ins.provenanceSet.size >= 3) base += 0.1;

  // ソースObservation数ボーナス
  if (ins.sourceCount >= 3) base += 0.05;
  if (ins.sourceCount >= 5) base += 0.05;

  // 時間減衰（Insightは半減期が長め: Observationより長く価値を持つ）
  const decay = timeDecay(ins.createdAt);
  // Insightは減衰を緩和（最低でも0.5倍）
  const adjustedDecay = 0.5 + 0.5 * decay;
  let score = base * adjustedDecay;

  return Math.min(Math.max(score, 0), 1.0);
}

/** 全データの信頼スコアを再計算（時間減衰 + Lint矛盾ペナルティ込み） */
export async function recalculateAllTrustScores(): Promise<{
  observationsUpdated: number;
  insightsUpdated: number;
  contradictionPenalties: number;
}> {
  // 1. Observationスコア再計算
  const observations = await prisma.observation.findMany({
    include: { insightLinks: true },
  });

  let obsUpdated = 0;
  for (const obs of observations) {
    const score = computeObservationTrustScore({
      confidence: obs.confidence,
      createdAt: obs.createdAt,
      insightLinkCount: obs.insightLinks.length,
    });

    if (Math.abs(score - obs.trustScore) > 0.01) {
      await prisma.observation.update({
        where: { id: obs.id },
        data: { trustScore: score },
      });
      obsUpdated++;
    }
  }

  // 2. Insightスコア再計算
  const insights = await prisma.insight.findMany({
    include: {
      sourceObservations: {
        include: { observation: { select: { provenance: true } } },
      },
    },
  });

  let insUpdated = 0;
  for (const ins of insights) {
    const provenanceSet = new Set(ins.sourceObservations.map((link) => link.observation.provenance));
    const score = computeInsightTrustScore({
      evidenceStrength: ins.evidenceStrength,
      createdAt: ins.createdAt,
      provenanceSet,
      sourceCount: ins.sourceObservations.length,
    });

    if (Math.abs(score - ins.trustScore) > 0.01) {
      await prisma.insight.update({
        where: { id: ins.id },
        data: { trustScore: score },
      });
      insUpdated++;
    }
  }

  // 3. Lint矛盾ペナルティ
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

  return { observationsUpdated: obsUpdated, insightsUpdated: insUpdated, contradictionPenalties };
}
