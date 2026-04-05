"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { VALUE_AXIS_CONFIG } from "@/lib/constants";

type Project = {
  id: string; name: string; nameAnonymized: string | null; description: string | null;
  hypothesisTheme: string | null; primaryValueAxis: string | null; targetKPI: string | null;
  status: string; startDate: string | null; endDate: string | null; createdAt: string;
  clientId: string; clientName: string; clientAnonymized: string | null;
  industryMajor: string; contactPerson: string | null;
  observationCount: number; fileCount: number;
};

type Client = {
  id: string; name: string; industryMajor: string; industryMinor: string | null;
  contactPerson: string | null; contactEmail: string | null; contractStatus: string;
  projectCount: number;
};

const STATUS_CONFIG: Record<string, { label: string; labelJa: string; color: string; bg: string }> = {
  active: { label: "Active", labelJa: "進行中", color: "#22c55e", bg: "bg-emerald-50" },
  completed: { label: "Completed", labelJa: "完了", color: "#6366f1", bg: "bg-indigo-50" },
  paused: { label: "Paused", labelJa: "一時停止", color: "#f59e0b", bg: "bg-amber-50" },
};

export function ProjectList({ projects: initialProjects, clients: initialClients }: {
  projects: Project[]; clients: Client[];
}) {
  const [tab, setTab] = useState<"projects" | "clients">("projects");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [projects, setProjects] = useState(initialProjects);
  const [clients, setClients] = useState(initialClients);

  // New project form
  const [newPJ, setNewPJ] = useState({ clientId: "", name: "", description: "", hypothesisTheme: "", primaryValueAxis: "", targetKPI: "", startDate: "" });
  // New client form
  const [newClient, setNewClient] = useState({ name: "", industryMajor: "", industryMinor: "", contactPerson: "", contactEmail: "", contactPhone: "", address: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const filteredProjects = statusFilter === "all"
    ? projects
    : projects.filter(p => p.status === statusFilter);

  const activeCount = projects.filter(p => p.status === "active").length;
  const completedCount = projects.filter(p => p.status === "completed").length;

  const handleCreateProject = async () => {
    if (!newPJ.clientId || !newPJ.name) return;
    setSaving(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPJ),
    });
    if (res.ok) {
      const pj = await res.json();
      const client = clients.find(c => c.id === pj.clientId);
      setProjects(prev => [{
        ...pj,
        clientName: client?.name || pj.client?.name || "",
        clientAnonymized: null,
        industryMajor: client?.industryMajor || pj.client?.industryMajor || "",
        contactPerson: client?.contactPerson || null,
        observationCount: 0,
        fileCount: 0,
        startDate: pj.startDate || null,
        endDate: pj.endDate || null,
        createdAt: pj.createdAt,
      }, ...prev]);
      setNewPJ({ clientId: "", name: "", description: "", hypothesisTheme: "", primaryValueAxis: "", targetKPI: "", startDate: "" });
      setShowNewProject(false);
    }
    setSaving(false);
  };

  const handleCreateClient = async () => {
    if (!newClient.name || !newClient.industryMajor) return;
    setSaving(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newClient),
    });
    if (res.ok) {
      const cl = await res.json();
      setClients(prev => [{ ...cl, projectCount: 0 }, ...prev]);
      setNewClient({ name: "", industryMajor: "", industryMinor: "", contactPerson: "", contactEmail: "", contactPhone: "", address: "", notes: "" });
      setShowNewClient(false);
    }
    setSaving(false);
  };

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
  };

  return (
    <div className="space-y-6">
      {/* Tab switcher + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-white border shadow-sm rounded-lg p-1">
          <button onClick={() => setTab("projects")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${tab === "projects" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"}`}>
            Projects ({projects.length})
          </button>
          <button onClick={() => setTab("clients")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${tab === "clients" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"}`}>
            Clients ({clients.length})
          </button>
        </div>
        <div className="flex gap-2">
          {tab === "projects" ? (
            <Button onClick={() => setShowNewProject(!showNewProject)} className="bg-zinc-900 hover:bg-zinc-800 gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              新規PJ
            </Button>
          ) : (
            <Button onClick={() => setShowNewClient(!showNewClient)} className="bg-zinc-900 hover:bg-zinc-800 gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              新規クライアント
            </Button>
          )}
        </div>
      </div>

      {/* New Project Form */}
      {showNewProject && tab === "projects" && (
        <Card className="border border-zinc-200 shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-zinc-900 to-zinc-700 px-6 py-3">
            <h3 className="text-white font-semibold text-sm">新規プロジェクト登録</h3>
          </div>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-600">クライアント *</label>
                <select value={newPJ.clientId} onChange={e => setNewPJ(p => ({ ...p, clientId: e.target.value }))}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm">
                  <option value="">選択してください</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.industryMajor})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-600">PJ名 *</label>
                <Input value={newPJ.name} onChange={e => setNewPJ(p => ({ ...p, name: e.target.value }))}
                  placeholder="例：2026年度 接客行動分析" className="text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-600">PJ概要</label>
              <Textarea value={newPJ.description} onChange={e => setNewPJ(p => ({ ...p, description: e.target.value }))}
                placeholder="プロジェクトの目的・背景" rows={2} className="text-sm resize-none" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-600">仮説テーマ</label>
                <Input value={newPJ.hypothesisTheme} onChange={e => setNewPJ(p => ({ ...p, hypothesisTheme: e.target.value }))}
                  placeholder="例：声掛けタイミング最適化" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-600">ターゲットKPI</label>
                <Input value={newPJ.targetKPI} onChange={e => setNewPJ(p => ({ ...p, targetKPI: e.target.value }))}
                  placeholder="例：接客率+15%" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-600">開始日</label>
                <Input type="date" value={newPJ.startDate} onChange={e => setNewPJ(p => ({ ...p, startDate: e.target.value }))}
                  className="text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewProject(false)}>キャンセル</Button>
              <Button onClick={handleCreateProject} disabled={!newPJ.clientId || !newPJ.name || saving}
                className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? "登録中..." : "PJ登録"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Client Form */}
      {showNewClient && tab === "clients" && (
        <Card className="border border-zinc-200 shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-zinc-900 to-zinc-700 px-6 py-3">
            <h3 className="text-white font-semibold text-sm">新規クライアント登録</h3>
          </div>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-600">会社名 *</label>
                <Input value={newClient.name} onChange={e => setNewClient(c => ({ ...c, name: e.target.value }))}
                  placeholder="例：株式会社トリノガーデン" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-600">業種 大分類 *</label>
                <select value={newClient.industryMajor} onChange={e => setNewClient(c => ({ ...c, industryMajor: e.target.value }))}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm">
                  <option value="">選択してください</option>
                  <option value="小売">小売</option>
                  <option value="飲食">飲食</option>
                  <option value="サービス">サービス</option>
                  <option value="ホテル・旅館">ホテル・旅館</option>
                  <option value="医療・福祉">医療・福祉</option>
                  <option value="教育">教育</option>
                  <option value="その他">その他</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-600">業種 中分類</label>
                <Input value={newClient.industryMinor} onChange={e => setNewClient(c => ({ ...c, industryMinor: e.target.value }))}
                  placeholder="例：眼鏡" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-600">担当者名</label>
                <Input value={newClient.contactPerson} onChange={e => setNewClient(c => ({ ...c, contactPerson: e.target.value }))}
                  placeholder="例：山田 太郎" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-600">メールアドレス</label>
                <Input type="email" value={newClient.contactEmail} onChange={e => setNewClient(c => ({ ...c, contactEmail: e.target.value }))}
                  placeholder="taro@example.com" className="text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-600">電話番号</label>
                <Input value={newClient.contactPhone} onChange={e => setNewClient(c => ({ ...c, contactPhone: e.target.value }))}
                  placeholder="03-1234-5678" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-600">所在地</label>
                <Input value={newClient.address} onChange={e => setNewClient(c => ({ ...c, address: e.target.value }))}
                  placeholder="東京都渋谷区..." className="text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-600">備考</label>
              <Textarea value={newClient.notes} onChange={e => setNewClient(c => ({ ...c, notes: e.target.value }))}
                placeholder="メモ・特記事項" rows={2} className="text-sm resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewClient(false)}>キャンセル</Button>
              <Button onClick={handleCreateClient} disabled={!newClient.name || !newClient.industryMajor || saving}
                className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? "登録中..." : "クライアント登録"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects Tab */}
      {tab === "projects" && (
        <>
          {/* Status filter */}
          <div className="flex gap-2">
            {[
              { key: "all", label: `すべて (${projects.length})` },
              { key: "active", label: `進行中 (${activeCount})` },
              { key: "completed", label: `完了 (${completedCount})` },
              { key: "paused", label: "一時停止" },
            ].map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                  statusFilter === f.key
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Project cards */}
          <div className="space-y-3">
            {filteredProjects.length === 0 ? (
              <Card className="border border-zinc-200 shadow-md">
                <CardContent className="py-12 text-center">
                  <div className="text-3xl mb-3">📁</div>
                  <p className="text-sm font-medium text-zinc-500">プロジェクトがありません</p>
                  <p className="text-xs text-zinc-400 mt-1">「新規PJ」ボタンからプロジェクトを登録してください</p>
                </CardContent>
              </Card>
            ) : (
              filteredProjects.map(pj => {
                const statusCfg = STATUS_CONFIG[pj.status] || STATUS_CONFIG.active;
                const axisCfg = pj.primaryValueAxis ? VALUE_AXIS_CONFIG[pj.primaryValueAxis as keyof typeof VALUE_AXIS_CONFIG] : null;
                return (
                  <Card key={pj.id} className="border border-zinc-200 shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                    <div className="h-1" style={{ backgroundColor: statusCfg.color }} />
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: statusCfg.color }}>
                              {statusCfg.labelJa}
                            </Badge>
                            <span className="text-xs text-zinc-400">{pj.industryMajor}</span>
                            {pj.contactPerson && (
                              <span className="text-xs text-zinc-400">· 担当: {pj.contactPerson}</span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-zinc-900">{pj.name}</h3>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {pj.clientName}
                            {pj.hypothesisTheme && <span className="ml-2 text-zinc-400">· {pj.hypothesisTheme}</span>}
                          </p>
                          {pj.description && (
                            <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{pj.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 shrink-0 ml-4">
                          <div className="text-center">
                            <div className="text-lg font-black text-zinc-800 tabular-nums">{pj.observationCount}</div>
                            <div className="text-[9px] text-zinc-400">観測数</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-black text-zinc-400 tabular-nums">{pj.fileCount}</div>
                            <div className="text-[9px] text-zinc-400">ファイル</div>
                          </div>
                          {axisCfg && (
                            <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: axisCfg.color }}>
                              {axisCfg.labelJa}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                        <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                          {pj.startDate && <span>開始: {pj.startDate.slice(0, 10)}</span>}
                          {pj.endDate && <span>終了: {pj.endDate.slice(0, 10)}</span>}
                          {pj.targetKPI && <span>KPI: {pj.targetKPI}</span>}
                        </div>
                        <div className="flex gap-1">
                          {pj.status === "active" && (
                            <button onClick={() => handleStatusChange(pj.id, "completed")}
                              className="text-[10px] font-medium text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 transition-colors">
                              完了にする
                            </button>
                          )}
                          {pj.status === "completed" && (
                            <button onClick={() => handleStatusChange(pj.id, "active")}
                              className="text-[10px] font-medium text-emerald-500 hover:text-emerald-700 px-2 py-1 rounded hover:bg-emerald-50 transition-colors">
                              再開する
                            </button>
                          )}
                          {pj.status === "active" && (
                            <button onClick={() => handleStatusChange(pj.id, "paused")}
                              className="text-[10px] font-medium text-amber-500 hover:text-amber-700 px-2 py-1 rounded hover:bg-amber-50 transition-colors">
                              一時停止
                            </button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Clients Tab */}
      {tab === "clients" && (
        <div className="space-y-3">
          {clients.length === 0 ? (
            <Card className="border border-zinc-200 shadow-md">
              <CardContent className="py-12 text-center">
                <div className="text-3xl mb-3">🏢</div>
                <p className="text-sm font-medium text-zinc-500">クライアントが登録されていません</p>
                <p className="text-xs text-zinc-400 mt-1">「新規クライアント」ボタンから登録してください</p>
              </CardContent>
            </Card>
          ) : (
            clients.map(cl => (
              <Card key={cl.id} className="border border-zinc-200 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`text-[10px] font-semibold border-0 ${
                          cl.contractStatus === "active" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                        }`}>
                          {cl.contractStatus === "active" ? "契約中" : cl.contractStatus}
                        </Badge>
                        <span className="text-xs text-zinc-400">{cl.industryMajor}</span>
                        {cl.industryMinor && <span className="text-xs text-zinc-300">· {cl.industryMinor}</span>}
                      </div>
                      <h3 className="text-sm font-bold text-zinc-900">{cl.name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                        {cl.contactPerson && (
                          <span className="flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                            </svg>
                            {cl.contactPerson}
                          </span>
                        )}
                        {cl.contactEmail && (
                          <span className="flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                            </svg>
                            {cl.contactEmail}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-center shrink-0 ml-4">
                      <div className="text-2xl font-black text-zinc-800 tabular-nums">{cl.projectCount}</div>
                      <div className="text-[9px] text-zinc-400">PJ数</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
