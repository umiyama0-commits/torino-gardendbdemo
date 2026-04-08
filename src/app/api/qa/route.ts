// Q&A API: ナレッジベースへの自然言語質問応答 + self-improving loop
// POST: 質問 → RAG(embedding類似検索) → LLM回答 → QASession保存
// PATCH: フィードバック送信 → unhelpful/partial 時に追加Insight自動生成（ループ本体）

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { answerQuestion } from "@/lib/llm-qa";
import { generateInsights } from "@/lib/llm-insight";
import { searchSimilarObservations, searchSimilarInsights } from "@/lib/embedding";
import { QAQuestionInput, QAFeedbackInput, safeParse } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST: 質問→回答（RAG: embedding類似検索で関連データを取得）
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = safeParse(QAQuestionInput, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { question } = parsed.data;

  // RAG: embedding類似検索で質問に関連するデータを取得
  // フォールバック: embeddingがない場合は従来のtrustScore順
  let observations: { id: string; text: string; modelLayer: string; provenance: string; trustScore: number }[];
  let insights: { id: string; text: string; modelLayer: string | null; provenance: string; trustScore: number }[];

  try {
    const [similarObs, similarIns] = await Promise.all([
      searchSimilarObservations(question, 25),
      searchSimilarInsights(question, 15),
    ]);

    if (similarObs.length >= 3) {
      observations = similarObs;
      insights = similarIns;
    } else {
      throw new Error("Not enough embeddings, falling back");
    }
  } catch {
    // フォールバック: embeddingなし or エラー時は従来方式
    [observations, insights] = await Promise.all([
      prisma.observation.findMany({
        orderBy: { trustScore: "desc" },
        take: 30,
        select: { id: true, text: true, modelLayer: true, provenance: true, trustScore: true },
      }),
      prisma.insight.findMany({
        orderBy: { trustScore: "desc" },
        take: 20,
        select: { id: true, text: true, modelLayer: true, provenance: true, trustScore: true },
      }),
    ]);
  }

  // LLMに質問
  const result = await answerQuestion(question, observations, insights);

  // 参照されたIDを収集
  const refObsIds = (result.referencedObservationIndices || [])
    .filter((i) => i >= 0 && i < observations.length)
    .map((i) => observations[i].id);
  const refInsIds = (result.referencedInsightIndices || [])
    .filter((i) => i >= 0 && i < insights.length)
    .map((i) => insights[i].id);

  // QASession保存
  const session = await prisma.qASession.create({
    data: {
      question,
      answer: result.answer,
      reasoning: result.reasoning,
      referencedObservationIds: JSON.stringify(refObsIds),
      referencedInsightIds: JSON.stringify(refInsIds),
    },
  });

  // CompilationEvent記録
  await prisma.compilationEvent.create({
    data: {
      trigger: "qa_feedback",
      sourceType: "qa_session",
      sourceId: session.id,
      llmModel: process.env.LLM_PROVIDER === "anthropic" ? "claude-sonnet-4" : "gpt-4o",
    },
  });

  return NextResponse.json({
    sessionId: session.id,
    answer: result.answer,
    reasoning: result.reasoning,
    confidence: result.confidence,
    suggestedFollowUp: result.suggestedFollowUp,
    matchDetails: result.matchDetails || [],
    references: {
      observations: refObsIds.map((id) => {
        const obs = observations.find((o) => o.id === id);
        const match = (result.matchDetails || []).find((m) => m.type === "observation" && observations[m.index]?.id === id);
        return obs ? { id: obs.id, text: obs.text, trustScore: obs.trustScore, matchScore: match?.matchScore, matchFactors: match?.matchFactors, matchSummary: match?.matchSummary } : null;
      }).filter(Boolean),
      insights: refInsIds.map((id) => {
        const ins = insights.find((i) => i.id === id);
        const match = (result.matchDetails || []).find((m) => m.type === "insight" && insights[m.index]?.id === id);
        return ins ? { id: ins.id, text: ins.text, trustScore: ins.trustScore, matchScore: match?.matchScore, matchFactors: match?.matchFactors, matchSummary: match?.matchSummary } : null;
      }).filter(Boolean),
    },
  });
}

