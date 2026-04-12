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
const DEFAULT_BATCH_SIZE = 100;

// 検索ソース優先度: 学術DB・業界レポート > 一般ニュース
const PREFERRED_SOURCES = [
  "scholar.google.com",      // Google Scholar
  "j-stage.jst.go.jp",       // J-STAGE（日本の学術論文）
  "ci.nii.ac.jp",            // CiNii（日本の学術DB）
  "jmra-net.or.jp",          // 日本マーケティングリサーチ協会
  "meti.go.jp",              // 経産省統計・レポート
  "nri.com",                 // 野村総研
  "mckinsey.com",            // McKinsey
  "hbr.org",                 // Harvard Business Review
  "retaildive.com",          // RetailDive（小売業界メディア）
  "diamond.jp",              // ダイヤモンド・オンライン
];

// 国コード → 言語・検索ヒント
const COUNTRY_LANG_HINT: Record<string, string> = {
  JP: "日本語",
  SG: "English (Singapore)",
  US: "English (US)",
  HK: "繁體中文 or English (Hong Kong)",
  AU: "English (Australia)",
  TW: "繁體中文 (Taiwan)",
  KR: "한국어 (Korea)",
  CN: "简体中文 (China)",
  TH: "English or ไทย (Thailand)",
  GB: "English (UK)",
  DE: "Deutsch (Germany)",
  FR: "Français (France)",
};

/**
 * マスターコンフィグから国別取込比率を読み込む
 * フォーマット: "JP:70,SG:6,US:6,HK:6,AU:6,TW:6"
 */
async function getCountryWeights(): Promise<{ code: string; weight: number; langHint: string }[]> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: "ingest.countryWeights" },
  }).catch(() => null);

  const raw = config?.value || "JP:70,SG:6,US:6,HK:6,AU:6,TW:6";
  const entries = raw.split(",").map((pair) => {
    const [code, weightStr] = pair.trim().split(":");
    return {
      code: code.trim(),
      weight: parseInt(weightStr?.trim() || "0", 10),
      langHint: COUNTRY_LANG_HINT[code.trim()] || "English",
    };
  }).filter((e) => e.weight > 0);

  return entries;
}

/**
 * 国別比率に基づいてクエリ数を配分
 * 例: 100件, JP:70% → JP向けクエリ70個相当
 */
function allocateQueriesByCountry(
  totalQueries: number,
  weights: { code: string; weight: number }[],
): { code: string; count: number }[] {
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  const result: { code: string; count: number }[] = [];
  let allocated = 0;

  for (let i = 0; i < weights.length; i++) {
    const count = i === weights.length - 1
      ? totalQueries - allocated // 最後は残り全部
      : Math.round((weights[i].weight / totalWeight) * totalQueries);
    result.push({ code: weights[i].code, count: Math.max(count, 1) });
    allocated += count;
  }

  return result;
}

/**
 * ソース品質スコア: URL中のドメインで学術・業界ソースを優遇
 * 高品質ソースから優先的にデータを取り込む
 */
function scoreSourceQuality(url: string): number {
  const domain = url.toLowerCase();
  // Tier 1: 学術DB (スコア 1.0)
  if (domain.includes("scholar.google") || domain.includes("j-stage.jst.go.jp") ||
      domain.includes("ci.nii.ac.jp") || domain.includes("pubmed") ||
      domain.includes("researchgate.net") || domain.includes("arxiv.org")) return 1.0;
  // Tier 2: 政府・研究機関 (スコア 0.9)
  if (domain.includes(".go.jp") || domain.includes(".gov") ||
      domain.includes("nri.com") || domain.includes("mckinsey.com") ||
      domain.includes("hbr.org") || domain.includes("bcg.com")) return 0.9;
  // Tier 3: 業界メディア (スコア 0.7)
  if (domain.includes("retaildive.com") || domain.includes("diamond.jp") ||
      domain.includes("nikkei.com") || domain.includes("toyokeizai.net") ||
      domain.includes("jmra-net.or.jp")) return 0.7;
  // Tier 4: 一般メディア (スコア 0.4)
  if (domain.includes(".ac.jp") || domain.includes(".edu")) return 0.8;
  // Tier 5: その他 (スコア 0.3)
  return 0.3;
}

// ─── メインパイプライン ───────────────────────────────────

