"use client";

import { useState, useEffect, useCallback } from "react";
import { MODEL_LAYER_CONFIG, VALUE_AXIS_CONFIG, PROVENANCE_CONFIG } from "@/lib/constants";

type RecentObs = {
  id: string; text: string; modelLayer: string; primaryValueAxis: string | null;
  provenance: string; createdAt: string; createdBy: string;
};

type Stats = {
  totalAll: number;
  totalToday: number;
  recent: RecentObs[];
};

export function ActivityFeed({ initialStats }: { initialStats: Stats }) {
  const [stats, setStats] = useState<Stats>(initialStats);
  const [highlight, setHighlight] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/ingest-stats");
      if (res.ok) {
        const data = await res.json();
        // Check if something new was added
        if (data.totalAll > stats.totalAll && stats.totalAll > 0) {
          // Flash the newest item
          if (data.recent?.[0]) {
            setHighlight(data.recent[0].id);
            setTimeout(() => setHighlight(null), 3000);
          }
        }
        setStats({
          totalAll: data.totalAll,
          totalToday: data.totalToday,
          recent: data.recent || [],
        });
      }
    } catch {
      // silently ignore
    }
  }, [stats.totalAll]);

  // Poll every 15s for updates
  useEffect(() => {
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Expose refresh for external callers
  useEffect(() => {
    (window as Record<string, unknown>).__refreshActivityFeed = refresh;
    return () => { delete (window as Record<string, unknown>).__refreshActivityFeed; };
  }, [refresh]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "たった今";
    if (mins < 60) return `${mins}分前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    return `${days}日前`;
  };

  return (
    <div className="space-y-4 sticky top-6">
      {/* Live stats card */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-700 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-white tracking-wider uppercase">Live Status</span>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-zinc-100">
          <div className="px-4 py-3 text-center">
            <div className="text-2xl font-black text-zinc-900 tabular-nums">{stats.totalAll}</div>
            <div className="text-[10px] font-medium text-zinc-400 mt-0.5">全観測数</div>
          </div>
          <div className="px-4 py-3 text-center">
            <div className="text-2xl font-black tabular-nums" style={{ color: stats.totalToday > 0 ? "#22c55e" : "#a1a1aa" }}>
              +{stats.totalToday}
            </div>
            <div className="text-[10px] font-medium text-zinc-400 mt-0.5">本日の追加</div>
          </div>
        </div>
      </div>

      {/* Coverage progress */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-600">4層カバレッジ</span>
          <span className="text-[10px] text-zinc-400">Layer Coverage</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.entries(MODEL_LAYER_CONFIG) as [string, (typeof MODEL_LAYER_CONFIG)[keyof typeof MODEL_LAYER_CONFIG]][]).map(([key, cfg]) => {
            const hasData = stats.recent.some(r => r.modelLayer === key);
            return (
              <div key={key} className="text-center">
                <div
                  className="h-2 rounded-full mb-1 transition-all duration-500"
                  style={{ backgroundColor: hasData ? cfg.color : "#e4e4e7" }}
                />
                <span className="text-[9px] font-medium" style={{ color: hasData ? cfg.color : "#a1a1aa" }}>
                  {cfg.labelJa}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent activity feed */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-md overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-600">最近の投入</span>
            <span className="text-[10px] text-zinc-400">Recent Activity</span>
          </div>
        </div>
        <div className="divide-y divide-zinc-50 max-h-[420px] overflow-y-auto">
          {stats.recent.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="text-2xl mb-2">📝</div>
              <p className="text-xs text-zinc-400">まだ観測データがありません</p>
              <p className="text-[10px] text-zinc-300 mt-0.5">最初の1件を入力してみましょう！</p>
            </div>
          ) : (
            stats.recent.map((obs) => {
              const layerCfg = MODEL_LAYER_CONFIG[obs.modelLayer as keyof typeof MODEL_LAYER_CONFIG];
              const axisCfg = obs.primaryValueAxis ? VALUE_AXIS_CONFIG[obs.primaryValueAxis as keyof typeof VALUE_AXIS_CONFIG] : null;
              const provCfg = PROVENANCE_CONFIG[obs.provenance as keyof typeof PROVENANCE_CONFIG];
              const isHighlighted = highlight === obs.id;

              return (
                <div
                  key={obs.id}
                  className={`px-4 py-3 transition-all duration-700 ${isHighlighted ? "bg-emerald-50 ring-1 ring-emerald-200" : "hover:bg-zinc-50"}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="mt-1 h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: layerCfg?.color || "#71717a" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-zinc-700 leading-relaxed line-clamp-2">
                        {obs.text}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: (layerCfg?.color || "#71717a") + "15", color: layerCfg?.color }}
                        >
                          {layerCfg?.labelJa}
                        </span>
                        {axisCfg && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: axisCfg.color + "15", color: axisCfg.color }}
                          >
                            {axisCfg.labelJa}
                          </span>
                        )}
                        {provCfg && (
                          <span className="text-[9px] text-zinc-400">
                            {provCfg.labelJa}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-zinc-300">{obs.createdBy}</span>
                        <span className="text-[10px] text-zinc-300">·</span>
                        <span className="text-[10px] text-zinc-300">{timeAgo(obs.createdAt)}</span>
                        {isHighlighted && (
                          <span className="text-[9px] font-bold text-emerald-500 ml-auto">NEW!</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Motivation */}
      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-3 text-center">
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          1件の気づきが、業界全体の知見になります。<br />
          <span className="text-zinc-500 font-medium">Every observation builds collective intelligence.</span>
        </p>
      </div>
    </div>
  );
}
