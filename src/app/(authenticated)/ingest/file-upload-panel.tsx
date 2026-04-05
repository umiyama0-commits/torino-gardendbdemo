"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ExtractionReview } from "@/components/extraction-review";

type UploadedFile = {
  id: string; category: string; originalName: string; storedPath: string;
  mimeType: string; fileSize: number; status: string;
  note: string | null; createdAt: string | Date;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  uploaded: { label: "アップロード済 / Uploaded", color: "#2563eb" },
  processing: { label: "処理中 / Processing", color: "#d97706" },
  extracted: { label: "抽出済 / Extracted", color: "#16a34a" },
  error: { label: "エラー / Error", color: "#dc2626" },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

type ClientOption = { id: string; name: string; industryMajor: string };
type ProjectOption = { id: string; name: string; clientId: string };

export function FileUploadPanel({
  category, titleJa, titleEn, descJa, descEn, accept, recentFiles, isVideo,
  clients = [], projects = [],
}: {
  category: string; titleJa: string; titleEn: string;
  descJa: string; descEn: string; accept: string;
  recentFiles: UploadedFile[]; isVideo?: boolean;
  clients?: ClientOption[]; projects?: ProjectOption[];
}) {
  const [files, setFiles] = useState<UploadedFile[]>(recentFiles);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [note, setNote] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [extractingFileId, setExtractingFileId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setUploadResult(null);

    let successCount = 0;
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      if (note) formData.append("note", note);
      if (projectId) formData.append("projectId", projectId);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const uploaded = await res.json();
        setFiles((prev) => [uploaded, ...prev]);
        successCount++;
      }
    }

    setUploading(false);
    setNote("");
    if (inputRef.current) inputRef.current.value = "";
    setUploadResult(`${successCount}/${fileList.length}件アップロード完了`);
    setTimeout(() => setUploadResult(null), 4000);
  }, [category, note, projectId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {/* Upload zone */}
        <Card className="border border-zinc-200 shadow-md">
          <CardHeader>
            <CardTitle className="text-base">
              {titleJa} <span className="text-zinc-400 font-normal text-sm">/ {titleEn}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-500 leading-relaxed">{descJa}</p>
            <p className="text-xs text-zinc-400 leading-relaxed">{descEn}</p>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`relative cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all duration-200 ${
                dragOver
                  ? "border-blue-400 bg-blue-50"
                  : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                multiple
                onChange={(e) => handleUpload(e.target.files)}
                className="hidden"
              />
              <div className="space-y-3">
                <div className="text-4xl">
                  {isVideo ? "🎬" : "📁"}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-700">
                    ドラッグ＆ドロップ、またはクリックして選択
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Drag & drop files here, or click to browse
                  </p>
                </div>
                <p className="text-[10px] text-zinc-400">
                  対応形式: {accept.replace(/\./g, "").replace(/,/g, ", ").toUpperCase()}
                  {isVideo && " (最大500MB)"}
                </p>
              </div>
            </div>

            {/* Client / Project selector */}
            {clients.length > 0 && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-3.5 text-zinc-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
                  </svg>
                  <span className="text-[11px] font-semibold text-zinc-600">紐付け先</span>
                  <span className="text-[10px] text-zinc-400">（クライアント・PJ）</span>
                </div>
                <div className="flex gap-2">
                  <select value={clientId} onChange={e => { setClientId(e.target.value); setProjectId(""); }}
                    className="flex-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px] bg-white">
                    <option value="">クライアント選択...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.industryMajor})</option>
                    ))}
                  </select>
                  {clientId && (
                    <select value={projectId} onChange={e => setProjectId(e.target.value)}
                      className="flex-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px] bg-white">
                      <option value="">PJ選択...</option>
                      {projects.filter(p => p.clientId === clientId).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {/* Note */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
                メモ / Note <span className="text-zinc-300 font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="ファイルに関するメモ..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Upload status */}
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <span className="animate-spin">◌</span>
                アップロード中... / Uploading...
              </div>
            )}
            {uploadResult && (
              <div className="text-sm text-emerald-600 font-medium animate-in fade-in">
                {uploadResult}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent uploads sidebar */}
      <div className="space-y-6">
        <Card className="border border-zinc-200 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              アップロード履歴 <span className="text-zinc-400 font-normal text-xs">/ Recent Uploads</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {files.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center">まだファイルがありません / No files yet</p>
            ) : (
              <div className="space-y-2">
                {files.map((f) => {
                  const statusCfg = STATUS_CONFIG[f.status] || STATUS_CONFIG.uploaded;
                  return (
                    <div key={f.id} className="rounded-lg border p-3 space-y-1.5 hover:bg-zinc-50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm shrink-0">
                            {f.mimeType.startsWith("video/") ? "🎬" :
                             f.mimeType.includes("pdf") ? "📕" :
                             f.mimeType.includes("word") || f.mimeType.includes("document") ? "📘" :
                             f.mimeType.includes("sheet") || f.mimeType.includes("excel") ? "📗" : "📄"}
                          </span>
                          <span className="text-xs font-medium truncate">{f.originalName}</span>
                        </div>
                        <Badge
                          className="text-white border-0 text-[9px] shrink-0"
                          style={{ backgroundColor: statusCfg.color }}
                        >
                          {statusCfg.label.split(" / ")[0]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                        <span>{formatFileSize(f.fileSize)}</span>
                        <span className="text-zinc-200">|</span>
                        <span>{new Date(f.createdAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      {f.note && <p className="text-[10px] text-zinc-500 leading-relaxed">{f.note}</p>}
                      {f.status === "uploaded" && extractingFileId !== f.id && (
                        <button
                          type="button"
                          onClick={() => setExtractingFileId(f.id)}
                          className="mt-1 rounded-md px-2 py-1 text-[10px] font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors flex items-center gap-1"
                        >
                          <span className="text-xs">&#x2728;</span>
                          AI抽出 / Extract
                        </button>
                      )}
                      {extractingFileId === f.id && (
                        <ExtractionReview
                          fileId={f.id}
                          onComplete={() => {
                            setExtractingFileId(null);
                            setFiles((prev) =>
                              prev.map((file) =>
                                file.id === f.id
                                  ? { ...file, status: "extracted" }
                                  : file
                              )
                            );
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info card */}
        <Card className="border border-zinc-200 shadow-md bg-zinc-900 text-white">
          <CardContent className="pt-5 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Processing Pipeline</div>
            <div className="space-y-2 text-xs text-zinc-300 leading-relaxed">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold">1</span>
                <span>ファイルアップロード / Upload</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold">2</span>
                <span>LLM テキスト抽出 / Extract</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[9px] font-bold text-zinc-400">3</span>
                <span className="text-zinc-500">Observation 自動生成 / Auto-generate <span className="text-zinc-600">(coming soon)</span></span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
