"use client";

import { useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  apiKey: string | null;
  lastLoginAt: Date | string | null;
  createdAt: Date | string;
};

type Config = {
  id: string;
  key: string;
  value: string;
  label: string;
  category: string;
};

type Stats = {
  observations: number;
  insights: number;
  patterns: number;
  compilations: number;
  qaSessions: number;
  openLints: number;
  clusters: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  llm: "LLM設定",
  trust: "信頼スコア・クラスタ",
  display: "表示設定",
  general: "一般",
};

export function AdminPanel({
  users,
  configs,
  stats,
}: {
  users: User[];
  configs: Config[];
  stats: Stats;
}) {
  const [activeTab, setActiveTab] = useState<"stats" | "config" | "users">("stats");
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveConfig(key: string, value: string) {
    setSaving(true);
    try {
      const apiKey = prompt("管理者APIキーを入力してください:");
      if (!apiKey) return;

      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`エラー: ${data.error}`);
        return;
      }
      setMessage(`${key} を更新しました`);
      setEditingConfig(null);
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      setMessage("ネットワークエラー");
    } finally {
      setSaving(false);
    }
  }

  const groupedConfigs = configs.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {} as Record<string, Config[]>);

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-zinc-200">
        {([
          ["stats", "稼働統計"],
          ["config", "システム設定"],
          ["users", "ユーザー管理"],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div className={`mb-4 px-3 py-2 rounded text-sm ${
          message.startsWith("エラー") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
        }`}>
          {message}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === "stats" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {([
            ["観測データ", stats.observations, "bg-blue-50 text-blue-700"],
            ["洞察", stats.insights, "bg-cyan-50 text-cyan-700"],
            ["パターン", stats.patterns, "bg-violet-50 text-violet-700"],
            ["クラスタ", stats.clusters, "bg-indigo-50 text-indigo-700"],
            ["Q&Aセッション", stats.qaSessions, "bg-emerald-50 text-emerald-700"],
            ["パイプライン実行", stats.compilations, "bg-zinc-100 text-zinc-700"],
            ["未対応Lint", stats.openLints, stats.openLints > 0 ? "bg-amber-50 text-amber-700" : "bg-zinc-50 text-zinc-500"],
          ] as const).map(([label, count, style]) => (
            <div key={label} className={`rounded-xl p-4 ${style}`}>
              <p className="text-xs font-medium opacity-70">{label}</p>
              <p className="text-2xl font-bold mt-1">{count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Config Tab */}
      {activeTab === "config" && (
        <div className="space-y-6">
          {Object.entries(groupedConfigs).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                {CATEGORY_LABELS[category] || category}
              </h3>
              <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
                {items.map((config) => (
                  <div key={config.key} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{config.label}</p>
                      <p className="text-xs text-zinc-400 font-mono">{config.key}</p>
                    </div>
                    {editingConfig === config.key ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="border border-zinc-300 rounded px-2 py-1 text-sm w-40"
                          autoFocus
                        />
                        <button
                          onClick={() => saveConfig(config.key, editValue)}
                          disabled={saving}
                          className="px-2 py-1 bg-zinc-900 text-white text-xs rounded hover:bg-zinc-700"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingConfig(null)}
                          className="px-2 py-1 text-xs text-zinc-500"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingConfig(config.key); setEditValue(config.value); }}
                        className="text-sm font-mono text-zinc-600 bg-zinc-50 px-3 py-1 rounded hover:bg-zinc-100 transition-colors"
                      >
                        {config.value}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {configs.length === 0 && (
            <p className="text-zinc-400 text-sm">設定が未初期化です。ページを再読み込みしてください。</p>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-zinc-500">名前</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-500">メール</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-500">権限</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-500">APIキー</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      user.role === "admin"
                        ? "bg-red-50 text-red-700"
                        : user.role === "viewer"
                          ? "bg-zinc-100 text-zinc-600"
                          : "bg-blue-50 text-blue-700"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {user.apiKey ? `${user.apiKey.slice(0, 8)}...` : "未発行"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
