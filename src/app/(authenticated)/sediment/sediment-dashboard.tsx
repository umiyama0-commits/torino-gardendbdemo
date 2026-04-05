"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MODEL_LAYER_CONFIG } from "@/lib/constants";

type ClusterMember = {
  observationId: string;
  text: string;
  modelLayer: string;
  provenance: string;
  viewCount: number;
  createdAt: string;
  anonymizedSource: string | null;
};

type Cluster = {
  id: string;
  label: string;
  modelLayer: string;
  primaryValueAxis: string | null;
  keywords: string[];
  memberCount: number;
  status: string;
  createdAt: string;
  members: ClusterMember[];
};

type ReferencedObs = {
  id: string;
  text: string;
  modelLayer: string;
  viewCount: number;
  lastReferencedAt: string | null;
  createdAt: string;
};

type DashboardData = {
  stats: { activeCount: number; sedimentCount: number; compostedCount: number };
  clusters: Cluster[];
  referencedSediment: ReferencedObs[];
  isAdmin: boolean;
};

export function SedimentDashboard({ data }: { data: DashboardData }) {
  const { stats, clusters, referencedSediment, isAdmin } = data;
  const [scanning, setScanning] = useState(false);
  const [clustering, setClustering] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [clusterResult, setClusterResult] = useState<string | null>(null);

  const totalObs = stats.activeCount + stats.sedimentCount + stats.compostedCount;
  const sedimentPercent = totalObs > 0 ? Math.round(((stats.sedimentCount + stats.compostedCount) / totalObs) * 100) : 0;

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/sediment/scan", { method: "POST" });
      const result = await res.json();
      setScanResult(`${result.sedimentedCount} 件の観測を沈殿データに分類しました`);
    } catch {
      setScanResult("エラーが発生しました");
    }
    setScanning(false);
  };

  const handleCluster = async () => {
    setClustering(true);
    setClusterResult(null);
    try {
      const res = await fetch("/api/sediment/clusters", { method: "POST" });
      const result = await res.json();
      setClusterResult(`${result.newClusters} 件の新しい萌芽パターンを検出しました`);
      if (result.newClusters > 0) {
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch {
      setClusterResult("エラーが発生しました");
    }
    setClustering(false);
  };

  return (
    <div className="space-y-6">
      {/* Stats overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="活性データ" sublabel="Active" value={stats.activeCount} color="emerald" />
        <StatCard label="沈殿データ" sublabel="Sediment" value={stats.sedimentCount} color="amber" />
        <StatCard label="堆肥化済み" sublabel="Composted" value={stats.compostedCount} color="violet" />
        <StatCard label="萌芽パターン" sublabel="Emerging" value={clusters.filter(c => c.status === "emerging").length} color="blue" />
      </div>

      {/* Data lifecycle visualization */}
      <Card className="border border-zinc-200 shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-700 px-6 py-4">
          <h3 className="text-white font-semibold">データのライフサイクル</h3>
          <p className="text-zinc-400 text-xs mt-0.5">観測データが知見に変わるまでの流れ</p>
        </div>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            {/* Lifecycle bar */}
            <div className="flex-1 flex rounded-full overflow-hidden h-6">
              {stats.activeCount > 0 && (
                <div
                  className="bg-emerald-400 flex items-center justify-center text-[10px] font-bold text-white transition-all"
                  style={{ width: `${((stats.activeCount / totalObs) * 100)}%`, minWidth: stats.activeCount > 0 ? "40px" : 0 }}
                >
                  {Math.round((stats.activeCount / totalObs) * 100)}%
                </div>
              )}
              {stats.sedimentCount > 0 && (
                <div
                  className="bg-amber-400 flex items-center justify-center text-[10px] font-bold text-white transition-all"
                  style={{ width: `${((stats.sedimentCount / totalObs) * 100)}%`, minWidth: stats.sedimentCount > 0 ? "40px" : 0 }}
                >
                  {Math.round((stats.sedimentCount / totalObs) * 100)}%
                </div>
              )}
              {stats.compostedCount > 0 && (
                <div
                  className="bg-violet-400 flex items-center justify-center text-[10px] font-bold text-white transition-all"
                  style={{ width: `${((stats.compostedCount / totalObs) * 100)}%`, minWidth: stats.compostedCount > 0 ? "40px" : 0 }}
                >
                  {Math.round((stats.compostedCount / totalObs) * 100)}%
                </div>
              )}
              {totalObs === 0 && (
                <div className="bg-zinc-200 flex-1 flex items-center justify-center text-[10px] text-zinc-400">
                  データなし
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 text-[11px] text-zinc-500">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              活性（90日以内）
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              沈殿（90日超・未分類）
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-violet-400" />
              堆肥化（パターン候補に統合）
            </div>
          </div>

          {/* Admin actions */}
          {isAdmin && (
            <div className="flex gap-3 mt-5 pt-4 border-t border-zinc-100">
              <Button
                variant="outline"
                size="sm"
                onClick={handleScan}
                disabled={scanning}
                className="text-xs gap-1.5"
              >
                {scanning ? (
                  <><span className="animate-spin">&#9676;</span> スキャン中...</>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                    </svg>
                    沈殿スキャン実行
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCluster}
                disabled={clustering}
                className="text-xs gap-1.5"
              >
                {clustering ? (
                  <><span className="animate-spin">&#9676;</span> クラスタリング中...</>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                    </svg>
                    自動クラスタリング実行
                  </>
                )}
              </Button>
              {scanResult && (
                <span className="text-xs text-emerald-600 font-medium self-center">{scanResult}</span>
              )}
              {clusterResult && (
                <span className="text-xs text-blue-600 font-medium self-center">{clusterResult}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emerging clusters */}
      {clusters.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5 text-amber-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
            萌芽パターン候補
            <Badge variant="outline" className="text-amber-600 border-amber-200 text-xs font-medium ml-1">
              {clusters.filter(c => c.status === "emerging").length} 件
            </Badge>
          </h2>

          <div className="grid gap-4">
            {clusters.map((cluster) => (
              <EmergingClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </div>
        </div>
      )}

      {clusters.length === 0 && (
        <Card className="border border-dashed border-zinc-300">
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-3">&#x1F331;</div>
            <p className="text-sm font-semibold text-zinc-600">萌芽パターンはまだありません</p>
            <p className="text-xs text-zinc-400 mt-1">
              観測データが蓄積すると、類似データが自動的にクラスタ化されます
            </p>
            {isAdmin && (
              <Button variant="outline" size="sm" className="mt-4 text-xs" onClick={handleCluster} disabled={clustering}>
                今すぐクラスタリングを実行
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Referenced sediment data */}
      {referencedSediment.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5 text-violet-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            再発見されたデータ
            <span className="text-xs font-normal text-zinc-400">検索・類似マッチで参照された沈殿データ</span>
          </h2>
          <div className="grid gap-2">
            {referencedSediment.map((obs) => {
              const layerCfg = MODEL_LAYER_CONFIG[obs.modelLayer as keyof typeof MODEL_LAYER_CONFIG];
              return (
                <div key={obs.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:shadow-sm transition-shadow">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: layerCfg?.color || "#71717a" }} />
                  <p className="text-[13px] text-zinc-700 flex-1 min-w-0 truncate">{obs.text}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-3.5 text-violet-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                    <span className="text-xs font-bold text-violet-500 tabular-nums">{obs.viewCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, sublabel, value, color }: { label: string; sublabel: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "from-emerald-50 to-emerald-100/50 border-emerald-200",
    amber: "from-amber-50 to-amber-100/50 border-amber-200",
    violet: "from-violet-50 to-violet-100/50 border-violet-200",
    blue: "from-blue-50 to-blue-100/50 border-blue-200",
  };
  const textColorMap: Record<string, string> = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    violet: "text-violet-700",
    blue: "text-blue-700",
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br ${colorMap[color]} p-4`}>
      <div className={`text-2xl font-black tabular-nums ${textColorMap[color]}`}>{value}</div>
      <div className="text-xs font-semibold text-zinc-600 mt-1">{label}</div>
      <div className="text-[10px] text-zinc-400">{sublabel}</div>
    </div>
  );
}

function EmergingClusterCard({ cluster }: { cluster: Cluster }) {
  const [expanded, setExpanded] = useState(false);
  const layerCfg = MODEL_LAYER_CONFIG[cluster.modelLayer as keyof typeof MODEL_LAYER_CONFIG];

  return (
    <Card className="border border-zinc-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 text-white font-black text-sm"
            style={{ backgroundColor: layerCfg?.color || "#71717a" }}
          >
            {cluster.memberCount}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-zinc-800">{cluster.label}</h3>
              <Badge
                variant="outline"
                className="text-[10px] font-medium"
                style={{ color: layerCfg?.color, borderColor: layerCfg?.color + "40" }}
              >
                {layerCfg?.labelJa || cluster.modelLayer}
              </Badge>
              {cluster.status === "emerging" && (
                <Badge className="bg-amber-100 text-amber-700 text-[10px] font-medium">
                  萌芽
                </Badge>
              )}
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {cluster.keywords.map((kw) => (
                <span key={kw} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-medium">
                  {kw}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-400">
              <span>{cluster.memberCount} 件の観測</span>
              <span>検出日: {new Date(cluster.createdAt).toLocaleDateString("ja-JP")}</span>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 p-1 rounded hover:bg-zinc-100 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
              className={`size-4 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-100 bg-zinc-50/50">
          <div className="divide-y divide-zinc-100">
            {cluster.members.map((member) => (
              <div key={member.observationId} className="px-5 py-3">
                <p className="text-[13px] text-zinc-700 leading-relaxed">{member.text}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-400">
                  <span>{new Date(member.createdAt).toLocaleDateString("ja-JP")}</span>
                  {member.anonymizedSource && (
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">{member.anonymizedSource}</span>
                  )}
                  {member.viewCount > 0 && (
                    <span className="text-violet-500 font-medium">参照 {member.viewCount} 回</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
