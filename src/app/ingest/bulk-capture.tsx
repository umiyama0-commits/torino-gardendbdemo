"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

type Tag = {
  id: string;
  code: string;
  displayNameJa: string;
  type: string;
  modelLayer: string | null;
};

type Props = {
  tagsByType: Record<string, Tag[]>;
};

type ExtractedObs = {
  clientId: string;
  text: string;
  modelLayer: string;
  primaryValueAxis: string | null;
  provenance: string;
  confidence: string;
  tagCodes: string[];
  tagIds: string[];
  tagNames: string[];
  reasoning: string;
  status: "pending" | "saving" | "saved" | "error";
  error?: string;
  deleted: boolean;
};

const MODEL_LAYER_LABELS: Record<string, { label: string; color: string }> = {
  MOVEMENT: { label: "動線", color: "bg-blue-100 text-blue-700" },
  APPROACH: { label: "接点", color: "bg-emerald-100 text-emerald-700" },
  BREAKDOWN: { label: "離脱", color: "bg-red-100 text-red-700" },
  TRANSFER: { label: "伝承", color: "bg-violet-100 text-violet-700" },
};

const VALUE_AXIS_LABELS: Record<string, { label: string; color: string }> = {
  REVENUE_UP: { label: "売上向上", color: "bg-orange-100 text-orange-700" },
  COST_DOWN: { label: "コスト削減", color: "bg-teal-100 text-teal-700" },
  RETENTION: { label: "継続率向上", color: "bg-amber-100 text-amber-700" },
};

const PROVENANCE_LABELS: Record<string, string> = {
  FIELD_OBSERVED: "①固有知",
  ANONYMIZED_DERIVED: "②汎用知",
  PUBLIC_CODIFIED: "③公知",
};

