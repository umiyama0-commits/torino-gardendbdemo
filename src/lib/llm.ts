const SYSTEM_PROMPT = `あなたは小売・サービス業の店舗行動観察の専門家です。
与えられたテキストから、店舗での顧客行動や業務に関する観察事実（Observation）を抽出してください。

各観察事実について以下の情報を構造化して返してください:
- text: 観察テキスト（日本語）
- textEn: 英語訳
- modelLayer: MOVEMENT（動線）, APPROACH（接客）, BREAKDOWN（離脱）, TRANSFER（伝承）のいずれか
- primaryValueAxis: REVENUE_UP（売上向上）, COST_DOWN（コスト削減）, RETENTION（定着・離職防止）のいずれか
- provenance: FIELD_OBSERVED（現場観察）, ANONYMIZED_DERIVED（匿名化データ）, PUBLIC_CODIFIED（公知）のいずれか
- confidence: HIGH, MEDIUM, LOW のいずれか
- estimatedImpactMin: KPIへの想定インパクト下限（%、数値のみ）
- estimatedImpactMax: KPIへの想定インパクト上限（%、数値のみ）
- impactKPI: 影響するKPI（売上, コスト削減率, 離職率 など）

JSON配列で返してください。観察事実が見つからない場合は空配列[]を返してください。`;

type ExtractedObservation = {
  text: string;
  textEn?: string;
  modelLayer: string;
  primaryValueAxis?: string;
  provenance: string;
  confidence: string;
  estimatedImpactMin?: number;
  estimatedImpactMax?: number;
  impactKPI?: string;
};

export async function extractObservationsFromText(
  documentText: string
): Promise<ExtractedObservation[]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const provider = process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "anthropic");

  if (!apiKey) {
    throw new Error("LLM API key not configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env");
  }

  const truncatedText = documentText.slice(0, 15000);

  if (provider === "anthropic") {
    return callAnthropic(apiKey, truncatedText);
  }
  return callOpenAI(apiKey, truncatedText);
}

async function callOpenAI(apiKey: string, text: string): Promise<ExtractedObservation[]> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `以下のテキストから観察事実を抽出してください:\n\n${text}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return [];

  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : parsed.observations || [];
}

async function callAnthropic(apiKey: string, text: string): Promise<ExtractedObservation[]> {
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
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `以下のテキストから観察事実を抽出してJSON配列で返してください:\n\n${text}` },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
  const data = await res.json();
  const content = data.content?.[0]?.text;
  if (!content) return [];

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  return JSON.parse(jsonMatch[0]);
}
