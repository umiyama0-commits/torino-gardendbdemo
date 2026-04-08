"use client";

import { useState } from "react";

export function LintActions({ observationCount, insightCount }: { observationCount: number; insightCount: number }) {
  const [running, setRunning] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [clustering, setClustering] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const totalCount = observationCount + insightCount;

  async function handleLint() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/lint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) {
        setResult(`エラー: ${data.error || "検証に失敗しました"}`);
        return;
      }
      setResult(`${data.created}件の検出事項を発見`);
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setResult("ネットワークエラー");
    } finally {
      setRunning(false);
    }
  }

  async function handleRecalc() {
    setRecalcing(true);
    setResult(null);
    try {
      const res = await fetch("/api/lint?action=recalc", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(`エラー: ${data.error || "再計算に失敗しました"}`);
        return;
      }
      setResult(`観測: ${data.observationsUpdated}件、洞察: ${data.insightsUpdated}件のスコアを更新`);
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setResult("ネットワークエラー");
    } finally {
      setRecalcing(false);
    }
  }

  async function handleResolveGaps() {
    setResolving(true);
    setResult(null);
    try {
      const res = await fetch("/api/lint?action=resolve-gaps", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(`エラー: ${data.error || "補完に失敗しました"}`);
        return;
      }
      if (data.resolved === 0) {
        setResult(data.message || "補完対象のギャップはありません");
      } else {
        setResult(`${data.resolved}件のギャップを補完（${data.generatedInsights?.length || 0}件の洞察を生成）`);
      }
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setResult("ネットワークエラー");
    } finally {
      setResolving(false);
    }
  }

  async function handleBackfill() {
    setBackfilling(true);
    setResult(null);
    try {
      const res = await fetch("/api/lint?action=backfill", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(`エラー: ${data.error || "バックフィルに失敗"}`);
        return;
      }
      setResult(`Embedding生成完了: 観測${data.observations}件、洞察${data.insights}件`);
    } catch {
      setResult("ネットワークエラー");
    } finally {
      setBackfilling(false);
    }
  }

  async function handleCluster() {
    setClustering(true);
    setResult(null);
    try {
      const res = await fetch("/api/lint?action=cluster", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(`エラー: ${data.error || "クラスタリングに失敗"}`);
        return;
      }
      setResult(`${data.clustersCreated}クラスタ生成（${data.insightsAssigned}件分類）、${data.patternsCreated}パターン発見`);
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setResult("ネットワークエラー");
    } finally {
      setClustering(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-1.5 flex-wrap justify-end">
        <button onClick={handleBackfill} disabled={backfilling}
          className="px-2 py-1 bg-cyan-100 text-cyan-800 text-[11px] font-medium rounded hover:bg-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
          {backfilling ? "生成中..." : "Embedding"}
        </button>
        <button onClick={handleCluster} disabled={clustering}
          className="px-2 py-1 bg-blue-100 text-blue-800 text-[11px] font-medium rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
          {clustering ? "分析中..." : "クラスタ"}
        </button>
        <button onClick={handleRecalc} disabled={recalcing}
          className="px-2 py-1 bg-zinc-200 text-zinc-700 text-[11px] font-medium rounded hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
          {recalcing ? "計算中..." : "スコア再計算"}
        </button>
        <button onClick={handleResolveGaps} disabled={resolving}
          className="px-2 py-1 bg-amber-100 text-amber-800 text-[11px] font-medium rounded hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
          {resolving ? "補完中..." : "ギャップ補完"}
        </button>
        <button onClick={handleLint} disabled={running || totalCount < 2}
          className="px-2 py-1 bg-violet-600 text-white text-[11px] font-medium rounded hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
          {running ? "検証中..." : "品質チェック"}
        </button>
      </div>
      {result && (
        <p className={`text-xs ${result.startsWith("エラー") ? "text-red-500" : "text-emerald-600"}`}>
          {result}
        </p>
      )}
    </div>
  );
}
