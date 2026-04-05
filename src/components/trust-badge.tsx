import { TRUST_LABELS } from "@/lib/constants";

export function TrustBadge({ score }: { score: number }) {
  const cfg = TRUST_LABELS[score] || TRUST_LABELS[1];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border"
      style={{ color: cfg.color, borderColor: cfg.color + "40", backgroundColor: cfg.color + "10" }}
    >
      <span className="text-xs leading-none">{cfg.icon}</span>
      {cfg.labelJa}
    </span>
  );
}

export function ImpactBadge({ min, max, kpi }: { min?: number | null; max?: number | null; kpi?: string | null }) {
  if (min == null || max == null) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-700 border border-emerald-200">
      <span className="text-emerald-400">▲</span>
      {min}%–{max}%
      {kpi && <span className="text-emerald-500 font-normal">{kpi}</span>}
    </span>
  );
}
