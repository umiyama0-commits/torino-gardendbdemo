"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROVENANCE_CONFIG } from "@/lib/constants";
import Link from "next/link";

type Source = {
  id: string; text: string; modelLayer: string; provenance: string;
  trustScore: number; projectName: string | null; projectId: string | null;
  clientName: string | null; impactRange: string | null; impactKPI: string | null;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

const EXAMPLES = [
  "入店時の声掛けの効果は？",
  "売上向上に最も効果的な施策は？",
  "離職率を下げるには？",
  "動線設計のベストプラクティスは？",
];

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMsgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "user") {
      // ユーザーメッセージ → 最下部へスクロール（送信確認）
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    } else {
      // AIの回答 → 回答の先頭が見える位置にスクロール
      requestAnimationFrame(() => {
        lastMsgRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [messages]);

  async function handleSubmit(question?: string) {
    const q = question || input.trim();
    if (!q || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);

    try {
      // Send conversation history for multi-turn context
      const history = [...messages, { role: "user" as const, content: q }]
        .filter((m) => !("sources" in m))
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.answer,
        sources: data.sources,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "エラーが発生しました。もう一度お試しください。",
      }]);
    }
    setLoading(false);
  }

  return (
    <Card className="border border-zinc-200 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-900 to-zinc-700 text-white text-[10px] font-bold">AI</span>
          <span className="text-sm font-semibold">Knowledge AI</span>
          <span className="text-xs text-zinc-400 font-normal">/ DB内の知見から回答</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Chat area */}
        <div
          ref={scrollRef}
          className="h-[28rem] overflow-y-auto rounded-xl bg-zinc-50 border border-zinc-200 p-4 space-y-4 scroll-smooth"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
              <div className="text-3xl">🧠</div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-600">DB内の知見について質問してください</p>
                <p className="text-xs text-zinc-400">Ask questions about the knowledge in the database</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => handleSubmit(ex)}
                    className="rounded-full bg-white border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:border-zinc-300 hover:shadow-sm transition-all"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              ref={i === messages.length - 1 ? lastMsgRef : undefined}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "" : ""}`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-zinc-900 text-white rounded-br-md"
                      : "bg-white border border-zinc-200 rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="whitespace-pre-wrap prose-sm">
                      {msg.content.split("\n").map((line, j) => {
                        // Bold handling
                        const parts = line.split(/(\*\*[^*]+\*\*)/);
                        return (
                          <div key={j} className={line === "" ? "h-2" : ""}>
                            {parts.map((part, k) => {
                              if (part.startsWith("**") && part.endsWith("**")) {
                                return <strong key={k} className="font-semibold">{part.slice(2, -2)}</strong>;
                              }
                              return <span key={k}>{part}</span>;
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="space-y-1.5 pl-1">
                    <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                      参照元 / Sources ({msg.sources.length})
                    </div>
                    {msg.sources.map((src) => {
                      const provCfg = PROVENANCE_CONFIG[src.provenance as keyof typeof PROVENANCE_CONFIG];
                      return (
                        <Link
                          key={src.id}
                          href={`/observations/${src.id}`}
                          className="block rounded-lg bg-white border border-zinc-100 p-2.5 hover:border-zinc-200 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-zinc-700 leading-relaxed line-clamp-2">{src.text}</p>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                {provCfg && (
                                  <Badge className="text-white border-0 text-[8px] px-1.5 py-0" style={{ backgroundColor: provCfg.color }}>
                                    {provCfg.labelJa}
                                  </Badge>
                                )}
                                {src.provenance === "FIELD_OBSERVED" && src.projectName && (
                                  <span className="text-[9px] text-zinc-500 font-mono bg-zinc-100 px-1.5 py-0.5 rounded">
                                    PJ:{src.projectName}
                                  </span>
                                )}
                                {src.impactRange && (
                                  <span className="text-[9px] text-emerald-600">
                                    {src.impactRange} {src.impactKPI}
                                  </span>
                                )}
                                {src.clientName && (
                                  <span className="text-[9px] text-zinc-400">{src.clientName}</span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 text-[9px] text-zinc-400">
                              {src.trustScore === 3 ? "◈3層" : src.trustScore === 2 ? "◉2層" : "○単独"}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-white border border-zinc-200 px-4 py-3 text-sm text-zinc-400">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                </span>
                知見を検索中...
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            placeholder="質問を入力... / Ask a question..."
            className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-sm placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
            disabled={loading}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            送信
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
