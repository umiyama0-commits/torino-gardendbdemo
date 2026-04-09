"use client";

import { useState } from "react";
import {
  MODEL_LAYER_CONFIG,
  VALUE_AXIS_CONFIG,
  COUNTRY_CONFIG,
} from "@/lib/constants";

type DictEntry = {
  id: string;
  text: string;
  modelLayer: string;
  primaryValueAxis: string | null;
  country: string;
  confidence: string;
  trustScore: number;
  sourceTitle: string | null;
  sourceUrl: string | null;
  createdAt: string | Date;
  tags: { tag: { id: string; code: string; displayNameJa: string; type: string } }[];
};

type Stats = {
  byModelLayer: { key: string; count: number }[];
  byCountry: { key: string; count: number }[];
  byValueAxis: { key: string; count: number }[];
};

type Props = {
  initialEntries: DictEntry[];
  total: number;
  stats: Stats;
  topTags: { code: string; name: string; count: number }[];
};

export function DictionaryBrowser({ initialEntries, total, stats, topTags }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [search, setSearch] = useState("");
  const [filterLayer, setFilterLayer] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(total);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function fetchEntries(newPage = 1) {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search);
    if (filterLayer) params.set("modelLayer", filterLayer);
    if (filterCountry) params.set("country", filterCountry);
    if (filterTag) params.set("tag", filterTag);
    params.set("page", String(newPage));
    params.set("limit", "50");

    try {
      const res = await fetch(`/api/dictionary?${params}`);
      const data = await res.json();
      setEntries(data.entries);
      setTotalCount(data.total);
      setPage(newPage);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(totalCount / 50);

  return (
    <div className="space-y-6">
      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="総件数" value={totalCount} color="bg-zinc-50 text-zinc-700" />
        {stats.byModelLayer.map((s) => (
          <StatCard
            key={s.key}
            label={MODEL_LAYER_CONFIG[s.key]?.label || s.key}
            value={s.count}
            color={MODEL_LAYER_CONFIG[s.key]?.bg || "bg-zinc-50"}
            onClick={() => { setFilterLayer(s.key); fetchEntries(1); }}
          />
        ))}
      </div>

      {/* 国別分布 */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-zinc-400 self-center mr-1">国:</span>
        {stats.byCountry.sort((a, b) => b.count - a.count).map((s) => (
          <button
            key={s.key}
            onClick={() => { setFilterCountry(filterCountry === s.key ? "" : s.key); fetchEntries(1); }}
            className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
              filterCountry === s.key
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {COUNTRY_CONFIG[s.key]?.flag || ""} {COUNTRY_CONFIG[s.key]?.label || s.key} ({s.count})
          </button>
        ))}
      </div>

      {/* タグクラウド */}
      {topTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-zinc-400 self-center mr-1">タグ:</span>
          {topTags.map((t) => (
            <button
              key={t.code}
              onClick={() => { setFilterTag(filterTag === t.code ? "" : t.code); fetchEntries(1); }}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                filterTag === t.code
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
              }`}
            >
              {t.name} ({t.count})
            </button>
          ))}
        </div>
      )}

      {/* 検索・フィルタ */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="辞書を検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchEntries(1)}
          className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
        />
        <select
          value={filterLayer}
          onChange={(e) => { setFilterLayer(e.target.value); fetchEntries(1); }}
          className="border border-zinc-200 rounded-lg px-2 py-2 text-sm bg-white"
        >
          <option value="">全モデル層</option>
          {Object.entries(MODEL_LAYER_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <button
          onClick={() => fetchEntries(1)}
          disabled={loading}
          className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 disabled:opacity-50"
        >
          {loading ? "..." : "検索"}
        </button>
        {(filterLayer || filterCountry || filterTag || search) && (
          <button
            onClick={() => {
              setSearch(""); setFilterLayer(""); setFilterCountry(""); setFilterTag("");
              fetchEntries(1);
            }}
            className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-800"
          >
            リセット
          </button>
        )}
      </div>

      {/* 件数 + ページング */}
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{totalCount}件中 {((page - 1) * 50) + 1}〜{Math.min(page * 50, totalCount)}件</span>
        <div className="flex gap-1">
          <button
            onClick={() => fetchEntries(page - 1)}
            disabled={page <= 1 || loading}
            className="px-2 py-1 rounded bg-zinc-100 disabled:opacity-30"
          >
            前
          </button>
          <span className="px-2 py-1">{page} / {totalPages}</span>
          <button
            onClick={() => fetchEntries(page + 1)}
            disabled={page >= totalPages || loading}
            className="px-2 py-1 rounded bg-zinc-100 disabled:opacity-30"
          >
            次
          </button>
        </div>
      </div>

      {/* エントリ一覧 */}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="bg-white rounded-xl border border-zinc-200 hover:border-zinc-300 transition-colors"
          >
            <button
              onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              className="w-full text-left px-4 py-3"
            >
              <div className="flex items-start gap-3">
                {/* モデル層バッジ */}
                <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded ${MODEL_LAYER_CONFIG[entry.modelLayer]?.bg || "bg-zinc-100"}`}>
                  {MODEL_LAYER_CONFIG[entry.modelLayer]?.label || entry.modelLayer}
                </span>

                {/* テキスト */}
                <p className={`text-sm text-zinc-700 ${expandedId === entry.id ? "" : "line-clamp-2"}`}>
                  {entry.text}
                </p>

                {/* 国旗 */}
                <span className="shrink-0 text-sm">
                  {COUNTRY_CONFIG[entry.country]?.flag || entry.country}
                </span>
              </div>
            </button>

            {/* 展開時の詳細 */}
            {expandedId === entry.id && (
              <div className="px-4 pb-3 space-y-2 border-t border-zinc-100 pt-2">
                <div className="flex flex-wrap gap-1.5">
                  {entry.primaryValueAxis && (
                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${VALUE_AXIS_CONFIG[entry.primaryValueAxis]?.bg || "bg-zinc-100"}`}>
                      {VALUE_AXIS_CONFIG[entry.primaryValueAxis]?.label || entry.primaryValueAxis}
                    </span>
                  )}
                  {entry.tags.map((t) => (
                    <span
                      key={t.tag.id}
                      className="px-1.5 py-0.5 text-[10px] bg-zinc-100 text-zinc-500 rounded cursor-pointer hover:bg-zinc-200"
                      onClick={(e) => { e.stopPropagation(); setFilterTag(t.tag.code); fetchEntries(1); }}
                    >
                      {t.tag.displayNameJa}
                    </span>
                  ))}
                </div>
                {entry.sourceTitle && (
                  <div className="text-xs text-zinc-400">
                    出典: {entry.sourceUrl ? (
                      <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600">
                        {entry.sourceTitle}
                      </a>
                    ) : entry.sourceTitle}
                  </div>
                )}
                <div className="text-[10px] text-zinc-300">
                  {COUNTRY_CONFIG[entry.country]?.label || entry.country} / {new Date(entry.createdAt).toLocaleDateString("ja-JP")}
                </div>
              </div>
            )}
          </div>
        ))}

        {entries.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-8">
            該当する公知データがありません
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, onClick }: { label: string; value: number; color: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`rounded-xl p-3 text-left ${color} ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
    >
      <p className="text-[10px] font-medium opacity-60">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </Tag>
  );
}
