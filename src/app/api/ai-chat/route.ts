import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";

// Detect if the message is casual/greeting vs knowledge query
function classifyIntent(text: string): "greeting" | "smalltalk" | "knowledge" {
  const greetings = /^(こんにちは|こんばんは|おはよう|はじめまして|やあ|ども|hi|hello|hey|お疲れ|おつかれ|よろしく|ありがとう|thanks|thank you|さようなら|バイバイ|bye|お元気|元気)/i;
  const smalltalk = /(天気|週末|趣味|好き|嫌い|今日は何|調子|気分|自己紹介|名前は|誰|何者|何ができる|どんなこと|help|ヘルプ|使い方|機能|できること)/i;

  if (greetings.test(text.trim())) return "greeting";
  if (smalltalk.test(text.trim())) return "smalltalk";
  return "knowledge";
}

// Casual response without DB lookup
function generateCasualResponse(question: string, userName: string, intent: "greeting" | "smalltalk"): string {
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "おはようございます" : hour < 18 ? "こんにちは" : "こんばんは";

  if (intent === "greeting") {
    const q = question.trim().toLowerCase();
    if (/ありがとう|thanks/.test(q)) {
      return `どういたしまして！${userName}さん、他にも気になることがあればいつでも聞いてくださいね。`;
    }
    if (/お疲れ|おつかれ/.test(q)) {
      return `${userName}さん、お疲れさまです！今日も一日お疲れさまでした。何かお手伝いできることはありますか？`;
    }
    if (/よろしく/.test(q)) {
      return `こちらこそよろしくお願いします、${userName}さん！知見DBの検索や分析、なんでもお気軽にどうぞ。`;
    }
    if (/さようなら|バイバイ|bye/.test(q)) {
      return `${userName}さん、またいつでもお声がけください！お疲れさまでした。`;
    }
    return `${timeGreeting}、${userName}さん！\nTorino Garden知見DBのAIアシスタントです。店舗行動観察に関する質問はもちろん、雑談もOKですよ。\n\n何かお手伝いできることはありますか？`;
  }

  // smalltalk
  const q = question.trim();
  if (/自己紹介|名前|誰|何者/.test(q)) {
    return `私はTorino Gardenの知見AIアシスタントです！\n\n${userName}さんの業務をサポートするために、こんなことができます：\n- 店舗行動観察の知見検索・分析\n- 業種別のベストプラクティス提案\n- データの傾向やインパクト分析\n- もちろん、ちょっとした雑談も\n\nお気軽に何でも聞いてください！`;
  }
  if (/何ができる|できること|機能|使い方|ヘルプ|help/.test(q)) {
    return `もちろんです！こんなことが得意です：\n\n**知見検索**\n「声掛けの効果は？」「離職率を下げるには？」のように質問してみてください。\n\n**業種別分析**\n「小売業の成功事例」「飲食店の動線改善」など業種を指定できます。\n\n**深掘り対話**\n気になる回答があれば「もっと詳しく」「具体的には？」と続けてください。\n\n**雑談**\n息抜きの会話もお任せください！`;
  }
  if (/天気/.test(q)) {
    return `残念ながら天気予報の機能は持っていないんです。でも、天気に関係なく${userName}さんのナレッジ検索はいつでもサポートしますよ！\n\n何か調べたいことはありますか？`;
  }
  if (/調子|気分|元気/.test(q)) {
    return `聞いてくれてありがとうございます！私はいつでも元気いっぱいです。\n\n${userName}さんの方はいかがですか？何か気になるデータや知見があれば、一緒に見てみましょう！`;
  }

  return `なるほど、面白い質問ですね！\n\n私は店舗行動観察の知見を扱うAIなので、そちらの分野は特に得意です。でも${userName}さんとのおしゃべりも楽しいですよ。\n\n何か知見DBで調べたいことがあれば、いつでもどうぞ！`;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question, history } = await request.json() as {
    question: string;
    history?: { role: string; content: string }[];
  };
  if (!question) return NextResponse.json({ error: "質問を入力してください" }, { status: 400 });

  // Classify intent
  const intent = classifyIntent(question);

  // For greetings and smalltalk, respond naturally without DB search
  if (intent !== "knowledge") {
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    const provider = process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "anthropic");

    if (apiKey) {
      // Use LLM for natural conversation
      const chatPrompt = `あなたはTorino Garden知見DBのAIアシスタント「TG」です。
ユーザー名は「${user.name}」さんです。

性格:
- フレンドリーで親しみやすい、でも丁寧
- ユーモアを交えつつもプロフェッショナル
- 店舗行動観察・小売コンサルティングの専門知識を持つ
- ユーザーの名前を時々呼んで親近感を出す
- 絵文字は使わない、でも温かみのある文体

できること:
- DB内の店舗行動観察知見の検索・分析
- 業種別のベストプラクティス提案
- 雑談や世間話にも自然に応じる

雑談の場合でも、自然に業務の話に繋げることができればベター（でも無理はしない）。
回答は日本語で。`;

      try {
        let answer: string;
        if (provider === "anthropic") {
          answer = await callAnthropic(apiKey, chatPrompt, question, history);
        } else {
          answer = await callOpenAI(apiKey, chatPrompt, question, history);
        }
        return NextResponse.json({ answer, sources: [] });
      } catch (err) {
        console.error("[AI-Chat] LLM casual call failed:", err);
        // Fall through to fallback
      }
    }

    // Fallback casual response
    const answer = generateCasualResponse(question, user.name, intent);
    return NextResponse.json({ answer, sources: [] });
  }

  // === Knowledge query: search DB ===
  const allText = [question, ...(history || []).map((m) => m.content)].join(" ");
  const keywords = allText.split(/[\s、。？！]+/).filter((w: string) => w.length > 1);

  const observations = await prisma.observation.findMany({
    where: keywords.length > 0 ? {
      OR: keywords.flatMap((kw: string) => [
        { text: { contains: kw } },
        { textEn: { contains: kw } },
      ]),
    } : {},
    include: {
      tags: { include: { tag: true } },
      store: { include: { client: { select: { name: true, industryMajor: true, industryMinor: true } } } },
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ trustScore: "desc" }, { estimatedImpactMax: { sort: "desc", nulls: "last" } }],
    take: 15,
  });

  const insights = await prisma.insight.findMany({
    where: keywords.length > 0 ? {
      OR: keywords.flatMap((kw: string) => [
        { text: { contains: kw } },
        { textEn: { contains: kw } },
      ]),
    } : {},
    include: { tags: { include: { tag: true } } },
    orderBy: [{ trustScore: "desc" }],
    take: 10,
  });

  const patterns = await prisma.crossIndustryPattern.findMany({
    orderBy: [{ trustScore: "desc" }, { estimatedImpactMax: { sort: "desc", nulls: "last" } }],
    take: 5,
  });

  let allObs = observations;
  if (allObs.length === 0) {
    allObs = await prisma.observation.findMany({
      include: {
        tags: { include: { tag: true } },
        store: { include: { client: { select: { name: true, industryMajor: true, industryMinor: true } } } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ trustScore: "desc" }, { estimatedImpactMax: { sort: "desc", nulls: "last" } }],
      take: 15,
    });
  }

  // Build context
  const obsContext = allObs.map((o) => {
    const projLabel = o.provenance === "FIELD_OBSERVED" && o.project ? `[PJ:${o.project.name || o.project.id}]` : "";
    const clientLabel = o.store?.client ? `${o.store.client.industryMajor}/${o.store.client.industryMinor || ""}(${o.store.client.name})` : "";
    const impact = o.estimatedImpactMin && o.estimatedImpactMax ? `${o.estimatedImpactMin}%-${o.estimatedImpactMax}%` : "";
    const trust = o.trustScore === 3 ? "3層裏付け" : o.trustScore === 2 ? "2層裏付け" : "単独";
    return `- ${projLabel}${o.text} [${o.modelLayer}][信頼:${trust}]${impact ? `[インパクト:${impact} ${o.impactKPI || ""}]` : ""}${clientLabel ? `[${clientLabel}]` : ""}`;
  }).join("\n");

  const insContext = insights.map((i) => {
    return `- ${i.text} [信頼:${i.trustScore}]${i.estimatedImpactMax ? `[インパクト:${i.estimatedImpactMin}%-${i.estimatedImpactMax}%]` : ""}`;
  }).join("\n");

  const patContext = patterns.map((p) => {
    return `- ${p.name}: ${p.description} [業種:${p.industries}]`;
  }).join("\n");

  const systemPrompt = `あなたはTorino Garden知見DBのAIアシスタント「TG」です。
ユーザー名は「${user.name}」さんです。

性格:
- フレンドリーで親しみやすい、でも丁寧
- データに基づいた回答を心がけるプロフェッショナル
- ユーザーの名前を時々呼んで親近感を出す
- 絵文字は使わない

回答ルール:
1. DB内の知見を根拠として引用してください
2. 固有知(FIELD_OBSERVED)の場合はPJ番号を表示してください
3. 信頼度（単独/2層裏付け/3層裏付け）を明記してください
4. 想定インパクト（%レンジ）があれば併記してください
5. 回答は分かりやすく、箇条書きを活用してください
6. 該当する知見がない場合は正直に伝えつつ、別の角度を提案してください
7. 堅苦しくなりすぎず、会話の流れを大切にしてください

以下がDB内の関連知見です:

【観測事実】
${obsContext || "該当なし"}

【インサイト】
${insContext || "該当なし"}

【業種横断パターン】
${patContext || "該当なし"}`;

  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const provider = process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "anthropic");

  if (!apiKey) {
    const answer = generateFallbackAnswer(question, user.name, allObs, insights);
    return NextResponse.json({ answer, sources: formatSources(allObs) });
  }

  try {
    let answer: string;
    if (provider === "anthropic") {
      answer = await callAnthropic(apiKey, systemPrompt, question, history);
    } else {
      answer = await callOpenAI(apiKey, systemPrompt, question, history);
    }
    return NextResponse.json({ answer, sources: formatSources(allObs) });
  } catch (err) {
    console.error("[AI-Chat] LLM call failed:", err);
    const answer = generateFallbackAnswer(question, user.name, allObs, insights);
    return NextResponse.json({ answer, sources: formatSources(allObs) });
  }
}

