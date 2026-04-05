"use client";

import { useEffect, useState, useCallback } from "react";

type ApiClientEntry = {
  id: string;
  name: string;
  description: string | null;
  apiKeyPrefix: string;
  status: string;
  allowedCategories: string;
  allowedIndustries: string;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  monthlyQuota: number;
  totalRequests: number;
  lastUsedAt: string | null;
  contactName: string | null;
  contactEmail: string | null;
  createdAt: string;
  expiresAt: string | null;
  _count: { accessLogs: number };
};

type NewClient = {
  name: string;
  description: string;
  contactName: string;
  contactEmail: string;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  monthlyQuota: number;
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  suspended: "bg-amber-50 text-amber-700",
  revoked: "bg-red-50 text-red-700",
};

export function ApiClientsAdmin() {
  const [clients, setClients] = useState<ApiClientEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [newClient, setNewClient] = useState<NewClient>({
    name: "",
    description: "",
    contactName: "",
    contactEmail: "",
    rateLimitPerMinute: 60,
    rateLimitPerDay: 10000,
    monthlyQuota: 100000,
  });

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/api-clients");
      if (res.ok) setClients(await res.json());
    } catch {
      showMsg("error", "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  async function handleCreate() {
    if (!newClient.name) { showMsg("error", "Name is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/api-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newClient,
          allowedCategories: ["ANONYMIZED_DERIVED", "PUBLIC_CODIFIED"],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewApiKey(data.apiKeyRaw);
        showMsg("success", "API Client created");
        setShowCreate(false);
        setNewClient({ name: "", description: "", contactName: "", contactEmail: "", rateLimitPerMinute: 60, rateLimitPerDay: 10000, monthlyQuota: 100000 });
        await fetchClients();
      } else {
        showMsg("error", "Create failed");
      }
    } catch { showMsg("error", "Create failed"); }
    finally { setSaving(false); }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await fetch(`/api/admin/api-clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      showMsg("success", `Status changed to ${status}`);
      await fetchClients();
    } catch { showMsg("error", "Update failed"); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-zinc-300 border-t-zinc-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">API Clients</h1>
        <p className="text-sm text-zinc-500 mt-1">
          外部API連携テナント管理 - キー発行・アクセス制御・利用状況
        </p>
      </div>

      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg ${
          message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {/* New API Key display (one-time) */}
      {newApiKey && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <div className="text-sm font-semibold text-amber-800 mb-1">API Key Generated (shown only once)</div>
          <div className="bg-white border border-amber-200 rounded-md p-3 font-mono text-xs break-all select-all">
            {newApiKey}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => { navigator.clipboard.writeText(newApiKey); showMsg("success", "Copied!"); }}
              className="px-3 py-1 text-xs bg-amber-600 text-white rounded-md hover:bg-amber-700"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={() => setNewApiKey(null)}
              className="px-3 py-1 text-xs bg-zinc-100 text-zinc-600 rounded-md hover:bg-zinc-200"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Create button & form */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700">Registered Clients ({clients.length})</h2>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white rounded-md hover:bg-zinc-800"
          >
            + New Client
          </button>
        </div>

        {showCreate && (
          <div className="px-4 py-4 border-b border-zinc-200 bg-blue-50/50">
            <div className="text-xs font-semibold text-zinc-600 mb-3">New API Client</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Client Name *</label>
                <input type="text" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  placeholder="e.g. ABC Corp" className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Description</label>
                <input type="text" value={newClient.description} onChange={(e) => setNewClient({ ...newClient, description: e.target.value })}
                  placeholder="Usage purpose" className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Contact Name</label>
                <input type="text" value={newClient.contactName} onChange={(e) => setNewClient({ ...newClient, contactName: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Contact Email</label>
                <input type="text" value={newClient.contactEmail} onChange={(e) => setNewClient({ ...newClient, contactEmail: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Rate Limit / min</label>
                <input type="number" value={newClient.rateLimitPerMinute} onChange={(e) => setNewClient({ ...newClient, rateLimitPerMinute: parseInt(e.target.value) || 60 })}
                  className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Monthly Quota</label>
                <input type="number" value={newClient.monthlyQuota} onChange={(e) => setNewClient({ ...newClient, monthlyQuota: parseInt(e.target.value) || 100000 })}
                  className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <div className="mt-2 text-[10px] text-zinc-400">
              * Default access: ANONYMIZED_DERIVED + PUBLIC_CODIFIED only (FIELD_OBSERVED is never exposed)
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleCreate} disabled={saving}
                className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Creating..." : "Generate API Key"}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-600 rounded-md hover:bg-zinc-200">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Client list */}
        <div className="divide-y divide-zinc-100">
          {clients.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">
              No API clients registered yet
            </div>
          ) : (
            clients.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900">{c.name}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_STYLES[c.status] || "bg-zinc-100 text-zinc-600"}`}>
                        {c.status}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                        {c.apiKeyPrefix}
                      </span>
                    </div>
                    {c.description && <div className="text-xs text-zinc-400 mt-0.5">{c.description}</div>}
                    <div className="flex gap-4 mt-1 text-[10px] text-zinc-400">
                      <span>Requests: {c.totalRequests.toLocaleString()}</span>
                      <span>Rate: {c.rateLimitPerMinute}/min</span>
                      <span>Quota: {c.monthlyQuota.toLocaleString()}/mo</span>
                      {c.lastUsedAt && <span>Last used: {new Date(c.lastUsedAt).toLocaleDateString("ja-JP")}</span>}
                      {c.contactEmail && <span>{c.contactEmail}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {c.status === "active" && (
                      <button onClick={() => handleStatusChange(c.id, "suspended")}
                        className="px-2 py-1 text-[10px] font-medium text-amber-600 bg-amber-50 rounded hover:bg-amber-100">
                        Suspend
                      </button>
                    )}
                    {c.status === "suspended" && (
                      <button onClick={() => handleStatusChange(c.id, "active")}
                        className="px-2 py-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100">
                        Activate
                      </button>
                    )}
                    {c.status !== "revoked" && (
                      <button onClick={() => handleStatusChange(c.id, "revoked")}
                        className="px-2 py-1 text-[10px] font-medium text-red-600 bg-red-50 rounded hover:bg-red-100">
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="text-xs text-zinc-400 px-1 space-y-1">
        <p>* API keys are hashed (SHA-256) and shown only once at creation.</p>
        <p>* FIELD_OBSERVED (proprietary data) is never exposed through external APIs.</p>
        <p>* Only observations with anonymizationVerified = true are available externally.</p>
      </div>
    </div>
  );
}
