// 公知(PUBLIC_CODIFIED)自動取込パイプライン
// Karpathy Stage 1 (Data Ingest) を公開情報に対して自動実行
//
// パイプライン:
// 1. ギャップ分析: Lint結果 + カバレッジマトリクスから優先トピック決定
// 2. 検索クエリ生成: LLMがドメイン知識でクエリを最適化
// 3. Web検索: Google / Brave で公開情報を取得
// 4. 重複検出: URL一致 → Embedding類似度(0.85)で除外
// 5. LLM構造化: 検索結果をObservationフォーマットに変換
// 6. 保存: DB + Embedding生成

import { prisma } from "@/lib/prisma";
import { searchWeb, type SearchResult } from "@/lib/web-search";
import { generateEmbedding, saveObservationEmbedding, searchSimilarObservations } from "@/lib/embedding";
import { parseLLMOutput } from "@/lib/validation";
import { z } from "zod";

// ─── 型定義 ──────────────────────────────────────────────

type IngestResult = {
  ingested: number;
  skippedDuplicates: number;
  skippedErrors: number;
  errors: string[];
  details: { text: string; modelLayer: string; source: string }[];
};

type SearchQuery = {
  query: string;
  targetModelLayer: string;
  targetIndustry: string;
  rationale: string;
};

type StructuredObservation = {
  text: string;
  modelLayer: string;
  primaryValueAxis: string | null;
  confidence: string;
  tagCodes: string[];
  country: string;
  reasoning: string;
};

// ─── Zodスキーマ ─────────────────────────────────────────

const LLMSearchQueryOutput = z.object({
  queries: z.array(z.object({
    query: z.string(),
    targetModelLayer: z.string(),
    targetIndustry: z.string(),
    rationale: z.string(),
  })),
});

