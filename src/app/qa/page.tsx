import { prisma } from "@/lib/prisma";
import { QAChat } from "./qa-chat";

export const dynamic = "force-dynamic";

export default async function QAPage() {
  const [obsCount, insightCount, recentSessions] = await Promise.all([
    prisma.observation.count(),
    prisma.insight.count(),
    prisma.qASession.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Q&A（質問応答）</h1>
        <p className="text-zinc-500 mt-1 text-sm">
          ナレッジベースに自然言語で質問。観測データ {obsCount}件・洞察 {insightCount}件を参照して回答します。
        </p>
      </div>

      <QAChat recentSessions={recentSessions.map((s) => ({
        id: s.id,
        question: s.question,
        answer: s.answer,
        feedback: s.feedback,
        createdAt: s.createdAt.toISOString(),
      }))} />
    </div>
  );
}