type ObsWithRelations = {
  id: string; text: string; textEn: string | null; modelLayer: string;
  provenance: string; trustScore: number; estimatedImpactMin: number | null;
  estimatedImpactMax: number | null; impactKPI: string | null;
  project: { id: string; name: string } | null;
  store: { client: { name: string; industryMajor: string; industryMinor: string | null } } | null;
};

function formatSources(obs: ObsWithRelations[]) {
  return obs.slice(0, 5).map((o) => ({
    id: o.id,
    text: o.text,
    modelLayer: o.modelLayer,
    provenance: o.provenance,
    trustScore: o.trustScore,
    projectName: o.project?.name || null,
    projectId: o.project?.id || null,
    clientName: o.store?.client?.name || null,
    impactRange: o.estimatedImpactMin && o.estimatedImpactMax
      ? `${o.estimatedImpactMin}%-${o.estimatedImpactMax}%` : null,
    impactKPI: o.impactKPI,
  }));
}

function generateFallbackAnswer(
  question: string,
  userName: string,
  obs: ObsWithRelations[],
  insights: { text: string; trustScore: number; estimatedImpactMin: number | null; estimatedImpactMax: number | null; impactKPI: string | null }[]
): string {
  if (obs.length === 0 && insights.length === 0) {
    return `${userName}さん、残念ながら「${question}」に該当する知見がDBに見つかりませんでした。\n\n別のキーワードで試してみるか、もう少し具体的に教えていただけますか？`;
  }

  let answer = `${userName}さん、「${question}」について調べてみました！関連する知見が${obs.length}件見つかりました。\n\n`;

  const highTrust = obs.filter((o) => o.trustScore >= 2);
  if (highTrust.length > 0) {
    answer += "**特に信頼度の高い知見はこちらです：**\n";
    for (const o of highTrust.slice(0, 5)) {
      const projLabel = o.provenance === "FIELD_OBSERVED" && o.project ? `[PJ:${o.project.name}] ` : "";
      const trust = o.trustScore === 3 ? "◈3層裏付け" : "◉2層裏付け";
      const impact = o.estimatedImpactMin && o.estimatedImpactMax ? ` (${o.estimatedImpactMin}%-${o.estimatedImpactMax}% ${o.impactKPI || ""})` : "";
      answer += `- ${projLabel}${o.text} ${trust}${impact}\n`;
    }
  }

  const fieldObs = obs.filter((o) => o.provenance === "FIELD_OBSERVED");
  if (fieldObs.length > 0 && highTrust.length === 0) {
    answer += "**現場観察からの知見：**\n";
    for (const o of fieldObs.slice(0, 5)) {
      const projLabel = o.project ? `[PJ:${o.project.name}] ` : "";
      answer += `- ${projLabel}${o.text}\n`;
    }
  }

  if (insights.length > 0) {
    answer += "\n**関連するインサイトもあります：**\n";
    for (const i of insights.slice(0, 3)) {
      answer += `- ${i.text}\n`;
    }
  }

  answer += "\n気になるポイントがあれば、もっと詳しくお伝えしますよ！";

  return answer;
}

async function callOpenAI(
  apiKey: string, systemPrompt: string, question: string,
  history?: { role: string; content: string }[]
): Promise<string> {
  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];
  if (history && history.length > 1) {
    for (const msg of history.slice(0, -1)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: "user", content: question });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.6,
      max_tokens: 1000,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "回答を生成できませんでした。";
}

async function callAnthropic(
  apiKey: string, systemPrompt: string, question: string,
  history?: { role: string; content: string }[]
): Promise<string> {
  const messages: { role: string; content: string }[] = [];
  if (history && history.length > 1) {
    for (const msg of history.slice(0, -1)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: "user", content: question });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || "回答を生成できませんでした。";
}
