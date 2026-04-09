// LLM自動構造化: テキストからモデル層・価値軸・Provenance・タグを自動推定
// OpenAI (GPT-4o-mini) / Anthropic (Claude) を環境変数で切り替え

const SUGGEST_PROMPT = `あなたは小売・サービス業の店舗行動観察の専門家です。
与えられた観察テキストを分析し、以下の構造化メタデータを推定してください。

## 出力フォーマット (JSON)
{
  "modelLayer": "MOVEMENT" | "APPROACH" | "BREAKDOWN" | "TRANSFER",
  "primaryValueAxis": "REVENUE_UP" | "COST_DOWN" | "RETENTION" | null,
  "provenance": "FIELD_OBSERVED" | "ANONYMIZED_DERIVED" | "PUBLIC_CODIFIED",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "tagCodes": ["tag_code_1", "tag_code_2", ...],
  "reasoning": "判定理由（1-2文）"
}

## modelLayer 判定基準
- MOVEMENT: 顧客/スタッフの動線・移動・入退店・回遊・滞在
- APPROACH: 声掛け・接客・提案・商品接触・試着試用
- BREAKDOWN: 離脱・待ち時間・不満・機会損失・キャパシティ超過
- TRANSFER: 教育・引き継ぎ・ナレッジ共有・標準化・OJT

## provenance 判定基準
- FIELD_OBSERVED: 特定店舗・特定日の直接観察（「〇〇店で」「今日」等の具体性）
- ANONYMIZED_DERIVED: 複数店舗/業種横断の匿名化データ（「小売全般で」「業種を問わず」等）
- PUBLIC_CODIFIED: 学術研究・公開調査・理論（論文名・研究者名・法則名の言及）

## 使用可能なタグコード
BEHAVIOR系: circulation, right_turn_bias, entrance, exit, dwell, staff_movement, customer_flow, route_deviation, shortcut, greeting, eye_contact, first_contact, proposal, trial, closing, upsell, cross_sell, complaint, service_counter, follow_up, wait_abandonment, queue, capacity_overload, hesitation, return_rate, browse_only, fatigue_curve, cognitive_load, shadowing, peer_sharing, checklist, handoff, observational_learning, role_play, manual_update
CONTEXT系: weekday, weekend, peak_hour, off_peak, event, season, full_staff, under_staff, newbie_on_floor, expert_on_floor, family, couple, solo, repeater, first_visit, impulse, planned, browsing, sc_location, roadside, station_front, urban_core, suburban, resort
SPACE系: entrance, main_aisle, sub_aisle, end_cap, golden_zone, checkout_zone, waiting_area, fitting_room, service_counter, back_office, main_display
THEORY系: mere_exposure, goal_gradient, paradox_of_choice, hicks_law, peak_end_rule, anchoring, nudge, spacing_effect, desirable_difficulty, chunking, psychological_safety, wait_perception

必ずJSON形式のみで応答してください。`;

import { LLMSuggestOutput, LLMBulkExtractOutput, parseLLMOutput } from "@/lib/validation";

export type SuggestResult = {
  modelLayer: string;
  primaryValueAxis: string | null;
  provenance: string;
  confidence: string;
  tagCodes: string[];
  reasoning: string;
};

export async function suggestMetadata(text: string): Promise<SuggestResult> {
  const provider = process.env.LLM_PROVIDER || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
  const apiKey = provider === "anthropic"
    ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("LLM API key not configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env");
  }

  const truncated = text.slice(0, 3000);

  if (provider === "anthropic") {
    return callAnthropicSuggest(apiKey, truncated);
  }
  return callOpenAISuggest(apiKey, truncated);
}

// ─── 一括抽出 ──────────────────────────────────────────

