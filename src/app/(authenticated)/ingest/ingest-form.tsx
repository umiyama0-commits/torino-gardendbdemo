"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MODEL_LAYER_CONFIG, VALUE_AXIS_CONFIG, PROVENANCE_CONFIG, THEORY_TAG_COLOR } from "@/lib/constants";

type Tag = {
  id: string; type: string; code: string;
  displayNameJa: string; displayNameEn: string | null;
  modelLayer: string | null; category: string | null;
};

type ClientOption = { id: string; name: string; industryMajor: string };
type ProjectOption = { id: string; name: string; clientId: string };

const STEPS = [
  { id: 1, label: "観測内容", icon: "1" },
  { id: 2, label: "分類", icon: "2" },
  { id: 3, label: "タグ・効果", icon: "3" },
];

const LAYER_HELP: Record<string, string> = {
  MOVEMENT: "お客さまの歩き方・動線・滞在に関する発見",
  APPROACH: "声掛け・接客・提案など、お客さまとの関わり方",
  BREAKDOWN: "離脱・混乱・待ち時間など、マイナスの事象",
  TRANSFER: "ノウハウの共有・教育・マニュアル化に関すること",
};

const AXIS_HELP: Record<string, string> = {
  REVENUE_UP: "売上や購買率の向上につながる",
  COST_DOWN: "コスト削減・業務効率化につながる",
  RETENTION: "スタッフの定着や離職防止につながる",
  CSAT_UP: "顧客満足度やリピート率の向上につながる",
};

