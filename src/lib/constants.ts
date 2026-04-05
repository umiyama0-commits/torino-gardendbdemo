export const VALUE_AXIS_CONFIG = {
  REVENUE_UP: { label: "Revenue UP", labelJa: "売上向上", color: "#2563eb", bg: "bg-blue-600", text: "text-blue-600", bgLight: "bg-blue-50", border: "border-blue-200" },
  COST_DOWN: { label: "Cost DOWN", labelJa: "コスト削減", color: "#0891b2", bg: "bg-cyan-600", text: "text-cyan-600", bgLight: "bg-cyan-50", border: "border-cyan-200" },
  RETENTION: { label: "Retention", labelJa: "定着・離職防止", color: "#d97706", bg: "bg-amber-600", text: "text-amber-600", bgLight: "bg-amber-50", border: "border-amber-200" },
  CSAT_UP: { label: "CSAT UP", labelJa: "顧客満足度向上", color: "#8b5cf6", bg: "bg-violet-500", text: "text-violet-500", bgLight: "bg-violet-50", border: "border-violet-200" },
} as const;

export const MODEL_LAYER_CONFIG = {
  MOVEMENT: { label: "Movement", labelJa: "動線", color: "#2563eb", bg: "bg-blue-600", text: "text-blue-600", bgLight: "bg-blue-50" },
  APPROACH: { label: "Approach", labelJa: "接客", color: "#0891b2", bg: "bg-cyan-600", text: "text-cyan-600", bgLight: "bg-cyan-50" },
  BREAKDOWN: { label: "Breakdown", labelJa: "離脱", color: "#dc2626", bg: "bg-red-600", text: "text-red-600", bgLight: "bg-red-50" },
  TRANSFER: { label: "Transfer", labelJa: "伝承", color: "#16a34a", bg: "bg-green-600", text: "text-green-600", bgLight: "bg-green-50" },
} as const;

export const PROVENANCE_CONFIG = {
  FIELD_OBSERVED: { label: "Proprietary", labelJa: "①固有知", color: "#18181b", bg: "bg-zinc-900", text: "text-zinc-900", bgLight: "bg-zinc-50" },
  ANONYMIZED_DERIVED: { label: "Anonymized", labelJa: "②汎用知", color: "#2563eb", bg: "bg-blue-600", text: "text-blue-600", bgLight: "bg-blue-50" },
  PUBLIC_CODIFIED: { label: "Public", labelJa: "③公知", color: "#71717a", bg: "bg-zinc-500", text: "text-zinc-500", bgLight: "bg-zinc-50" },
} as const;

export const THEORY_TAG_COLOR = "#7c3aed";

export const TRUST_LABELS: Record<number, { label: string; labelJa: string; color: string; icon: string }> = {
  1: { label: "Single Source", labelJa: "単独", color: "#a1a1aa", icon: "○" },
  2: { label: "Dual Backed", labelJa: "2層裏付", color: "#f59e0b", icon: "◉" },
  3: { label: "Triple Backed", labelJa: "3層裏付", color: "#22c55e", icon: "◈" },
};

export const KPI_LABELS: Record<string, { labelJa: string; labelEn: string }> = {
  "売上": { labelJa: "売上", labelEn: "Revenue" },
  "コスト削減率": { labelJa: "コスト削減率", labelEn: "Cost Reduction" },
  "離職率": { labelJa: "離職率", labelEn: "Turnover Rate" },
};

export type ValueAxis = keyof typeof VALUE_AXIS_CONFIG;
export type ModelLayer = keyof typeof MODEL_LAYER_CONFIG;
export type Provenance = keyof typeof PROVENANCE_CONFIG;