export async function runAutoIngest(options?: { batchSize?: number }): Promise<IngestResult> {
  const batchSize = options?.batchSize || DEFAULT_BATCH_SIZE;
  const result: IngestResult = { ingested: 0, skippedDuplicates: 0, skippedErrors: 0, errors: [], details: [] };

  try {
    // Step 0: マスターコンフィグから国別比率を読み込み
    const countryWeights = await getCountryWeights();

    // Step 1: ギャップ分析 → 検索クエリ生成（国別比率対応）
    const queries = await generateSearchQueries(batchSize, countryWeights);
    if (queries.length === 0) {
      result.errors.push("検索クエリの生成に失敗しました");
      return result;
    }

    // Step 2: Web検索 → ソース品質でソート
    const candidates: { result: SearchResult; query: SearchQuery; sourceQuality: number }[] = [];
    for (const q of queries) {
      const searchResults = await searchWeb(q.query, 3);
      for (const sr of searchResults) {
        candidates.push({ result: sr, query: q, sourceQuality: scoreSourceQuality(sr.url) });
      }
    }
    // 学術・業界ソースを優先
    candidates.sort((a, b) => b.sourceQuality - a.sourceQuality);

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

async function generateSearchQueries(
  count: number,
  countryWeights?: { code: string; weight: number; langHint: string }[],
): Promise<SearchQuery[]> {
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

## 検索先の優先順位
1. 学術論文・研究（J-STAGE, Google Scholar, CiNii, HBR）
2. 業界レポート・統計（経産省, NRI, McKinsey, RetailDive）
3. 専門メディア（ダイヤモンド, 日経ビジネス等）
4. 一般ニュースは最後の手段

## 国・言語の比率（マスターコンフィグ設定）
${(countryWeights || [{ code: "JP", weight: 70, langHint: "日本語" }]).map((cw) =>
  `- ${cw.code}(${cw.weight}%): ${cw.langHint}`
).join("\n")}

## 新しさの重視
- 過去5年以内（2021年以降）の研究を優先
- クエリに年号（"2023" "2024" "最新"）を含めるとよい
- ただし古典的理論（ヒックの法則等）も必要に応じて含める

## 出力フォーマット (JSON)
{
  "queries": [
    {
      "query": "検索クエリ（日本語 or 英語。site:指定も可）",
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
  // タグコードからタグIDを解決（typeも取得してタグ充実度計算に使う）
  const tags = await prisma.ontologyTag.findMany({
    where: { code: { in: structured.tagCodes } },
    select: { id: true, type: true },
  });

  // タグ充実度ベースの信頼スコアを計算
  const { computeObservationTrustScore, computeTagRichnessScore } = await import("@/lib/trust-score");
  const tagTypes = new Set(tags.map((t) => t.type));
  const trustScore = computeObservationTrustScore({
    confidence: structured.confidence,
    provenance: "PUBLIC_CODIFIED",
    createdAt: new Date(),
    insightLinkCount: 0,
    tagCount: tags.length,
    tagTypes,
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
      trustScore,
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    result.errors.push("OPENAI_API_KEY required");
    return result;
  }

  // ギャップ情報取得
  const gaps = await prisma.lintResult.findMany({
    where: { type: { in: ["gap", "topic_suggestion"] }, status: "open" },
    take: 10,
    select: { description: true },
  }).catch(() => []);

  const coverage = await prisma.observation.groupBy({
    by: ["modelLayer"],
    where: { provenance: "PUBLIC_CODIFIED" },
    _count: { id: true },
  }).catch(() => []);

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

  // バッチ分割: LLM1回で最大20件、複数回に分けて合計batchSizeを目指す
  const CHUNK_SIZE = 20;
  const chunks = Math.ceil(batchSize / CHUNK_SIZE);

  for (let chunk = 0; chunk < chunks && result.ingested < batchSize; chunk++) {
    const remaining = batchSize - result.ingested;
    const thisChunk = Math.min(CHUNK_SIZE, remaining);

    // チャンクごとにフォーカスするモデル層を回す
    const focusLayer = MODEL_LAYERS[chunk % MODEL_LAYERS.length];
    const focusIndustries = INDUSTRIES.slice((chunk * 2) % INDUSTRIES.length, ((chunk * 2) % INDUSTRIES.length) + 3);

    const prompt = `あなたは小売・サービス業の店舗行動観察に精通した研究者です。
以下の条件で、学術的に確立された公知の知見を${thisChunk}件生成してください。

## 今回のフォーカス
モデル層: ${focusLayer}を中心に（他も可）
業種: ${focusIndustries.join("、")}を中心に

## 現在のカバレッジ
${coverage.map((c) => `${c.modelLayer}: ${c._count.id}件`).join(", ") || "なし"}

## ギャップ
${gaps.map((g) => g.description).join("\n") || "特になし"}

## 全対象業種: ${INDUSTRIES.join("、")}

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
- 前のバッチで生成済みのテーマとは異なる内容を生成すること（バッチ${chunk + 1}/${chunks}）

必ずJSON形式のみで応答してください。`;

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.6,
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
      result.errors.push(`Fallback batch ${chunk + 1} error: ${err instanceof Error ? err.message : String(err)}`);
    }
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
