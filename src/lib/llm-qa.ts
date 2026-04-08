// LLM Q&A: ナレッジベースのObservation/Insightを文脈として読み込み、質問に回答
// Karpathy Stage 4: no RAG — LLMがWiki(KB)を直接読む

export type QAResult = {
  answer: string;
  reasoning: string;
  referencedObservationIndices: number[];
  referencedInsightIndices: number[];
  confidence: "high" | "medium" | "low";
  suggestedFollowUp: string | null;
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

## 回答ルール
- ナレッジベースの内容に基づいて回答すること（根拠なき推測は避ける）
- 根拠となるデータの番号を明示すること（[OBS-0], [INS-2] 等）
- 信頼スコアが高いデータを優先して引用すること
- ナレッジベースに該当する情報がない場合は正直に「該当データなし」と回答すること
- 回答の確信度を判定すること

## 出力フォーマット (JSON)
{
  "answer": "質問への回答（日本語、1-5文）",
  "reasoning": "この回答を導出した根拠（1-2文）",
  "referencedObservationIndices": [0, 2],
  "referencedInsightIndices": [1],
  "confidence": "high" | "medium" | "low",
  "suggestedFollowUp": "関連する追加質問の提案（あれば）"
}

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
  return JSON.parse(content);
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

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");
  return JSON.parse(jsonMatch[0]);
}
