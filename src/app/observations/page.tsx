import { prisma } from "@/lib/prisma";
import { ObservationsList } from "./observations-list";

export const dynamic = "force-dynamic";

export default async function ObservationsPage() {
  const [observations, clients] = await Promise.all([
    prisma.observation.findMany({
      include: {
        tags: { include: { tag: true } },
        project: {
          select: { name: true, client: { select: { industry: true, industryDetail: true } } },
        },
        store: {
          select: { name: true, client: { select: { industry: true, industryDetail: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.client.findMany({
      select: { industry: true, industryDetail: true },
      distinct: ["industryDetail"],
    }),
  ]);

  const industries = [...new Set(clients.map((c) => c.industryDetail || c.industry).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Observations</h1>
        <p className="text-zinc-500 mt-1 text-sm">
          蓄積された観測データ。フィルタで絞り込み、詳細を確認。
        </p>
      </div>
      <ObservationsList observations={observations} industries={industries} />
    </div>
  );
}
