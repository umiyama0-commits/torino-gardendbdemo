"use client";

import { useState, useRef, useCallback } from "react";
import { upload } from "@vercel/blob/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RawFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  blobUrl: string;
  status: string;
  extractedText: string | null;
  errorMessage: string | null;
};

type KpiImpact = {
  metric: string;
  direction: "UP" | "DOWN" | "NEUTRAL" | "UNKNOWN";
  magnitude: string;
  note: string;
};

type ExtractedObs = {
  clientId: string;
  text: string;
  event: string;
  outcome: string;
  kpiImpacts: KpiImpact[];
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

const DIRECTION_SYMBOL: Record<string, string> = {
  UP: "↑",
  DOWN: "↓",
  NEUTRAL: "→",
  UNKNOWN: "?",
};

const DIRECTION_COLOR: Record<string, string> = {
  UP: "text-emerald-600 bg-emerald-50 border-emerald-200",
  DOWN: "text-red-600 bg-red-50 border-red-200",
  NEUTRAL: "text-zinc-600 bg-zinc-50 border-zinc-200",
  UNKNOWN: "text-zinc-400 bg-zinc-50 border-zinc-200",
};

function buildSavedText(obs: ExtractedObs): string {
  // 保存時: event/outcome/KPIを text に統合して保存（DBスキーマ変更なし）
  const parts: string[] = [];
  if (obs.event) parts.push(`【事象】${obs.event}`);
  if (obs.outcome) parts.push(`【帰結】${obs.outcome}`);
  if (obs.kpiImpacts.length > 0) {
    const kpiLines = obs.kpiImpacts.map((k) => {
      const dir = DIRECTION_SYMBOL[k.direction] || "";
      const mag = k.magnitude ? ` ${k.magnitude}` : "";
      const note = k.note ? ` (${k.note})` : "";
      return `・${k.metric}${dir}${mag}${note}`;
    });
    parts.push(`【KPI影響】\n${kpiLines.join("\n")}`);
  }
  // 事象/帰結が空ならフォールバックで obs.text を使う
  return parts.length > 0 ? parts.join("\n") : obs.text;
}

type UploadedFile = {
  rawFile: RawFile;
  splitting: boolean;
  splitError: string | null;
  observations: ExtractedObs[];
  batchProgress: { total: number; done: number } | null;
};

const FILE_TYPE_ICONS: Record<string, string> = {
  PDF: "📄",
  DOCX: "📝",
  TXT: "📃",
  CSV: "📊",
  MP4: "🎥",
  MOV: "🎥",
  PNG: "🖼️",
  JPG: "🖼️",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  uploaded: { label: "アップロード済み", color: "bg-blue-100 text-blue-700" },
  extracting: { label: "テキスト抽出中...", color: "bg-amber-100 text-amber-700" },
  extracted: { label: "抽出完了", color: "bg-emerald-100 text-emerald-700" },
  error: { label: "エラー", color: "bg-red-100 text-red-700" },
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    const blob = await upload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/upload",
      contentType: file.type,
    });
    const res = await fetch("/api/upload/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        blobUrl: blob.url,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "登録失敗");
    }
    return (await res.json()) as RawFile;
  }, []);

  const extractText = useCallback(async (fileId: string) => {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    });
    if (!res.ok) throw new Error("テキスト抽出失敗");
    return res.json() as Promise<{ file: RawFile }>;
  }, []);

  const splitIntoObservations = useCallback(async (rawFileId: string, extractedText: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.rawFile.id === rawFileId ? { ...f, splitting: true, splitError: null } : f)),
    );

    try {
      const res = await fetch("/api/bulk-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractedText }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "分割抽出失敗");
      }

      const obs: ExtractedObs[] = data.observations.map((o: ExtractedObs, i: number) => ({
        ...o,
        clientId: `${rawFileId}-${Date.now()}-${i}`,
        status: "pending" as const,
        deleted: false,
      }));

      setFiles((prev) =>
        prev.map((f) =>
          f.rawFile.id === rawFileId ? { ...f, splitting: false, observations: obs } : f,
        ),
      );
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.rawFile.id === rawFileId
            ? { ...f, splitting: false, splitError: (err as Error).message }
            : f,
        ),
      );
    }
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setUploading(true);

      for (const file of Array.from(fileList)) {
        try {
          const rawFile = await uploadFile(file);
          const entry: UploadedFile = {
            rawFile,
            splitting: false,
            splitError: null,
            observations: [],
            batchProgress: null,
          };
          setFiles((prev) => [...prev, entry]);

          try {
            const result = await extractText(rawFile.id);
            setFiles((prev) =>
              prev.map((f) => (f.rawFile.id === rawFile.id ? { ...f, rawFile: result.file } : f)),
            );

            // 抽出成功 & テキストあり → 自動で複数観測に分割
            if (result.file.extractedText && result.file.extractedText.length > 30) {
              splitIntoObservations(rawFile.id, result.file.extractedText);
            }
          } catch {
            setFiles((prev) =>
              prev.map((f) =>
                f.rawFile.id === rawFile.id
                  ? {
                      ...f,
                      rawFile: { ...f.rawFile, status: "error", errorMessage: "テキスト抽出失敗" },
                    }
                  : f,
              ),
            );
          }
        } catch (err) {
          console.error("Upload failed:", file.name, err);
        }
      }

      setUploading(false);
    },
    [uploadFile, extractText, splitIntoObservations],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleEditObs = useCallback((rawFileId: string, clientId: string, newText: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.rawFile.id === rawFileId
          ? {
              ...f,
              observations: f.observations.map((o) =>
                o.clientId === clientId ? { ...o, text: newText } : o,
              ),
            }
          : f,
      ),
    );
  }, []);

  const handleDeleteObs = useCallback((rawFileId: string, clientId: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.rawFile.id === rawFileId
          ? {
              ...f,
              observations: f.observations.map((o) =>
                o.clientId === clientId ? { ...o, deleted: true } : o,
              ),
            }
          : f,
      ),
    );
  }, []);

  const saveAllObservations = useCallback(
    async (rawFileId: string) => {
      const entry = files.find((f) => f.rawFile.id === rawFileId);
      if (!entry) return;
      const toSave = entry.observations.filter((o) => !o.deleted && o.status === "pending");
      if (toSave.length === 0) return;

      setFiles((prev) =>
        prev.map((f) =>
          f.rawFile.id === rawFileId
            ? { ...f, batchProgress: { total: toSave.length, done: 0 } }
            : f,
        ),
      );

      for (let i = 0; i < toSave.length; i++) {
        const obs = toSave[i];

        setFiles((prev) =>
          prev.map((f) =>
            f.rawFile.id === rawFileId
              ? {
                  ...f,
                  observations: f.observations.map((o) =>
                    o.clientId === obs.clientId ? { ...o, status: "saving" as const } : o,
                  ),
                }
              : f,
          ),
        );

        try {
          const res = await fetch("/api/observations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: buildSavedText(obs),
              modelLayer: obs.modelLayer,
              primaryValueAxis: obs.primaryValueAxis || null,
              provenance: obs.provenance,
              confidence: obs.confidence,
              tagIds: obs.tagIds,
              sourceType: entry.rawFile.fileType,
              sourceTitle: entry.rawFile.fileName,
            }),
          });

          const newStatus = res.ok ? ("saved" as const) : ("error" as const);
          setFiles((prev) =>
            prev.map((f) =>
              f.rawFile.id === rawFileId
                ? {
                    ...f,
                    observations: f.observations.map((o) =>
                      o.clientId === obs.clientId
                        ? { ...o, status: newStatus, error: res.ok ? undefined : "保存失敗" }
                        : o,
                    ),
                    batchProgress: { total: toSave.length, done: i + 1 },
                  }
                : f,
            ),
          );
        } catch {
          setFiles((prev) =>
            prev.map((f) =>
              f.rawFile.id === rawFileId
                ? {
                    ...f,
                    observations: f.observations.map((o) =>
                      o.clientId === obs.clientId
                        ? { ...o, status: "error" as const, error: "通信エラー" }
                        : o,
                    ),
                    batchProgress: { total: toSave.length, done: i + 1 },
                  }
                : f,
            ),
          );
        }
      }

      setFiles((prev) =>
        prev.map((f) => (f.rawFile.id === rawFileId ? { ...f, batchProgress: null } : f)),
      );
    },
    [files],
  );

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <Card
        className={`shadow-sm border-2 border-dashed transition-colors cursor-pointer ${
          dragOver ? "border-blue-400 bg-blue-50/50" : "border-zinc-200 hover:border-zinc-300"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="py-12 flex flex-col items-center gap-3">
          <div className="text-4xl">📁</div>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-700">
              ファイルをドラッグ＆ドロップ、またはクリックして選択
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              PDF, Word, テキスト, CSV, 動画(MP4/MOV), 画像(PNG/JPG) — 最大100MB
            </p>
            <p className="text-[11px] text-blue-500 mt-2">
              ★ PDF/Word/テキストは抽出後にAIが複数の観測データへ自動分割します
            </p>
          </div>
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <span className="inline-block w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              アップロード中...
            </div>
          )}
        </CardContent>
      </Card>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.csv,.mp4,.mov,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {/* Uploaded files */}
      {files.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            アップロードファイル ({files.length})
          </p>
          {files.map((entry) => {
            const { rawFile, splitting, splitError, observations, batchProgress } = entry;
            const activeObs = observations.filter((o) => !o.deleted);
            const pendingCount = activeObs.filter((o) => o.status === "pending").length;
            const savedCount = activeObs.filter((o) => o.status === "saved").length;

            return (
              <Card key={rawFile.id} className="shadow-sm">
                <CardContent className="py-4 space-y-3">
                  {/* ファイル情報ヘッダー */}
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{FILE_TYPE_ICONS[rawFile.fileType] || "📎"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{rawFile.fileName}</p>
                        <span className="text-xs text-zinc-400">
                          {formatFileSize(rawFile.fileSize)}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${STATUS_LABELS[rawFile.status]?.color || ""}`}
                        >
                          {rawFile.status === "extracting" && (
                            <span className="inline-block w-3 h-3 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin mr-1" />
                          )}
                          {STATUS_LABELS[rawFile.status]?.label || rawFile.status}
                        </Badge>
                        {rawFile.extractedText && (
                          <span className="text-[10px] text-zinc-400">
                            {rawFile.extractedText.length.toLocaleString()} 文字
                          </span>
                        )}
                      </div>

                      {rawFile.extractedText && (
                        <details className="mt-1">
                          <summary className="text-[11px] text-zinc-400 cursor-pointer hover:text-zinc-600">
                            抽出テキストをプレビュー
                          </summary>
                          <div className="mt-1 p-2 bg-zinc-50 rounded text-xs text-zinc-600 max-h-40 overflow-y-auto whitespace-pre-wrap">
                            {rawFile.extractedText.slice(0, 2000)}
                            {rawFile.extractedText.length > 2000 && "…"}
                          </div>
                        </details>
                      )}

                      {rawFile.errorMessage && (
                        <p className="mt-1 text-xs text-red-500">{rawFile.errorMessage}</p>
                      )}
                    </div>
                  </div>

                  {/* 分割抽出中 */}
                  {splitting && (
                    <div className="flex items-center gap-2 text-xs text-violet-600 px-2 py-1.5 bg-violet-50 rounded">
                      <span className="inline-block w-3.5 h-3.5 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                      AIが観測データに分割抽出中...（最大60秒）
                    </div>
                  )}

                  {splitError && (
                    <div className="text-xs text-red-600 px-2 py-1.5 bg-red-50 rounded">
                      分割抽出エラー: {splitError}
                    </div>
                  )}

                  {/* 抽出された観測データ */}
                  {activeObs.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-zinc-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-zinc-700">
                            {activeObs.length}件の観測データを抽出
                          </span>
                          {savedCount > 0 && (
                            <span className="text-xs text-emerald-600">
                              {savedCount}件保存済
                            </span>
                          )}
                          {batchProgress && (
                            <span className="text-xs text-zinc-500 flex items-center gap-1">
                              <span className="inline-block w-3 h-3 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                              {batchProgress.done}/{batchProgress.total}
                            </span>
                          )}
                        </div>
                        {pendingCount > 0 && (
                          <Button
                            size="sm"
                            onClick={() => saveAllObservations(rawFile.id)}
                            disabled={!!batchProgress}
                            className="text-xs h-7"
                          >
                            全て保存 ({pendingCount}件)
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {activeObs.map((obs, idx) => (
                          <div
                            key={obs.clientId}
                            className={`border rounded-lg px-3 py-2 transition-colors ${
                              obs.status === "saved"
                                ? "border-emerald-200 bg-emerald-50/30"
                                : obs.status === "error"
                                  ? "border-red-200 bg-red-50/30"
                                  : obs.status === "saving"
                                    ? "border-zinc-300 opacity-70"
                                    : "border-zinc-200 bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-zinc-400 font-mono w-4">
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
                                      VALUE_AXIS_LABELS[obs.primaryValueAxis]?.color ||
                                      "bg-zinc-100"
                                    }`}
                                  >
                                    {VALUE_AXIS_LABELS[obs.primaryValueAxis]?.label ||
                                      obs.primaryValueAxis}
                                  </span>
                                )}
                                <span className="text-[10px] text-zinc-400">
                                  {PROVENANCE_LABELS[obs.provenance] || obs.provenance}
                                </span>
                              </div>
                              <div className="shrink-0 flex items-center gap-1">
                                {obs.status === "saved" && (
                                  <span className="text-[11px] text-emerald-600">保存済</span>
                                )}
                                {obs.status === "error" && (
                                  <span className="text-[11px] text-red-600">{obs.error}</span>
                                )}
                                {obs.status === "saving" && (
                                  <span className="inline-block w-3 h-3 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                                )}
                                {obs.status === "pending" && (
                                  <button
                                    onClick={() => handleDeleteObs(rawFile.id, obs.clientId)}
                                    className="p-0.5 text-zinc-400 hover:text-red-500"
                                    title="削除"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* 事象 */}
                            {obs.event && (
                              <div className="mt-1">
                                <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded mr-1.5">
                                  事象
                                </span>
                                {obs.status === "pending" ? (
                                  <textarea
                                    value={obs.event}
                                    onChange={(e) =>
                                      setFiles((prev) =>
                                        prev.map((f) =>
                                          f.rawFile.id === rawFile.id
                                            ? {
                                                ...f,
                                                observations: f.observations.map((o) =>
                                                  o.clientId === obs.clientId
                                                    ? { ...o, event: e.target.value }
                                                    : o,
                                                ),
                                              }
                                            : f,
                                        ),
                                      )
                                    }
                                    rows={2}
                                    className="w-full mt-1 text-xs text-zinc-700 bg-transparent border border-zinc-100 rounded px-2 py-1 focus:outline-none focus:border-zinc-300 resize-y"
                                  />
                                ) : (
                                  <span className="text-xs text-zinc-700">{obs.event}</span>
                                )}
                              </div>
                            )}

                            {/* 帰結 */}
                            {obs.outcome && (
                              <div className="mt-1.5">
                                <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mr-1.5">
                                  帰結
                                </span>
                                {obs.status === "pending" ? (
                                  <textarea
                                    value={obs.outcome}
                                    onChange={(e) =>
                                      setFiles((prev) =>
                                        prev.map((f) =>
                                          f.rawFile.id === rawFile.id
                                            ? {
                                                ...f,
                                                observations: f.observations.map((o) =>
                                                  o.clientId === obs.clientId
                                                    ? { ...o, outcome: e.target.value }
                                                    : o,
                                                ),
                                              }
                                            : f,
                                        ),
                                      )
                                    }
                                    rows={2}
                                    className="w-full mt-1 text-xs text-zinc-700 bg-transparent border border-zinc-100 rounded px-2 py-1 focus:outline-none focus:border-zinc-300 resize-y"
                                  />
                                ) : (
                                  <span className="text-xs text-zinc-700">{obs.outcome}</span>
                                )}
                              </div>
                            )}

                            {/* KPI影響 */}
                            {obs.kpiImpacts.length > 0 && (
                              <div className="mt-1.5">
                                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded mr-1.5">
                                  KPI影響
                                </span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {obs.kpiImpacts.map((k, ki) => (
                                    <span
                                      key={ki}
                                      className={`text-[10px] px-1.5 py-0.5 rounded border ${DIRECTION_COLOR[k.direction] || ""}`}
                                      title={k.note}
                                    >
                                      {k.metric} {DIRECTION_SYMBOL[k.direction] || ""}{" "}
                                      {k.magnitude}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* event/outcome が空のフォールバック: text を表示 */}
                            {!obs.event && !obs.outcome && (
                              obs.status === "pending" ? (
                                <textarea
                                  value={obs.text}
                                  onChange={(e) =>
                                    handleEditObs(rawFile.id, obs.clientId, e.target.value)
                                  }
                                  rows={2}
                                  className="w-full text-xs text-zinc-700 bg-transparent border border-zinc-100 rounded px-2 py-1 focus:outline-none focus:border-zinc-300 resize-y"
                                />
                              ) : (
                                <p className="text-xs text-zinc-700">{obs.text}</p>
                              )
                            )}

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

                            {obs.reasoning && (
                              <p className="text-[10px] text-violet-500 mt-1.5">{obs.reasoning}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 動画・画像: 分割抽出は不可能なので従来通り単発保存のみ */}
                  {["MP4", "MOV", "PNG", "JPG"].includes(rawFile.fileType) &&
                    rawFile.status === "extracted" &&
                    activeObs.length === 0 &&
                    !splitting && (
                      <p className="text-xs text-zinc-400">
                        動画・画像はテキスト抽出対象外のため、別途手入力してください
                      </p>
                    )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Guide */}
      <Card className="shadow-sm bg-zinc-950 text-white">
        <CardContent className="pt-5 pb-5 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            ファイル取り込みガイド
          </p>
          <div className="space-y-2 text-[12px] leading-relaxed">
            <div className="flex gap-2">
              <span className="shrink-0">📄</span>
              <div>
                <p className="font-medium">報告書 (PDF/Word)</p>
                <p className="text-zinc-400">
                  テキスト抽出 → AIが複数観測に自動分割 → 個別に確認・編集 → 一括保存
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0">📃</span>
              <div>
                <p className="font-medium">日報 (TXT/CSV)</p>
                <p className="text-zinc-400">
                  テキスト読み込み → AIが複数観測に自動分割 → 一括保存
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0">🎥</span>
              <div>
                <p className="font-medium">動画 (MP4/MOV)</p>
                <p className="text-zinc-400">ファイル保存 → 将来的にフレーム解析対応予定</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
