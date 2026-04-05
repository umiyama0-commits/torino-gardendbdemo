"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IngestForm } from "./ingest-form";
import { FileUploadPanel } from "./file-upload-panel";
import { ActivityFeed } from "./activity-feed";

type Tag = {
  id: string; type: string; code: string;
  displayNameJa: string; displayNameEn: string | null;
  modelLayer: string | null; category: string | null;
};

type UploadedFile = {
  id: string; category: string; originalName: string; storedPath: string;
  mimeType: string; fileSize: number; status: string;
  note: string | null; createdAt: string | Date;
};

type RecentObs = {
  id: string; text: string; modelLayer: string; primaryValueAxis: string | null;
  provenance: string; createdAt: string; createdBy: string;
};

type ClientOption = { id: string; name: string; industryMajor: string };
type ProjectOption = { id: string; name: string; clientId: string };

type InitialStats = {
  totalAll: number;
  totalToday: number;
  recent: RecentObs[];
};

export function IngestTabs({ tags, recentFiles, initialStats, clients = [], projects = [] }: {
  tags: Tag[];
  recentFiles: UploadedFile[];
  initialStats: InitialStats;
  clients?: ClientOption[];
  projects?: ProjectOption[];
}) {
  return (
    <div className="flex gap-6">
      {/* Main form area */}
      <div className="flex-1 min-w-0">
        <Tabs defaultValue="manual" className="space-y-6">
          <TabsList className="bg-white border shadow-sm p-1 h-auto">
            <TabsTrigger value="manual" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white px-4 py-2 text-sm">
              <span className="mr-1.5">✎</span> 手動入力 / Manual
            </TabsTrigger>
            <TabsTrigger value="report" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white px-4 py-2 text-sm">
              <span className="mr-1.5">📄</span> 報告書 / Report
            </TabsTrigger>
            <TabsTrigger value="daily" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white px-4 py-2 text-sm">
              <span className="mr-1.5">📋</span> 日報 / Daily Log
            </TabsTrigger>
            <TabsTrigger value="video" className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white px-4 py-2 text-sm">
              <span className="mr-1.5">🎬</span> 動画 / Video
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <IngestForm tags={tags} clients={clients} projects={projects} />
          </TabsContent>

          <TabsContent value="report">
            <FileUploadPanel
              category="REPORT"
              titleJa="報告書アップロード"
              titleEn="Report Upload"
              descJa="フィールド調査報告書（PDF / Word / Excel）をアップロードします。将来的にLLMによる自動抽出に対応予定です。"
              descEn="Upload field survey reports (PDF / Word / Excel). Automatic LLM extraction will be supported in the future."
              accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt,.csv"
              recentFiles={recentFiles.filter((f) => f.category === "REPORT")}
              clients={clients}
              projects={projects}
            />
          </TabsContent>

          <TabsContent value="daily">
            <FileUploadPanel
              category="DAILY_LOG"
              titleJa="作業日報アップロード"
              titleEn="Daily Work Log Upload"
              descJa="日々の作業日報（PDF / テキスト / Excel）をアップロードします。スタッフの気づきや現場メモを蓄積します。"
              descEn="Upload daily work logs (PDF / text / Excel). Accumulate staff observations and field notes."
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.md"
              recentFiles={recentFiles.filter((f) => f.category === "DAILY_LOG")}
              clients={clients}
              projects={projects}
            />
          </TabsContent>

          <TabsContent value="video">
            <FileUploadPanel
              category="VIDEO"
              titleJa="動画アップロード"
              titleEn="Video Upload"
              descJa="店舗内の行動観察動画をアップロードします。動線分析・接客分析の素材として活用します。"
              descEn="Upload in-store behavioral observation videos for traffic flow and service analysis."
              accept="video/*,.mp4,.mov,.avi,.webm"
              recentFiles={recentFiles.filter((f) => f.category === "VIDEO")}
              isVideo
              clients={clients}
              projects={projects}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Activity feed sidebar */}
      <div className="hidden lg:block w-72 shrink-0">
        <ActivityFeed initialStats={initialStats} />
      </div>
    </div>
  );
}
