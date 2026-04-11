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

/**
 * Provenance重み付け: 固有知 > 汎用知 >> 公知
 * 公知は補完的位置づけ。量が増えてもスコアで固有知を上回らない設計。
 */
const PROVENANCE_WEIGHT: Record<string, number> = {
  FIELD_OBSERVED: 1.0,       // 現場で観測された一次情報 → 最高重み
  ANONYMIZED_DERIVED: 0.7,   // 匿名化・汎化された知見 → 高い重み
  PUBLIC_CODIFIED: 0.3,      // 公開文献・理論 → 補完的重み
};

export function getProvenanceWeight(provenance: string): number {
  return PROVENANCE_WEIGHT[provenance] ?? 0.3;
}

/**
 * Provenance比率キャップ（全モジュール共通）
 * 固有知・汎用知を優先的に残し、公知(PUBLIC_CODIFIED)を上限比率に制限する。
 * 公知がいくら増えても、分析・生成プロセスへの影響に天井を設ける。
 *
 * @param items - provenance フィールドを持つアイテム配列
 * @param limit - 最大取得件数
 * @param publicRatioCap - 公知の上限比率 (0.0〜1.0, デフォルト0.3)
 */
export function applyProvenanceCap<T extends { provenance: string }>(
  items: T[],
  limit: number,
  publicRatioCap: number = 0.3,
): T[] {
  const nonPublic = items.filter((i) => i.provenance !== "PUBLIC_CODIFIED");
  const publicItems = items.filter((i) => i.provenance === "PUBLIC_CODIFIED");

  // 固有知・汎用知を先に確保
  const result = nonPublic.slice(0, limit);

  // 残り枠に公知を入れる（全体の publicRatioCap 以下に制限）
  const maxPublic = Math.floor(limit * publicRatioCap);
  const publicSlots = Math.min(maxPublic, limit - result.length, publicItems.length);
  result.push(...publicItems.slice(0, publicSlots));

  return result.slice(0, limit);
}

/**
 * マスターコンフィグから公知比率上限を取得
 */
export async function getPublicRatioCap(): Promise<number> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: "ingest.publicRatioCap" },
  }).catch(() => null);
  return parseFloat(config?.value || "0.3");
}

/** Observationの信頼スコアを計算 */
export function computeObservationTrustScore(obs: {
  confidence: string;
  provenance: string;
  createdAt: Date;
  insightLinkCount: number;
}): number {
  // 基礎スコア: confidence
  let base = obs.confidence === "HIGH" ? 0.8 : obs.confidence === "MEDIUM" ? 0.5 : 0.2;

  // Insightにリンクされている → +0.1（知見導出に使われた実績）
  if (obs.insightLinkCount > 0) base += 0.1;

  // Provenance重み付け: 公知は最大でも固有知の30%程度のスコア
  const provWeight = getProvenanceWeight(obs.provenance);
  base *= provWeight;

  // 時間減衰を適用
  const decay = timeDecay(obs.createdAt);
  const score = base * decay;

  return Math.min(Math.max(score, 0), 1.0);
}

/**
 * Insightの信頼スコアを計算
 *
 * 信頼度チェーンの原則:
 *   固有知が基軸。固有知なしの知見は信頼度が大幅に制限される。
 *   固有知 + 汎用知 + 公知 = 最高信頼（現場観測→業種横断確認→理論裏付け）
 *   公知のみ = 参考値（辞書的価値はあるがチェーン対象外）
 */
export function computeInsightTrustScore(ins: {
  evidenceStrength: string;
  createdAt: Date;
  provenanceSet: Set<string>;
  sourceCount: number;
}): number {
  const hasField = ins.provenanceSet.has("FIELD_OBSERVED");
  const hasDerived = ins.provenanceSet.has("ANONYMIZED_DERIVED");
  const hasPublic = ins.provenanceSet.has("PUBLIC_CODIFIED");

  // 基礎スコア: evidenceStrength
  let base = ins.evidenceStrength === "HIGH" ? 0.8 : ins.evidenceStrength === "MEDIUM" ? 0.5 : 0.2;

  // ── 信頼度チェーン（固有知基軸）──
  if (hasField) {
    // 固有知あり → チェーンの起点が存在する
    if (hasDerived && hasPublic) {
      // 3層チェーン完成: 現場観測 + 業種横断確認 + 理論裏付け → 最高信頼
      base += 0.25;
    } else if (hasDerived) {
      // 固有知 + 汎用知: 現場観測が業種横断で確認された
      base += 0.20;
    } else if (hasPublic) {
      // 固有知 + 公知: 現場観測に理論的裏付けがある
      base += 0.10;
    }
    // 固有知のみ: ボーナスなし（単一事例としての基礎スコアのみ）
  } else {
    // 固有知なし → チェーンの基軸がない → 信頼度を大幅に制限
    if (hasDerived) {
      // 汎用知はあるが現場未確認 → 参考レベル
      base *= 0.5;
    } else {
      // 公知のみ → 辞書的参照。信頼度チェーンの対象外
      base *= 0.2;
    }
  }

  // ソースObservation数ボーナス（固有知ありの場合のみ有効）
  if (hasField) {
    if (ins.sourceCount >= 3) base += 0.05;
    if (ins.sourceCount >= 5) base += 0.05;
  }

  // 時間減衰（Insightは半減期が長め: Observationより長く価値を持つ）
  const decay = timeDecay(ins.createdAt);
  // Insightは減衰を緩和（最低でも0.5倍）
  const adjustedDecay = 0.5 + 0.5 * decay;
  const score = base * adjustedDecay;

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
      provenance: obs.provenance,
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
