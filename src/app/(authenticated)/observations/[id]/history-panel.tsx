"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";

type AuditLog = {
  id: string;
  action: string;
  changeSummary: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

const ACTION_CONFIG: Record<string, { label: string; labelJa: string; color: string; icon: string }> = {
  CREATE: { label: "Created", labelJa: "作成", color: "#16a34a", icon: "+" },
  UPDATE: { label: "Updated", labelJa: "更新", color: "#2563eb", icon: "~" },
  DELETE: { label: "Deleted", labelJa: "削除", color: "#dc2626", icon: "-" },
};

export function HistoryPanel({ observationId }: { observationId: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(`/api/observations/${observationId}/history`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [observationId]);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString("ja-JP")} ${d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function parseChangeSummary(summary: string | null): Record<string, { from: unknown; to: unknown }> | null {
    if (!summary) return null;
    try {
      return JSON.parse(summary);
    } catch {
      return null;
    }
  }

  function formatFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      text: "Text / テキスト",
      textEn: "English Text / 英語テキスト",
      modelLayer: "Layer / 4層",
      primaryValueAxis: "Value Axis / 価値軸",
      provenance: "Provenance / 出自",
      confidence: "Confidence / 確信度",
      trustScore: "Trust Score / 信頼度",
      estimatedImpactMin: "Impact Min",
      estimatedImpactMax: "Impact Max",
      impactKPI: "Impact KPI",
    };
    return labels[field] || field;
  }

  return (
    <Card className="border border-zinc-200 shadow-md">
      <CardContent className="pt-4 pb-4">
        <div className="space-y-4">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            History / 変更履歴
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="text-xs text-zinc-400">Loading...</div>
            </div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-4">
              No history yet / 変更履歴はありません
            </p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-zinc-200" />

              <div className="space-y-4">
                {logs.map((log) => {
                  const actionCfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.UPDATE;
                  const changes = parseChangeSummary(log.changeSummary);

                  return (
                    <div key={log.id} className="relative flex gap-3 pl-0">
                      {/* Timeline dot */}
                      <div
                        className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-bold z-10"
                        style={{ backgroundColor: actionCfg.color }}
                      >
                        {actionCfg.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-semibold"
                            style={{ color: actionCfg.color }}
                          >
                            {actionCfg.label} / {actionCfg.labelJa}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-zinc-500">{log.user.name}</span>
                          <span className="text-[10px] text-zinc-300">|</span>
                          <span className="text-[10px] text-zinc-400">{formatDate(log.createdAt)}</span>
                        </div>

                        {/* Changed fields */}
                        {log.action === "UPDATE" && changes && Object.keys(changes).length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {Object.entries(changes).map(([field, diff]) => (
                              <div key={field} className="text-[10px] bg-zinc-50 rounded px-2 py-1">
                                <span className="font-medium text-zinc-500">{formatFieldLabel(field)}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-red-400 line-through truncate max-w-[80px]">
                                    {String(diff.from ?? "--")}
                                  </span>
                                  <span className="text-zinc-300">&rarr;</span>
                                  <span className="text-green-600 truncate max-w-[80px]">
                                    {String(diff.to ?? "--")}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
