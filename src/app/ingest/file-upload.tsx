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

type SuggestionResult = {
  modelLayer: string;
  primaryValueAxis: string | null;
  provenance: string;
  confidence: string;
  tagCodes: string[];
  tagIds?: string[];
  reasoning: string;
};

type UploadedFile = {
  rawFile: RawFile;
  suggestion: SuggestionResult | null;
  saving: boolean;
  saved: boolean;
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
    // クライアント→Blob直接アップロード（Vercelの4.5MBボディ上限を回避）
    const blob = await upload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/upload",
      contentType: file.type,
    });

    // アップロード完了後、メタデータをDBへ登録
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

  const extractAndSuggest = useCallback(async (fileId: string) => {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    });
    if (!res.ok) throw new Error("テキスト抽出失敗");
    return res.json() as Promise<{ file: RawFile; suggestion: SuggestionResult | null }>;
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setUploading(true);
      const newFiles: UploadedFile[] = [];

      for (const file of Array.from(fileList)) {
        try {
          const rawFile = await uploadFile(file);
          const entry: UploadedFile = {
            rawFile,
            suggestion: null,
            saving: false,
            saved: false,
          };
          newFiles.push(entry);
          setFiles((prev) => [...prev, entry]);

          // Auto-extract text
          try {
            const result = await extractAndSuggest(rawFile.id);
            setFiles((prev) =>
              prev.map((f) =>
                f.rawFile.id === rawFile.id
                  ? { ...f, rawFile: result.file, suggestion: result.suggestion }
                  : f
              )
            );
          } catch {
            setFiles((prev) =>
              prev.map((f) =>
                f.rawFile.id === rawFile.id
                  ? {
                      ...f,
                      rawFile: { ...f.rawFile, status: "error", errorMessage: "テキスト抽出失敗" },
                    }
                  : f
              )
            );
          }
        } catch (err) {
          console.error("Upload failed:", file.name, err);
        }
      }

      setUploading(false);
    },
    [uploadFile, extractAndSuggest]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const saveAsObservation = useCallback(
    async (fileId: string) => {
      setFiles((prev) =>
        prev.map((f) => (f.rawFile.id === fileId ? { ...f, saving: true } : f))
      );

      const entry = files.find((f) => f.rawFile.id === fileId);
      if (!entry) return;

      const text = entry.rawFile.extractedText || `[${entry.rawFile.fileType}] ${entry.rawFile.fileName}`;
      const s = entry.suggestion;

      try {
        const res = await fetch("/api/observations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.slice(0, 5000),
            modelLayer: s?.modelLayer || "MOVEMENT",
            provenance: s?.provenance || "FIELD_OBSERVED",
            primaryValueAxis: s?.primaryValueAxis || null,
            confidence: s?.confidence || "MEDIUM",
            tagIds: s?.tagIds || [],
            sourceType: entry.rawFile.fileType,
            sourceTitle: entry.rawFile.fileName,
          }),
        });

        if (res.ok) {
          setFiles((prev) =>
            prev.map((f) =>
              f.rawFile.id === fileId ? { ...f, saving: false, saved: true } : f
            )
          );
        }
      } catch {
        setFiles((prev) =>
          prev.map((f) => (f.rawFile.id === fileId ? { ...f, saving: false } : f))
        );
      }
    },
    [files]
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
        <div className="space-y-3">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            アップロードファイル ({files.length})
          </p>
          {files.map(({ rawFile, suggestion, saving, saved }) => (
            <Card key={rawFile.id} className="shadow-sm">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{FILE_TYPE_ICONS[rawFile.fileType] || "📎"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{rawFile.fileName}</p>
                      <span className="text-xs text-zinc-400">{formatFileSize(rawFile.fileSize)}</span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${STATUS_LABELS[rawFile.status]?.color || ""}`}
                      >
                        {rawFile.status === "extracting" && (
                          <span className="inline-block w-3 h-3 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin mr-1" />
                        )}
                        {STATUS_LABELS[rawFile.status]?.label || rawFile.status}
                      </Badge>
                    </div>

                    {/* Extracted text preview */}
                    {rawFile.extractedText && (
                      <div className="mt-2 p-2 bg-zinc-50 rounded text-xs text-zinc-600 max-h-24 overflow-y-auto whitespace-pre-wrap">
                        {rawFile.extractedText.slice(0, 500)}
                        {rawFile.extractedText.length > 500 && "..."}
                      </div>
                    )}

                    {/* Error */}
                    {rawFile.errorMessage && (
                      <p className="mt-1 text-xs text-red-500">{rawFile.errorMessage}</p>
                    )}

                    {/* AI suggestion */}
                    {suggestion && (
                      <div className="mt-2 p-2 bg-violet-50 border border-violet-200 rounded">
                        <p className="text-[11px] text-violet-700 mb-1">
                          <span className="font-medium">AI推定: </span>
                          {suggestion.reasoning}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {suggestion.modelLayer}
                          </Badge>
                          {suggestion.primaryValueAxis && (
                            <Badge variant="outline" className="text-[10px]">
                              {suggestion.primaryValueAxis}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {suggestion.provenance}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Save button */}
                  <div className="shrink-0">
                    {saved ? (
                      <span className="text-xs text-emerald-600 font-medium">登録済み ✓</span>
                    ) : rawFile.status === "extracted" ? (
                      <Button
                        size="sm"
                        onClick={() => saveAsObservation(rawFile.id)}
                        disabled={saving}
                        className="text-xs h-7"
                      >
                        {saving ? "保存中..." : "観測として登録"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
                <p className="text-zinc-400">テキスト自動抽出 → AI構造化 → 観測として登録</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0">📃</span>
              <div>
                <p className="font-medium">日報 (TXT/CSV)</p>
                <p className="text-zinc-400">テキスト読み込み → AI構造化 → 観測として登録</p>
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
