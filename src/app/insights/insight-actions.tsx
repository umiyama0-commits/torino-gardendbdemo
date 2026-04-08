"use client";

import { useState } from "react";

export function InsightActions({ observationCount }: { observationCount: number }) {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) {
        setResult(`エラー: ${data.error || "生成に失敗しました"}`);
        return;
      }
      setResult(`${data.created}件の洞察を生成しました`);
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setResult("ネットワークエラー");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleGenerate}
        disabled={generating || observationCount < 2}
        className="px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {generating ? "生成中..." : "Insight生成"}
      </button>
      {result && (
        <p className={`text-xs ${result.startsWith("エラー") ? "text-red-500" : "text-emerald-600"}`}>
          {result}
        </p>
      )}
      {observationCount < 2 && (
        <p className="text-xs text-zinc-400">観測データが2件以上必要です</p>
      )}
    </div>
  );
}