const LLMStructuredObservation = z.object({
  text: z.string(),
  modelLayer: z.enum(["MOVEMENT", "APPROACH", "BREAKDOWN", "TRANSFER"]),
  primaryValueAxis: z.enum(["REVENUE_UP", "COST_DOWN", "RETENTION"]).nullable(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  tagCodes: z.array(z.string()),
  country: z.string().length(2).default("JP"),
  reasoning: z.string(),
});

// ─── 定数 ─────────────────────────────────────────────────

const DUPLICATE_SIMILARITY_THRESHOLD = 0.85;
const MODEL_LAYERS = ["MOVEMENT", "APPROACH", "BREAKDOWN", "TRANSFER"];
const INDUSTRIES = ["眼鏡小売", "アパレル", "飲食", "不動産", "保険", "美容室"];
const DEFAULT_BATCH_SIZE = 10;

// ─── メインパイプライン ───────────────────────────────────

export async function runAutoIngest(options?: { batchSize?: number }): Promise<IngestResult> {
  const batchSize = options?.batchSize || DEFAULT_BATCH_SIZE;
  const result: IngestResult = { ingested: 0, skippedDuplicates: 0, skippedErrors: 0, errors: [], details: [] };

  try {
    // Step 1: ギャップ分析 → 検索クエリ生成
    const queries = await generateSearchQueries(batchSize);
    if (queries.length === 0) {
      result.errors.push("検索クエリの生成に失敗しました");
      return result;
    }

    // Step 2: Web検索
    const candidates: { result: SearchResult; query: SearchQuery }[] = [];
    for (const q of queries) {
      const searchResults = await searchWeb(q.query, 3);
      for (const sr of searchResults) {
        candidates.push({ result: sr, query: q });
      }
    }

    // 検索APIなしの場合、LLMの内部知識で生成
    if (candidates.length === 0) {
      return await fallbackLLMIngest(batchSize, result);
    }

    // Step 3-5: 重複検出 → 構造化 → 保存
    for (const candidate of candidates) {
      if (result.ingested >= batchSize) break;

      try {
        // Step 3: URL重複チェック
        const urlExists = await prisma.observation.findFirst({
          where: { sourceUrl: candidate.result.url },
          select: { id: true },
        });
        if (urlExists) {
          result.skippedDuplicates++;
          continue;
        }

        // Step 3b: Embedding類似度チェック
        const candidateText = `${candidate.result.title} ${candidate.result.snippet}`;
        const similar = await searchSimilarObservations(candidateText, 1, DUPLICATE_SIMILARITY_THRESHOLD).catch(() => []);
        if (similar.length > 0) {
          result.skippedDuplicates++;
          continue;
        }

        // Step 4: LLM構造化
        const structured = await structureSearchResult(
          candidate.result.snippet,
          candidate.result.url,
          candidate.result.title
        );

        // Step 5: 保存
        const saved = await saveObservation(structured, candidate.result.url, candidate.result.title);
        if (saved) {
          result.ingested++;
          result.details.push({
            text: structured.text.slice(0, 100),
            modelLayer: structured.modelLayer,
            source: candidate.result.url,
          });
        }
      } catch (err) {
        result.skippedErrors++;
        result.errors.push(`Error processing ${candidate.result.url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // CompilationEvent記録
    await recordCompilationEvent(result);
    return result;

  } catch (err) {
    result.errors.push(`Pipeline error: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }
}

// ─── Step 1: 検索クエリ生成 ──────────────────────────────

async function generateSearchQueries(count: number): Promise<SearchQuery[]> {
  // ギャップ情報を取得
  const gaps = await prisma.lintResult.findMany({
    where: { type: { in: ["gap", "topic_suggestion"] }, status: "open" },
    orderBy: { severity: "asc" },
    take: 10,
    select: { description: true, type: true, severity: true },
  }).catch(() => []);

  // カバレッジ分析
  const coverage = await prisma.observation.groupBy({
    by: ["modelLayer"],
    where: { provenance: "PUBLIC_CODIFIED" },
    _count: { id: true },
  }).catch(() => []);

  const coverageStr = coverage.map((c) =>
    `${c.modelLayer}: ${c._count.id}件`
  ).join(", ") || "データなし";

  const gapStr = gaps.length > 0
    ? gaps.map((g) => `[${g.severity}] ${g.description}`).join("\n")
    : "特定のギャップなし（バランス良く収集）";

  const prompt = `あなたは小売・サービス業の店舗行動観察ナレッジベースの情報収集担当です。

## 現在のカバレッジ
PUBLIC_CODIFIED（公知形式知）の登録状況:
${coverageStr}

## 特定されたギャップ
${gapStr}

## 対象業種
${INDUSTRIES.join("、")}

## 対象モデル層
${MODEL_LAYERS.join("、")}
- MOVEMENT: 顧客/スタッフの動線・移動・入退店・回遊・滞在
- APPROACH: 声掛け・接客・提案・商品接触・試着試用
- BREAKDOWN: 離脱・待ち時間・不満・機会損失
- TRANSFER: 教育・引き継ぎ・ナレッジ共有・標準化

## タスク
上記のギャップとカバレッジを踏まえ、公開されている学術研究・業界レポート・専門家の知見を検索するためのクエリを${count}個生成してください。

## 出力フォーマット (JSON)
{
  "queries": [
    {
      "query": "検索クエリ（日本語 or 英語）",
      "targetModelLayer": "MOVEMENT|APPROACH|BREAKDOWN|TRANSFER",
      "targetIndustry": "業種名",
      "rationale": "このクエリを選んだ理由"
    }
  ]
}

必ずJSON形式のみで応答してください。`;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY required");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");

  const parsed = parseLLMOutput(LLMSearchQueryOutput, content);
  return parsed.queries.slice(0, count);
}

// ─── Step 4: 検索結果の構造化 ────────────────────────────

async function structureSearchResult(
  snippet: string,
  sourceUrl: string,
  sourceTitle: string,
): Promise<StructuredObservation> {
  const prompt = `あなたは小売・サービス業の店舗行動観察の専門家です。
以下のWeb検索結果から、店舗行動観察に関連する公知形式知（PUBLIC_CODIFIED）を1つ抽出し、構造化してください。

## 検索結果
タイトル: ${sourceTitle}
URL: ${sourceUrl}
内容: ${snippet}

## 出力フォーマット (JSON)
{
  "text": "観測事実として構造化されたテキスト（日本語、100-300文字）。出典を明記すること。",
  "modelLayer": "MOVEMENT|APPROACH|BREAKDOWN|TRANSFER",
  "primaryValueAxis": "REVENUE_UP|COST_DOWN|RETENTION" or null,
  "confidence": "HIGH|MEDIUM|LOW",
  "tagCodes": ["該当するタグコード"],
  "country": "JP（日本の情報）/ US（米国）等のISO 3166-1 alpha-2",
  "reasoning": "分類理由"
}

## タグコード候補
BEHAVIOR系: circulation, right_turn_bias, entrance, dwell, staff_movement, customer_flow, greeting, eye_contact, first_contact, proposal, trial, closing, upsell, cross_sell, wait_abandonment, queue, capacity_overload, hesitation, fatigue_curve, cognitive_load, shadowing, peer_sharing, checklist, handoff
THEORY系: mere_exposure, goal_gradient, paradox_of_choice, hicks_law, peak_end_rule, anchoring, nudge, spacing_effect, desirable_difficulty, chunking, psychological_safety, wait_perception

必ずJSON形式のみで応答してください。`;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY required");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");

  return parseLLMOutput(LLMStructuredObservation, content);
}

// ─── Step 5: DB保存 ──────────────────────────────────────

async function saveObservation(
  structured: StructuredObservation,
  sourceUrl: string,
  sourceTitle: string,
): Promise<boolean> {
  // タグコードからタグIDを解決
  const tags = await prisma.ontologyTag.findMany({
    where: { code: { in: structured.tagCodes } },
    select: { id: true },
  });

  const observation = await prisma.observation.create({
    data: {
      text: structured.text,
      modelLayer: structured.modelLayer,
      provenance: "PUBLIC_CODIFIED",
      primaryValueAxis: structured.primaryValueAxis,
      confidence: structured.confidence,
      country: structured.country,
      sourceType: "web_search",
      sourceTitle: sourceTitle,
      sourceUrl: sourceUrl,
      trustScore: 0.5, // PUBLIC_CODIFIED初期値
      tags: {
        create: tags.map((t) => ({ tagId: t.id })),
      },
    },
  });

  // Embedding生成（非同期）
  saveObservationEmbedding(observation.id, observation.text).catch((err) =>
    console.error("Auto-ingest embedding failed:", err)
  );

  return true;
}

// ─── フォールバック: Web検索なしでLLM内部知識から生成 ──

async function fallbackLLMIngest(batchSize: number, result: IngestResult): Promise<IngestResult> {
  // ギャップ情報取得
  const gaps = await prisma.lintResult.findMany({
    where: { type: { in: ["gap", "topic_suggestion"] }, status: "open" },
    take: 5,
    select: { description: true },
  }).catch(() => []);

  const coverage = await prisma.observation.groupBy({
    by: ["modelLayer"],
    where: { provenance: "PUBLIC_CODIFIED" },
    _count: { id: true },
  }).catch(() => []);

  const prompt = `あなたは小売・サービス業の店舗行動観察に精通した研究者です。
以下の条件で、学術的に確立された公知の知見を${batchSize}件生成してください。

## 現在のカバレッジ
${coverage.map((c) => `${c.modelLayer}: ${c._count.id}件`).join(", ") || "なし"}

## ギャップ
${gaps.map((g) => g.description).join("\n") || "特になし"}

## 対象業種: ${INDUSTRIES.join("、")}

## 出力フォーマット (JSON)
{
  "observations": [
    {
      "text": "公知の知見（出典・研究名を含む、100-300文字）",
      "modelLayer": "MOVEMENT|APPROACH|BREAKDOWN|TRANSFER",
      "primaryValueAxis": "REVENUE_UP|COST_DOWN|RETENTION" or null,
      "confidence": "MEDIUM",
      "tagCodes": ["タグコード"],
      "country": "JP",
      "source": "出典名（論文・書籍・研究機関名）"
    }
  ]
}

## 重要
- 必ず実在する研究・理論・法則に基づくこと（ハルシネーション厳禁）
- 「〇〇の研究によると」「〇〇理論では」等、出典を本文に含めること
- 各業種・各モデル層をバランスよくカバーすること

必ずJSON形式のみで応答してください。`;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    result.errors.push("OPENAI_API_KEY required");
    return result;
  }

  const LLMFallbackOutput = z.object({
    observations: z.array(z.object({
      text: z.string(),
      modelLayer: z.enum(["MOVEMENT", "APPROACH", "BREAKDOWN", "TRANSFER"]),
      primaryValueAxis: z.enum(["REVENUE_UP", "COST_DOWN", "RETENTION"]).nullable(),
      confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
      tagCodes: z.array(z.string()),
      country: z.string().length(2).default("JP"),
      source: z.string(),
    })),
  });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.5,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const parsed = parseLLMOutput(LLMFallbackOutput, content);

    for (const obs of parsed.observations) {
      if (result.ingested >= batchSize) break;

      try {
        // 重複チェック
        const similar = await searchSimilarObservations(obs.text, 1, DUPLICATE_SIMILARITY_THRESHOLD).catch(() => []);
        if (similar.length > 0) {
          result.skippedDuplicates++;
          continue;
        }

        const saved = await saveObservation(
          { ...obs, reasoning: "LLM内部知識からの生成" },
          "",
          obs.source,
        );
        if (saved) {
          result.ingested++;
          result.details.push({
            text: obs.text.slice(0, 100),
            modelLayer: obs.modelLayer,
            source: obs.source,
          });
        }
      } catch (err) {
        result.skippedErrors++;
        result.errors.push(`Fallback error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    result.errors.push(`Fallback pipeline error: ${err instanceof Error ? err.message : String(err)}`);
  }

  await recordCompilationEvent(result);
  return result;
}

// ─── CompilationEvent記録 ────────────────────────────────

async function recordCompilationEvent(result: IngestResult): Promise<void> {
  await prisma.compilationEvent.create({
    data: {
      trigger: "auto_ingest",
      sourceType: "web_search",
      resultType: "observation",
    },
  }).catch((err) => console.error("Failed to record CompilationEvent:", err));
}
