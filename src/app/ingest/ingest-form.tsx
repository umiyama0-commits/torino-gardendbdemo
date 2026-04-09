"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const MODEL_LAYERS = [
  { value: "MOVEMENT", label: "動線" },
  { value: "APPROACH", label: "接点" },
  { value: "BREAKDOWN", label: "離脱" },
  { value: "TRANSFER", label: "伝承" },
];

const VALUE_AXES = [
  { value: "REVENUE_UP", label: "売上向上" },
  { value: "COST_DOWN", label: "コスト削減" },
  { value: "RETENTION", label: "継続率向上" },
];

const PROVENANCES = [
  { value: "FIELD_OBSERVED", label: "①固有知（実観測）" },
  { value: "ANONYMIZED_DERIVED", label: "②汎用知（匿名化）" },
  { value: "PUBLIC_CODIFIED", label: "③公知（形式知）" },
];

const CONFIDENCES = [
  { value: "HIGH", label: "高" },
  { value: "MEDIUM", label: "中" },
  { value: "LOW", label: "低" },
];

const TAG_TYPE_CONFIG: Record<string, { label: string; bg: string; selectedBg: string }> = {
  BEHAVIOR: { label: "行動タグ", bg: "bg-blue-50/50 border border-blue-100", selectedBg: "bg-blue-600 hover:bg-blue-700 text-white" },
  CONTEXT: { label: "文脈タグ", bg: "bg-green-50/50 border border-green-100", selectedBg: "bg-green-600 hover:bg-green-700 text-white" },
  SPACE: { label: "空間タグ", bg: "bg-amber-50/50 border border-amber-100", selectedBg: "bg-amber-600 hover:bg-amber-700 text-white" },
  THEORY: { label: "理論タグ", bg: "bg-purple-50/50 border border-purple-100", selectedBg: "bg-purple-600 hover:bg-purple-700 text-white" },
};

type SuggestResponse = {
  modelLayer: string;
  primaryValueAxis: string | null;
  provenance: string;
  confidence: string;
  tagIds: string[];
  tagCodes: string[];
  reasoning: string;
  error?: string;
};

