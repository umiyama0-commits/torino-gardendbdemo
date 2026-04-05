import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Navigation } from "@/components/navigation";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Navigation user={user} />
      <div className="flex flex-col flex-1" style={{ marginLeft: "15rem" }}>
        <main className="flex-1 px-8 py-6">
          {children}
        </main>
        <footer className="border-t border-zinc-200 bg-white py-3 px-8">
          <p className="text-[11px] text-zinc-400 font-medium">Torino Garden Main DB &mdash; Knowledge Intelligence Platform</p>
        </footer>
      </div>
    </div>
  );
}
