"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", labelJa: "ダッシュボード", icon: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
    </svg>
  )},
  { href: "/projects", label: "Projects", labelJa: "プロジェクト", icon: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  )},
  { href: "/ingest", label: "Data Ingest", labelJa: "データ投入", icon: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )},
  { href: "/observations", label: "Observations", labelJa: "観測事実", icon: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )},
  { href: "/search", label: "Knowledge Search", labelJa: "ナレッジ検索", icon: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  )},
  { href: "/patterns", label: "Patterns", labelJa: "業種横断パターン", icon: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
    </svg>
  )},
  { href: "/sediment", label: "Sediment Lab", labelJa: "沈殿データ分析", icon: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  )},
  { href: "/bookmarks", label: "Bookmarks", labelJa: "ブックマーク", icon: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
    </svg>
  )},
];

const ROLE_LABELS: Record<string, { ja: string; color: string; sidebarColor: string }> = {
  admin: { ja: "管理者", color: "bg-red-100 text-red-700", sidebarColor: "bg-red-500/20 text-red-300" },
  consultant: { ja: "コンサルタント", color: "bg-blue-100 text-blue-700", sidebarColor: "bg-blue-500/20 text-blue-300" },
  viewer: { ja: "閲覧者", color: "bg-zinc-100 text-zinc-600", sidebarColor: "bg-zinc-500/20 text-zinc-300" },
};

const adminNavItems = [
  { href: "/admin/master-config", label: "Master Config", labelJa: "マスターデータ管理", icon: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
    </svg>
  )},
  { href: "/admin/api-clients", label: "API Clients", labelJa: "外部API連携", icon: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
    </svg>
  )},
];

type User = { id: string; name: string; email: string; role: string };

export function Navigation({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.viewer;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[#191919] text-zinc-300">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#191919] text-xs font-black shrink-0">
          TG
        </div>
        <div className="leading-tight min-w-0">
          <div className="text-[13px] font-bold text-white tracking-tight truncate">Torino Garden</div>
          <div className="text-[9px] text-zinc-500 tracking-wider uppercase font-medium">Main DB</div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-zinc-700/50" />

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-all duration-150 group",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              )}
            >
              <span className={cn(
                "shrink-0 transition-colors",
                isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
              )}>
                {item.icon}
              </span>
              <div className="min-w-0">
                <div className="truncate">{item.label}</div>
                <div className={cn(
                  "text-[10px] truncate",
                  isActive ? "text-zinc-400" : "text-zinc-600"
                )}>
                  {item.labelJa}
                </div>
              </div>
              {isActive && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white shrink-0" />
              )}
            </Link>
          );
        })}

        {/* Admin section */}
        {user.role === "admin" && (
          <>
            <div className="mx-0.5 my-2 border-t border-zinc-700/50" />
            <div className="px-2.5 py-1 text-[9px] font-semibold text-zinc-600 uppercase tracking-wider">
              Admin
            </div>
            {adminNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-all duration-150 group",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <span className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                  )}>
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate">{item.label}</div>
                    <div className={cn(
                      "text-[10px] truncate",
                      isActive ? "text-zinc-400" : "text-zinc-600"
                    )}>
                      {item.labelJa}
                    </div>
                  </div>
                  {isActive && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white shrink-0" />
                  )}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-zinc-700/50" />

      {/* User section */}
      <div className="p-3">
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 hover:bg-white/5 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-600 text-white text-[10px] font-bold shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="text-left leading-tight min-w-0 flex-1">
              <div className="text-[12px] font-medium text-zinc-200 truncate">{user.name}</div>
              <div className={cn("text-[9px] font-semibold rounded px-1 py-0.5 inline-block", roleInfo.sidebarColor)}>
                {roleInfo.ja}
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-3.5 text-zinc-500 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 bottom-full mb-1 z-50 w-full rounded-lg bg-[#252525] border border-zinc-700 shadow-2xl py-1">
                <div className="px-3 py-2.5 border-b border-zinc-700/50">
                  <div className="text-[12px] font-medium text-white">{user.name}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{user.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-[12px] text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                  </svg>
                  Sign Out / ログアウト
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
