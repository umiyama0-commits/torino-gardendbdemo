"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "ダッシュボード" },
  { href: "/ingest", label: "データ取込" },
  { href: "/observations", label: "観測データ" },
  { href: "/insights", label: "洞察" },
  { href: "/qa", label: "Q&A" },
  { href: "/search", label: "検索" },
  { href: "/patterns", label: "パターン" },
  { href: "/lint", label: "品質検証" },
  { href: "/analysis-trees", label: "PF分析" },
  { href: "/admin", label: "管理" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <header className="bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex h-14 items-center gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400" />
            <span className="font-semibold text-sm tracking-tight hidden lg:inline">
              Tollino Garden
            </span>
          </Link>
          <nav className="flex gap-0.5 overflow-x-auto scrollbar-none">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-2.5 py-1.5 text-[12px] rounded-md transition-all duration-150 whitespace-nowrap shrink-0",
                  pathname === item.href
                    ? "bg-white/15 text-white font-medium"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
