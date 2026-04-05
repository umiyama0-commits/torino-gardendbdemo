import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const tags = await prisma.ontologyTag.findMany({
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });
  return NextResponse.json(tags);
}
