"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MODEL_LAYER_CONFIG, VALUE_AXIS_CONFIG, PROVENANCE_CONFIG, THEORY_TAG_COLOR } from "@/lib/constants";
import { TrustBadge, ImpactBadge } from "@/components/trust-badge";

type Tag = { id: string; type: string; code: string; displayNameJa: string; displayNameEn: string | null; modelLayer: string | null };
type Result = {
  id: string; text: string; textEn: string | null;
  modelLayer: string | null; primaryValueAxis: string | null; provenance: string;
  trustScore: number; estimatedImpactMin: number | null; estimatedImpactMax: number | null;
  impactKPI: string | null; projectId: string | null;
  observedAt: string | null; createdAt: string;
  tags: { tag: Tag }[];
  store?: { name: string; client: { name: string; industryMajor: string; industryMinor: string | null; industryMajorEn: string | null; industryMinorEn: string | null } } | null;
  project?: { id: string; name: string } | null;
};
type Pattern = {
  id: string; name: string; nameEn: string | null; description: string; descriptionEn: string | null;
  industries: string; modelLayer: string | null; primaryValueAxis: string | null;
  estimatedImpactMin: number | null; estimatedImpactMax: number | null; impactKPI: string | null;
  trustScore: number; insightCount: number;
};

const INDUSTRY_TAXONOMY = [
  { major: "小売", majorEn: "Retail", minors: ["眼鏡", "アパレル", "食品", "ドラッグストア", "家電", "雑貨"] },
  { major: "飲食", majorEn: "Food & Beverage", minors: ["カジュアルダイニング", "ファストフード", "カフェ", "居酒屋", "ベーカリー"] },
  { major: "サービス", majorEn: "Service", minors: ["美容", "フィットネス", "ホテル", "クリニック", "教育", "保険"] },
  { major: "建設", majorEn: "Construction", minors: ["住宅", "商業施設", "リフォーム", "不動産仲介"] },
  { major: "スポーツ", majorEn: "Sports", minors: ["フィットネスジム", "スポーツ用品", "スタジアム", "スクール"] },
];

