// Zodバリデーション: API入力 + LLM出力の型安全性を保証
import { z } from "zod";

// ─── 共通Enum ──────────────────────────────────────────

export const ModelLayer = z.enum(["MOVEMENT", "APPROACH", "BREAKDOWN", "TRANSFER"]);
export const ValueAxis = z.enum(["REVENUE_UP", "COST_DOWN", "RETENTION"]);
export const Provenance = z.enum(["FIELD_OBSERVED", "ANONYMIZED_DERIVED", "PUBLIC_CODIFIED"]);
export const Confidence = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const EvidenceStrength = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const Generalizability = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const QAFeedback = z.enum(["helpful", "unhelpful", "partial"]);

// ─── API入力スキーマ ────────────────────────────────────

export const Country = z.string().length(2, "国コードはISO 3166-1 alpha-2（2文字）").default("JP");

export const CreateObservationInput = z.object({
  text: z.string().min(1, "テキストは必須です").max(10000),
  modelLayer: ModelLayer,
  provenance: Provenance.default("FIELD_OBSERVED"),
  primaryValueAxis: ValueAxis.nullable().optional(),
  confidence: Confidence.default("MEDIUM"),
  country: Country,
  projectId: z.string().nullable().optional(),
  storeId: z.string().nullable().optional(),
  sourceType: z.string().nullable().optional(),
  sourceTitle: z.string().nullable().optional(),
  tagIds: z.array(z.string()).default([]),
});

export const CreateInsightInput = z.object({
  observationIds: z.array(z.string()).optional(),
  modelLayer: ModelLayer.optional(),
});

export const QAQuestionInput = z.object({
  question: z.string().min(1, "質問を入力してください").max(5000),
});

export const QAFeedbackInput = z.object({
  sessionId: z.string().min(1),
  feedback: QAFeedback,
});

export const SearchInput = z.object({
  q: z.string().optional(),
  industry: z.string().optional(),
  modelLayer: ModelLayer.optional(),
  valueAxis: ValueAxis.optional(),
  provenance: Provenance.optional(),
  tag: z.string().optional(),
});

// ─── LLM出力スキーマ ───────────────────────────────────

export const LLMSuggestOutput = z.object({
  modelLayer: ModelLayer,
  primaryValueAxis: ValueAxis.nullable(),
  provenance: Provenance,
  confidence: Confidence,
  tagCodes: z.array(z.string()),
  reasoning: z.string(),
});

export const LLMInsightOutput = z.object({
  insights: z.array(z.object({
    text: z.string(),
    evidenceStrength: EvidenceStrength,
    generalizability: Generalizability,
    modelLayer: ModelLayer,
    primaryValueAxis: ValueAxis.nullable(),
    provenance: z.string().default("ANONYMIZED_DERIVED"),
    applicableConditions: z.string().nullable().optional(),
    counterConditions: z.string().nullable().optional(),
    sourceObservationIndices: z.array(z.number().int().min(0)),
    reasoning: z.string(),
  })),
});

export const LLMMatchDetail = z.object({
  index: z.number().int().min(0),
  type: z.enum(["observation", "insight"]),
  matchScore: z.number().min(0).max(100),
  matchFactors: z.object({
    industry: z.number().min(0).max(100),
    situation: z.number().min(0).max(100),
    behavior: z.number().min(0).max(100),
    provenance: z.number().min(0).max(100),
  }),
  matchSummary: z.string(),
});

export const LLMQAOutput = z.object({
  answer: z.string(),
  reasoning: z.string(),
  referencedObservationIndices: z.array(z.number().int().min(0)),
  referencedInsightIndices: z.array(z.number().int().min(0)),
  confidence: z.enum(["high", "medium", "low"]),
  suggestedFollowUp: z.string().nullable(),
  matchDetails: z.array(LLMMatchDetail).default([]),
});

export const LLMLintOutput = z.object({
  results: z.array(z.object({
    type: z.enum(["contradiction", "gap", "connection", "topic_suggestion"]),
    severity: z.enum(["critical", "warning", "info"]),
    targetIndex: z.number().int().min(0),
    relatedIndex: z.number().int().min(0).nullable(),
    description: z.string(),
  })),
});

// ─── ヘルパー ───────────────────────────────────────────

/** Zodスキーマでパースし、失敗時は整形済みエラーメッセージを返す */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const messages = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  return { success: false, error: messages };
}

/** LLM出力をパースし、不正なフィールドはデフォルト値で補完 */
export function parseLLMOutput<T>(schema: z.ZodSchema<T>, raw: string): T {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in LLM response");

  const parsed = JSON.parse(jsonMatch[0]);
  return schema.parse(parsed);
}
