"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MODEL_LAYER_CONFIG, VALUE_AXIS_CONFIG, PROVENANCE_CONFIG, THEORY_TAG_COLOR } from "@/lib/constants";
import { TrustBadge, ImpactBadge } from "@/components/trust-badge";
import { BookmarkButton } from "@/components/bookmark-button";

type Observation = {
  id: string; text: string; textEn: string | null;
  modelLayer: string; primaryValueAxis: string | null; provenance: string;
  confidence: string; trustScore: number;
  estimatedImpactMin: number | null; estimatedImpactMax: number | null;
  impactKPI: string | null;
  observedAt: string | Date | null;
  createdAt: string | Date;
  store: { name: string; client: { name: string; industryMajor: string; industryMajorEn: string | null; industryMinor: string | null } } | null;
  project: { id: string; name: string } | null;
  tags: { tag: { id: string; type: string; code: string; displayNameJa: string; displayNameEn: string | null; modelLayer: string | null } }[];
};

type IndustryMap = Record<string, { en: string; minors: Record<string, string> }>;

export function ObservationsList({
  observations,
  industryMap,
  bookmarkedIds,
  userRole,
}: {
  observations: Observation[];
  industryMap: IndustryMap;
  bookmarkedIds: string[];
  userRole: string;
}) {
  const [filterProv, setFilterProv] = useState("ALL");
  const [filterLayer, setFilterLayer] = useState("ALL");
  const [filterAxis, setFilterAxis] = useState("ALL");
  const [filterIndustry, setFilterIndustry] = useState("ALL");
  const [filterTrust, setFilterTrust] = useState("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterBookmarked, setFilterBookmarked] = useState(false);

  const bookmarkedSet = new Set(bookmarkedIds);

  const filtered = observations.filter((obs) => {
    if (filterProv !== "ALL" && obs.provenance !== filterProv) return false;
    if (filterLayer !== "ALL" && obs.modelLayer !== filterLayer) return false;
    if (filterAxis !== "ALL" && obs.primaryValueAxis !== filterAxis) return false;
    if (filterTrust !== "ALL" && obs.trustScore !== parseInt(filterTrust)) return false;
    if (filterIndustry !== "ALL" && obs.store?.client.industryMajor !== filterIndustry) return false;
    if (filterDateFrom) {
      const obsDate = obs.observedAt || obs.createdAt;
      if (new Date(obsDate) < new Date(filterDateFrom)) return false;
    }
    if (filterDateTo) {
      const obsDate = obs.observedAt || obs.createdAt;
      if (new Date(obsDate) > new Date(filterDateTo + "T23:59:59")) return false;
    }
    if (filterBookmarked && !bookmarkedSet.has(obs.id)) return false;
    return true;
  });

  const handleExportCSV = useCallback(() => {
    const params = new URLSearchParams();
    if (filterLayer !== "ALL") params.set("layer", filterLayer);
    if (filterAxis !== "ALL") params.set("axis", filterAxis);
    if (filterProv !== "ALL") params.set("provenance", filterProv);
    if (filterIndustry !== "ALL") params.set("industry", filterIndustry);
    if (filterTrust !== "ALL") params.set("trust", filterTrust);
    if (filterBookmarked) params.set("bookmarked", "true");
    const qs = params.toString();
    window.open(`/api/observations/export${qs ? `?${qs}` : ""}`, "_blank");
  }, [filterLayer, filterAxis, filterProv, filterIndustry, filterTrust, filterBookmarked]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border border-zinc-200 shadow-md">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-6">
            <FilterGroup label="Provenance / 出自"
              options={[{ key: "ALL", label: "All" }, ...Object.entries(PROVENANCE_CONFIG).map(([k, v]) => ({ key: k, label: v.labelJa }))]}
              value={filterProv} onChange={setFilterProv} />
            <FilterGroup label="Layer / 4層"
              options={[{ key: "ALL", label: "All" }, ...Object.entries(MODEL_LAYER_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))]}
              value={filterLayer} onChange={setFilterLayer} />
            <FilterGroup label="Value / 価値軸"
              options={[{ key: "ALL", label: "All" }, ...Object.entries(VALUE_AXIS_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))]}
              value={filterAxis} onChange={setFilterAxis} />
            <FilterGroup label="Industry / 業種"
              options={[{ key: "ALL", label: "All" }, ...Object.keys(industryMap).map((k) => ({ key: k, label: `${k} / ${industryMap[k].en}` }))]}
              value={filterIndustry} onChange={setFilterIndustry} />
            <FilterGroup label="Trust / 信頼度"
              options={[{ key: "ALL", label: "All" }, { key: "3", label: "◈ 3層" }, { key: "2", label: "◉ 2層" }, { key: "1", label: "○ 単独" }]}
              value={filterTrust} onChange={setFilterTrust} />
            <div className="space-y-1.5">
              <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Date / 観測日</div>
              <div className="flex items-center gap-1.5">
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] bg-white text-zinc-700 font-medium focus:outline-none focus:ring-1 focus:ring-zinc-500" />
                <span className="text-zinc-400 text-xs font-bold">〜</span>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] bg-white text-zinc-700 font-medium focus:outline-none focus:ring-1 focus:ring-zinc-500" />
                {(filterDateFrom || filterDateTo) && (
                  <button type="button" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                    className="rounded-md px-1.5 py-1 text-[10px] text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all">
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">{filtered.length}件 / {observations.length}件中</span>
          <button
            type="button"
            onClick={() => setFilterBookmarked((v) => !v)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150 flex items-center gap-1 ${
              filterBookmarked
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-300"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3">
              <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clipRule="evenodd" />
            </svg>
            Bookmarked Only / ブックマークのみ
          </button>
        </div>
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
      </div>

      {/* Observation Cards */}
      <div className="space-y-3">
        {filtered.map((obs) => {
          const layerCfg = MODEL_LAYER_CONFIG[obs.modelLayer as keyof typeof MODEL_LAYER_CONFIG];
          const axisCfg = obs.primaryValueAxis ? VALUE_AXIS_CONFIG[obs.primaryValueAxis as keyof typeof VALUE_AXIS_CONFIG] : null;
          const provCfg = PROVENANCE_CONFIG[obs.provenance as keyof typeof PROVENANCE_CONFIG];
          return (
            <Card key={obs.id} className="border border-zinc-200 shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
              <div className="h-1" style={{ backgroundColor: layerCfg?.color || "#e4e4e7" }} />
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <Link href={`/observations/${obs.id}`} className="block group">
                      <p className="text-sm font-medium leading-relaxed group-hover:text-blue-600 transition-colors">{obs.text}</p>
                      {obs.textEn && <p className="text-xs text-zinc-500 leading-relaxed">{obs.textEn}</p>}
                    </Link>
                    <div className="flex items-center gap-2 flex-wrap">
                      {obs.provenance === "FIELD_OBSERVED" && obs.project && (
                        <span className="text-[10px] font-mono bg-zinc-900 text-white px-1.5 py-0.5 rounded">
                          PJ:{obs.project.name || obs.project.id.slice(0, 8)}
                        </span>
                      )}
                      {obs.store && (
                        <span className="text-[11px] text-zinc-500">
                          {obs.store.client.name} / {obs.store.name}
                          <span className="mx-1 text-zinc-400">|</span>
                          {obs.store.client.industryMajor}{obs.store.client.industryMinor ? ` › ${obs.store.client.industryMinor}` : ""}
                        </span>
                      )}
                    </div>
                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {layerCfg && <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: layerCfg.color }}>{layerCfg.label}</Badge>}
                      {axisCfg && <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: axisCfg.color }}>{axisCfg.labelJa}</Badge>}
                      {provCfg && <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: provCfg.color }}>{provCfg.labelJa}</Badge>}
                      <TrustBadge score={obs.trustScore} />
                      {obs.tags.map(({ tag }) => (
                        <Badge key={tag.id} variant="outline" className="text-[9px] px-1.5 py-0"
                          style={tag.type === "THEORY" ? { borderColor: THEORY_TAG_COLOR, color: THEORY_TAG_COLOR }
                            : tag.type === "BEHAVIOR" && tag.modelLayer
                            ? { borderColor: MODEL_LAYER_CONFIG[tag.modelLayer as keyof typeof MODEL_LAYER_CONFIG]?.color, color: MODEL_LAYER_CONFIG[tag.modelLayer as keyof typeof MODEL_LAYER_CONFIG]?.color }
                            : {}}>
                          {tag.displayNameJa}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <BookmarkButton observationId={obs.id} initialBookmarked={bookmarkedSet.has(obs.id)} />
                    <ImpactBadge min={obs.estimatedImpactMin} max={obs.estimatedImpactMax} kpi={obs.impactKPI} />
                    <div className="text-right space-y-0.5">
                      {obs.observedAt && (
                        <div className="text-[11px] font-medium text-zinc-600">
                          <span className="text-[9px] text-zinc-400 mr-1">観測</span>
                          {new Date(obs.observedAt).toLocaleDateString("ja-JP")}
                        </div>
                      )}
                      <div className="text-[10px] text-zinc-400">
                        <span className="text-[9px] text-zinc-300 mr-0.5">登録</span>
                        {new Date(obs.createdAt).toLocaleDateString("ja-JP")}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FilterGroup({ label, options, value, onChange }: {
  label: string; options: { key: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">{label}</div>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button key={opt.key} type="button" onClick={() => onChange(opt.key)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 ${
              value === opt.key ? "bg-zinc-900 text-white shadow-md" : "bg-white text-zinc-600 border border-zinc-300 hover:border-zinc-400 hover:shadow-sm"
            }`}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