export function BulkCapture({ tagsByType: _tagsByType }: Props) {
  const [rawText, setRawText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [observations, setObservations] = useState<ExtractedObs[]>([]);
  const [error, setError] = useState("");
  const [saveProgress, setSaveProgress] = useState<{ total: number; done: number } | null>(null);

  const activeObs = observations.filter((o) => !o.deleted);
  const pendingObs = activeObs.filter((o) => o.status === "pending");
  const savedObs = activeObs.filter((o) => o.status === "saved");

  async function handleExtract() {
    if (!rawText.trim()) return;
    setExtracting(true);
    setError("");
    setObservations([]);

    try {
      const res = await fetch("/api/bulk-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText.trim() }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "抽出に失敗しました");
        return;
      }

      setObservations(
        data.observations.map((obs: ExtractedObs, i: number) => ({
          ...obs,
          clientId: `bulk-${Date.now()}-${i}`,
          status: "pending" as const,
          deleted: false,
        })),
      );
    } catch {
      setError("APIに接続できませんでした");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSaveAll() {
    const toSave = pendingObs;
    if (toSave.length === 0) return;

    setSaveProgress({ total: toSave.length, done: 0 });

    for (let i = 0; i < toSave.length; i++) {
      const obs = toSave[i];

      // ステータス更新: saving
      setObservations((prev) =>
        prev.map((o) => (o.clientId === obs.clientId ? { ...o, status: "saving" as const } : o)),
      );

      try {
        const res = await fetch("/api/observations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: obs.text,
            modelLayer: obs.modelLayer,
            primaryValueAxis: obs.primaryValueAxis || null,
            provenance: obs.provenance,
            confidence: obs.confidence,
            tagIds: obs.tagIds,
          }),
        });

        if (res.ok) {
          setObservations((prev) =>
            prev.map((o) =>
              o.clientId === obs.clientId ? { ...o, status: "saved" as const } : o,
            ),
          );
        } else {
          setObservations((prev) =>
            prev.map((o) =>
              o.clientId === obs.clientId
                ? { ...o, status: "error" as const, error: "保存失敗" }
                : o,
            ),
          );
        }
      } catch {
        setObservations((prev) =>
          prev.map((o) =>
            o.clientId === obs.clientId
              ? { ...o, status: "error" as const, error: "通信エラー" }
              : o,
          ),
        );
      }

      setSaveProgress({ total: toSave.length, done: i + 1 });
    }

    setSaveProgress(null);
  }

  function handleDelete(clientId: string) {
    setObservations((prev) =>
      prev.map((o) => (o.clientId === clientId ? { ...o, deleted: true } : o)),
    );
  }

  function handleEditText(clientId: string, newText: string) {
    setObservations((prev) =>
      prev.map((o) => (o.clientId === clientId ? { ...o, text: newText } : o)),
    );
  }

  return (
    <div className="space-y-6">
      {/* 入力エリア */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">テキスト一括取込</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              日報・報告書・議事録を貼り付けると、AIが個別の観測データに自動分割します
            </p>
          </div>
          <button
            onClick={handleExtract}
            disabled={extracting || !rawText.trim()}
            className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {extracting ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-zinc-400 border-t-white rounded-full animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <span className="text-base">&#9733;</span>
                AI分析
              </>
            )}
          </button>
        </div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`例:\n今日のA店視察メモ。\n・入口右側の新作ディスプレイに70%の客が立ち寄っていた。\n・声掛けは平均5秒後。3秒以内だと接客発生率が高い印象。\n・14時台にスタッフ2名体制になりレジ待ち3分超え発生。\n・新人の田中さんはシャドーイングで接客パターンを吸収していた。`}
          rows={8}
          className="w-full border border-zinc-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 resize-y"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-zinc-400">
            {rawText.length > 0 ? `${rawText.length}文字` : ""}
          </span>
          {rawText.length > 8000 && (
            <span className="text-xs text-amber-600">
              8,000文字を超える部分は切り捨てられます
            </span>
          )}
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 抽出結果 */}
      {activeObs.length > 0 && (
        <>
          {/* アクションバー */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border border-zinc-200 rounded-xl px-5 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-zinc-700">
                {activeObs.length}件抽出
              </span>
              {savedObs.length > 0 && (
                <span className="text-xs text-emerald-600 font-medium">
                  {savedObs.length}件保存済み
                </span>
              )}
              {saveProgress && (
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3.5 h-3.5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                  <span className="text-xs text-zinc-500">
                    {saveProgress.done}/{saveProgress.total} 保存中...
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {pendingObs.length > 0 && (
                <button
                  onClick={handleSaveAll}
                  disabled={!!saveProgress}
                  className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                >
                  全て保存（{pendingObs.length}件）
                </button>
              )}
              <button
                onClick={() => {
                  setObservations([]);
                  setRawText("");
                }}
                className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                クリア
              </button>
            </div>
          </div>

          {/* カード一覧 */}
          <div className="space-y-3">
            {activeObs.map((obs, idx) => (
              <div
                key={obs.clientId}
                className={`bg-white rounded-xl border transition-colors ${
                  obs.status === "saved"
                    ? "border-emerald-200 bg-emerald-50/30"
                    : obs.status === "error"
                      ? "border-red-200 bg-red-50/30"
                      : obs.status === "saving"
                        ? "border-zinc-300 opacity-70"
                        : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="px-4 py-3">
                  {/* ヘッダー行 */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-zinc-400 font-mono w-5">
                        {idx + 1}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                          MODEL_LAYER_LABELS[obs.modelLayer]?.color || "bg-zinc-100"
                        }`}
                      >
                        {MODEL_LAYER_LABELS[obs.modelLayer]?.label || obs.modelLayer}
                      </span>
                      {obs.primaryValueAxis && (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                            VALUE_AXIS_LABELS[obs.primaryValueAxis]?.color || "bg-zinc-100"
                          }`}
                        >
                          {VALUE_AXIS_LABELS[obs.primaryValueAxis]?.label || obs.primaryValueAxis}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-400">
                        {PROVENANCE_LABELS[obs.provenance] || obs.provenance}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {obs.status === "saved" && (
                        <span className="text-xs text-emerald-600 font-medium mr-1">
                          保存済
                        </span>
                      )}
                      {obs.status === "error" && (
                        <span className="text-xs text-red-600 font-medium mr-1">
                          {obs.error}
                        </span>
                      )}
                      {obs.status === "saving" && (
                        <span className="inline-block w-3 h-3 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin mr-1" />
                      )}
                      {obs.status === "pending" && (
                        <button
                          onClick={() => handleDelete(obs.clientId)}
                          className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                          title="削除"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* テキスト（編集可能） */}
                  {obs.status === "pending" ? (
                    <textarea
                      value={obs.text}
                      onChange={(e) => handleEditText(obs.clientId, e.target.value)}
                      rows={2}
                      className="w-full text-sm text-zinc-700 bg-transparent border border-zinc-100 rounded px-2 py-1.5 focus:outline-none focus:border-zinc-300 resize-y"
                    />
                  ) : (
                    <p className="text-sm text-zinc-700">{obs.text}</p>
                  )}

                  {/* タグ */}
                  {obs.tagNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {obs.tagNames.map((name, ti) => (
                        <Badge
                          key={ti}
                          variant="outline"
                          className="text-[10px] bg-zinc-50"
                        >
                          {name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* AI判定理由 */}
                  <p className="text-[11px] text-violet-500 mt-1.5">{obs.reasoning}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 空状態のヒント */}
      {observations.length === 0 && !extracting && !error && (
        <div className="text-center py-12">
          <p className="text-zinc-400 text-sm">
            テキストを貼り付けて「AI分析」を押すと、自動的に観測データに分割されます
          </p>
          <div className="mt-4 text-xs text-zinc-300 space-y-1">
            <p>対応形式: 日報・視察メモ・議事録・報告書テキスト</p>
            <p>1回の分析で最大30件の観測データを自動抽出</p>
          </div>
        </div>
      )}
    </div>
  );
}
