import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  await prisma.similarityClusterMember.deleteMany();
  await prisma.similarityCluster.deleteMany();
  await prisma.crossIndustryPattern.deleteMany();
  await prisma.insightTag.deleteMany();
  await prisma.insight.deleteMany();
  await prisma.observationTag.deleteMany();
  await prisma.observation.deleteMany();
  await prisma.spatialZone.deleteMany();
  await prisma.project.deleteMany();
  await prisma.store.deleteMany();
  await prisma.client.deleteMany();
  await prisma.ontologyTag.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // ========== OntologyTag Master (98 tags) ==========

  const behaviorMovement = [
    { code: "entry", ja: "入店", en: "Entry", desc: "顧客の店舗への入店行動" },
    { code: "exit", ja: "退店", en: "Exit", desc: "顧客の店舗からの退店行動" },
    { code: "circulation", ja: "回遊", en: "Circulation", desc: "店内を回遊する行動" },
    { code: "stop", ja: "立ち止まり", en: "Stop", desc: "特定地点での立ち止まり" },
    { code: "pass_through", ja: "通過", en: "Pass Through", desc: "特定エリアの素通り" },
    { code: "u_turn", ja: "Uターン", en: "U-Turn", desc: "進行方向の反転" },
    { code: "route_choice", ja: "経路選択", en: "Route Choice", desc: "複数経路からの選択行動" },
    { code: "staff_movement", ja: "スタッフ動線", en: "Staff Movement", desc: "スタッフの移動パターン" },
    { code: "queue", ja: "待ち行列", en: "Queue", desc: "レジ・サービス待ち" },
  ];
  const behaviorApproach = [
    { code: "greeting", ja: "声掛け", en: "Greeting", desc: "スタッフから顧客への最初の声掛け" },
    { code: "eye_contact", ja: "アイコンタクト", en: "Eye Contact", desc: "視線による接触" },
    { code: "product_touch", ja: "商品タッチ", en: "Product Touch", desc: "商品への手触り・試着" },
    { code: "trial", ja: "試着・試用", en: "Trial", desc: "商品の試着・試用体験" },
    { code: "needs_hearing", ja: "ニーズヒアリング", en: "Needs Hearing", desc: "顧客ニーズの聞き取り" },
    { code: "proposal", ja: "提案", en: "Proposal", desc: "商品やサービスの提案" },
    { code: "demonstration", ja: "デモンストレーション", en: "Demonstration", desc: "商品の実演" },
    { code: "explanation", ja: "説明", en: "Explanation", desc: "商品・サービスの説明" },
    { code: "closing", ja: "クロージング", en: "Closing", desc: "購入決定への誘導" },
    { code: "follow_up", ja: "フォローアップ", en: "Follow Up", desc: "購入後のフォロー" },
  ];
  const behaviorBreakdown = [
    { code: "missed_contact", ja: "接触機会逸失", en: "Missed Contact", desc: "声掛けタイミングを逃す" },
    { code: "wait_abandonment", ja: "待ち離脱", en: "Wait Abandonment", desc: "待ち時間による離脱" },
    { code: "staff_absence", ja: "スタッフ不在", en: "Staff Absence", desc: "必要時にスタッフがいない" },
    { code: "post_contact_drop", ja: "接触後離脱", en: "Post-Contact Drop", desc: "接客後の購入離脱" },
    { code: "quality_degradation", ja: "品質劣化", en: "Quality Degradation", desc: "��ービス品質の低下" },
    { code: "capacity_overload", ja: "キャパシティ超過", en: "Capacity Overload", desc: "処理能力の超過" },
    { code: "process_error", ja: "プロセスエラー", en: "Process Error", desc: "業務プロセス上のミス" },
    { code: "customer_confusion", ja: "顧客混乱", en: "Customer Confusion", desc: "顧客の迷い・混乱" },
  ];
  const behaviorTransfer = [
    { code: "shadowing", ja: "シャドーイング", en: "Shadowing", desc: "先輩の業務を観察して学ぶ" },
    { code: "handoff", ja: "引き継ぎ", en: "Handoff", desc: "シフト間の業務引き継ぎ" },
    { code: "checklist", ja: "チェックリスト", en: "Checklist", desc: "業務チェックリストの活用" },
    { code: "peer_sharing", ja: "ピア共有", en: "Peer Sharing", desc: "同僚間のノウハウ共有" },
    { code: "manual_reference", ja: "マニュアル参照", en: "Manual Reference", desc: "マニュアルの参照・活用" },
    { code: "coaching", ja: "コーチング", en: "Coaching", desc: "上司・先輩からの指導" },
    { code: "pattern_replication", ja: "パタ���ン複製", en: "Pattern Replication", desc: "成功パターンの他店展開" },
  ];

  const contextTags = [
    { code: "peak_hour", ja: "ピーク時間帯", en: "Peak Hour" },
    { code: "off_peak", ja: "閑散時間帯", en: "Off-Peak" },
    { code: "opening", ja: "開店時", en: "Opening" },
    { code: "closing_time", ja: "閉店時", en: "Closing Time" },
    { code: "seasonal_peak", ja: "季節ピーク", en: "Seasonal Peak" },
    { code: "solo_staff", ja: "1人体制", en: "Solo Staff" },
    { code: "duo_staff", ja: "2人体制", en: "Duo Staff" },
    { code: "full_staff", ja: "フル体制", en: "Full Staff" },
    { code: "newbie_on_floor", ja: "新��配置", en: "Newbie on Floor" },
    { code: "veteran_only", ja: "ベテランのみ", en: "Veteran Only" },
    { code: "mixed_experience", ja: "混合経験", en: "Mixed Experience" },
    { code: "purpose_visit", ja: "目的来店", en: "Purpose Visit" },
    { code: "browse_visit", ja: "ブラウズ来店", en: "Browse Visit" },
    { code: "group_visit", ja: "グループ来店", en: "Group Visit" },
    { code: "solo_visit", ja: "一人来店", en: "Solo Visit" },
    { code: "first_visit", ja: "初回来店", en: "First Visit" },
    { code: "repeat_visit", ja: "リピート来店", en: "Repeat Visit" },
    { code: "high_intent", ja: "購買意欲高", en: "High Intent" },
    { code: "low_intent", ja: "購買意欲低", en: "Low Intent" },
    { code: "sc_location", ja: "SC立地", en: "Shopping Center" },
    { code: "street_location", ja: "路面立地", en: "Street Location" },
    { code: "department_store", ja: "百貨店立地", en: "Department Store" },
    { code: "airport_station", ja: "空港・駅立地", en: "Airport/Station" },
  ];

  const spaceTags = [
    { code: "entrance", ja: "入口", en: "Entrance" },
    { code: "storefront", ja: "店頭", en: "Storefront" },
    { code: "main_display", ja: "メイン什器", en: "Main Display" },
    { code: "sub_display", ja: "サブ什器", en: "Sub Display" },
    { code: "trial_area", ja: "試着・試用エリア", en: "Trial Area" },
    { code: "service_counter", ja: "サービスカウンター", en: "Service Counter" },
    { code: "checkout", ja: "レジ", en: "Checkout" },
    { code: "waiting_area", ja: "待合エリア", en: "Waiting Area" },
    { code: "backyard", ja: "バックヤード", en: "Backyard" },
    { code: "workstation", ja: "ワークステーション", en: "Workstation" },
    { code: "transition_zone", ja: "遷移ゾーン", en: "Transition Zone" },
  ];

  const theoryTags = [
    { code: "anchoring", ja: "アンカリング", en: "Anchoring", cat: "意思決定系" },
    { code: "hicks_law", ja: "ヒックの法則", en: "Hick's Law", cat: "意思決定系" },
    { code: "paradox_of_choice", ja: "選択のパラドックス", en: "Paradox of Choice", cat: "意思決定系" },
    { code: "default_effect", ja: "デフォルト効果", en: "Default Effect", cat: "意思決定系" },
    { code: "framing", ja: "フレーミング", en: "Framing", cat: "意思決定系" },
    { code: "mere_exposure", ja: "単純接触効果", en: "Mere Exposure", cat: "接点・接客系" },
    { code: "social_proof", ja: "社会的証明", en: "Social Proof", cat: "接点・接客系" },
    { code: "reciprocity", ja: "返報性", en: "Reciprocity", cat: "接点・接客系" },
    { code: "peak_end_rule", ja: "ピークエンドの法則", en: "Peak-End Rule", cat: "接点・接客系" },
    { code: "primacy_recency", ja: "初頭・親近効果", en: "Primacy-Recency", cat: "接点・接客系" },
    { code: "right_turn_bias", ja: "右回り傾向", en: "Right-Turn Bias", cat: "空間・動線・身体系" },
    { code: "gruen_transfer", ja: "グルーエン効果", en: "Gruen Transfer", cat: "空間・動線・身体系" },
    { code: "attention_bottleneck", ja: "注意のボトルネック", en: "Attention Bottleneck", cat: "空間・動線・身体系" },
    { code: "golden_zone", ja: "ゴールデンゾーン", en: "Golden Zone", cat: "空間・動線・身体系" },
    { code: "fatigue_curve", ja: "疲労曲線", en: "Fatigue Curve", cat: "空間・動線・身体系" },
    { code: "proxemics", ja: "プロクセミクス", en: "Proxemics", cat: "空間・動線・身体系" },
    { code: "wayfinding", ja: "ウェイファインディング", en: "Wayfinding", cat: "空間・動線・身体系" },
    { code: "loss_aversion", ja: "損失回避", en: "Loss Aversion", cat: "離脱・待ち系" },
    { code: "wait_perception", ja: "待ち時間知覚", en: "Wait Perception", cat: "離脱・待ち系" },
    { code: "goal_gradient", ja: "ゴール勾配効果", en: "Goal Gradient", cat: "離脱・待ち系" },
    { code: "cognitive_load", ja: "認知負荷", en: "Cognitive Load", cat: "認知・学習系" },
    { code: "schema", ja: "スキーマ", en: "Schema", cat: "認知・学習系" },
    { code: "working_memory", ja: "ワーキングメモリ", en: "Working Memory", cat: "認知・学習系" },
    { code: "mirror_neuron", ja: "ミラーニューロン", en: "Mirror Neuron", cat: "認知・学習系" },
    { code: "automaticity", ja: "自動化", en: "Automaticity", cat: "認知・学習系" },
    { code: "spacing_effect", ja: "分散効果", en: "Spacing Effect", cat: "認知・学習系" },
    { code: "desirable_difficulty", ja: "望ましい困難", en: "Desirable Difficulty", cat: "認知・学習系" },
    { code: "observational_learning", ja: "観察学習", en: "Observational Learning", cat: "認知・学習系" },
    { code: "chunking", ja: "チャンキング", en: "Chunking", cat: "認知・学習系" },
    { code: "psychological_safety", ja: "心理的安全性", en: "Psychological Safety", cat: "組織・定着系" },
  ];

  // Create all tags
  const allBehavior = [
    ...behaviorMovement.map((t) => ({ ...t, ml: "MOVEMENT" })),
    ...behaviorApproach.map((t) => ({ ...t, ml: "APPROACH" })),
    ...behaviorBreakdown.map((t) => ({ ...t, ml: "BREAKDOWN" })),
    ...behaviorTransfer.map((t) => ({ ...t, ml: "TRANSFER" })),
  ];
  for (const t of allBehavior) {
    await prisma.ontologyTag.create({ data: { type: "BEHAVIOR", code: t.code, displayNameJa: t.ja, displayNameEn: t.en, description: t.desc, modelLayer: t.ml } });
  }
  for (const t of contextTags) {
    await prisma.ontologyTag.create({ data: { type: "CONTEXT", code: t.code, displayNameJa: t.ja, displayNameEn: t.en } });
  }
  for (const t of spaceTags) {
    await prisma.ontologyTag.create({ data: { type: "SPACE", code: t.code, displayNameJa: t.ja, displayNameEn: t.en } });
  }
  for (const t of theoryTags) {
    await prisma.ontologyTag.create({ data: { type: "THEORY", code: t.code, displayNameJa: t.ja, displayNameEn: t.en, category: t.cat } });
  }

  // ========== Clients with industry taxonomy ==========

  const owndays = await prisma.client.create({
    data: {
      name: "OWNDAYS",
      industryMajor: "小売", industryMajorEn: "Retail",
      industryMinor: "眼鏡", industryMinorEn: "Eyewear",
      scale: "中堅",
      stores: {
        create: [
          { name: "柏店", locationType: "SC", area: 60, staffCount: 5, address: "千葉県柏市" },
          { name: "伊丹昆陽店", locationType: "SC", area: 55, staffCount: 4, address: "兵庫県伊丹市" },
        ],
      },
    },
    include: { stores: true },
  });

  const restaurantA = await prisma.client.create({
    data: {
      name: "飲食A社",
      industryMajor: "飲食", industryMajorEn: "Food & Beverage",
      industryMinor: "カジュアルダイニング", industryMinorEn: "Casual Dining",
      scale: "中小",
      stores: { create: [{ name: "渋谷店", locationType: "路面", area: 80, staffCount: 8, address: "東京都渋谷区" }] },
    },
    include: { stores: true },
  });

  const apparelB = await prisma.client.create({
    data: {
      name: "アパレルB社",
      industryMajor: "小売", industryMajorEn: "Retail",
      industryMinor: "カジュアルウェア", industryMinorEn: "Casual Wear",
      scale: "中堅",
      stores: { create: [{ name: "���宿店", locationType: "百貨店", area: 120, staffCount: 10, address: "東京都新宿区" }] },
    },
    include: { stores: true },
  });

  await prisma.client.create({
    data: {
      name: "不動産C社",
      industryMajor: "不動産", industryMajorEn: "Real Estate",
      industryMinor: "仲介", industryMinorEn: "Brokerage",
      scale: "大手",
    },
  });

  await prisma.client.create({
    data: {
      name: "美容室D社",
      industryMajor: "サービス", industryMajorEn: "Service",
      industryMinor: "美容", industryMinorEn: "Beauty Salon",
      scale: "中小",
    },
  });

  await prisma.client.create({
    data: {
      name: "保険E社",
      industryMajor: "金融", industryMajorEn: "Finance",
      industryMinor: "保険", industryMinorEn: "Insurance",
      scale: "大手",
    },
  });

  // ========== Project ==========
  const project = await prisma.project.create({
    data: {
      clientId: owndays.id,
      name: "OWNDAYS接客最適化プロジェクト",
      hypothesisTheme: "声掛けタイミングと接客品質の最適化",
      primaryValueAxis: "REVENUE_UP",
      targetKPI: "接客発生率・成約率",
      status: "active",
      startDate: new Date("2024-04-01"),
    },
  });

  const tag = async (code: string) => {
    const t = await prisma.ontologyTag.findUnique({ where: { code } });
    if (!t) throw new Error(`Tag not found: ${code}`);
    return t;
  };

  // ========== Observations (20) with impact ranges & trust ==========
  // trustScore: 3 = 固有知+汎用知+公知で裏付け, 2 = 2層裏付け, 1 = 単独

  const obsData: {
    text: string; textEn: string; ml: string; prov: string; va: string;
    conf: string; impMin: number; impMax: number; kpi: string;
    trust: number; tagCodes: string[];
    projId?: string; storeId?: string;
    srcType?: string; srcTitle?: string;
    observedAt: string; // 観測日 YYYY-MM-DD
  }[] = [
    // FIELD_OBSERVED (10)
    { text: "入店後3秒以内の声掛けで接客発生率が2.1倍に向上", textEn: "Greeting within 3 sec of entry increases service engagement by 2.1x", ml: "APPROACH", prov: "FIELD_OBSERVED", va: "REVENUE_UP", conf: "HIGH", impMin: 8, impMax: 15, kpi: "売上", trust: 3, tagCodes: ["greeting", "mere_exposure"], projId: project.id, storeId: owndays.stores[0].id, observedAt: "2024-05-12" },
    { text: "2択比較提案時の成約率は3択以上と比較して32%高い", textEn: "Binary-choice proposals yield 32% higher close rate vs 3+ options", ml: "APPROACH", prov: "FIELD_OBSERVED", va: "REVENUE_UP", conf: "HIGH", impMin: 5, impMax: 10, kpi: "売上", trust: 3, tagCodes: ["proposal", "hicks_law"], projId: project.id, storeId: owndays.stores[0].id, observedAt: "2024-05-18" },
    { text: "ピーク時スタッフ3名以下で接客品質が急落（60㎡店舗）", textEn: "Service quality drops sharply below 3 staff during peak (60sqm store)", ml: "BREAKDOWN", prov: "FIELD_OBSERVED", va: "COST_DOWN", conf: "HIGH", impMin: 10, impMax: 20, kpi: "コスト削減率", trust: 2, tagCodes: ["capacity_overload", "cognitive_load"], projId: project.id, storeId: owndays.stores[0].id, observedAt: "2024-06-03" },
    { text: "スタッフ作業動線30cm短縮で累計移動距離15%減少", textEn: "30cm shorter staff workflow path cuts cumulative distance 15%", ml: "MOVEMENT", prov: "FIELD_OBSERVED", va: "COST_DOWN", conf: "MEDIUM", impMin: 3, impMax: 5, kpi: "コスト削減率", trust: 1, tagCodes: ["staff_movement", "fatigue_curve"], projId: project.id, storeId: owndays.stores[0].id, observedAt: "2024-06-15" },
    { text: "新人シャドーイング1日で独り立ち1週間短縮", textEn: "1-day shadowing shortens new-hire ramp-up by 1 week", ml: "TRANSFER", prov: "FIELD_OBSERVED", va: "RETENTION", conf: "HIGH", impMin: 5, impMax: 10, kpi: "離職率", trust: 2, tagCodes: ["shadowing", "observational_learning"], projId: project.id, storeId: owndays.stores[0].id, observedAt: "2024-07-08" },
    { text: "引き継ぎチェックリスト導入でシフト間ミス70%減", textEn: "Shift handoff checklist reduces errors by 70%", ml: "TRANSFER", prov: "FIELD_OBSERVED", va: "COST_DOWN", conf: "HIGH", impMin: 5, impMax: 8, kpi: "コスト削減率", trust: 1, tagCodes: ["checklist", "handoff", "chunking"], projId: project.id, storeId: owndays.stores[0].id, observedAt: "2024-07-22" },
    { text: "メガネ試着3回以上の顧客の購入率92%", textEn: "Customers trying 3+ frames purchase at 92% rate", ml: "APPROACH", prov: "FIELD_OBSERVED", va: "REVENUE_UP", conf: "HIGH", impMin: 10, impMax: 18, kpi: "売上", trust: 2, tagCodes: ["trial", "goal_gradient"], projId: project.id, storeId: owndays.stores[0].id, observedAt: "2024-08-05" },
    { text: "入口右側の棚の商品タッチ率が左側より28%高い", textEn: "Right-side shelf product touch rate 28% higher than left", ml: "MOVEMENT", prov: "FIELD_OBSERVED", va: "REVENUE_UP", conf: "MEDIUM", impMin: 3, impMax: 7, kpi: "売上", trust: 3, tagCodes: ["circulation", "product_touch", "right_turn_bias"], projId: project.id, storeId: owndays.stores[0].id, observedAt: "2024-08-19" },
    { text: "閑散時間帯のスタッフ配置最適化で人件費12%削減", textEn: "Off-peak staff reallocation cuts labor cost by 12%", ml: "MOVEMENT", prov: "FIELD_OBSERVED", va: "COST_DOWN", conf: "MEDIUM", impMin: 8, impMax: 12, kpi: "コスト削減率", trust: 1, tagCodes: ["staff_movement", "off_peak"], projId: project.id, storeId: owndays.stores[0].id, observedAt: "2024-09-10" },
    { text: "朝礼での成功事例共有がチーム帰属意識を高め離職率12%低下", textEn: "Morning briefing success sharing lowers turnover by 12%", ml: "TRANSFER", prov: "FIELD_OBSERVED", va: "RETENTION", conf: "MEDIUM", impMin: 8, impMax: 12, kpi: "離職率", trust: 3, tagCodes: ["peer_sharing", "psychological_safety"], projId: project.id, storeId: owndays.stores[0].id, observedAt: "2024-10-01" },
    // ANONYMIZED_DERIVED (4)
    { text: "小売SC立地60㎡で接客あり購入率は接客なし比4倍", textEn: "In SC retail 60sqm, service-engaged purchase rate is 4x", ml: "APPROACH", prov: "ANONYMIZED_DERIVED", va: "REVENUE_UP", conf: "HIGH", impMin: 15, impMax: 25, kpi: "売上", trust: 2, tagCodes: ["greeting", "sc_location"], observedAt: "2024-11-15" },
    { text: "サービス業全般で声掛け応答率はピーク時に40%低下", textEn: "Greeting response rate drops 40% during peak hours across service industry", ml: "BREAKDOWN", prov: "ANONYMIZED_DERIVED", va: "COST_DOWN", conf: "MEDIUM", impMin: 5, impMax: 10, kpi: "コスト削減率", trust: 2, tagCodes: ["peak_hour", "missed_contact"], observedAt: "2024-12-01" },
    { text: "入口右側への自然な流入傾向は業種を問わず60-70%", textEn: "Natural right-side entry flow is 60-70% across all industries", ml: "MOVEMENT", prov: "ANONYMIZED_DERIVED", va: "REVENUE_UP", conf: "MEDIUM", impMin: 3, impMax: 7, kpi: "売上", trust: 2, tagCodes: ["entry", "right_turn_bias"], observedAt: "2025-01-10" },
    { text: "新人の独り立ち期間はシャドーイング有無で平均5日差", textEn: "Shadowing vs. no-shadowing creates 5-day gap in new-hire independence", ml: "TRANSFER", prov: "ANONYMIZED_DERIVED", va: "RETENTION", conf: "MEDIUM", impMin: 3, impMax: 8, kpi: "離職率", trust: 2, tagCodes: ["shadowing", "newbie_on_floor"], observedAt: "2025-02-05" },
    // PUBLIC_CODIFIED (6)
    { text: "選択肢が3つ以上になると意思決定が平均40%遅延（Hick's Law研究）", textEn: "3+ options slow decision-making by 40% avg (Hick's Law)", ml: "APPROACH", prov: "PUBLIC_CODIFIED", va: "REVENUE_UP", conf: "HIGH", impMin: 5, impMax: 10, kpi: "売上", trust: 1, tagCodes: ["hicks_law"], srcType: "academic", srcTitle: "Hick's Law研究", observedAt: "2023-06-01" },
    { text: "体感待ち時間は実測の1.3〜2.0倍（待ち時間心理学メタ分析）", textEn: "Perceived wait time is 1.3-2.0x actual (meta-analysis)", ml: "BREAKDOWN", prov: "PUBLIC_CODIFIED", va: "COST_DOWN", conf: "HIGH", impMin: 5, impMax: 12, kpi: "コスト削減率", trust: 1, tagCodes: ["wait_perception"], srcType: "academic", srcTitle: "待ち時間心理学メタ分析", observedAt: "2022-03-15" },
    { text: "分散型研修は集中型と比較して定着率2.3倍（spacing effect研究）", textEn: "Spaced training yields 2.3x retention vs massed training", ml: "TRANSFER", prov: "PUBLIC_CODIFIED", va: "RETENTION", conf: "HIGH", impMin: 10, impMax: 20, kpi: "離職率", trust: 1, tagCodes: ["spacing_effect"], srcType: "academic", srcTitle: "spacing effect研究", observedAt: "2021-09-01" },
    { text: "心理的安全性の高いチームは離職率が26%低い（Google Project Aristotle）", textEn: "Psychologically safe teams have 26% lower turnover (Google Aristotle)", ml: "TRANSFER", prov: "PUBLIC_CODIFIED", va: "RETENTION", conf: "HIGH", impMin: 15, impMax: 26, kpi: "離職率", trust: 1, tagCodes: ["psychological_safety"], srcType: "industry_report", srcTitle: "Google Project Aristotle", observedAt: "2019-01-01" },
    { text: "単純接触効果により接触回数と好意度は対数的に相関（Zajonc 1968追試）", textEn: "Mere-exposure effect: familiarity and liking correlate logarithmically", ml: "APPROACH", prov: "PUBLIC_CODIFIED", va: "REVENUE_UP", conf: "HIGH", impMin: 3, impMax: 8, kpi: "売上", trust: 1, tagCodes: ["mere_exposure"], srcType: "academic", srcTitle: "Zajonc 1968追試", observedAt: "2020-04-01" },
    { text: "ゴールデンゾーン（目線〜腰）の商品は棚全体売上の65%を占める", textEn: "Golden zone (eye-to-hip level) products account for 65% of shelf sales", ml: "MOVEMENT", prov: "PUBLIC_CODIFIED", va: "REVENUE_UP", conf: "HIGH", impMin: 8, impMax: 15, kpi: "売上", trust: 1, tagCodes: ["golden_zone"], srcType: "industry_report", srcTitle: "棚割り最適化研究", observedAt: "2023-11-01" },
  ];

  for (const o of obsData) {
    const obs = await prisma.observation.create({
      data: {
        text: o.text,
        textEn: o.textEn,
        modelLayer: o.ml,
        provenance: o.prov,
        primaryValueAxis: o.va,
        confidence: o.conf,
        estimatedImpactMin: o.impMin,
        estimatedImpactMax: o.impMax,
        impactKPI: o.kpi,
        trustScore: o.trust,
        projectId: o.projId || null,
        storeId: o.storeId || null,
        sourceType: o.srcType || null,
        sourceTitle: o.srcTitle || null,
        observedAt: new Date(o.observedAt),
      },
    });
    for (const code of o.tagCodes) {
      const t = await tag(code);
      await prisma.observationTag.create({ data: { observationId: obs.id, tagId: t.id } });
    }
  }

  // ========== Insights (10) ==========
  const insightData = [
    { text: "入店直後の声掛けタイミングが成約率に最も影響する", textEn: "Greeting timing immediately after entry is the strongest driver of close rate", es: "HIGH", va: "REVENUE_UP", ml: "APPROACH", prov: "FIELD_OBSERVED", impMin: 8, impMax: 15, kpi: "売上", trust: 3 },
    { text: "選択肢を2つに絞ることで意思決定速度と満足度が同時に向上", textEn: "Limiting to 2 options improves both decision speed and satisfaction", es: "HIGH", va: "REVENUE_UP", ml: "APPROACH", prov: "FIELD_OBSERVED", impMin: 5, impMax: 10, kpi: "売上", trust: 3 },
    { text: "店舗面積あたりの適正スタッフ数には明確な臨界点が存在する", textEn: "There is a clear tipping point for staff-to-floor ratio", es: "HIGH", va: "COST_DOWN", ml: "BREAKDOWN", prov: "ANONYMIZED_DERIVED", impMin: 10, impMax: 20, kpi: "コスト削減率", trust: 2 },
    { text: "スタッフ動線の微調整が累積的に大きなコスト削減効果を生む", textEn: "Minor workflow path adjustments create significant cumulative savings", es: "MEDIUM", va: "COST_DOWN", ml: "MOVEMENT", prov: "FIELD_OBSERVED", impMin: 3, impMax: 5, kpi: "コスト削減率", trust: 1 },
    { text: "シャドーイングは新人教育において最もROIの高い手法", textEn: "Shadowing is the highest-ROI method for new hire training", es: "HIGH", va: "RETENTION", ml: "TRANSFER", prov: "ANONYMIZED_DERIVED", impMin: 5, impMax: 10, kpi: "離職率", trust: 2 },
    { text: "チェックリストベースの引き継ぎは暗黙知の形式知化に有効", textEn: "Checklist-based handoffs effectively convert tacit knowledge to explicit", es: "HIGH", va: "COST_DOWN", ml: "TRANSFER", prov: "FIELD_OBSERVED", impMin: 5, impMax: 8, kpi: "コスト削減率", trust: 1 },
    { text: "試着・試用回数と購入確率には強い正の相関がある", textEn: "Trial count strongly correlates with purchase probability", es: "HIGH", va: "REVENUE_UP", ml: "APPROACH", prov: "FIELD_OBSERVED", impMin: 10, impMax: 18, kpi: "売上", trust: 2 },
    { text: "右回り動線は人間の自然な行動バイアスに基づく普遍的パターン", textEn: "Right-hand circulation is a universal behavioral bias pattern", es: "MEDIUM", va: "REVENUE_UP", ml: "MOVEMENT", prov: "ANONYMIZED_DERIVED", impMin: 3, impMax: 7, kpi: "売上", trust: 3 },
    { text: "閑散時間帯の人員配置最適化は最もリスクの低いコスト削減施策", textEn: "Off-peak staffing optimization is the lowest-risk cost reduction measure", es: "MEDIUM", va: "COST_DOWN", ml: "MOVEMENT", prov: "FIELD_OBSERVED", impMin: 8, impMax: 12, kpi: "コスト削減率", trust: 1 },
    { text: "心理的安全性は離職率低減の最も強力な予測因子", textEn: "Psychological safety is the strongest predictor of turnover reduction", es: "HIGH", va: "RETENTION", ml: "TRANSFER", prov: "PUBLIC_CODIFIED", impMin: 15, impMax: 26, kpi: "離職率", trust: 3 },
  ];
  for (const i of insightData) {
    await prisma.insight.create({
      data: {
        text: i.text, textEn: i.textEn, evidenceStrength: i.es,
        primaryValueAxis: i.va, modelLayer: i.ml, provenance: i.prov,
        estimatedImpactMin: i.impMin, estimatedImpactMax: i.impMax,
        impactKPI: i.kpi, trustScore: i.trust,
      },
    });
  }

  // ========== CrossIndustryPattern (3) ==========
  await prisma.crossIndustryPattern.create({
    data: {
      name: "声掛け3秒ルール", nameEn: "3-Second Greeting Rule",
      description: "入店後3秒以内の声掛けが接客発生率と成約率を大幅に向上させるパターン。眼鏡小売、アパレル、飲食業界で共通して観測。",
      descriptionEn: "Greeting within 3 seconds of entry significantly boosts engagement and close rate. Observed across eyewear, apparel, and F&B.",
      industries: JSON.stringify(["小売/眼鏡", "小売/カジュアルウェア", "飲食/カジュアルダイニング"]),
      modelLayer: "APPROACH", primaryValueAxis: "REVENUE_UP",
      estimatedImpactMin: 8, estimatedImpactMax: 15, impactKPI: "売上",
      trustScore: 3, insightCount: 23,
    },
  });
  await prisma.crossIndustryPattern.create({
    data: {
      name: "2択提案の優位性", nameEn: "Binary Choice Advantage",
      description: "選択肢を2つに絞った提案が3択以上と比較して高い成約率を実現。ヒックの法則に基づく普遍的な意思決定最適化。",
      descriptionEn: "Binary-choice proposals outperform 3+ option proposals. A universal decision optimization based on Hick's Law.",
      industries: JSON.stringify(["小売/眼鏡", "不動産/仲介", "金融/保険"]),
      modelLayer: "APPROACH", primaryValueAxis: "REVENUE_UP",
      estimatedImpactMin: 5, estimatedImpactMax: 10, impactKPI: "売上",
      trustScore: 3, insightCount: 18,
    },
  });
  await prisma.crossIndustryPattern.create({
    data: {
      name: "キャパシティ臨界点", nameEn: "Capacity Tipping Point",
      description: "店舗面積とスタッフ数の比率には明確な臨界点があり、これを下回ると接客品質が急激に低下。",
      descriptionEn: "There is a clear tipping point in staff-to-floor ratio; below it, service quality drops sharply.",
      industries: JSON.stringify(["小売/眼鏡", "飲食/カジュアルダイニング", "サービス/美容"]),
      modelLayer: "BREAKDOWN", primaryValueAxis: "COST_DOWN",
      estimatedImpactMin: 10, estimatedImpactMax: 20, impactKPI: "コスト削減率",
      trustScore: 2, insightCount: 15,
    },
  });

  // ========== SimilarityCluster (3) ==========
  await prisma.similarityCluster.create({
    data: {
      name: "声掛けタイミングと成約率", nameEn: "Greeting Timing & Close Rate",
      description: "声掛けのタイミング・方法と成約率の関連性", descriptionEn: "Correlation between greeting timing/method and close rate",
      memberCount: 47, modelLayer: "APPROACH", primaryValueAxis: "REVENUE_UP",
    },
  });
  await prisma.similarityCluster.create({
    data: {
      name: "選択肢の数と意思決定速度", nameEn: "Option Count & Decision Speed",
      description: "提案時の選択肢数が意思決定速度と成約率に与える影響", descriptionEn: "Impact of option count on decision speed and close rate",
      memberCount: 34, modelLayer: "APPROACH", primaryValueAxis: "REVENUE_UP",
    },
  });
  await prisma.similarityCluster.create({
    data: {
      name: "待ち時間と離脱率", nameEn: "Wait Time & Abandonment Rate",
      description: "待ち時間の長さと体感、顧客離脱率の関係", descriptionEn: "Relationship between wait duration, perception, and abandonment",
      memberCount: 29, modelLayer: "BREAKDOWN", primaryValueAxis: "COST_DOWN",
    },
  });

  // Create default users with hashed passwords
  function hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
  }

  await prisma.user.createMany({
    data: [
      { name: "管理者", email: "admin@torino-garden.com", passwordHash: hashPassword("admin123"), role: "admin" },
      { name: "田中太郎", email: "tanaka@torino-garden.com", passwordHash: hashPassword("tanaka123"), role: "consultant" },
      { name: "閲覧ユーザー", email: "viewer@torino-garden.com", passwordHash: hashPassword("viewer123"), role: "viewer" },
    ],
  });

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
