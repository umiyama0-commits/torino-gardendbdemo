import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  ctx: RouteContext
) {
  const { id } = await ctx.params;

  const comments = await prisma.comment.findMany({
    where: { observationId: id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(comments);
}

export async function POST(
  request: Request,
  ctx: RouteContext
) {
  const { id } = await ctx.params;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!body.text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      userId: user.id,
      observationId: id,
      text: body.text,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(comment);
}
