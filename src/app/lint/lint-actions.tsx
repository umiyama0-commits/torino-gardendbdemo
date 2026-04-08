"use client";

import { useState } from "react";

export function LintActions({ observationCount, insightCount }: { observationCount: number; insightCount: number }) {
  const [running, setRunning] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  const [resolving, setResolving] = useState(false);
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

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          onClick={handleRecalc}
          disabled={recalcing}
          className="px-4 py-2 bg-zinc-200 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {recalcing ? "計算中..." : "スコア再計算"}
        </button>
        <button
          onClick={handleResolveGaps}
          disabled={resolving}
          className="px-4 py-2 bg-amber-100 text-amber-800 text-sm font-medium rounded-lg hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {resolving ? "補完中..." : "ギャップ自動補完"}
        </button>
        <button
          onClick={handleLint}
          disabled={running || totalCount < 2}
          className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? "検証中..." : "品質チェック実行"}
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
