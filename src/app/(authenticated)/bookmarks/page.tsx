import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BookmarksList } from "./bookmarks-list";

export default async function BookmarksPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: user.id },
    include: {
      observation: {
        include: {
          tags: { include: { tag: true } },
          store: {
            include: {
              client: {
                select: {
                  name: true,
                  industryMajor: true,
                  industryMinor: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Bookmarks
        </h1>
        <p className="text-sm text-zinc-600 mt-1 font-medium">
          ブックマーク &mdash; Saved observations for quick access
        </p>
      </div>
      <BookmarksList bookmarks={bookmarks} />
    </div>
  );
}