const SORT_OPTIONS = [
  { key: "impact", label: "期待効果順", en: "By Impact" },
  { key: "trust", label: "信頼度順", en: "By Trust" },
  { key: "date", label: "新着順", en: "By Date" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("");
  const [industryMinor, setIndustryMinor] = useState("");
  const [layerFilter, setLayerFilter] = useState("");
  const [axisFilter, setAxisFilter] = useState("");
  const [sortBy, setSortBy] = useState("impact");
  const [observations, setObservations] = useState<Result[]>([]);
  const [insights, setInsights] = useState<Result[]>([]);
  const [recommendations, setRecommendations] = useState<Pattern[]>([]);
  const [industryHighImpact, setIndustryHighImpact] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const doSearch = async (overrides?: { industry?: string; industryMinor?: string; layer?: string; axis?: string; sort?: string }) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const ind = overrides?.industry ?? industry;
    const indMinor = overrides?.industryMinor ?? industryMinor;
    const lay = overrides?.layer ?? layerFilter;
    const ax = overrides?.axis ?? axisFilter;
    const srt = overrides?.sort ?? sortBy;
    if (ind) params.set("industry", ind);
    if (indMinor) params.set("industryMinor", indMinor);
    if (lay) params.set("layer", lay);
    if (ax) params.set("axis", ax);
    params.set("sort", srt);

    const res = await fetch(`/api/search?${params}`);
    const data = await res.json();
    setObservations(data.observations);
    setInsights(data.insights);
    setRecommendations(data.recommendations || []);
    setIndustryHighImpact(data.industryHighImpact || []);
    setSearched(true);
    setLoading(false);
  };

  // Auto-search when industry changes
  const handleIndustryClick = (ind: string) => {
    const newInd = industry === ind ? "" : ind;
    setIndustry(newInd);
    setIndustryMinor("");
    doSearch({ industry: newInd, industryMinor: "" });
  };

  const handleMinorClick = (minor: string) => {
    const newMinor = industryMinor === minor ? "" : minor;
    setIndustryMinor(newMinor);
    doSearch({ industryMinor: newMinor });
  };

  const handleLayerClick = (l: string) => {
    const newL = layerFilter === l ? "" : l;
    setLayerFilter(newL);
    doSearch({ layer: newL });
  };

  const handleAxisClick = (a: string) => {
    const newA = axisFilter === a ? "" : a;
    setAxisFilter(newA);
    doSearch({ axis: newA });
  };

  const handleSortClick = (s: string) => {
    setSortBy(s);
    doSearch({ sort: s });
  };

  const handleExportCSV = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (industry) params.set("industry", industry);
    if (industryMinor) params.set("industryMinor", industryMinor);
    if (layerFilter) params.set("layer", layerFilter);
    if (axisFilter) params.set("axis", axisFilter);
    const qs = params.toString();
    window.open(`/api/observations/export${qs ? `?${qs}` : ""}`, "_blank");
  }, [query, industry, industryMinor, layerFilter, axisFilter]);

  const provCounts = {
    FIELD_OBSERVED: observations.filter((o) => o.provenance === "FIELD_OBSERVED").length,
    ANONYMIZED_DERIVED: observations.filter((o) => o.provenance === "ANONYMIZED_DERIVED").length,
    PUBLIC_CODIFIED: observations.filter((o) => o.provenance === "PUBLIC_CODIFIED").length,
  };
  const totalResults = observations.length + insights.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Knowledge Search</h1>
        <p className="text-sm text-zinc-600 mt-1 font-medium">ナレッジ検索 &mdash; Find high-impact insights for your industry</p>
      </div>

      {/* Search bar */}
      <Card className="border border-zinc-200 shadow-md">
        <CardContent className="pt-5 pb-5 space-y-5">
          <div className="flex gap-3">
            <Input placeholder="キーワードを入力 / Enter keywords..."
              value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              className="text-base h-12 bg-zinc-50 border-zinc-200" />
            <button onClick={() => doSearch()} disabled={loading}
              className="h-12 px-6 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 shrink-0">
              {loading ? "検索中..." : "検索 / Search"}
            </button>
          </div>

          {/* Industry selector - 大分類 */}
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
              大分類 / Industry Major
            </label>
            <div className="flex flex-wrap gap-2">
              {INDUSTRY_TAXONOMY.map((cat) => (
                <button key={cat.major} type="button" onClick={() => handleIndustryClick(cat.major)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 border ${
                    industry === cat.major
                      ? "bg-zinc-900 text-white border-transparent shadow-sm"
                      : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400 hover:shadow-sm"
                  }`}>
                  <span>{cat.major}</span>
                  <span className="text-[10px] ml-1.5 opacity-60">{cat.majorEn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Industry minor - 中分類 */}
          {industry && (
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                中分類 / Industry Minor
              </label>
              <div className="flex flex-wrap gap-1.5">
                {INDUSTRY_TAXONOMY.find((c) => c.major === industry)?.minors.map((minor) => (
                  <button key={minor} type="button" onClick={() => handleMinorClick(minor)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 border ${
                      industryMinor === minor
                        ? "bg-zinc-700 text-white border-transparent"
                        : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:border-zinc-300"
                    }`}>
                    {minor}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick filters row */}
          <div className="flex flex-wrap gap-6">
            {/* Layer filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Layer / 4層</label>
              <div className="flex gap-1">
                {Object.entries(MODEL_LAYER_CONFIG).map(([key, cfg]) => (
                  <button key={key} type="button" onClick={() => handleLayerClick(key)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ${
                      layerFilter === key ? "text-white shadow-sm" : "bg-white text-zinc-600 border border-zinc-300 hover:border-zinc-400 hover:shadow-sm"
                    }`}
                    style={layerFilter === key ? { backgroundColor: cfg.color } : {}}>
                    {cfg.labelJa}
                  </button>
                ))}
              </div>
            </div>
            {/* Axis filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Value / KPI</label>
              <div className="flex gap-1">
                {Object.entries(VALUE_AXIS_CONFIG).map(([key, cfg]) => (
                  <button key={key} type="button" onClick={() => handleAxisClick(key)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ${
                      axisFilter === key ? "text-white shadow-sm" : "bg-white text-zinc-600 border border-zinc-300 hover:border-zinc-400 hover:shadow-sm"
                    }`}
                    style={axisFilter === key ? { backgroundColor: cfg.color } : {}}>
                    {cfg.labelJa}
                  </button>
                ))}
              </div>
            </div>
            {/* Sort */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Sort / 並び順</label>
              <div className="flex gap-1">
                {SORT_OPTIONS.map((opt) => (
                  <button key={opt.key} type="button" onClick={() => handleSortClick(opt.key)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ${
                      sortBy === opt.key ? "bg-zinc-900 text-white shadow-sm" : "bg-white text-zinc-600 border border-zinc-300 hover:border-zinc-400 hover:shadow-sm"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Industry recommendation section */}
      {industry && recommendations.length > 0 && (
        <Card className="border border-zinc-200 shadow-md bg-gradient-to-r from-blue-50 to-cyan-50 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              <span className="text-blue-600">✦</span> {industry}業界のおすすめパターン
              <span className="text-zinc-400 font-normal text-xs ml-2">/ Recommended patterns for {INDUSTRY_TAXONOMY.find((i) => i.major === industry)?.majorEn}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((p) => {
              const layerCfg = p.modelLayer ? MODEL_LAYER_CONFIG[p.modelLayer as keyof typeof MODEL_LAYER_CONFIG] : null;
              return (
                <div key={p.id} className="rounded-lg bg-white/80 backdrop-blur border border-blue-100 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{p.name}</span>
                        {p.nameEn && <span className="text-xs text-zinc-400">{p.nameEn}</span>}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{p.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <ImpactBadge min={p.estimatedImpactMin} max={p.estimatedImpactMax} kpi={p.impactKPI} />
                      <TrustBadge score={p.trustScore} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {layerCfg && <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: layerCfg.color }}>{layerCfg.label}</Badge>}
                    <span className="text-[10px] text-zinc-400">{p.insightCount}件の裏付け</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* High-impact for industry */}
      {industry && industryHighImpact.length > 0 && (
        <Card className="border border-zinc-200 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              High-Impact Cases <span className="text-zinc-300">/</span> {industry}向け期待効果の高い事象
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {industryHighImpact.map((obs) => (
              <ResultCard key={obs.id} item={obs} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Search results */}
      {searched && (
        <>
          {/* Summary bar */}
          <div className="flex items-center justify-between rounded-xl bg-white shadow-sm p-4">
            <div className="flex items-center gap-6">
              <div className="text-sm font-medium">{totalResults}件</div>
              <div className="h-4 w-px bg-zinc-200" />
              {Object.entries(PROVENANCE_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2">
                  <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: cfg.color }}>{cfg.labelJa}</Badge>
                  <span className="text-xs tabular-nums font-medium">{provCounts[key as keyof typeof provCounts]}</span>
                </div>
              ))}
            </div>
            {totalResults > 0 && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="rounded-md px-3 py-1.5 text-[11px] font-medium bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all duration-150 flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                CSV Export
              </button>
            )}
          </div>

          {observations.length > 0 && (
            <Card className="border border-zinc-200 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">
                  Observations <span className="text-zinc-300">/</span> 観測事実 ({observations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {observations.map((obs) => <ResultCard key={obs.id} item={obs} />)}
              </CardContent>
            </Card>
          )}

          {insights.length > 0 && (
            <Card className="border border-zinc-200 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">
                  Insights <span className="text-zinc-300">/</span> インサイト ({insights.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.map((ins) => <ResultCard key={ins.id} item={ins} />)}
              </CardContent>
            </Card>
          )}

          {totalResults === 0 && (
            <div className="text-center py-16 text-zinc-400">
              <div className="text-4xl mb-3">⌕</div>
              <p className="text-sm">該当する結果がありません / No results found</p>
              <p className="text-xs mt-1">キーワードや業種を変えて検索してみてください</p>
            </div>
          )}
        </>
      )}

      {/* Initial state - quick start guide */}
      {!searched && !industry && (
        <Card className="border border-zinc-200 shadow-md">
          <CardContent className="py-16 text-center space-y-4">
            <div className="text-5xl">⌕</div>
            <div className="space-y-1">
              <p className="text-base font-medium text-zinc-700">業種を選んで期待効果の高いナレッジを発見</p>
              <p className="text-sm text-zinc-400">Select an industry above to discover high-impact insights, or enter keywords to search</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <span className="text-[10px] text-zinc-400 mr-1 pt-1">例:</span>
              {["声掛け", "試着", "動線", "離職", "待ち時間"].map((w) => (
                <button key={w} type="button" onClick={() => { setQuery(w); }}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200 transition-colors">
                  {w}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResultCard({ item }: { item: Result }) {
  const layerCfg = item.modelLayer ? MODEL_LAYER_CONFIG[item.modelLayer as keyof typeof MODEL_LAYER_CONFIG] : null;
  const axisCfg = item.primaryValueAxis ? VALUE_AXIS_CONFIG[item.primaryValueAxis as keyof typeof VALUE_AXIS_CONFIG] : null;
  const provCfg = PROVENANCE_CONFIG[item.provenance as keyof typeof PROVENANCE_CONFIG];

  return (
    <div className="rounded-lg border p-4 space-y-2 hover:bg-zinc-50 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1">
          <p className="text-sm font-medium leading-relaxed">{item.text}</p>
          {item.textEn && <p className="text-xs text-zinc-400 leading-relaxed">{item.textEn}</p>}
          <div className="flex items-center gap-2 flex-wrap">
            {item.provenance === "FIELD_OBSERVED" && item.project && (
              <span className="text-[10px] font-mono bg-zinc-900 text-white px-1.5 py-0.5 rounded">
                PJ:{item.project.name || item.project.id.slice(0, 8)}
              </span>
            )}
            {item.store && (
              <span className="text-[10px] text-zinc-400">
                {item.store.client.name}
                <span className="mx-1 text-zinc-200">|</span>
                {item.store.client.industryMajor}{item.store.client.industryMinor ? ` › ${item.store.client.industryMinor}` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <ImpactBadge min={item.estimatedImpactMin} max={item.estimatedImpactMax} kpi={item.impactKPI} />
          <TrustBadge score={item.trustScore} />
          {item.observedAt && (
            <span className="text-[10px] font-medium text-zinc-500">
              <span className="text-[9px] text-zinc-400 mr-0.5">観測</span>
              {new Date(item.observedAt).toLocaleDateString("ja-JP")}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {layerCfg && <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: layerCfg.color }}>{layerCfg.label}</Badge>}
        {axisCfg && <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: axisCfg.color }}>{axisCfg.labelJa}</Badge>}
        {provCfg && <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: provCfg.color }}>{provCfg.labelJa}</Badge>}
        {item.tags.map(({ tag }) => (
          <Badge key={tag.id} variant="outline" className="text-[9px] px-1.5 py-0"
            style={tag.type === "THEORY" ? { borderColor: THEORY_TAG_COLOR, color: THEORY_TAG_COLOR } : {}}>
            {tag.displayNameJa}
          </Badge>
        ))}
      </div>
    </div>
  );
}
