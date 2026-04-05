import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { IngestTabs } from "./ingest-tabs";

export default async function IngestPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const tags = await prisma.ontologyTag.findMany({
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });

  const recentFiles = await prisma.uploadedFile.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Get clients and active projects — filtered by user role
  let clientsList: { id: string; name: string; industryMajor: string }[];
  let projectsList: { id: string; name: string; clientId: string }[];

  if (user.role === "admin") {
    // Admin sees all active clients & projects
    [clientsList, projectsList] = await Promise.all([
      prisma.client.findMany({
        where: { contractStatus: "active" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, industryMajor: true },
      }),
      prisma.project.findMany({
        where: { status: "active" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, clientId: true },
      }),
    ]);
  } else {
    // Consultant/viewer: only assigned active projects & their clients
    const assignments = await prisma.projectAssignment.findMany({
      where: { userId: user.id },
      include: {
        project: {
          where: { status: "active" },
          select: { id: true, name: true, clientId: true, client: { select: { id: true, name: true, industryMajor: true, contractStatus: true } } },
        },
      },
    });

    const assignedProjects = assignments
      .filter(a => a.project && a.project.clientId)
      .map(a => a.project!);

    // Deduplicate clients from assigned projects
    const clientMap = new Map<string, { id: string; name: string; industryMajor: string }>();
    for (const p of assignedProjects) {
      if (p.client.contractStatus === "active") {
        clientMap.set(p.client.id, { id: p.client.id, name: p.client.name, industryMajor: p.client.industryMajor });
      }
    }
    clientsList = Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    projectsList = assignedProjects
      .filter(p => p.client.contractStatus === "active")
      .map(p => ({ id: p.id, name: p.name, clientId: p.clientId }));
  }

  // Get stats for the activity feed
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalAll, totalToday, recentObservations] = await Promise.all([
    prisma.observation.count(),
    prisma.observation.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.observation.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        text: true,
        modelLayer: true,
        primaryValueAxis: true,
        provenance: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  const serializedRecent = recentObservations.map(o => ({
    id: o.id,
    text: o.text.slice(0, 80),
    modelLayer: o.modelLayer,
    primaryValueAxis: o.primaryValueAxis,
    provenance: o.provenance,
    createdAt: o.createdAt.toISOString(),
    createdBy: o.createdBy?.name || "—",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Data Ingest</h1>
        <p className="text-sm text-zinc-600 mt-1 font-medium">データ投入 &mdash; Manual entry, report upload, daily logs, and video</p>
      </div>
      <IngestTabs
        tags={tags}
        recentFiles={recentFiles}
        initialStats={{ totalAll, totalToday, recent: serializedRecent }}
        clients={clientsList}
        projects={projectsList}
      />
    </div>
  );
}