export function IngestForm({ tags, clients = [], projects = [] }: {
  tags: Tag[];
  clients?: ClientOption[];
  projects?: ProjectOption[];
}) {
  const [step, setStep] = useState(1);
  const [text, setText] = useState("");
  const [textEn, setTextEn] = useState("");
  const [modelLayer, setModelLayer] = useState("");
  const [valueAxis, setValueAxis] = useState("");
  const [provenance, setProvenance] = useState("FIELD_OBSERVED");
  const [confidence, setConfidence] = useState("MEDIUM");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [impactMin, setImpactMin] = useState("");
  const [impactMax, setImpactMax] = useState("");
  const [impactKPI, setImpactKPI] = useState("売上");
  const [observedAt, setObservedAt] = useState(new Date().toISOString().slice(0, 10));
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedStats, setSavedStats] = useState<{ totalAll: number; myTotal: number; myToday: number; streak: number } | null>(null);
  const [showTagSearch, setShowTagSearch] = useState("");
  const [similarObs, setSimilarObs] = useState<SimilarObservation[]>([]);

  type SimilarObservation = {
    id: string; text: string; modelLayer: string;
    primaryValueAxis: string | null; provenance: string;
    sedimentStatus: string; createdAt: string;
    sharedKeywords: string[]; score: number;
    anonymizedSource: string | null;
  };

  const behaviorTags = tags.filter((t) => t.type === "BEHAVIOR");
  const contextTags = tags.filter((t) => t.type === "CONTEXT");
  const spaceTags = tags.filter((t) => t.type === "SPACE");
  const theoryTags = tags.filter((t) => t.type === "THEORY");

  const toggleTag = (id: string) => {
    setSelectedTags((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  const canNext = () => {
    if (step === 1) return text.length > 0;
    if (step === 2) return !!modelLayer;
    return true;
  };

  const handleSubmit = async () => {
    if (!text || !modelLayer) return;
    setSaving(true);
    setSaved(false);
    setSavedStats(null);
    setSimilarObs([]);

    const submittedText = text;
    const submittedLayer = modelLayer;
    const submittedProjectId = projectId;

    await fetch("/api/observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text, textEn: textEn || null, modelLayer,
        primaryValueAxis: valueAxis || null,
        provenance, confidence, tagIds: selectedTags,
        estimatedImpactMin: impactMin ? parseFloat(impactMin) : null,
        estimatedImpactMax: impactMax ? parseFloat(impactMax) : null,
        impactKPI: impactKPI || null,
        observedAt: observedAt || null,
        projectId: projectId || null,
      }),
    });

    // Fetch stats + similar observations in parallel (再発見トリガー)
    try {
      const [statsRes, similarRes] = await Promise.all([
        fetch("/api/ingest-stats"),
        fetch(`/api/observations/similar?text=${encodeURIComponent(submittedText)}&modelLayer=${encodeURIComponent(submittedLayer)}${submittedProjectId ? `&excludeProjectId=${submittedProjectId}` : ""}`),
      ]);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setSavedStats({
          totalAll: statsData.totalAll,
          myTotal: statsData.myTotal,
          myToday: statsData.myToday,
          streak: statsData.streak,
        });
      }
      if (similarRes.ok) {
        const similarData = await similarRes.json();
        if (similarData.similar?.length > 0) {
          setSimilarObs(similarData.similar);
        }
      }
    } catch { /* ignore */ }

    // Refresh the activity feed
    if (typeof window !== "undefined" && (window as Record<string, unknown>).__refreshActivityFeed) {
      ((window as Record<string, unknown>).__refreshActivityFeed as () => void)();
    }

    setText(""); setTextEn(""); setModelLayer(""); setValueAxis(""); setProvenance("FIELD_OBSERVED");
    setConfidence("MEDIUM"); setSelectedTags([]); setImpactMin(""); setImpactMax("");
    setObservedAt(new Date().toISOString().slice(0, 10)); setClientId(""); setProjectId("");
    setSaving(false);
    setSaved(true);
    setStep(1);
    setTimeout(() => { setSaved(false); setSavedStats(null); setSimilarObs([]); }, 15000);
  };

  const filteredTags = (tagList: Tag[]) => {
    if (!showTagSearch) return tagList;
    const q = showTagSearch.toLowerCase();
    return tagList.filter(t =>
      t.displayNameJa.includes(q) ||
      (t.displayNameEn && t.displayNameEn.toLowerCase().includes(q)) ||
      t.code.includes(q)
    );
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Success banner with stats */}
      {saved && (
        <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 overflow-hidden shadow-md">
          <div className="px-5 py-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-800">登録できました！</p>
              <p className="text-xs text-emerald-600 mt-0.5">ナレッジベースが成長しています。続けて次の観測を入力できます。</p>
            </div>
          </div>
          {savedStats && (
            <div className="border-t border-emerald-100 bg-white/60 px-5 py-3">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  <div>
                    <div className="text-sm font-black text-zinc-800 tabular-nums">{savedStats.totalAll}</div>
                    <div className="text-[9px] text-zinc-400 font-medium">全体の観測数</div>
                  </div>
                </div>
                <div className="h-8 w-px bg-emerald-100" />
                <div className="flex items-center gap-2">
                  <span className="text-lg">🙌</span>
                  <div>
                    <div className="text-sm font-black text-zinc-800 tabular-nums">{savedStats.myTotal}</div>
                    <div className="text-[9px] text-zinc-400 font-medium">あなたの投入数</div>
                  </div>
                </div>
                <div className="h-8 w-px bg-emerald-100" />
                <div className="flex items-center gap-2">
                  <span className="text-lg">📅</span>
                  <div>
                    <div className="text-sm font-black text-zinc-800 tabular-nums">+{savedStats.myToday}</div>
                    <div className="text-[9px] text-zinc-400 font-medium">今日の投入</div>
                  </div>
                </div>
                {savedStats.streak > 0 && (
                  <>
                    <div className="h-8 w-px bg-emerald-100" />
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔥</span>
                      <div>
                        <div className="text-sm font-black text-orange-500 tabular-nums">{savedStats.streak}日</div>
                        <div className="text-[9px] text-zinc-400 font-medium">連続記録</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* B. 再発見トリガー — 類似する過去の観測 */}
      {saved && similarObs.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 overflow-hidden shadow-md">
          <div className="px-5 py-3 flex items-center gap-3 border-b border-amber-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-white shrink-0 shadow-sm text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">
                再発見! 過去に類似の観測が {similarObs.length} 件あります
              </p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                あなたの観測が既存データと合流し、パターン化の可能性が高まりました
              </p>
            </div>
          </div>
          <div className="divide-y divide-amber-100">
            {similarObs.map((obs) => (
              <div key={obs.id} className="px-5 py-3 hover:bg-amber-50/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <div className={`h-2 w-2 rounded-full ${
                      obs.sedimentStatus === "sediment" ? "bg-zinc-400" : "bg-emerald-400"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-zinc-700 leading-relaxed line-clamp-2">{obs.text}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-medium">
                        {MODEL_LAYER_CONFIG[obs.modelLayer as keyof typeof MODEL_LAYER_CONFIG]?.labelJa || obs.modelLayer}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        一致度 {obs.score}%
                      </span>
                      {obs.anonymizedSource && (
                        <span className="text-[10px] text-zinc-400">
                          {obs.anonymizedSource}
                        </span>
                      )}
                      {obs.sedimentStatus === "sediment" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 font-medium">
                          沈殿データ復活!
                        </span>
                      )}
                    </div>
                    {obs.sharedKeywords.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {obs.sharedKeywords.slice(0, 5).map((kw) => (
                          <span key={kw} className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-2.5 bg-amber-50/80 border-t border-amber-100">
            <p className="text-[10px] text-amber-500 text-center">
              類似観測が蓄積すると、自動的に「萌芽パターン」として検出されます
            </p>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => { if (s.id < step || canNext()) setStep(s.id); }}
            className="flex items-center gap-2 group"
          >
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
              step === s.id
                ? "bg-zinc-900 text-white shadow-md"
                : step > s.id
                ? "bg-emerald-500 text-white"
                : "bg-zinc-200 text-zinc-400"
            }`}>
              {step > s.id ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : s.icon}
            </div>
            <span className={`text-sm font-medium transition-colors ${
              step === s.id ? "text-zinc-900" : "text-zinc-400"
            }`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-1 ${step > s.id ? "bg-emerald-300" : "bg-zinc-200"}`} />
            )}
          </button>
        ))}
      </div>

      {/* Step 1: Observation content */}
      {step === 1 && (
        <Card className="border border-zinc-200 shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-zinc-900 to-zinc-700 px-6 py-4">
            <h3 className="text-white font-semibold">何を発見しましたか？</h3>
            <p className="text-zinc-400 text-xs mt-0.5">現場で気づいたこと・計測結果を自由に書いてください</p>
          </div>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-2">
              <Textarea
                placeholder="例：入店後3秒以内に声を掛けると、接客につながる確率が2.1倍になった&#10;例：ゴールデンゾーン（目線〜腰）の商品が棚全体売上の65%を占めていた&#10;例：新人スタッフの離職が3ヶ月目に集中している"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="resize-none text-[15px] leading-relaxed border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400/20"
              />
              <p className="text-[11px] text-zinc-400">
                <span className="font-medium text-zinc-500">Tip:</span> 数字があると後で分析しやすくなります（「約2倍」「65%」「3ヶ月」など）
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setTextEn(textEn ? "" : " ")}
                className="text-[11px] text-zinc-400 hover:text-zinc-600 flex items-center gap-1 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d={textEn ? "M19.5 8.25l-7.5 7.5-7.5-7.5" : "M8.25 4.5l7.5 7.5-7.5 7.5"} />
                </svg>
                英語テキストも追加（任意）
              </button>
              {textEn !== "" && (
                <Textarea
                  placeholder="English translation (optional)"
                  value={textEn}
                  onChange={(e) => setTextEn(e.target.value)}
                  rows={2}
                  className="resize-none text-sm border-zinc-200"
                />
              )}
            </div>

            <div className="flex items-center gap-4 pt-2 border-t border-zinc-100">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4 text-zinc-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                <span className="text-xs text-zinc-500">観測日</span>
                <Input
                  type="date"
                  value={observedAt}
                  onChange={(e) => setObservedAt(e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">出自</span>
                <div className="flex gap-1">
                  {Object.entries(PROVENANCE_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key} type="button"
                      onClick={() => setProvenance(key)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                        provenance === key
                          ? "text-white shadow-sm"
                          : "text-zinc-500 bg-zinc-100 hover:bg-zinc-200"
                      }`}
                      style={provenance === key ? { backgroundColor: cfg.color } : {}}
                    >
                      {cfg.labelJa}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Client / Project selector for 固有知 */}
            {provenance === "FIELD_OBSERVED" && clients.length > 0 && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-3.5 text-zinc-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
                  </svg>
                  <span className="text-[11px] font-semibold text-zinc-600">固有知の紐付け先</span>
                  <span className="text-[10px] text-zinc-400">（任意）</span>
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

            {/* Anonymization notice for 汎用知 */}
            {provenance === "ANONYMIZED_DERIVED" && (
              <div className="rounded-lg bg-blue-50/50 border border-blue-100 px-3 py-2">
                <p className="text-[11px] text-blue-600">
                  <span className="font-semibold">汎用知:</span> 会社名・PJ名は自動的に匿名化されます（例：「小売A社」「小売A社PJ-1」）
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Classification */}
      {step === 2 && (
        <Card className="border border-zinc-200 shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-zinc-900 to-zinc-700 px-6 py-4">
            <h3 className="text-white font-semibold">どんな種類の発見？</h3>
            <p className="text-zinc-400 text-xs mt-0.5">一番近いものを選んでください</p>
          </div>
          <CardContent className="pt-5 space-y-6">
            {/* Preview of entered text */}
            <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-4 py-3">
              <p className="text-sm text-zinc-600 leading-relaxed line-clamp-2">{text}</p>
            </div>

            {/* Model Layer - Big friendly buttons */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-700">どの層？</span>
                <span className="text-[11px] text-red-400">*必須</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(MODEL_LAYER_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key} type="button"
                    onClick={() => setModelLayer(key)}
                    className={`rounded-xl p-4 text-left transition-all duration-200 border-2 group ${
                      modelLayer === key
                        ? "border-current shadow-md"
                        : "border-zinc-200 hover:border-zinc-300 hover:shadow-sm"
                    }`}
                    style={modelLayer === key ? { borderColor: cfg.color, backgroundColor: cfg.color + "08" } : {}}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: cfg.color }}
                      />
                      <span className="text-sm font-bold" style={modelLayer === key ? { color: cfg.color } : {}}>
                        {cfg.labelJa}
                      </span>
                      <span className="text-[11px] text-zinc-400">{cfg.label}</span>
                    </div>
                    <p className="text-[12px] text-zinc-500 leading-relaxed">
                      {LAYER_HELP[key]}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Value Axis */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-700">どんな効果が期待できる？</span>
                <span className="text-[11px] text-zinc-400">任意</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(VALUE_AXIS_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key} type="button"
                    onClick={() => setValueAxis(valueAxis === key ? "" : key)}
                    className={`rounded-lg px-4 py-3 text-left transition-all duration-200 border ${
                      valueAxis === key
                        ? "border-current shadow-sm"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                    style={valueAxis === key ? { borderColor: cfg.color, backgroundColor: cfg.color + "08" } : {}}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                      <span className="text-sm font-medium" style={valueAxis === key ? { color: cfg.color } : {}}>
                        {cfg.labelJa}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 ml-[18px]">{AXIS_HELP[key]}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence */}
            <div className="space-y-2">
              <span className="text-sm font-semibold text-zinc-700">確信度は？</span>
              <div className="flex gap-2">
                {[
                  { key: "HIGH", label: "高い", desc: "データで裏付けあり", emoji: "💎" },
                  { key: "MEDIUM", label: "中程度", desc: "繰り返し観察した", emoji: "👀" },
                  { key: "LOW", label: "まだ仮説", desc: "初めて気づいた", emoji: "💡" },
                ].map((level) => (
                  <button
                    key={level.key} type="button"
                    onClick={() => setConfidence(level.key)}
                    className={`flex-1 rounded-lg px-3 py-2.5 text-left transition-all duration-200 border ${
                      confidence === level.key
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{level.emoji}</span>
                      <span className="text-sm font-medium">{level.label}</span>
                    </div>
                    <p className={`text-[11px] mt-0.5 ${confidence === level.key ? "text-zinc-400" : "text-zinc-400"}`}>
                      {level.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Tags & Impact */}
      {step === 3 && (
        <Card className="border border-zinc-200 shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-zinc-900 to-zinc-700 px-6 py-4">
            <h3 className="text-white font-semibold">タグと効果を追加</h3>
            <p className="text-zinc-400 text-xs mt-0.5">あてはまるものをタップ（スキップもOK）</p>
          </div>
          <CardContent className="pt-5 space-y-5">
            {/* Impact - Simplified */}
            <div className="rounded-lg bg-emerald-50/50 border border-emerald-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">📊</span>
                <span className="text-sm font-semibold text-zinc-700">期待できる効果（任意）</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {["売上", "コスト削減率", "離職率", "顧客満足度"].map((k) => (
                    <button key={k} type="button" onClick={() => setImpactKPI(k)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                        impactKPI === k ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 border border-zinc-200"
                      }`}>
                      {k}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <Input type="number" placeholder="3" value={impactMin} onChange={(e) => setImpactMin(e.target.value)}
                    className="w-16 h-8 text-sm text-center" />
                  <span className="text-zinc-400 text-xs">〜</span>
                  <Input type="number" placeholder="8" value={impactMax} onChange={(e) => setImpactMax(e.target.value)}
                    className="w-16 h-8 text-sm text-center" />
                  <span className="text-xs text-zinc-400">%</span>
                </div>
              </div>
            </div>

            {/* Tag search */}
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <Input
                placeholder="タグを検索... （例：声掛け、動線、スキーマ）"
                value={showTagSearch}
                onChange={(e) => setShowTagSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Selected tags */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] text-zinc-400 mr-1 pt-1">選択中:</span>
                {selectedTags.map((id) => {
                  const tag = tags.find((t) => t.id === id);
                  if (!tag) return null;
                  return (
                    <Badge key={id} className="cursor-pointer text-white text-xs"
                      style={{ backgroundColor: tag.type === "THEORY" ? THEORY_TAG_COLOR : MODEL_LAYER_CONFIG[tag.modelLayer as keyof typeof MODEL_LAYER_CONFIG]?.color || "#71717a" }}
                      onClick={() => toggleTag(id)}>
                      {tag.displayNameJa} <span className="ml-1 opacity-70">x</span>
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Tag sections - Compact */}
            <div className="space-y-4">
              <TagSection title="行動" subtitle="何が起きた？" tags={filteredTags(behaviorTags)} selected={selectedTags} onToggle={toggleTag}
                getColor={(t) => MODEL_LAYER_CONFIG[t.modelLayer as keyof typeof MODEL_LAYER_CONFIG]?.color || "#71717a"} />
              <TagSection title="文脈" subtitle="どんな状況？" tags={filteredTags(contextTags)} selected={selectedTags} onToggle={toggleTag}
                getColor={() => "#71717a"} />
              <TagSection title="空間" subtitle="どこで？" tags={filteredTags(spaceTags)} selected={selectedTags} onToggle={toggleTag}
                getColor={() => "#52525b"} />
              <TagSection title="理論" subtitle="なぜ起きる？" tags={filteredTags(theoryTags)} selected={selectedTags} onToggle={toggleTag}
                getColor={() => THEORY_TAG_COLOR} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              もどる
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              className="gap-1.5 bg-zinc-900 hover:bg-zinc-800 px-6"
            >
              つぎへ
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!text || !modelLayer || saving}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 px-8 shadow-md"
            >
              {saving ? (
                <>
                  <span className="animate-spin">&#9676;</span>
                  保存中...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  登録する
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TagSection({ title, subtitle, tags, selected, onToggle, getColor }: {
  title: string; subtitle: string; tags: Tag[]; selected: string[];
  onToggle: (id: string) => void; getColor: (tag: Tag) => string;
}) {
  if (tags.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-zinc-600">{title}</span>
        <span className="text-[11px] text-zinc-400">{subtitle}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const sel = selected.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggle(tag.id)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-all duration-150 border ${
                sel
                  ? "text-white border-transparent shadow-sm"
                  : "text-zinc-600 border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm"
              }`}
              style={sel ? { backgroundColor: getColor(tag), borderColor: getColor(tag) } : {}}
            >
              {tag.displayNameJa}
            </button>
          );
        })}
      </div>
    </div>
  );
}
