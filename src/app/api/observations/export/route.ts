import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { generateCSV } from "@/lib/csv";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const layer = searchParams.get("layer");
  const axis = searchParams.get("axis");
  const provenance = searchParams.get("provenance");
  const industry = searchParams.get("industry");
  const trust = searchParams.get("trust");
  const bookmarked = searchParams.get("bookmarked");

  const conditions: Prisma.ObservationWhereInput[] = [];
  if (q) {
    conditions.push({ OR: [{ text: { contains: q } }, { textEn: { contains: q } }] });
  }
  if (layer) {
    conditions.push({ modelLayer: layer });
  }
  if (axis) {
    conditions.push({ primaryValueAxis: axis });
  }
  if (provenance) {
    conditions.push({ provenance });
  }
  if (industry) {
    conditions.push({ store: { client: { industryMajor: industry } } });
  }
  if (trust) {
    conditions.push({ trustScore: parseInt(trust) });
  }
  if (bookmarked === "true") {
    const userBookmarks = await prisma.bookmark.findMany({
      where: { userId: user.id },
      select: { observationId: true },
    });
    conditions.push({ id: { in: userBookmarks.map((b) => b.observationId) } });
  }

  const where: Prisma.ObservationWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const observations = await prisma.observation.findMany({
    where,
    include: {
      tags: { include: { tag: true } },
      store: { include: { client: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = observations.map((obs) => ({
    id: obs.id,
    text: obs.text,
    textEn: obs.textEn || "",
    modelLayer: obs.modelLayer,
    primaryValueAxis: obs.primaryValueAxis || "",
    provenance: obs.provenance,
    confidence: obs.confidence,
    estimatedImpactMin: obs.estimatedImpactMin ?? "",
    estimatedImpactMax: obs.estimatedImpactMax ?? "",
    impactKPI: obs.impactKPI || "",
    tags: obs.tags.map((t) => t.tag.displayNameJa).join("; "),
    client: obs.store?.client?.name || "",
    store: obs.store?.name || "",
    createdAt: obs.createdAt.toISOString(),
  }));

  const columns = [
    { key: "id", label: "ID" },
    { key: "text", label: "テキスト" },
    { key: "textEn", label: "英語" },
    { key: "modelLayer", label: "モデル層" },
    { key: "primaryValueAxis", label: "価値軸" },
    { key: "provenance", label: "出自" },
    { key: "confidence", label: "信頼度" },
    { key: "estimatedImpactMin", label: "インパクト下限(%)" },
    { key: "estimatedImpactMax", label: "インパクト上限(%)" },
    { key: "impactKPI", label: "KPI" },
    { key: "tags", label: "タグ" },
    { key: "client", label: "クライアント" },
    { key: "store", label: "店舗" },
    { key: "createdAt", label: "作成日" },
  ];

  const csv = generateCSV(rows, columns);
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="observations_${today}.csv"`,
    },
  });
}
