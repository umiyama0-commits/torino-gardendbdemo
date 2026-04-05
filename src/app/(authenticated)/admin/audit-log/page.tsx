import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE: { label: "作成", color: "text-emerald-600 bg-emerald-50" },
  UPDATE: { label: "更新", color: "text-blue-600 bg-blue-50" },
  DELETE: { label: "削除", color: "text-red-600 bg-red-50" },
};

export default async function AuditLogPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") redirect("/");

  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          監査ログ <span className="text-zinc-400 font-normal text-lg">/ Audit Log</span>
        </h1>
        <p className="text-sm text-zinc-500 mt-1">全ての変更履歴を確認できます / View all change history</p>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/50">
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">日時 / Date</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">ユーザー / User</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">操作 / Action</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">対象 / Entity</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">変更内容 / Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {logs.map((log) => {
              const actionCfg = ACTION_LABELS[log.action] || ACTION_LABELS.UPDATE;
              let changes: Record<string, { from: unknown; to: unknown }> | null = null;
              try {
                if (log.changeSummary) changes = JSON.parse(log.changeSummary);
              } catch { /* ignore */ }

              return (
                <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("ja-JP", {
                      year: "numeric", month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-zinc-700">{log.user.name}</div>
                    <div className="text-[10px] text-zinc-400">{log.user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${actionCfg.color}`}>
                      {actionCfg.label} / {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-zinc-700">{log.entityType}</div>
                    <div className="text-[10px] text-zinc-400 font-mono">{log.entityId.slice(0, 12)}...</div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {changes ? (
                      <div className="space-y-0.5">
                        {Object.entries(changes).slice(0, 3).map(([key, val]) => (
                          <div key={key} className="text-[10px]">
                            <span className="text-zinc-400">{key}:</span>{" "}
                            <span className="text-red-400 line-through">{String(val.from ?? "").slice(0, 30)}</span>{" "}
                            <span className="text-emerald-600">{String(val.to ?? "").slice(0, 30)}</span>
                          </div>
                        ))}
                        {Object.keys(changes).length > 3 && (
                          <div className="text-[10px] text-zinc-300">+{Object.keys(changes).length - 3} more</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-300">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-zinc-400">
                  まだ変更履歴がありません / No audit logs yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
