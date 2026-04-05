import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { VALUE_AXIS_CONFIG, MODEL_LAYER_CONFIG, PROVENANCE_CONFIG } from "@/lib/constants";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "markdown";
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  // 1. Fetch all ontology tags from DB
  const tags = await prisma.ontologyTag.findMany({
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });

  // 2. Group tags by type
  const tagsByType: Record<string, { code: string; displayNameJa: string; displayNameEn: string | null; modelLayer: string | null }[]> = {};
  for (const tag of tags) {
    if (!tagsByType[tag.type]) tagsByType[tag.type] = [];
    tagsByType[tag.type].push({
      code: tag.code,
      displayNameJa: tag.displayNameJa,
      displayNameEn: tag.displayNameEn,
      modelLayer: tag.modelLayer,
    });
  }

  // 3. Get current stats
  const [totalObservations, totalInsights, totalPatterns] = await Promise.all([
    prisma.observation.count(),
    prisma.insight.count(),
    prisma.crossIndustryPattern.count(),
  ]);

  // 4. Get existing industries
  const clients = await prisma.client.findMany({
    select: { industryMajor: true, industryMajorEn: true, industryMinor: true },
    distinct: ["industryMajor"],
  });

  // 5. Build the value axes description
  const valueAxes = Object.entries(VALUE_AXIS_CONFIG).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    labelJa: cfg.labelJa,
  }));

  // 6. Build model layers description
  const modelLayers = Object.entries(MODEL_LAYER_CONFIG).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    labelJa: cfg.labelJa,
  }));

  // 7. Build provenance types
  const provenanceTypes = Object.entries(PROVENANCE_CONFIG).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    labelJa: cfg.labelJa,
  }));

  // 8. Get value axis distribution
  const observations = await prisma.observation.findMany({
    select: { modelLayer: true, primaryValueAxis: true, provenance: true },
  });

  const layerCounts: Record<string, number> = {};
  const axisCounts: Record<string, number> = {};
  for (const obs of observations) {
    layerCounts[obs.modelLayer] = (layerCounts[obs.modelLayer] || 0) + 1;
    if (obs.primaryValueAxis) {
      axisCounts[obs.primaryValueAxis] = (axisCounts[obs.primaryValueAxis] || 0) + 1;
    }
  }

  // Find weak areas
  const weakLayers = modelLayers
    .filter(l => (layerCounts[l.key] || 0) < totalObservations * 0.15)
    .map(l => `${l.labelJa}(${l.label})`);
  const weakAxes = valueAxes
    .filter(a => (axisCounts[a.key] || 0) < totalObservations * 0.1)
    .map(a => `${a.labelJa}(${a.label})`);

  if (format === "json") {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      date,
      schema: {
        valueAxes,
        modelLayers,
        provenanceTypes,
        tags: tagsByType,
      },
      stats: {
        totalObservations,
        totalInsights,
        totalPatterns,
        layerCounts,
        axisCounts,
        weakLayers,
        weakAxes,
      },
      industries: clients.map(c => ({
        major: c.industryMajor,
        majorEn: c.industryMajorEn,
        minor: c.industryMinor,
      })),
    });
  }

  // Generate Markdown prompt
  const prompt = generateScanPrompt({
    date,
    valueAxes,
    modelLayers,
    provenanceTypes,
    tagsByType,
    totalObservations,
    totalInsights,
    totalPatterns,
    layerCounts,
    axisCounts,
    weakLayers,
    weakAxes,
    industries: clients,
  });

  return new NextResponse(prompt, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

function generateScanPrompt(ctx: {
  date: string;
  valueAxes: { key: string; label: string; labelJa: string }[];
  modelLayers: { key: string; label: string; labelJa: string }[];
  provenanceTypes: { key: string; label: string; labelJa: string }[];
  tagsByType: Record<string, { code: string; displayNameJa: string; displayNameEn: string | null; modelLayer: string | null }[]>;
  totalObservations: number;
  totalInsights: number;
  totalPatterns: number;
  layerCounts: Record<string, number>;
  axisCounts: Record<string, number>;
  weakLayers: string[];
  weakAxes: string[];
  industries: { industryMajor: string; industryMajorEn: string | null; industryMinor: string | null }[];
}) {
  const behaviorTags = ctx.tagsByType["BEHAVIOR"] || [];
  const contextTags = ctx.tagsByType["CONTEXT"] || [];
  const spaceTags = ctx.tagsByType["SPACE"] || [];
  const theoryTags = ctx.tagsByType["THEORY"] || [];

  const layerStats = ctx.modelLayers
    .map(l => `  - ${l.labelJa}(${l.label}): ${ctx.layerCounts[l.key] || 0}件`)
    .join("\n");

  const axisStats = ctx.valueAxes
    .map(a => `  - ${a.labelJa}(${a.label}): ${ctx.axisCounts[a.key] || 0}件`)
    .join("\n");

  const weakAreaNote = [
    ...(ctx.weakLayers.length > 0 ? [`  - 層の偏り: ${ctx.weakLayers.join("、")} が少ない`] : []),
    ...(ctx.weakAxes.length > 0 ? [`  - 価値軸の偏り: ${ctx.weakAxes.join("、")} が少ない`] : []),
  ].join("\n") || "  - 特になし";

  return `# ${ctx.date} – Daily Tacit Knowledge Ontology Scan
## Torino Garden Main DB – 公知スキャンプロンプト（自動生成）

> このプロンプトは Torino Garden Main DB のオントロジー構成から自動生成されています。
> DB構成が変更されると、このプロンプトも自動的に更新されます。
> エンドポイント: \`/api/prompt-template?date=${ctx.date}\`

---

## 現在のDB状況
- 観測事実: ${ctx.totalObservations}件
- インサイト: ${ctx.totalInsights}件
- 業種横断パターン: ${ctx.totalPatterns}件

### 層別分布
${layerStats}

### 価値軸分布
${axisStats}

### 注力すべき弱い領域
${weakAreaNote}

---

## オントロジー定義

### ${ctx.modelLayers.length}層モデル (model_layer)
各事例は必ず以下のいずれかに分類する:
${ctx.modelLayers.map(l => `- **${l.key}** (${l.labelJa}): ${l.label}`).join("\n")}

### ${ctx.valueAxes.length}価値軸 (value_axis)
各事例の期待効果を以下のいずれかに分類する:
${ctx.valueAxes.map(a => `- **${a.key}** (${a.labelJa}): ${a.label}`).join("\n")}

### 出自区分 (provenance)
今回のスキャンでは以下を使用:
${ctx.provenanceTypes.map(p => `- **${p.key}** (${p.labelJa}): ${p.label}`).join("\n")}

---

## 利用可能なタグ一覧

### behavior_tags (${behaviorTags.length}種)
${behaviorTags.map(t => `\`${t.code}\` (${t.displayNameJa})`).join(" / ")}

