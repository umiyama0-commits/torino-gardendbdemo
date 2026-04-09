"use client";

import { useState } from "react";
import { IngestForm } from "./ingest-form";
import { FileUpload } from "./file-upload";
import { BulkCapture } from "./bulk-capture";

type Tag = {
  id: string;
  code: string;
  displayNameJa: string;
  type: string;
  modelLayer: string | null;
};

type Props = {
  tagsByType: Record<string, Tag[]>;
};

const TABS = [
  { id: "bulk", label: "一括取込", icon: "📋" },
  { id: "manual", label: "手入力", icon: "✏️" },
  { id: "upload", label: "ファイル取込", icon: "📁" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function IngestTabs({ tagsByType }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("bulk");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? "text-zinc-900"
                : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "bulk" && <BulkCapture tagsByType={tagsByType} />}
      {activeTab === "manual" && <IngestForm tagsByType={tagsByType} />}
      {activeTab === "upload" && <FileUpload />}
    </div>
  );
}
