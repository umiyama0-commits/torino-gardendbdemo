// LLM Linting: 矛盾検出・ギャップ補完・接続発見・トピック提案
// Karpathy Stage 6: 能動的品質向上

const LINT_PROMPT = `あなたは小売・サービス業のナレッジベースの品質管理専門家です。
与えられたObservationとInsightのデータを分析し、以下の品質チェックを実行してください。

## 出力フォーマット (JSON)
{
  "results": [
    {
      "type": "contradiction" | "gap" | "connection" | "topic_suggestion",
      "severity": "critical" | "warning" | "info",
      "targetIndex": 0,
      "relatedIndex": 1,
      "description": "発見内容の説明"
    }
  ]
}

## チェック項目

### contradiction（矛盾検出）
- 同じテーマについて矛盾する主張がないか
- 例: 「入口右側のディスプレイは効果的」vs「入口右側は死角になりやすい」
- severity: critical（明確な矛盾）、warning（条件次第で矛盾）

### gap（ギャップ補完）
- 特定のmodelLayerやvalueAxisのデータが不足していないか
- 重要そうなテーマに対して裏付けデータが1件しかない場合
- severity: warning（重要な欠落）、info（軽微）

### connection（接続発見）
- 異なるmodelLayer間で因果関係がありそうなデータの組み合わせ
- 例: MOVEMENT の観察が APPROACH の知見を裏付けている
- severity: info

### topic_suggestion（トピック提案）
- 既存データから推測される、次に調査すべきテーマ
- severity: info

## 重要
- 無理に多くの結果を出さない（本当に価値のあるものだけ）
- targetIndex と relatedIndex は入力データの0始まりインデックス
- relatedIndex は該当なしの場合 null

必ずJSON形式のみで応答してください。`;

import { LLMLintOutput, parseLLMOutput } from "@/lib/validation";

export type LintSuggestion = {
  type: "contradiction" | "gap" | "connection" | "topic_suggestion";
  severity: "critical" | "warning" | "info";
  targetIndex: number;
  relatedIndex: number | null;
  description: string;
};

export type LintSuggestResult = {
  results: LintSuggestion[];
};

export async function lintKnowledgeBase(
  items: { id: string; type: "observation" | "insight"; text: string; modelLayer: string; primaryValueAxis: string | null; provenance: string }[]
): Promise<LintSuggestResult> {
  const provider = process.env.LLM_PROVIDER || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
  const apiKey = provider === "anthropic"
    ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("LLM API key not configured");
  }

  const input = items.map((item, i) =>
    `[${i}] type=${item.type}, modelLayer=${item.modelLayer}, valueAxis=${item.primaryValueAxis || "なし"}, provenance=${item.provenance}\n${item.text}`
  ).join("\n\n");

  const truncated = input.slice(0, 8000);

  if (provider === "anthropic") {
    return callAnthropicLint(apiKey, truncated);
  }
  return callOpenAILint(apiKey, truncated);
}

async function callOpenAILint(apiKey: string, text: string): Promise<LintSuggestResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: LINT_PROMPT },
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
  return parseLLMOutput(LLMLintOutput, content);
}

async function callAnthropicLint(apiKey: string, text: string): Promise<LintSuggestResult> {
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
      system: LINT_PROMPT,
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

  return parseLLMOutput(LLMLintOutput, content);
}
