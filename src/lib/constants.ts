export const VALUE_AXIS_CONFIG: Record<string, { label: string; color: string; bg: string; bar: string }> = {
  REVENUE_UP: { label: "売上向上", color: "text-blue-700", bg: "bg-blue-50 border border-blue-200", bar: "bg-blue-500" },
  COST_DOWN: { label: "コスト削減", color: "text-teal-700", bg: "bg-teal-50 border border-teal-200", bar: "bg-teal-500" },
  RETENTION: { label: "継続率向上", color: "text-amber-700", bg: "bg-amber-50 border border-amber-200", bar: "bg-amber-500" },
};

export const MODEL_LAYER_CONFIG: Record<string, { label: string; color: string; bg: string; bar: string }> = {
  MOVEMENT: { label: "動線", color: "text-blue-700", bg: "bg-blue-50 border border-blue-200", bar: "bg-blue-500" },
  APPROACH: { label: "接点", color: "text-cyan-700", bg: "bg-cyan-50 border border-cyan-200", bar: "bg-cyan-500" },
  BREAKDOWN: { label: "離脱", color: "text-red-700", bg: "bg-red-50 border border-red-200", bar: "bg-red-500" },
  TRANSFER: { label: "伝承", color: "text-green-700", bg: "bg-green-50 border border-green-200", bar: "bg-green-500" },
};

export const PROVENANCE_CONFIG: Record<string, { label: string; shortLabel: string; color: string; bg: string; dot: string }> = {
  FIELD_OBSERVED: { label: "固有知（実観測）", shortLabel: "①固有知", color: "text-zinc-800", bg: "bg-zinc-100 border border-zinc-300", dot: "bg-zinc-800" },
  ANONYMIZED_DERIVED: { label: "汎用知（匿名化）", shortLabel: "②汎用知", color: "text-blue-700", bg: "bg-blue-50 border border-blue-200", dot: "bg-blue-500" },
  PUBLIC_CODIFIED: { label: "公知（形式知）", shortLabel: "③公知", color: "text-zinc-500", bg: "bg-zinc-50 border border-zinc-200", dot: "bg-zinc-400" },
};

export const CONFIDENCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  HIGH: { label: "高", color: "text-emerald-700", bg: "bg-emerald-50 border border-emerald-200" },
  MEDIUM: { label: "中", color: "text-yellow-700", bg: "bg-yellow-50 border border-yellow-200" },
  LOW: { label: "低", color: "text-red-700", bg: "bg-red-50 border border-red-200" },
};

export const NODE_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CATEGORY: { label: "大分類", color: "text-slate-700", bg: "bg-slate-100 border border-slate-300" },
  PERFORMANCE: { label: "パフォーマンス", color: "text-indigo-700", bg: "bg-indigo-50 border border-indigo-200" },
  INDICATOR: { label: "指標", color: "text-sky-700", bg: "bg-sky-50 border border-sky-200" },
  FACTOR: { label: "要因", color: "text-orange-700", bg: "bg-orange-50 border border-orange-200" },
  COUNTERMEASURE: { label: "対策", color: "text-emerald-700", bg: "bg-emerald-50 border border-emerald-200" },
};

export const INDUSTRY_LIST = [
  "眼鏡小売",
  "アパレル",
  "飲食",
  "不動産",
  "保険",
  "美容室",
] as const;

export const COUNTRY_CONFIG: Record<string, { label: string; flag: string }> = {
  JP: { label: "日本", flag: "🇯🇵" },
  US: { label: "アメリカ", flag: "🇺🇸" },
  KR: { label: "韓国", flag: "🇰🇷" },
  CN: { label: "中国", flag: "🇨🇳" },
  TW: { label: "台湾", flag: "🇹🇼" },
  TH: { label: "タイ", flag: "🇹🇭" },
  SG: { label: "シンガポール", flag: "🇸🇬" },
  GB: { label: "イギリス", flag: "🇬🇧" },
  DE: { label: "ドイツ", flag: "🇩🇪" },
  FR: { label: "フランス", flag: "🇫🇷" },
  AU: { label: "オーストラリア", flag: "🇦🇺" },
};
