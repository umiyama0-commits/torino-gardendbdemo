import { prisma } from "@/lib/prisma";
import { ProjectList } from "./project-list";

export default async function ProjectsPage() {
  const [projects, clients] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, nameAnonymized: true, industryMajor: true, contactPerson: true } },
        _count: { select: { observations: true, uploadedFiles: true } },
      },
    }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { projects: true } } },
    }),
  ]);

  const serialized = projects.map(p => ({
    id: p.id,
    name: p.name,
    nameAnonymized: p.nameAnonymized,
    description: p.description,
    hypothesisTheme: p.hypothesisTheme,
    primaryValueAxis: p.primaryValueAxis,
    targetKPI: p.targetKPI,
    status: p.status,
    startDate: p.startDate?.toISOString() || null,
    endDate: p.endDate?.toISOString() || null,
    createdAt: p.createdAt.toISOString(),
    clientId: p.client.id,
    clientName: p.client.name,
    clientAnonymized: p.client.nameAnonymized,
    industryMajor: p.client.industryMajor,
    contactPerson: p.client.contactPerson,
    observationCount: p._count.observations,
    fileCount: p._count.uploadedFiles,
  }));

  const serializedClients = clients.map(c => ({
    id: c.id,
    name: c.name,
    industryMajor: c.industryMajor,
    industryMinor: c.industryMinor,
    contactPerson: c.contactPerson,
    contactEmail: c.contactEmail,
    contractStatus: c.contractStatus,
    projectCount: c._count.projects,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Projects</h1>
        <p className="text-sm text-zinc-600 mt-1 font-medium">プロジェクト管理 &mdash; Client projects, CRM, and knowledge tracking</p>
      </div>
      <ProjectList projects={serialized} clients={serializedClients} />
    </div>
  );
}
