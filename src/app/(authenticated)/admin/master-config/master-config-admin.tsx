"use client";

import { useEffect, useState, useCallback } from "react";

type ConfigEntry = {
  id: string;
  category: string;
  key: string;
  labelEn: string;
  labelJa: string;
  color: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

type NewEntry = {
  category: string;
  key: string;
  labelEn: string;
  labelJa: string;
  color: string;
  description: string;
  sortOrder: number;
};

const CATEGORIES = [
  { key: "MODEL_LAYER", label: "Model Layer", labelJa: "思考レイヤー" },
  { key: "VALUE_AXIS", label: "Value Axis", labelJa: "価値軸" },
  { key: "PROVENANCE", label: "Provenance", labelJa: "知見区分" },
  { key: "TAG_TYPE", label: "Tag Type", labelJa: "タグ種別" },
] as const;

const EMPTY_NEW: NewEntry = {
  category: "",
  key: "",
  labelEn: "",
  labelJa: "",
  color: "#3b82f6",
  description: "",
  sortOrder: 0,
};

export function MasterConfigAdmin() {
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [activeTab, setActiveTab] = useState<string>(CATEGORIES[0].key);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState<NewEntry>({ ...EMPTY_NEW });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ConfigEntry>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/master-config");
      if (res.ok) {
        setConfigs(await res.json());
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load configs" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const filtered = configs
    .filter((c) => c.category === activeTab)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Create
  async function handleCreate() {
    if (!newEntry.key || !newEntry.labelEn || !newEntry.labelJa || !newEntry.color) {
      showMsg("error", "Key, Label (EN), Label (JA), Color are required");
      return;
    }
    setSaving("create");
    try {
      const res = await fetch("/api/admin/master-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newEntry,
          category: activeTab,
          sortOrder: newEntry.sortOrder || filtered.length + 1,
        }),
      });
      if (res.ok) {
        showMsg("success", "Created successfully");
        setShowAdd(false);
        setNewEntry({ ...EMPTY_NEW });
        await fetchConfigs();
      } else {
        const err = await res.json();
        showMsg("error", err.error || "Create failed");
      }
    } catch {
      showMsg("error", "Create failed");
    } finally {
      setSaving(null);
    }
  }

  // Update
  async function handleUpdate(id: string) {
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/master-config/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        showMsg("success", "Updated successfully");
        setEditingId(null);
        setEditForm({});
        await fetchConfigs();
      } else {
        showMsg("error", "Update failed");
      }
    } catch {
      showMsg("error", "Update failed");
    } finally {
      setSaving(null);
    }
  }

  // Soft delete (toggle isActive)
  async function handleToggleActive(entry: ConfigEntry) {
    setSaving(entry.id);
    try {
      const res = await fetch(`/api/admin/master-config/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !entry.isActive }),
      });
      if (res.ok) {
        showMsg("success", entry.isActive ? "Deactivated" : "Activated");
        await fetchConfigs();
      }
    } catch {
      showMsg("error", "Toggle failed");
    } finally {
      setSaving(null);
    }
  }

  function startEdit(entry: ConfigEntry) {
    setEditingId(entry.id);
    setEditForm({
      labelEn: entry.labelEn,
      labelJa: entry.labelJa,
      color: entry.color,
      description: entry.description,
      sortOrder: entry.sortOrder,
    });
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Master Config</h1>
        <p className="text-sm text-zinc-500 mt-1">
          マスターデータ管理 - Model Layer, Value Axis, Provenance, Tag Type
        </p>
      </div>

      {/* Toast message */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-100 rounded-lg w-fit">
        {CATEGORIES.map((cat) => {
          const count = configs.filter((c) => c.category === cat.key).length;
          const activeCount = configs.filter((c) => c.category === cat.key && c.isActive).length;
          return (
            <button
              key={cat.key}
              onClick={() => {
                setActiveTab(cat.key);
                setShowAdd(false);
                setEditingId(null);
              }}
              className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${
                activeTab === cat.key
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <div>{cat.label}</div>
              <div className="text-[10px] text-zinc-400">
                {cat.labelJa} ({activeCount}/{count})
              </div>
            </button>
          );
        })}
      </div>

      {/* Entry List */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700">
            {CATEGORIES.find((c) => c.key === activeTab)?.label} Entries
          </h2>
          <button
            onClick={() => {
              setShowAdd(!showAdd);
              setNewEntry({ ...EMPTY_NEW });
            }}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white rounded-md hover:bg-zinc-800 transition-colors"
          >
            + Add Entry
          </button>
        </div>

        {/* Add new form */}
        {showAdd && (
          <div className="px-4 py-4 border-b border-zinc-200 bg-blue-50/50">
            <div className="text-xs font-semibold text-zinc-600 mb-3">New Entry</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Key (uppercase)</label>
                <input
                  type="text"
                  value={newEntry.key}
                  onChange={(e) => setNewEntry({ ...newEntry, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })}
                  placeholder="e.g. NEW_ITEM"
                  className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Color</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={newEntry.color}
                    onChange={(e) => setNewEntry({ ...newEntry, color: e.target.value })}
                    className="h-8 w-10 border border-zinc-200 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newEntry.color}
                    onChange={(e) => setNewEntry({ ...newEntry, color: e.target.value })}
                    className="flex-1 px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Label (EN)</label>
                <input
                  type="text"
                  value={newEntry.labelEn}
                  onChange={(e) => setNewEntry({ ...newEntry, labelEn: e.target.value })}
                  placeholder="English label"
                  className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Label (JA)</label>
                <input
                  type="text"
                  value={newEntry.labelJa}
                  onChange={(e) => setNewEntry({ ...newEntry, labelJa: e.target.value })}
                  placeholder="Japanese label"
                  className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Description</label>
                <input
                  type="text"
                  value={newEntry.description}
                  onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={newEntry.sortOrder || ""}
                  onChange={(e) => setNewEntry({ ...newEntry, sortOrder: parseInt(e.target.value) || 0 })}
                  placeholder="Auto"
                  className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleCreate}
                disabled={saving === "create"}
                className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving === "create" ? "Saving..." : "Create"}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-600 rounded-md hover:bg-zinc-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="divide-y divide-zinc-100">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">
              No entries in this category
            </div>
          ) : (
            filtered.map((entry) => (
              <div key={entry.id} className={`px-4 py-3 ${!entry.isActive ? "opacity-50 bg-zinc-50" : ""}`}>
                {editingId === entry.id ? (
                  /* Edit mode */
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">Label (EN)</label>
                        <input
                          type="text"
                          value={editForm.labelEn ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, labelEn: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">Label (JA)</label>
                        <input
                          type="text"
                          value={editForm.labelJa ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, labelJa: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">Color</label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            value={editForm.color ?? "#000000"}
                            onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                            className="h-8 w-10 border border-zinc-200 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={editForm.color ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                            className="flex-1 px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">Sort Order</label>
                        <input
                          type="number"
                          value={editForm.sortOrder ?? 0}
                          onChange={(e) => setEditForm({ ...editForm, sortOrder: parseInt(e.target.value) || 0 })}
                          className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">Description</label>
                        <input
                          type="text"
                          value={editForm.description ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(entry.id)}
                        disabled={saving === entry.id}
                        className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {saving === entry.id ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditForm({}); }}
                        className="px-4 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-600 rounded-md hover:bg-zinc-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display mode */
                  <div className="flex items-center gap-3">
                    {/* Color swatch */}
                    <div
                      className="h-8 w-8 rounded-md shrink-0 border border-zinc-200"
                      style={{ backgroundColor: entry.color }}
                    />
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900">{entry.labelEn}</span>
                        <span className="text-sm text-zinc-500">{entry.labelJa}</span>
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                          {entry.key}
                        </span>
                        {!entry.isActive && (
                          <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      {entry.description && (
                        <div className="text-xs text-zinc-400 mt-0.5 truncate">{entry.description}</div>
                      )}
                    </div>
                    {/* Sort order */}
                    <div className="text-[10px] text-zinc-400 font-mono shrink-0">
                      #{entry.sortOrder}
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(entry)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded transition-colors"
                        title="Edit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleToggleActive(entry)}
                        disabled={saving === entry.id}
                        className={`p-1.5 rounded transition-colors ${
                          entry.isActive
                            ? "text-zinc-400 hover:text-red-500 hover:bg-red-50"
                            : "text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50"
                        }`}
                        title={entry.isActive ? "Deactivate" : "Activate"}
                      >
                        {entry.isActive ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Help text */}
      <div className="text-xs text-zinc-400 px-1">
        <p>* Key is immutable after creation (used as DB reference). Use Deactivate instead of Delete.</p>
        <p>* Changes take effect within 60 seconds (server-side cache TTL).</p>
      </div>
    </div>
  );
}
