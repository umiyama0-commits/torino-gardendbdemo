import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ObservationsList } from "./observations-list";

export default async function ObservationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const observations = await prisma.observation.findMany({
    include: {
      tags: { include: { tag: true } },
      store: { include: { client: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: user.id },
    select: { observationId: true },
  });
  const bookmarkedIds = bookmarks.map((b) => b.observationId);

  const clients = await prisma.client.findMany({
    select: { industryMajor: true, industryMajorEn: true, industryMinor: true, industryMinorEn: true },
  });

  // Build industry taxonomy
  const industryMap: Record<string, { en: string; minors: Record<string, string> }> = {};
  for (const c of clients) {
    if (!industryMap[c.industryMajor]) {
      industryMap[c.industryMajor] = { en: c.industryMajorEn || "", minors: {} };
    }
    if (c.industryMinor) {
      industryMap[c.industryMajor].minors[c.industryMinor] = c.industryMinorEn || "";
    }
  }

  // Serialize dates for client component - explicitly map all fields
  const serializedObs = observations.map((obs) => ({
    id: obs.id,
    text: obs.text,
    textEn: obs.textEn,
    modelLayer: obs.modelLayer,
    primaryValueAxis: obs.primaryValueAxis,
    provenance: obs.provenance,
    confidence: obs.confidence,
    trustScore: obs.trustScore,
    estimatedImpactMin: obs.estimatedImpactMin,
    estimatedImpactMax: obs.estimatedImpactMax,
    impactKPI: obs.impactKPI,
    observedAt: obs.observedAt ? obs.observedAt.toISOString() : null,
    createdAt: obs.createdAt.toISOString(),
    store: obs.store ? { name: obs.store.name, client: { name: obs.store.client.name, industryMajor: obs.store.client.industryMajor, industryMajorEn: obs.store.client.industryMajorEn, industryMinor: obs.store.client.industryMinor } } : null,
    project: obs.project,
    tags: obs.tags.map((t) => ({ tag: { id: t.tag.id, type: t.tag.type, code: t.tag.code, displayNameJa: t.tag.displayNameJa, displayNameEn: t.tag.displayNameEn, modelLayer: t.tag.modelLayer } })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Observations</h1>
        <p className="text-sm text-zinc-600 mt-1 font-medium">観測事実一覧 &mdash; All field observations and derived knowledge</p>
      </div>
      <ObservationsList
        observations={serializedObs}
        industryMap={industryMap}
        bookmarkedIds={bookmarkedIds}
        userRole={user.role}
      />
    </div>
  );
}
