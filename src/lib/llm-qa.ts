// LLM Q&A: ナレッジベースのObservation/Insightを文脈として読み込み、質問に回答
// Karpathy Stage 4: no RAG — LLMがWiki(KB)を直接読む

import { LLMQAOutput, parseLLMOutput } from "@/lib/validation";

export type MatchDetail = {
  index: number;
  type: "observation" | "insight";
  matchScore: number; // 0-100
  matchFactors: {
    industry: number;    // 業種マッチ度 0-100
    situation: number;   // 状況マッチ度 0-100
    behavior: number;    // 行動Behaviorマッチ度 0-100
    provenance: number;  // データ出自の信頼度 0-100
  };
  matchSummary: string; // 日本語での簡潔なマッチ理由
};

export type QAResult = {
  answer: string;
  reasoning: string;
  referencedObservationIndices: number[];
  referencedInsightIndices: number[];
  confidence: "high" | "medium" | "low";
  suggestedFollowUp: string | null;
  matchDetails: MatchDetail[];
};

export async function answerQuestion(
  question: string,
  observations: { id: string; text: string; modelLayer: string; provenance: string; trustScore: number }[],
  insights: { id: string; text: string; modelLayer: string | null; provenance: string; trustScore: number }[]
): Promise<QAResult> {
  const provider = process.env.LLM_PROVIDER || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
  const apiKey = provider === "anthropic"
    ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY;

  if (!apiKey) throw new Error("LLM API key not configured");

  const systemPrompt = buildSystemPrompt(observations, insights);
  const truncatedQ = question.slice(0, 2000);

  if (provider === "anthropic") {
    return callAnthropic(apiKey, systemPrompt, truncatedQ);
  }
  return callOpenAI(apiKey, systemPrompt, truncatedQ);
}

function buildSystemPrompt(
  observations: { id: string; text: string; modelLayer: string; provenance: string; trustScore: number }[],
  insights: { id: string; text: string; modelLayer: string | null; provenance: string; trustScore: number }[]
): string {
  const obsContext = observations.map((o, i) =>
    `[OBS-${i}] (信頼:${(o.trustScore * 100).toFixed(0)}%, ${o.modelLayer}, ${o.provenance}) ${o.text}`
  ).join("\n");

  const insContext = insights.map((ins, i) =>
    `[INS-${i}] (信頼:${(ins.trustScore * 100).toFixed(0)}%, ${ins.modelLayer || "—"}, ${ins.provenance}) ${ins.text}`
  ).join("\n");

  return `あなたは小売・サービス業の店舗行動観察ナレッジベースのQ&Aアシスタントです。
以下のナレッジベースの内容に基づいて質問に回答してください。

## ナレッジベース

### 観測データ (Observation)
${obsContext || "(データなし)"}

### 洞察 (Insight)
${insContext || "(データなし)"}

## アウトプット品質基準

### 必須原則
- 「分析しました」で終わるのは不可。必ず「だから何をすべきか」「それによって何が変わるか」まで踏み込む
- KPIに言及する場合、①実測値 ②同条件ベンチマーク(母数付き) ③ポジショニング をセットで出す
- 改善提案には必ず: ①ボトルネック特定 → ②根拠 → ③具体的打ち手 → ④想定インパクト(レンジで提示) → ⑤信頼度

### 信頼度ルール
- 根拠データのProvenance層を明示すること（FIELD_OBSERVED=自社実績, ANONYMIZED_DERIVED=匿名化汎用知, PUBLIC_CODIFIED=公知形式知）
- 信頼スコアが高いデータを優先して引用すること
- 複数のProvenance層で裏付けられた知見は最優先で引用
- 点推定は禁止。改善予測は必ずレンジ（例: +8〜15%）で提示

### 禁止事項
- エビデンスなき断言（データ不足なら「仮説段階」と正直に表記）
- クライアント名の漏洩（匿名化データから復元可能な情報の提示）

## 回答ルール
- ナレッジベースの内容に基づいて回答すること（根拠なき推測は避ける）
- 根拠となるデータの番号を明示すること（[OBS-0], [INS-2] 等）
- ナレッジベースに該当する情報がない場合は正直に「該当データなし」と回答すること
- 回答の確信度を判定すること

## マッチ度評価
回答に使用する各データについて、質問内容との「マッチ度」を以下4軸で0-100で評価し、納得感の根拠とする:
- industry: 業種の一致度（同業種=100, 類似業種=50-80, 異業種=0-30）
- situation: 状況の一致度（同条件=100, 類似条件=50-80, 異条件=0-30）
- behavior: 行動Behaviorの一致度（同じ行動パターン=100, 類似=50-80, 異種=0-30）
- provenance: データ出自の信頼度（FIELD_OBSERVED=90-100, ANONYMIZED_DERIVED=50-70, PUBLIC_CODIFIED=20-40）

総合マッチ度 matchScore = (industry×0.3 + situation×0.3 + behavior×0.25 + provenance×0.15) の加重平均

## 出力フォーマット (JSON)
{
  "answer": "質問への回答（日本語、1-5文。改善提案の場合はボトルネック→打ち手→想定インパクトの構造で）",
  "reasoning": "この回答を導出した根拠（引用データのProvenance層と信頼度を明示）",
  "referencedObservationIndices": [0, 2],
  "referencedInsightIndices": [1],
  "confidence": "high" | "medium" | "low",
  "suggestedFollowUp": "関連する追加質問の提案（あれば）",
  "matchDetails": [
    {
      "index": 0,
      "type": "observation",
      "matchScore": 85,
      "matchFactors": { "industry": 100, "situation": 80, "behavior": 70, "provenance": 90 },
      "matchSummary": "同業種・同立地での接客観察データ。状況も類似"
    }
  ]
}

matchDetailsには、回答に使用した全てのデータ（OBS/INS）についてマッチ度を記載すること。

必ずJSON形式のみで応答してください。`;
}

async function callOpenAI(apiKey: string, systemPrompt: string, question: string): Promise<QAResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
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
  return parseLLMOutput(LLMQAOutput, content);
}

async function callAnthropic(apiKey: string, systemPrompt: string, question: string): Promise<QAResult> {
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
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text;
  if (!content) throw new Error("Empty response from Anthropic");

  return parseLLMOutput(LLMQAOutput, content);
}
