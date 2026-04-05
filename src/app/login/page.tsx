"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "ログインに失敗しました");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex bg-[#191919]">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#191919] text-sm font-black">
              TG
            </div>
            <span className="text-white/90 text-sm font-semibold tracking-tight">Torino Garden</span>
          </div>
        </div>
        <div className="relative z-10 space-y-4">
          <h2 className="text-4xl font-bold text-white leading-tight tracking-tight">
            Knowledge<br />Intelligence<br />Platform
          </h2>
          <p className="text-zinc-500 text-sm max-w-xs leading-relaxed">
            Store-level observations, cross-industry patterns, and AI-driven insights in one unified database.
          </p>
          <div className="flex items-center gap-3 pt-4">
            <div className="h-1 w-8 rounded-full bg-white/30" />
            <div className="h-1 w-8 rounded-full bg-white/10" />
            <div className="h-1 w-8 rounded-full bg-white/10" />
          </div>
        </div>
        <div className="relative z-10">
          <p className="text-zinc-600 text-[11px]">Torino Garden Main DB v1.0</p>
        </div>
        {/* Background gradient decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/30 via-transparent to-blue-900/10" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-blue-600/5 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden text-center space-y-2 pb-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#191919] text-sm font-black">
              TG
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">Torino Garden Main DB</h1>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="bg-[#252525] rounded-xl border border-zinc-700/50 p-7 space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">Sign In</h2>
              <p className="text-[12px] text-zinc-500">アカウント情報を入力してください</p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@torino-garden.com"
                  className="w-full rounded-lg border border-zinc-600 bg-[#191919] px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-lg border border-zinc-600 bg-[#191919] px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#191919] hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">&#9676;</span> Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="rounded-xl border border-zinc-700/50 bg-[#252525] p-4 space-y-3">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Demo Accounts</div>
            <div className="space-y-2 text-[12px]">
              {[
                { role: "Admin", email: "admin@torino-garden.com", pw: "admin123" },
                { role: "Consultant", email: "tanaka@torino-garden.com", pw: "tanaka123" },
                { role: "Viewer", email: "viewer@torino-garden.com", pw: "viewer123" },
              ].map((acc) => (
                <div key={acc.role} className="flex justify-between items-center">
                  <span className="font-medium text-zinc-300">{acc.role}</span>
                  <span className="font-mono text-zinc-600 text-[11px]">{acc.email} / {acc.pw}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