### context_tags (${contextTags.length}種)
${contextTags.map(t => `\`${t.code}\` (${t.displayNameJa})`).join(" / ")}

### space_tags (${spaceTags.length}種)
${spaceTags.map(t => `\`${t.code}\` (${t.displayNameJa})`).join(" / ")}

### theory_tags (${theoryTags.length}種)
${theoryTags.map(t => `\`${t.code}\` (${t.displayNameJa})`).join(" / ")}

---

## スキャン指示

### 目的
小売・飲食・サービス業の現場における「暗黙知の形式知化」事例を収集し、Torino Gardenのオントロジーに沿って分類する。

### 収集基準
1. **現場レベル**の具体的な行動・プロセスが記述されている事例
2. 暗黙知（ベテランの勘・コツ）が形式知（マニュアル・システム・データ）に変換された事例
3. 成果（売上・コスト・定着率・顧客満足度等）が定量的または定性的に示されている事例

### 各事例の出力フォーマット
\`\`\`
### N. [施設名/企業名]：[事例タイトル]
- **業種**: [具体的業種]
- **国・地域**: [国名]
- **ソース**: [URL]
- **年代**: [年]
- **カテゴリ**: [顧客行動 / 店舗オペレーション / ナレッジ移転 / 空間設計]

**分類タグ:**
- **model_layer**: ${ctx.modelLayers.map(l => l.key).join(" / ")} から選択
- **value_axis**: ${ctx.valueAxes.map(a => a.key).join(" / ")} から選択
- **behavior_tags**: 上記リストから該当するものを選択
- **context_tags**: 上記リストから該当するものを選択
- **space_tags**: 上記リストから該当するものを選択
- **theory_tags**: 上記リストから該当するものを選択

**事例の内容:**
- **何が暗黙知だったか**: [記述]
- **どう形式知化されたか**: [記述]
- **成果**: [定量的な成果]
- **Torino Gardenへの示唆**: [オントロジーとの関連]
- **similarity_hint**: [類似事例検索用キーワード]
\`\`\`

### 収集ターゲット（優先度順）
1. ${ctx.weakLayers.length > 0 ? `**${ctx.weakLayers.join("・")}** の事例を重点的に（現在少ない層）` : "各層バランスよく収集"}
2. ${ctx.weakAxes.length > 0 ? `**${ctx.weakAxes.join("・")}** 軸の事例を重点的に（現在少ない軸）` : "各価値軸バランスよく収集"}
3. 未カバーの業種（テーマパーク、ドラッグストア、コールセンター等）
4. 海外事例（シンガポール、オーストラリア、香港等）

### 検索キーワード例（日本語）
- 接客 トップ販売員 行動分析 標準化 事例
- 飲食店 ホール オペレーション 改善事例 暗黙知 形式知
- 小売 顧客動線 分析 購買率 改善 事例
- 熟練スタッフ 技 見える化 事例
- 離職率 低下 施策 オンボーディング
- 顧客満足度 向上 接客品質 標準化

### 検索キーワード例（英語）
- retail "top performer" behavior analysis standardization case study
- restaurant service excellence tacit knowledge codification
- hotel housekeeping standardization quality improvement
- "mystery shopping" insights formalization retail
- customer satisfaction improvement service design case study

---

## 目標
- 収集件数: 10〜20件
- 全${ctx.modelLayers.length}層をカバー
- 全${ctx.valueAxes.length}価値軸をカバー
- theory_tagsの紐付け率: 60%以上
`;
}
