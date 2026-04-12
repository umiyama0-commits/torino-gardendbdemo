// 信頼スコア計算: 時間減衰 + タグ充実度 + Provenance多層裏付け + Lint矛盾ペナルティ
// 改善: ハードコードのProvenance重みをタグ充実度（データが語る重み）に置き換え

import { prisma } from "@/lib/prisma";

/** 時間減衰関数: 半減期900日（約2.5年で信頼度が半分に） — 人の行動原理は急には変わらない */
const HALF_LIFE_DAYS = 900;

function timeDecay(createdAt: Date): number {
  const ageMs = Date.now() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const lambda = Math.LN2 / HALF_LIFE_DAYS;
  return Math.exp(-lambda * ageDays);
}

// ─── タグ充実度スコア ─────────────────────────────────────

/** タグ種別 */
const TAG_TYPES = ["BEHAVIOR", "CONTEXT", "SPACE", "THEORY"] as const;

/** タグ種別多様性ボーナス: カバーする種別が多いほど「多角的に観測された」 */
const DIVERSITY_BONUS: Record<number, number> = {
  0: 0.5,  // タグなし → 情報が乏しい
  1: 1.0,  // 単一視点
  2: 1.2,  // 複眼
  3: 1.5,  // 多角的
  4: 1.8,  // 完全観測
};

/**
 * タグ充実度スコアを計算
 *
 * データ自身の情報密度で重みを決める。固有知は自然とタグが豊か（6〜8）、
 * 公知は少ない（1〜2）ため、ハードコードのProvenance重みなしで
 * 固有知 > 汎用知 > 公知 の階層が自然に発現する。
 *
 * @param tagCount - 付与されたタグの総数
 * @param tagTypes - 付与されたタグの種別セット (BEHAVIOR, CONTEXT, SPACE, THEORY)
 * @returns 0.0〜1.0 のタグ充実度スコア
 */
export function computeTagRichnessScore(
  tagCount: number,
  tagTypes: Set<string>,
): number {
  // タグ数スコア: 0個→0.1, 1個→0.3, 2個→0.5, 3個→0.65, 5個→0.8, 8個以上→1.0
  // 対数カーブで増加（タグ追加の限界効用が逓減する）
  const countScore = tagCount === 0
    ? 0.1
    : Math.min(1.0, 0.3 + 0.7 * Math.log(tagCount + 1) / Math.log(9));

  // 種別多様性ボーナス
  const typeCount = TAG_TYPES.filter((t) => tagTypes.has(t)).length;
  const diversityMultiplier = DIVERSITY_BONUS[typeCount] ?? 1.0;

  // タグ充実度 = タグ数スコア × 多様性ボーナス（上限1.0にクリップ）
  return Math.min(1.0, countScore * diversityMultiplier);
}

/**
 * Provenance比率キャップ（全モジュール共通）
 * 固有知・汎用知を優先的に残し、公知(PUBLIC_CODIFIED)を上限比率に制限する。
 */
