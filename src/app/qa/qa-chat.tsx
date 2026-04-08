"use client";

import { useState } from "react";

type MatchFactors = { industry: number; situation: number; behavior: number; provenance: number };
type Reference = {
  id: string;
  text: string;
  trustScore: number;
  matchScore?: number;
  matchFactors?: MatchFactors;
  matchSummary?: string;
};

type QAResponse = {
  sessionId: string;
  answer: string;
  reasoning: string;
  confidence: "high" | "medium" | "low";
  suggestedFollowUp: string | null;
  references: {
    observations: Reference[];
    insights: Reference[];
  };
};

type FeedbackResponse = {
  feedback: string;
  selfImprovingLoop: boolean;
  generatedInsights: { id: string; text: string }[];
};

type SessionSummary = {
  id: string;
  question: string;
  answer: string;
  feedback: string | null;
  createdAt: string;
};

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  high: { label: "高確信", color: "text-emerald-700 bg-emerald-50" },
  medium: { label: "中確信", color: "text-amber-700 bg-amber-50" },
  low: { label: "低確信", color: "text-red-700 bg-red-50" },
};

function MatchBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-zinc-400 w-8 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-zinc-500 w-6 text-right tabular-nums">{value}</span>
    </div>
  );
}

function ReferenceCard({ ref_, type, typeColor }: { ref_: Reference; type: string; typeColor: string }) {
  return (
    <div className="border border-zinc-100 rounded-lg p-2.5 space-y-1.5">
      <div className="flex items-start gap-2">
        <span className={`shrink-0 mt-0.5 px-1.5 py-0 rounded text-[10px] font-medium ${typeColor}`}>
          {type}
        </span>
        <p className="text-xs text-zinc-600 line-clamp-2 flex-1">{ref_.text}</p>
        <div className="shrink-0 flex gap-2 items-center">
          <span className="text-[10px] text-zinc-400">信頼 {(ref_.trustScore * 100).toFixed(0)}%</span>
          {ref_.matchScore != null && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              ref_.matchScore >= 70 ? "bg-emerald-50 text-emerald-700" :
              ref_.matchScore >= 40 ? "bg-amber-50 text-amber-700" :
              "bg-red-50 text-red-600"
            }`}>
              適合 {ref_.matchScore}%
            </span>
          )}
        </div>
      </div>
      {ref_.matchFactors && (
        <div className="grid grid-cols-4 gap-2 pl-8">
          <MatchBar label="業種" value={ref_.matchFactors.industry} />
          <MatchBar label="状況" value={ref_.matchFactors.situation} />
          <MatchBar label="行動" value={ref_.matchFactors.behavior} />
          <MatchBar label="出自" value={ref_.matchFactors.provenance} />
        </div>
      )}
      {ref_.matchSummary && (
        <p className="text-[10px] text-zinc-400 pl-8">{ref_.matchSummary}</p>
      )}
    </div>
  );
}

export function QAChat({ recentSessions }: { recentSessions: SessionSummary[] }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<QAResponse | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);
  const [loopResult, setLoopResult] = useState<FeedbackResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    if (!question.trim()) return;
    setLoading(true);
    setResponse(null);
    setFeedbackSent(null);
    setLoopResult(null);
    setError(null);

    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "回答の生成に失敗しました");
        return;
      }
      setResponse(data);
    } catch {
      setError("ネットワークエラー");
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(feedback: "helpful" | "unhelpful" | "partial") {
    if (!response) return;
    setFeedbackSent(feedback);

    try {
      const res = await fetch("/api/qa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: response.sessionId, feedback }),
      });
      const data = await res.json();
      if (res.ok) {
        setLoopResult(data);
      }
    } catch {
      // フィードバック送信失敗は無視
    }
  }

  function handleFollowUp(followUp: string) {
    setQuestion(followUp);
  }

  return (
    <div className="space-y-6">
      {/* 質問入力 */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
        <label className="text-sm font-medium text-zinc-700 block mb-2">
          ナレッジベースへの質問
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleAsk()}
            placeholder="例: 入口付近で離脱が起きる原因は？"
            className="flex-1 px-4 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            className="px-6 py-2.5 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {loading ? "回答生成中..." : "質問する"}
          </button>
        </div>
      </div>

      {/* エラー */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 回答 */}
      {response && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          {/* 回答ヘッダー */}
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="font-semibold text-sm">回答</h3>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${CONFIDENCE_LABELS[response.confidence]?.color || ""}`}>
              {CONFIDENCE_LABELS[response.confidence]?.label || response.confidence}
            </span>
          </div>

          {/* 回答本文 */}
          <div className="px-5 py-4 space-y-4">
            <p className="text-sm leading-relaxed text-zinc-800">{response.answer}</p>

            {/* 推論根拠 */}
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">推論根拠</p>
              <p className="text-xs text-zinc-600">{response.reasoning}</p>
            </div>

            {/* 参照データ */}
            {(response.references.observations.length > 0 || response.references.insights.length > 0) && (
              <div className="space-y-3">
                <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">参照データ</p>
                {response.references.observations.map((ref) => (
                  <ReferenceCard key={ref.id} ref_={ref} type="観測" typeColor="bg-blue-50 text-blue-700" />
                ))}
                {response.references.insights.map((ref) => (
                  <ReferenceCard key={ref.id} ref_={ref} type="洞察" typeColor="bg-cyan-50 text-cyan-700" />
                ))}
              </div>
            )}

            {/* 追加質問の提案 */}
            {response.suggestedFollowUp && (
              <button
                onClick={() => handleFollowUp(response.suggestedFollowUp!)}
                className="text-xs text-cyan-600 hover:text-cyan-800 hover:underline transition-colors"
              >
                関連質問: {response.suggestedFollowUp}
              </button>
            )}
          </div>

          {/* フィードバック */}
          <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50">
            {!feedbackSent ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">この回答は役に立ちましたか？</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFeedback("helpful")}
                    className="px-3 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200 transition-colors"
                  >
                    役に立った
                  </button>
                  <button
                    onClick={() => handleFeedback("partial")}
                    className="px-3 py-1 text-xs bg-amber-100 text-amber-700 rounded-md hover:bg-amber-200 transition-colors"
                  >
                    一部役立った
                  </button>
                  <button
                    onClick={() => handleFeedback("unhelpful")}
                    className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                  >
                    不十分
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500">
                  フィードバック送信済み: <span className="font-medium">{feedbackSent === "helpful" ? "役に立った" : feedbackSent === "partial" ? "一部役立った" : "不十分"}</span>
                </p>
                {/* self-improving loop の結果 */}
                {loopResult?.selfImprovingLoop && (
                  <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-cyan-800">
                      Self-Improving Loop 発動: {loopResult.generatedInsights.length}件の新しい洞察を自動生成しました
                    </p>
                    {loopResult.generatedInsights.map((ins) => (
                      <p key={ins.id} className="text-xs text-cyan-700 pl-3 border-l-2 border-cyan-300">
                        {ins.text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 過去のQ&A履歴 */}
      {recentSessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">過去の質問</h3>
          <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-lg overflow-hidden bg-white">
            {recentSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleFollowUp(session.question)}
                className="w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-800 truncate">{session.question}</p>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{session.answer}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {session.feedback && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        session.feedback === "helpful" ? "bg-emerald-50 text-emerald-600" :
                        session.feedback === "partial" ? "bg-amber-50 text-amber-600" :
                        "bg-red-50 text-red-600"
                      }`}>
                        {session.feedback === "helpful" ? "有用" : session.feedback === "partial" ? "部分的" : "不十分"}
                      </span>
                    )}
                    <span className="text-[11px] text-zinc-400">
                      {new Date(session.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
