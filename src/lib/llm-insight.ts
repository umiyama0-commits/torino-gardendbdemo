// LLM Insight生成: 複数Observationを統合してInsightを導出
// Karpathy Stage 2→3: Observation群からの知見昇格

const INSIGHT_PROMPT = `あなたは小売・サービス業の店舗行動観察データを分析する専門家です。
与えられた複数の観察データ（Observation）を統合分析し、一般化された知見（Insight）を導出してください。

## 入力
- 複数のObservation（各々にmodelLayer, valueAxis, provenance, タグ情報付き）

## 出力フォーマット (JSON)
{
  "insights": [
    {
      "text": "知見テキスト（観察から導出された一般化された気づき。1-3文）",
      "evidenceStrength": "HIGH" | "MEDIUM" | "LOW",
      "generalizability": "HIGH" | "MEDIUM" | "LOW",
      "modelLayer": "MOVEMENT" | "APPROACH" | "BREAKDOWN" | "TRANSFER",
      "primaryValueAxis": "REVENUE_UP" | "COST_DOWN" | "RETENTION" | null,
      "provenance": "ANONYMIZED_DERIVED",
      "applicableConditions": "この知見が成立する条件",
      "counterConditions": "この知見が成立しない条件",
      "sourceObservationIndices": [0, 1, 2],
      "reasoning": "この知見を導出した根拠（1-2文）"
    }
  ]
}

## 知見導出の基準
- 2つ以上のObservationに共通するパターンを抽出
- 個別店舗の話を業種横断の一般知に昇格させる
- evidenceStrength: 裏付けるObservationの数と一貫性で判定
- generalizability: 業種・店舗規模を超えて適用できるかで判定
- provenance は基本 ANONYMIZED_DERIVED（個別店舗情報を匿名化した導出知）

## アウトプット品質基準
- 単なるObservationの要約ではなく、複数観察から導ける「法則」「傾向」「パターン」を抽出すること
- 可能な場合、ベンチマーク比較に使えるKPI（接客発生率、CVR、人時売上高等）への言及を含める
- 改善に繋がる知見を優先（「だから何をすべきか」に繋がるInsight）
- 点推定は避け、傾向をレンジで表現する（例: 「+8〜15%の改善傾向」）
- 複数Provenance層のデータに裏付けられたInsightを優先的に導出する

## 制約
- sourceObservationIndices は入力Observationの0始まりインデックス
- 1-5件程度のInsightを導出すること（無理に多く出さない）
- クライアント名や店舗を特定可能な情報は含めない

必ずJSON形式のみで応答してください。`;

import { LLMInsightOutput, parseLLMOutput } from "@/lib/validation";

export type InsightSuggestion = {
  text: string;
  evidenceStrength: string;
  generalizability: string;
  modelLayer: string;
  primaryValueAxis: string | null;
  provenance: string;
  applicableConditions?: string | null;
  counterConditions?: string | null;
  sourceObservationIndices: number[];
  reasoning: string;
};

export type InsightSuggestResult = {
  insights: InsightSuggestion[];
};

export async function generateInsights(
  observations: { id: string; text: string; modelLayer: string; primaryValueAxis: string | null; provenance: string; tagCodes: string[] }[]
): Promise<InsightSuggestResult> {
  const provider = process.env.LLM_PROVIDER || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
  const apiKey = provider === "anthropic"
    ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("LLM API key not configured");
  }

  const input = observations.map((o, i) =>
    `[Observation ${i}] modelLayer=${o.modelLayer}, valueAxis=${o.primaryValueAxis || "なし"}, provenance=${o.provenance}, tags=[${o.tagCodes.join(",")}]\n${o.text}`
  ).join("\n\n");

  const truncated = input.slice(0, 8000);

  if (provider === "anthropic") {
    return callAnthropicInsight(apiKey, truncated);
  }
  return callOpenAIInsight(apiKey, truncated);
}

async function callOpenAIInsight(apiKey: string, text: string): Promise<InsightSuggestResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: INSIGHT_PROMPT },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");
  return parseLLMOutput(LLMInsightOutput, content);
}

async function callAnthropicInsight(apiKey: string, text: string): Promise<InsightSuggestResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: INSIGHT_PROMPT,
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text;
  if (!content) throw new Error("Empty response from Anthropic");

  return parseLLMOutput(LLMInsightOutput, content);
}
