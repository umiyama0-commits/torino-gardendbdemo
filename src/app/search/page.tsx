"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MODEL_LAYER_CONFIG,
  VALUE_AXIS_CONFIG,
  PROVENANCE_CONFIG,
} from "@/lib/constants";

/* ── Types ── */
type TagRelation = {
  tag: { id: string; code: string; displayNameJa: string; type: string };
};
type ObsResult = {
  id: string;
  text: string;
  modelLayer: string;
  primaryValueAxis: string | null;
  provenance: string;
  tags: TagRelation[];
  store?: { client: { industry: string; industryDetail: string | null } } | null;
  project?: { client: { industry: string; industryDetail: string | null } } | null;
};
type InsightResult = {
  id: string;
  text: string;
  modelLayer: string | null;
  primaryValueAxis: string | null;
  provenance: string;
  tags: TagRelation[];
};
type SearchResult = {
  observations: ObsResult[];
  insights: InsightResult[];
  industries: string[];
};
type OntologyTag = {
  id: string;
  code: string;
  displayNameJa: string;
  type: string;
};

/* ── Filter toggle component ── */
function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string; color?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        <Badge
          variant={value === "" ? "default" : "outline"}
          className="cursor-pointer text-[11px] h-6"
          onClick={() => onChange("")}
        >
          すべて
        </Badge>
        {options.map((opt) => (
          <Badge
            key={opt.key}
            variant={value === opt.key ? "default" : "outline"}
            className={`cursor-pointer text-[11px] h-6 ${
              value === opt.key ? "" : opt.color || ""
            }`}
            onClick={() => onChange(value === opt.key ? "" : opt.key)}
          >
            {opt.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/* ── Main ── */
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("");
  const [modelLayer, setModelLayer] = useState("");
  const [valueAxis, setValueAxis] = useState("");
  const [provenance, setProvenance] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [trustOnly, setTrustOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [industries, setIndustries] = useState<string[]>([]);
  const [tags, setTags] = useState<OntologyTag[]>([]);

  // Load initial data
  useEffect(() => {
    fetch("/api/industries")
      .then((r) => r.json())
      .then((d) => setIndustries(d.industries || []));
    fetch("/api/tags")
      .then((r) => r.json())
      .then((d) => setTags(d || []));
  }, []);

  const activeFilterCount = [modelLayer, valueAxis, provenance, selectedTag, industry].filter(Boolean).length + (trustOnly ? 1 : 0);

  const handleSearch = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (industry) params.set("industry", industry);
    if (modelLayer) params.set("modelLayer", modelLayer);
    if (valueAxis) params.set("valueAxis", valueAxis);
    if (provenance) params.set("provenance", provenance);
    if (selectedTag) params.set("tag", selectedTag);

    // Need at least one filter
    if (params.toString() === "") return;

    setLoading(true);
    try {
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      setResults(data);
      if (data.industries?.length) {
        setIndustries((prev) => {
          const merged = new Set([...prev, ...data.industries]);
          return [...merged];
        });
      }
    } finally {
      setLoading(false);
    }
  }, [query, industry, modelLayer, valueAxis, provenance, selectedTag]);

  const clearFilters = () => {
    setQuery("");
    setIndustry("");
    setModelLayer("");
    setValueAxis("");
    setProvenance("");
    setSelectedTag("");
    setTrustOnly(false);
    setResults(null);
  };

  // Trust chain analysis
  const trustChainMatches = results ? findTrustChain(results.observations) : [];

  // Apply trust-only filter client-side
  const trustTagCodes = new Set(trustChainMatches.map((m) => m.tagCode));
  const filteredObs = trustOnly && results
    ? results.observations.filter((o) => o.tags.some((t) => trustTagCodes.has(t.tag.code)))
    : results?.observations || [];

  // Provenance breakdown
  const provenanceCounts = results
    ? {
        FIELD_OBSERVED: results.observations.filter((o) => o.provenance === "FIELD_OBSERVED").length,
        ANONYMIZED_DERIVED: results.observations.filter((o) => o.provenance === "ANONYMIZED_DERIVED").length,
        PUBLIC_CODIFIED: results.observations.filter((o) => o.provenance === "PUBLIC_CODIFIED").length,
      }
    : null;

  // Popular tags from results
  const tagFrequency = results
    ? (() => {
        const freq: Record<string, { tag: OntologyTag; count: number }> = {};
        for (const obs of results.observations) {
          for (const t of obs.tags) {
            if (!freq[t.tag.code]) freq[t.tag.code] = { tag: t.tag, count: 0 };
            freq[t.tag.code].count++;
          }
        }
        return Object.values(freq)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
      })()
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">検索</h1>
        <p className="text-zinc-500 mt-1 text-sm">
          モデル層・価値軸・プロベナンス・タグなど多軸で横断検索。信頼度チェーンで裏付けを確認。
        </p>
      </div>

      {/* Search bar */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            placeholder="キーワードで検索... (空欄でもフィルターのみで検索可)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="bg-white"
          />
          <Button onClick={handleSearch} disabled={loading} className="shrink-0 px-6">
            {loading ? "検索中..." : "検索"}
          </Button>
        </div>

        {/* Filter toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-xs text-zinc-500 hover:text-zinc-800 transition-colors flex items-center gap-1"
          >
            <span className="text-base">{showFilters ? "▾" : "▸"}</span>
            絞り込みフィルター
            {activeFilterCount > 0 && (
              <Badge className="bg-blue-600 text-white text-[10px] h-4 px-1.5 ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-[11px] text-red-500 hover:text-red-700 transition-colors"
            >
              フィルターをクリア
            </button>
          )}
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <FilterGroup
                label="モデル層"
                options={Object.entries(MODEL_LAYER_CONFIG).map(([k, v]) => ({
                  key: k,
                  label: v.label,
                }))}
                value={modelLayer}
                onChange={setModelLayer}
              />
              <FilterGroup
                label="価値軸"
                options={Object.entries(VALUE_AXIS_CONFIG).map(([k, v]) => ({
                  key: k,
                  label: v.label,
                }))}
                value={valueAxis}
                onChange={setValueAxis}
              />
              <FilterGroup
                label="プロベナンス"
                options={Object.entries(PROVENANCE_CONFIG).map(([k, v]) => ({
                  key: k,
                  label: v.shortLabel,
                }))}
                value={provenance}
                onChange={setProvenance}
              />
              <FilterGroup
                label="業種"
                options={industries.map((ind) => ({ key: ind, label: ind }))}
                value={industry}
                onChange={setIndustry}
              />
            </div>

            {/* Tag filter */}
            <div>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                タグで絞り込み
              </p>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                {selectedTag && (
                  <Badge
                    className="cursor-pointer text-[11px] h-6 bg-blue-600 text-white"
                    onClick={() => setSelectedTag("")}
                  >
                    {tags.find((t) => t.code === selectedTag)?.displayNameJa || selectedTag} ✕
                  </Badge>
                )}
                {!selectedTag &&
                  tags.slice(0, 40).map((tag) => (
                    <Badge
                      key={tag.code}
                      variant="outline"
                      className="cursor-pointer text-[11px] h-6 hover:bg-zinc-100"
                      onClick={() => setSelectedTag(tag.code)}
                    >
                      {tag.displayNameJa}
                    </Badge>
                  ))}
                {!selectedTag && tags.length > 40 && (
                  <span className="text-[10px] text-zinc-400 self-center ml-1">
                    他 {tags.length - 40}件...
                  </span>
                )}
              </div>
            </div>

            {/* Trust chain toggle */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setTrustOnly(!trustOnly)}
                className={`w-9 h-5 rounded-full transition-colors relative ${
                  trustOnly ? "bg-emerald-500" : "bg-zinc-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    trustOnly ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-xs text-zinc-600">
                多層裏付けのある知見のみ表示
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-5">
          {/* Result summary bar */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-zinc-700">
              {results.observations.length + results.insights.length}件の結果
            </span>
            {provenanceCounts && (
              <div className="flex gap-3">
                {Object.entries(PROVENANCE_CONFIG).map(([key, config]) => {
                  const count = provenanceCounts[key as keyof typeof provenanceCounts] || 0;
                  return (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                      <span className="text-[11px] text-zinc-500">{config.shortLabel}</span>
                      <span className="text-xs font-semibold tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {trustChainMatches.length > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px]">
                {trustChainMatches.length}件の多層裏付け
              </Badge>
            )}
          </div>

          {/* Trust Chain highlight */}
          {trustChainMatches.length > 0 && (
            <Card className="shadow-sm border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-emerald-700 uppercase tracking-wider">
                  多層裏付けあり — 高信頼知見
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {trustChainMatches.map((match) => (
                  <div
                    key={match.tagCode}
                    className="bg-white rounded-lg border border-emerald-100 p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px]">
                        {match.provenances.length}層裏付け
                      </Badge>
                      <span className="text-xs text-zinc-500">
                        テーマ: {match.tagName}
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {match.provenances.map((prov) => {
                        const cfg = PROVENANCE_CONFIG[prov.provenance];
                        return (
                          <div key={prov.provenance} className="flex gap-3 items-start">
                            <div className="flex items-center gap-1.5 w-20 shrink-0">
                              <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                              <span className="text-[11px] font-medium text-zinc-500">
                                {cfg.shortLabel}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-700">{prov.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Popular tags from results */}
          {tagFrequency.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
                関連タグ（結果内の出現頻度）
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tagFrequency.map(({ tag, count }) => (
                  <Badge
                    key={tag.code}
                    variant="outline"
                    className={`text-[11px] cursor-pointer hover:bg-zinc-100 ${
                      selectedTag === tag.code ? "bg-blue-50 border-blue-300" : ""
                    }`}
                    onClick={() => {
                      setSelectedTag(selectedTag === tag.code ? "" : tag.code);
                      setShowFilters(true);
                    }}
                  >
                    {tag.displayNameJa}
                    <span className="text-zinc-400 ml-1">{count}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Observations */}
          {filteredObs.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
                観測データ ({filteredObs.length}件)
              </h2>
              <div className="space-y-2">
                {filteredObs.map((obs) => (
                  <ObservationCard key={obs.id} obs={obs} />
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {results.insights.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
                洞察 ({results.insights.length}件)
              </h2>
              <div className="space-y-2">
                {results.insights.map((ins) => (
                  <InsightCard key={ins.id} ins={ins} />
                ))}
              </div>
            </div>
          )}

          {filteredObs.length === 0 && results.insights.length === 0 && (
            <p className="text-zinc-400 text-sm py-8 text-center">
              該当する結果がありません
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!results && !loading && (
        <Card className="shadow-sm bg-zinc-50/50">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-3xl">&#128270;</p>
            <p className="text-sm text-zinc-500">
              キーワードを入力するか、フィルターを設定して検索してください
            </p>
            <p className="text-xs text-zinc-400">
              フィルターのみの検索も可能です（例: 「動線」×「売上向上」で関連する観測を一覧）
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Result Cards ── */
function ObservationCard({ obs }: { obs: ObsResult }) {
  const layerConfig = MODEL_LAYER_CONFIG[obs.modelLayer];
  const valueConfig = obs.primaryValueAxis ? VALUE_AXIS_CONFIG[obs.primaryValueAxis] : null;
  const provConfig = PROVENANCE_CONFIG[obs.provenance];
  const clientIndustry =
    obs.store?.client?.industryDetail ||
    obs.store?.client?.industry ||
    obs.project?.client?.industryDetail ||
    obs.project?.client?.industry;

  return (
    <Card className="shadow-sm hover:shadow transition-shadow">
      <CardContent className="pt-4 pb-4">
        <p className="text-sm leading-relaxed mb-2.5">{obs.text}</p>
        <div className="flex flex-wrap gap-1.5">
          {provConfig && (
            <Badge className={`${provConfig.bg} ${provConfig.color} text-[11px] px-1.5 py-0`}>
              {provConfig.shortLabel}
            </Badge>
          )}
          {layerConfig && (
            <Badge className={`${layerConfig.bg} ${layerConfig.color} text-[11px] px-1.5 py-0`}>
              {layerConfig.label}
            </Badge>
          )}
          {valueConfig && (
            <Badge className={`${valueConfig.bg} ${valueConfig.color} text-[11px] px-1.5 py-0`}>
              {valueConfig.label}
            </Badge>
          )}
          {clientIndustry && (
            <Badge className="bg-violet-50 border border-violet-200 text-violet-700 text-[11px] px-1.5 py-0">
              {clientIndustry}
            </Badge>
          )}
          {obs.tags.map((t) => (
            <Badge
              key={t.tag.id}
              variant="outline"
              className={`text-[11px] px-1.5 py-0 ${
                t.tag.type === "THEORY"
                  ? "border-purple-200 text-purple-600 bg-purple-50"
                  : "border-zinc-200"
              }`}
            >
              {t.tag.displayNameJa}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function InsightCard({ ins }: { ins: InsightResult }) {
  const layerConfig = ins.modelLayer ? MODEL_LAYER_CONFIG[ins.modelLayer] : null;
  const valueConfig = ins.primaryValueAxis ? VALUE_AXIS_CONFIG[ins.primaryValueAxis] : null;

  return (
    <Card className="shadow-sm hover:shadow transition-shadow border-l-4 border-l-cyan-400">
      <CardContent className="pt-4 pb-4">
        <p className="text-sm leading-relaxed mb-2.5">{ins.text}</p>
        <div className="flex flex-wrap gap-1.5">
          {layerConfig && (
            <Badge className={`${layerConfig.bg} ${layerConfig.color} text-[11px] px-1.5 py-0`}>
              {layerConfig.label}
            </Badge>
          )}
          {valueConfig && (
            <Badge className={`${valueConfig.bg} ${valueConfig.color} text-[11px] px-1.5 py-0`}>
              {valueConfig.label}
            </Badge>
          )}
          {ins.tags.map((t) => (
            <Badge
              key={t.tag.id}
              variant="outline"
              className={`text-[11px] px-1.5 py-0 ${
                t.tag.type === "THEORY"
                  ? "border-purple-200 text-purple-600 bg-purple-50"
                  : "border-zinc-200"
              }`}
            >
              {t.tag.displayNameJa}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Trust Chain Logic ── */
function findTrustChain(observations: ObsResult[]) {
  const tagGroups: Record<
    string,
    { tagName: string; tagCode: string; entries: { provenance: string; text: string }[] }
  > = {};

  for (const obs of observations) {
    for (const t of obs.tags) {
      if (!tagGroups[t.tag.code]) {
        tagGroups[t.tag.code] = { tagName: t.tag.displayNameJa, tagCode: t.tag.code, entries: [] };
      }
      const existing = tagGroups[t.tag.code].entries.find((e) => e.provenance === obs.provenance);
      if (!existing) {
        tagGroups[t.tag.code].entries.push({ provenance: obs.provenance, text: obs.text });
      }
    }
  }

  return Object.values(tagGroups)
    .filter((g) => g.entries.length >= 2)
    .map((g) => ({
      tagCode: g.tagCode,
      tagName: g.tagName,
      provenances: g.entries.sort((a, b) => {
        const order = ["FIELD_OBSERVED", "ANONYMIZED_DERIVED", "PUBLIC_CODIFIED"];
        return order.indexOf(a.provenance) - order.indexOf(b.provenance);
      }),
    }))
    .sort((a, b) => b.provenances.length - a.provenances.length);
}