export function applyProvenanceCap<T extends { provenance: string }>(
  items: T[],
  limit: number,
  publicRatioCap: number = 0.3,
): T[] {
  const nonPublic = items.filter((i) => i.provenance !== "PUBLIC_CODIFIED");
  const publicItems = items.filter((i) => i.provenance === "PUBLIC_CODIFIED");

  const result = nonPublic.slice(0, limit);

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

/** Observationの信頼スコアを計算（タグ充実度ベース） */
export function computeObservationTrustScore(obs: {
  confidence: string;
  provenance: string;
  createdAt: Date;
  insightLinkCount: number;
  tagCount: number;
  tagTypes: Set<string>;
}): number {
  // 基礎スコア: confidence
  let base = obs.confidence === "HIGH" ? 0.8 : obs.confidence === "MEDIUM" ? 0.5 : 0.2;

  // Insightにリンクされている → +0.1（知見導出に使われた実績）
  if (obs.insightLinkCount > 0) base += 0.1;

  // タグ充実度で重み付け（ハードコードのProvenance重みを置換）
  // データの情報密度が自然に固有知>汎用知>公知の階層を作る
  const tagRichness = computeTagRichnessScore(obs.tagCount, obs.tagTypes);
  base *= tagRichness;

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
  avgTagRichness?: number; // ソースObservationの平均タグ充実度
}): number {
  const hasField = ins.provenanceSet.has("FIELD_OBSERVED");
  const hasDerived = ins.provenanceSet.has("ANONYMIZED_DERIVED");
  const hasPublic = ins.provenanceSet.has("PUBLIC_CODIFIED");

  // 基礎スコア: evidenceStrength
  let base = ins.evidenceStrength === "HIGH" ? 0.8 : ins.evidenceStrength === "MEDIUM" ? 0.5 : 0.2;

  // ── 信頼度チェーン（固有知基軸）──
  if (hasField) {
    if (hasDerived && hasPublic) {
      base += 0.25;
    } else if (hasDerived) {
      base += 0.20;
    } else if (hasPublic) {
      base += 0.10;
    }
  } else {
    if (hasDerived) {
      base *= 0.5;
    } else {
      base *= 0.2;
    }
  }

  // ソースObservation数ボーナス（固有知ありの場合のみ有効）
  if (hasField) {
    if (ins.sourceCount >= 3) base += 0.05;
    if (ins.sourceCount >= 5) base += 0.05;
  }

  // タグ充実度ボーナス: ソースObservationの平均タグ充実度を反映
  if (ins.avgTagRichness !== undefined && ins.avgTagRichness > 0) {
    // タグ充実度が高いソースから導出された知見は信頼度が高い
    base *= 0.7 + 0.3 * ins.avgTagRichness;
  }

  // 時間減衰（Insightは半減期が長め）
  const decay = timeDecay(ins.createdAt);
  const adjustedDecay = 0.5 + 0.5 * decay;
  const score = base * adjustedDecay;

  return Math.min(Math.max(score, 0), 1.0);
}

/** 全データの信頼スコアを再計算（タグ充実度 + 時間減衰 + Lint矛盾ペナルティ込み） */
export async function recalculateAllTrustScores(): Promise<{
  observationsUpdated: number;
  insightsUpdated: number;
  contradictionPenalties: number;
}> {
  // 1. Observationスコア再計算（タグ情報を含む）
  const observations = await prisma.observation.findMany({
    include: {
      insightLinks: true,
      tags: { include: { tag: { select: { type: true } } } },
    },
  });

  let obsUpdated = 0;
  for (const obs of observations) {
    const tagTypes = new Set(obs.tags.map((t) => t.tag.type));
    const score = computeObservationTrustScore({
      confidence: obs.confidence,
      provenance: obs.provenance,
      createdAt: obs.createdAt,
      insightLinkCount: obs.insightLinks.length,
      tagCount: obs.tags.length,
      tagTypes,
    });

    if (Math.abs(score - obs.trustScore) > 0.01) {
      await prisma.observation.update({
        where: { id: obs.id },
        data: { trustScore: score },
      });
      obsUpdated++;
    }
  }

  // 2. Insightスコア再計算（ソースObservationのタグ充実度を含む）
  const insights = await prisma.insight.findMany({
    include: {
      sourceObservations: {
        include: {
          observation: {
            select: {
              provenance: true,
              tags: { include: { tag: { select: { type: true } } } },
            },
          },
        },
      },
    },
  });

  let insUpdated = 0;
  for (const ins of insights) {
    const provenanceSet = new Set(ins.sourceObservations.map((link) => link.observation.provenance));

    // ソースObservationの平均タグ充実度を計算
    let avgTagRichness = 0;
    if (ins.sourceObservations.length > 0) {
      const richnesses = ins.sourceObservations.map((link) => {
        const tagTypes = new Set(link.observation.tags.map((t) => t.tag.type));
        return computeTagRichnessScore(link.observation.tags.length, tagTypes);
      });
      avgTagRichness = richnesses.reduce((a, b) => a + b, 0) / richnesses.length;
    }

    const score = computeInsightTrustScore({
      evidenceStrength: ins.evidenceStrength,
      createdAt: ins.createdAt,
      provenanceSet,
      sourceCount: ins.sourceObservations.length,
      avgTagRichness,
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
