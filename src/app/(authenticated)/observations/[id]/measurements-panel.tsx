"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Measurement = {
  id: string;
  category: string;
  label: string;
  value: string;
  unit: string | null;
  sortOrder: number;
};

const CATEGORIES = [
  { key: "sample", label: "サンプル情報", labelEn: "Sample", icon: "👥", color: "bg-blue-50 border-blue-200 text-blue-700" },
  { key: "before_after", label: "前後比較", labelEn: "Before/After", icon: "📊", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { key: "methodology", label: "計測手法", labelEn: "Methodology", icon: "🔬", color: "bg-violet-50 border-violet-200 text-violet-700" },
  { key: "raw_data", label: "数値データ", labelEn: "Raw Data", icon: "📈", color: "bg-amber-50 border-amber-200 text-amber-700" },
  { key: "environment", label: "環境条件", labelEn: "Environment", icon: "🏪", color: "bg-zinc-50 border-zinc-200 text-zinc-700" },
];

const QUICK_TEMPLATES: Record<string, { label: string; unit?: string }[]> = {
  sample: [
    { label: "サンプル数", unit: "件" },
    { label: "計測期間", unit: "日間" },
    { label: "対象店舗数", unit: "店舗" },
    { label: "対象スタッフ数", unit: "人" },
  ],
  before_after: [
    { label: "施策前", unit: "%" },
    { label: "施策後", unit: "%" },
    { label: "変化率", unit: "%" },
    { label: "統計的有意性 (p値)" },
  ],
  methodology: [
    { label: "計測方法" },
    { label: "観察期間" },
    { label: "データソース" },
    { label: "分析手法" },
  ],
  raw_data: [
    { label: "平均値" },
    { label: "中央値" },
    { label: "標準偏差" },
    { label: "最大値" },
    { label: "最小値" },
  ],
  environment: [
    { label: "店舗タイプ" },
    { label: "立地" },
    { label: "面積", unit: "㎡" },
    { label: "時間帯" },
    { label: "曜日" },
  ],
};

export function MeasurementsPanel({
  observationId,
  initialMeasurements,
  canEdit,
}: {
  observationId: string;
  initialMeasurements: Measurement[];
  canEdit: boolean;
}) {
  const [measurements, setMeasurements] = useState<Measurement[]>(initialMeasurements);
  const [showForm, setShowForm] = useState(false);
  const [formCategory, setFormCategory] = useState("sample");
  const [formLabel, setFormLabel] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [saving, setSaving] = useState(false);

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: measurements.filter((m) => m.category === cat.key),
  })).filter((cat) => cat.items.length > 0);

  const handleAdd = async () => {
    if (!formLabel || !formValue) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/observations/${observationId}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formCategory,
          label: formLabel,
          value: formValue,
          unit: formUnit || null,
          sortOrder: measurements.filter((m) => m.category === formCategory).length,
        }),
      });
      if (res.ok) {
        const newItem = await res.json();
        setMeasurements((prev) => [...prev, newItem]);
        setFormLabel("");
        setFormValue("");
        setFormUnit("");
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (measurementId: string) => {
    try {
      const res = await fetch(
        `/api/observations/${observationId}/measurements?measurementId=${measurementId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setMeasurements((prev) => prev.filter((m) => m.id !== measurementId));
      }
    } catch { /* ignore */ }
  };

  const handleQuickAdd = (label: string, unit?: string) => {
    setFormLabel(label);
    setFormUnit(unit || "");
    setFormValue("");
  };

  return (
    <Card className="border border-zinc-200 shadow-md">
      <CardContent className="pt-4 pb-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
              </svg>
              Measurement Data / 計測データ
            </h3>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="text-[11px] h-7 gap-1"
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? "閉じる" : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    データ追加
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Data display */}
          {grouped.length > 0 ? (
            <div className="space-y-3">
              {grouped.map((cat) => (
                <div key={cat.key} className={`rounded-lg border p-3 ${cat.color}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-sm">{cat.icon}</span>
                    <span className="text-[11px] font-bold">{cat.label}</span>
                    <span className="text-[10px] opacity-60">{cat.labelEn}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {cat.items.map((item) => (
                      <div key={item.id} className="bg-white/80 rounded-md px-3 py-2 group relative">
                        <div className="text-[10px] text-zinc-400 font-medium">{item.label}</div>
                        <div className="text-sm font-bold text-zinc-800 tabular-nums">
                          {item.value}
                          {item.unit && <span className="text-[10px] font-normal text-zinc-400 ml-0.5">{item.unit}</span>}
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-300 hover:text-red-400 p-0.5"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !showForm && (
              <div className="rounded-lg border border-dashed border-zinc-200 py-6 text-center">
                <p className="text-xs text-zinc-400">計測データはまだ登録されていません</p>
                {canEdit && (
                  <Button variant="ghost" size="sm" className="text-[11px] mt-2 text-zinc-500" onClick={() => setShowForm(true)}>
                    データを追加する
                  </Button>
                )}
              </div>
            )
          )}

          {/* Add form */}
          {showForm && canEdit && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-zinc-600">カテゴリ</div>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => { setFormCategory(cat.key); setFormLabel(""); setFormUnit(""); }}
                      className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                        formCategory === cat.key
                          ? "bg-zinc-900 text-white shadow-sm"
                          : "bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick templates */}
              {QUICK_TEMPLATES[formCategory] && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-zinc-400">クイック選択:</div>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_TEMPLATES[formCategory].map((t) => (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => handleQuickAdd(t.label, t.unit)}
                        className={`rounded-full px-2.5 py-1 text-[10px] transition-all ${
                          formLabel === t.label
                            ? "bg-zinc-700 text-white"
                            : "bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="ラベル（例：サンプル数）"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  className="flex-1 h-8 text-sm"
                />
                <Input
                  placeholder="値"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  className="w-32 h-8 text-sm"
                />
                <Input
                  placeholder="単位"
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  className="w-20 h-8 text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={!formLabel || !formValue || saving}
                  className="h-8 text-xs px-4 bg-zinc-900 hover:bg-zinc-800"
                >
                  {saving ? "..." : "追加"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