const BULK_EXTRACT_PROMPT = `あなたは小売・サービス業の店舗行動観察の専門家です。
与えられた日報・報告書・メモ・議事録のテキストから、個別の観測事実を抽出してください。

## ルール
1. テキスト中の**別々の事実・観測・知見**をそれぞれ独立した観測データに分割する
2. 1つの観測 = 1つの具体的な事実や発見。複合的な文は分割する
3. 主観的な感想や曖昧な記述は除外する。事実ベースの記述のみ抽出する
4. 各観測に構造化メタデータを付与する
5. 元テキストの情報を失わないよう、重要な数値・条件は保持する

## 出力フォーマット (JSON)
{
  "observations": [
    {
      "text": "抽出した観測テキスト（簡潔かつ具体的に。50〜200文字程度）",
      "modelLayer": "MOVEMENT" | "APPROACH" | "BREAKDOWN" | "TRANSFER",
      "primaryValueAxis": "REVENUE_UP" | "COST_DOWN" | "RETENTION" | null,
      "provenance": "FIELD_OBSERVED" | "ANONYMIZED_DERIVED" | "PUBLIC_CODIFIED",
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "tagCodes": ["tag_code_1", "tag_code_2"],
      "reasoning": "抽出理由（1文）"
    }
  ]
}

## modelLayer 判定基準
- MOVEMENT: 顧客/スタッフの動線・移動・入退店・回遊・滞在
- APPROACH: 声掛け・接客・提案・商品接触・試着試用
- BREAKDOWN: 離脱・待ち時間・不満・機会損失・キャパシティ超過
- TRANSFER: 教育・引き継ぎ・ナレッジ共有・標準化・OJT

## provenance 判定基準
- FIELD_OBSERVED: 特定店舗・特定日の直接観察（「〇〇店で」「今日」等の具体性）
- ANONYMIZED_DERIVED: 複数店舗/業種横断の匿名化データ（「小売全般で」「業種を問わず」等）
- PUBLIC_CODIFIED: 学術研究・公開調査・理論（論文名・研究者名・法則名の言及）

## 使用可能なタグコード
BEHAVIOR系: circulation, right_turn_bias, entrance, exit, dwell, staff_movement, customer_flow, route_deviation, shortcut, greeting, eye_contact, first_contact, proposal, trial, closing, upsell, cross_sell, complaint, service_counter, follow_up, wait_abandonment, queue, capacity_overload, hesitation, return_rate, browse_only, fatigue_curve, cognitive_load, shadowing, peer_sharing, checklist, handoff, observational_learning, role_play, manual_update
CONTEXT系: weekday, weekend, peak_hour, off_peak, event, season, full_staff, under_staff, newbie_on_floor, expert_on_floor, family, couple, solo, repeater, first_visit, impulse, planned, browsing, sc_location, roadside, station_front, urban_core, suburban, resort
SPACE系: entrance, main_aisle, sub_aisle, end_cap, golden_zone, checkout_zone, waiting_area, fitting_room, service_counter, back_office, main_display
THEORY系: mere_exposure, goal_gradient, paradox_of_choice, hicks_law, peak_end_rule, anchoring, nudge, spacing_effect, desirable_difficulty, chunking, psychological_safety, wait_perception

必ずJSON形式のみで応答してください。`;

export type BulkExtractResult = {
  observations: Array<{
    text: string;
    modelLayer: string;
    primaryValueAxis: string | null;
    provenance: string;
    confidence: string;
    tagCodes: string[];
    reasoning: string;
  }>;
};

export async function bulkExtractObservations(text: string): Promise<BulkExtractResult> {
  const provider = process.env.LLM_PROVIDER || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");
  const apiKey = provider === "anthropic"
    ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("LLM API key not configured");
  }

  const truncated = text.slice(0, 8000);

  if (provider === "anthropic") {
    return callAnthropicBulkExtract(apiKey, truncated);
  }
  return callOpenAIBulkExtract(apiKey, truncated);
}

async function callOpenAIBulkExtract(apiKey: string, text: string): Promise<BulkExtractResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: BULK_EXTRACT_PROMPT },
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

  return parseLLMOutput(LLMBulkExtractOutput, content);
}

async function callAnthropicBulkExtract(apiKey: string, text: string): Promise<BulkExtractResult> {
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
      system: BULK_EXTRACT_PROMPT,
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

  return parseLLMOutput(LLMBulkExtractOutput, content);
}

// ─── 単件推定 ──────────────────────────────────────────

async function callOpenAISuggest(apiKey: string, text: string): Promise<SuggestResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SUGGEST_PROMPT },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  return parseLLMOutput(LLMSuggestOutput, content);
}

async function callAnthropicSuggest(apiKey: string, text: string): Promise<SuggestResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SUGGEST_PROMPT,
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

  return parseLLMOutput(LLMSuggestOutput, content);
}