// PATCH: フィードバック送信 → self-improving loop
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const parsed = safeParse(QAFeedbackInput, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { sessionId, feedback } = parsed.data;

  // QASession更新
  const session = await prisma.qASession.update({
    where: { id: sessionId },
    data: { feedback },
  });

  let generatedInsights: { id: string; text: string }[] = [];

  // === self-improving loop 本体 ===
  // unhelpful/partial → 質問テーマに関連するObservationから追加Insightを自動生成
  if (feedback === "unhelpful" || feedback === "partial") {
    const refObsIds: string[] = session.referencedObservationIds
      ? JSON.parse(session.referencedObservationIds)
      : [];

    // 質問に関連するObservationを取得（参照済み + テキスト検索）
    const keywords = session.question.split(/\s+/).filter((w) => w.length >= 2).slice(0, 3);
    const relatedObs = await prisma.observation.findMany({
      where: {
        OR: [
          { id: { in: refObsIds } },
          ...keywords.map((kw) => ({ text: { contains: kw, mode: "insensitive" as const } })),
        ],
      },
      include: { tags: { include: { tag: true } } },
      take: 15,
    });

    if (relatedObs.length >= 2) {
      // LLMで追加Insightを生成
      const obsForLLM = relatedObs.map((o) => ({
        id: o.id,
        text: o.text,
        modelLayer: o.modelLayer,
        primaryValueAxis: o.primaryValueAxis,
        provenance: o.provenance,
        tagCodes: o.tags.map((t) => t.tag.code),
      }));

      try {
        const insightResult = await generateInsights(obsForLLM);

        for (const suggestion of insightResult.insights) {
          const insight = await prisma.insight.create({
            data: {
              text: suggestion.text,
              evidenceStrength: suggestion.evidenceStrength,
              generalizability: suggestion.generalizability,
              modelLayer: suggestion.modelLayer,
              primaryValueAxis: suggestion.primaryValueAxis,
              provenance: suggestion.provenance || "ANONYMIZED_DERIVED",
              applicableConditions: suggestion.applicableConditions,
              counterConditions: suggestion.counterConditions,
              trustScore: suggestion.evidenceStrength === "HIGH" ? 0.8 : suggestion.evidenceStrength === "MEDIUM" ? 0.5 : 0.2,
            },
          });

          // ObservationInsightLink作成
          for (const idx of suggestion.sourceObservationIndices || []) {
            if (idx >= 0 && idx < relatedObs.length) {
              await prisma.observationInsightLink.create({
                data: {
                  observationId: relatedObs[idx].id,
                  insightId: insight.id,
                  role: "supporting",
                },
              }).catch(() => {}); // duplicate無視
            }
          }

          generatedInsights.push({ id: insight.id, text: insight.text });
        }

        // QASessionに生成したInsightを記録
        if (generatedInsights.length > 0) {
          await prisma.qASession.update({
            where: { id: sessionId },
            data: { generatedInsightId: generatedInsights[0].id },
          });
        }

        // CompilationEvent: self-improving loop発動を記録
        await prisma.compilationEvent.create({
          data: {
            trigger: "qa_feedback",
            sourceType: "qa_session",
            sourceId: sessionId,
            resultType: "insight",
            resultId: generatedInsights[0]?.id,
            llmModel: process.env.LLM_PROVIDER === "anthropic" ? "claude-sonnet-4" : "gpt-4o",
          },
        });
      } catch (err) {
        console.error("Self-improving loop error:", err);
      }
    }
  }

  return NextResponse.json({
    feedback,
    selfImprovingLoop: generatedInsights.length > 0,
    generatedInsights,
  });
}