export function IngestForm({ tagsByType }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [modelLayer, setModelLayer] = useState("");
  const [valueAxis, setValueAxis] = useState("");
  const [provenance, setProvenance] = useState("");
  const [confidence, setConfidence] = useState("MEDIUM");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [suggesting, setSuggesting] = useState(false);
  const [reasoning, setReasoning] = useState("");
  const [suggestError, setSuggestError] = useState("");

  const handleSuggest = async () => {
    if (!text.trim()) return;
    setSuggesting(true);
    setReasoning("");
    setSuggestError("");

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const data: SuggestResponse = await res.json();

      if (!res.ok || data.error) {
        setSuggestError(data.error || "推定に失敗しました");
        return;
      }

      // Apply suggestions
      if (data.modelLayer) setModelLayer(data.modelLayer);
      if (data.primaryValueAxis) setValueAxis(data.primaryValueAxis);
      if (data.provenance) setProvenance(data.provenance);
      if (data.confidence) setConfidence(data.confidence);
      if (data.tagIds?.length) {
        setSelectedTags(new Set(data.tagIds));
      }
      if (data.reasoning) setReasoning(data.reasoning);
    } catch {
      setSuggestError("APIに接続できませんでした");
    } finally {
      setSuggesting(false);
    }
  };

  const toggleTag = (id: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!text.trim() || !modelLayer || !provenance) return;
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          modelLayer,
          primaryValueAxis: valueAxis || null,
          provenance,
          confidence,
          tagIds: Array.from(selectedTags),
        }),
      });

      if (res.ok) {
        setSaved(true);
        setSavedCount((c) => c + 1);
        setText("");
        setModelLayer("");
        setValueAxis("");
        setProvenance("");
        setConfidence("MEDIUM");
        setSelectedTags(new Set());
        setReasoning("");

        if (memo.trim()) {
          await fetch("/api/observations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `[メモ] ${memo.trim()}`,
              modelLayer: modelLayer || "MOVEMENT",
              provenance: "FIELD_OBSERVED",
              confidence: "LOW",
              tagIds: [],
            }),
          });
          setMemo("");
        }

        // 3秒後に成功メッセージを消す + テキストエリアにフォーカス
        setTimeout(() => setSaved(false), 3000);
        textareaRef.current?.focus();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Main form — 2/3 width */}
      <div className="lg:col-span-2 space-y-5">
        <Card className="shadow-sm">
          <CardContent className="pt-6 space-y-5">
            {/* Text input + AI suggest */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  観測テキスト *
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSuggest}
                  disabled={suggesting || !text.trim()}
                  className="text-xs gap-1.5 h-7"
                >
                  {suggesting ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                      推定中...
                    </>
                  ) : (
                    <>
                      <span className="text-base leading-none">&#9733;</span>
                      AI自動推定
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                ref={textareaRef}
                placeholder="例: 入店後3秒以内の声掛けで接客発生率が2.1倍に向上"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (reasoning) setReasoning("");
                  if (suggestError) setSuggestError("");
                }}
                rows={3}
                className="mt-2 bg-white"
              />
              {reasoning && (
                <div className="mt-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-md">
                  <p className="text-xs text-violet-700">
                    <span className="font-medium">AI判定: </span>
                    {reasoning}
                  </p>
                </div>
              )}
              {suggestError && (
                <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-xs text-red-700">{suggestError}</p>
                </div>
              )}
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  モデル層 *
                </Label>
                <Select value={modelLayer} onValueChange={(v) => setModelLayer(v ?? "")}>
                  <SelectTrigger className="mt-2 bg-white">
                    <SelectValue placeholder="選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_LAYERS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  価値軸
                </Label>
                <Select value={valueAxis} onValueChange={(v) => setValueAxis(v ?? "")}>
                  <SelectTrigger className="mt-2 bg-white">
                    <SelectValue placeholder="選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {VALUE_AXES.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  プロベナンス *
                </Label>
                <Select value={provenance} onValueChange={(v) => setProvenance(v ?? "")}>
                  <SelectTrigger className="mt-2 bg-white">
                    <SelectValue placeholder="選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVENANCES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  信頼度
                </Label>
                <Select value={confidence} onValueChange={(v) => setConfidence(v ?? "MEDIUM")}>
                  <SelectTrigger className="mt-2 bg-white">
                    <SelectValue placeholder="選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIDENCES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tags */}
            {Object.entries(tagsByType).map(([type, tags]) => {
              const config = TAG_TYPE_CONFIG[type];
              return (
                <div key={type}>
                  <Label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 block">
                    {config.label}
                  </Label>
                  <div className={`flex flex-wrap gap-1.5 p-3 rounded-lg ${config.bg}`}>
                    {tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant={selectedTags.has(tag.id) ? "default" : "outline"}
                        className={`cursor-pointer text-[11px] transition-all ${
                          selectedTags.has(tag.id)
                            ? config.selectedBg
                            : "bg-white hover:bg-zinc-50"
                        }`}
                        onClick={() => toggleTag(tag.id)}
                      >
                        {tag.displayNameJa}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Submit */}
            <div className="flex gap-3 items-center pt-2">
              <Button
                onClick={handleSubmit}
                disabled={saving || !text.trim() || !modelLayer || !provenance}
                className="px-6"
              >
                {saving ? "保存中..." : "保存して次へ"}
              </Button>
              {saved && (
                <span className="text-sm text-emerald-600 font-medium animate-pulse">
                  保存しました
                </span>
              )}
              {savedCount > 0 && !saved && (
                <span className="text-xs text-zinc-400">
                  このセッション: {savedCount}件保存済み
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar — 1/3 width */}
      <div className="space-y-5">
        {/* Quick memo */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              観測メモ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="報告書に載せなかった気付き..."
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              className="bg-white"
            />
            <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
              上記の保存時に「低」信頼度の観測データとして自動登録されます
            </p>
          </CardContent>
        </Card>

        {/* Selection summary */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              選択中のタグ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedTags.size === 0 ? (
              <p className="text-xs text-zinc-400">タグが選択されていません</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selectedTags).map((id) => {
                  const tag = Object.values(tagsByType)
                    .flat()
                    .find((t) => t.id === id);
                  if (!tag) return null;
                  return (
                    <Badge
                      key={id}
                      className="text-[11px] cursor-pointer hover:line-through"
                      onClick={() => toggleTag(id)}
                    >
                      {tag.displayNameJa}
                    </Badge>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Provenance guide */}
        <Card className="shadow-sm bg-zinc-950 text-white">
          <CardContent className="pt-5 pb-5 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              プロベナンスガイド
            </p>
            <div className="space-y-2.5 text-[12px] leading-relaxed">
              <div className="flex gap-2">
                <span className="w-2 h-2 mt-1.5 rounded-full bg-zinc-400 shrink-0" />
                <div>
                  <p className="font-medium">①固有知</p>
                  <p className="text-zinc-400">特定クライアントの実観測データ</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 shrink-0" />
                <div>
                  <p className="font-medium">②汎用知</p>
                  <p className="text-zinc-400">匿名化・業種横断で抽出した知見</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="w-2 h-2 mt-1.5 rounded-full bg-zinc-600 shrink-0" />
                <div>
                  <p className="font-medium">③公知</p>
                  <p className="text-zinc-400">学術論文・公開調査に基づく形式知</p>
                </div>
              </div>
            </div>
            <div className="border-t border-zinc-800 pt-3 mt-3">
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                同じテーマが複数層で確認されるほど信頼度が高まります
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
