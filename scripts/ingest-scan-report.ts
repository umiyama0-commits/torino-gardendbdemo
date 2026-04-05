import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Tag code -> ID mapping from the database
const TAG_IDS: Record<string, string> = {
  // BEHAVIOR
  "greeting": "cmnkzp0p10009lvgvrwr47ile",
  "needs_hearing": "cmnkzp0p3000dlvgvvpsso7wm",
  "follow_up": "cmnkzp0p6000ilvgv7o7p1uzh",
  "checklist": "cmnkzp0pc000tlvgv0fbragm4",
  "closing": "cmnkzp0p5000hlvgvuz01yrtb",
  "circulation": "cmnkzp0ov0002lvgvvfzjkf1i",
  "stop": "cmnkzp0ow0003lvgvsded61ak",
  "route_choice": "cmnkzp0ox0006lvgv8j76bcas",
  "process_error": "cmnkzp0pa000rlvgviniq8ulv",  // wrong - let me fix
  "manual_reference": "cmnkzp0pd000vlvgv4irs42dv",
  "quality_degradation": "cmnkzp0p9000nlvgv9vf8awgv",
  "coaching": "cmnkzp0pd000wlvgvqqdxxftf",
  "shadowing": "cmnkzp0pa000rlvgviniq8ulv",
  "customer_confusion": "cmnkzp0pa000qlvgvgr06t7lu",
  "post_contact_drop": "cmnkzp0p8000mlvgvn2iy3aqo",
  "product_touch": "cmnkzp0p2000blvgvmk0rwbcb",
  "pass_through": "cmnkzp0ow0004lvgv0wbhbpt3",
  "staff_movement": "cmnkzp0oy0007lvgveq5koxg0",
  "pattern_replication": "cmnkzp0pe000xlvgvkm7dlhha",
  "peer_sharing": "cmnkzp0pc000ulvgv6ji4oz7g",
  "explanation": "cmnkzp0p5000glvgvsvh8e8j8",
  "missed_contact": "cmnkzp0p6000jlvgv7ak2d2tp",
  "eye_contact": "cmnkzp0p2000alvgvjenaqq6f",
  "proposal": "cmnkzp0p4000elvgv2r2mq47r",
  // CONTEXT
  "first_visit": "cmnkzp0pl001dlvgvhpfusdmo",
  "repeat_visit": "cmnkzp0pm001elvgvzo7syf16",
  "peak_hour": "cmnkzp0pe000ylvgv7hwto583",
  "seasonal_peak": "cmnkzp0pg0012lvgvghid9g5p",
  "newbie_on_floor": "cmnkzp0pi0016lvgvciqc4ppl",
  "mixed_experience": "cmnkzp0pj0018lvgv3v7fygim",
  "browse_visit": "cmnkzp0pk001alvgvee3przz3",
  "purpose_visit": "cmnkzp0pk0019lvgvnt6sqvdy",
  // SPACE
  "service_counter": "cmnkzp0pr001qlvgv7ygjbty8",
  "main_display": "cmnkzp0pq001nlvgv4r9rmbtk",
  "sub_display": "cmnkzp0pq001olvgvudt0fb6v",
  "transition_zone": "cmnkzp0pu001vlvgv0lgwy6rv",
  "backyard": "cmnkzp0pt001tlvgv5c6crgyp",
  "workstation": "cmnkzp0pt001ulvgvu7cw9m5m",
  "checkout": "cmnkzp0ps001rlvgvliuqie0h",
  "trial_area": "cmnkzp0pr001plvgvv3a27408",
  // THEORY
  "peak_end_rule": "cmnkzp0py0024lvgvjh90zbu9",
  "schema": "cmnkzp0q5002hlvgvvo0djjs4",
  "goal_gradient": "cmnkzp0q4002flvgv1xiifqnm",
  "wayfinding": "cmnkzp0q2002clvgvuxqraku3",
  "cognitive_load": "cmnkzp0q4002glvgvmu4x9nfd",
  "automaticity": "cmnkzp0q6002klvgvl2hn62ty",
  "spacing_effect": "cmnkzp0q6002llvgvnqbl9q7q",
  "psychological_safety": "cmnkzp0q9002plvgvuok48865",
  "paradox_of_choice": "cmnkzp0pv001ylvgvqny702yp",
  "attention_bottleneck": "cmnkzp0q00028lvgvtfoysd69",
  "gruen_transfer": "cmnkzp0pz0027lvgveiton8rb",
  "social_proof": "cmnkzp0px0022lvgvbywgqjwz",
};

// Fix: process_error and shadowing have correct IDs
// process_error: cmnkzp0pa000plvgvufe77w01
// shadowing: cmnkzp0pa000rlvgviniq8ulv
TAG_IDS["process_error"] = "cmnkzp0pa000plvgvufe77w01";

type ObsInput = {
  text: string;
  textEn: string;
  modelLayer: string;
  primaryValueAxis: string;
  provenance: string;
  confidence: string;
  estimatedImpactMin: number | null;
  estimatedImpactMax: number | null;
  impactKPI: string | null;
  observedAt: string;
  tagCodes: string[];
};

const observations: ObsInput[] = [
  {
    text: "Door代官山：顧客導線を14ステップに分解し各ステップでの接客行動・質問を標準化することでリピート率を安定化",
    textEn: "Door Daikanyama salon: Decomposed customer journey into 14 steps, standardized service behaviors and questions at each step, stabilizing repeat rate",
    modelLayer: "APPROACH",
    primaryValueAxis: "REVENUE_UP",
    provenance: "PUBLIC_CODIFIED",
    confidence: "MEDIUM",
    estimatedImpactMin: 5,
    estimatedImpactMax: 15,
    impactKPI: "リピート率",
    observedAt: "2024-01-15",
    tagCodes: ["greeting", "needs_hearing", "follow_up", "checklist", "first_visit", "repeat_visit", "service_counter", "peak_end_rule", "schema"],
  },
  {
    text: "髪屋こころ：カウンセリング時に来店周期を明示的に伝え次回予約に繋げるプロセスを標準化しリピート率8割超を達成",
    textEn: "Kamiya Kokoro salon: Standardized process of explicitly communicating optimal visit cycle during consultation and linking to next appointment, achieving 80%+ repeat rate",
    modelLayer: "APPROACH",
    primaryValueAxis: "REVENUE_UP",
    provenance: "PUBLIC_CODIFIED",
    confidence: "MEDIUM",
    estimatedImpactMin: 10,
    estimatedImpactMax: 20,
    impactKPI: "リピート率",
    observedAt: "2024-01-15",
    tagCodes: ["needs_hearing", "closing", "follow_up", "repeat_visit", "service_counter", "goal_gradient"],
  },
  {
    text: "カインズ：店内顧客行動履歴をデータ可視化し到達率×立ち止まり率のマトリックスで分析、商品陳列改善と売上アップを実現",
    textEn: "CAINZ home center: Visualized in-store customer behavior data, analyzed reach rate x stop rate matrix, improved product placement and increased sales",
    modelLayer: "MOVEMENT",
    primaryValueAxis: "REVENUE_UP",
    provenance: "PUBLIC_CODIFIED",
    confidence: "MEDIUM",
    estimatedImpactMin: 3,
    estimatedImpactMax: 10,
    impactKPI: "売上",
    observedAt: "2024-03-01",
    tagCodes: ["circulation", "stop", "route_choice", "main_display", "sub_display", "transition_zone", "wayfinding"],
  },
  {
    text: "セブン-イレブン：AIが天候・曜日・販売実績から需要予測し発注推奨量を提示、発注業務時間を約40%削減",
    textEn: "7-Eleven: AI integrates weather, day-of-week, and sales data to predict demand and suggest order quantities, reducing ordering time by ~40%",
    modelLayer: "TRANSFER",
    primaryValueAxis: "COST_DOWN",
    provenance: "PUBLIC_CODIFIED",
    confidence: "HIGH",
    estimatedImpactMin: 30,
    estimatedImpactMax: 40,
    impactKPI: "業務時間",
    observedAt: "2023-06-01",
    tagCodes: ["checklist", "process_error", "peak_hour", "seasonal_peak", "backyard", "cognitive_load"],
  },
  {
    text: "大戸屋：スマートフォンでいつでも参照可能な動画・写真付き調理マニュアルを導入し全店舗の料理品質を均一化",
    textEn: "Ootoya: Introduced smartphone-accessible cooking manuals with videos/photos, achieving uniform food quality across all stores",
    modelLayer: "TRANSFER",
    primaryValueAxis: "COST_DOWN",
    provenance: "PUBLIC_CODIFIED",
    confidence: "MEDIUM",
    estimatedImpactMin: 5,
    estimatedImpactMax: 15,
    impactKPI: "品質均一化",
    observedAt: "2023-09-01",
    tagCodes: ["manual_reference", "quality_degradation", "newbie_on_floor", "mixed_experience", "workstation", "automaticity", "spacing_effect"],
  },
  {
    text: "鳥貴族：構造化面接＋採用担当者の配属後定期訪問＋週次選考会議で入社1年目離職率を25%→11.1%に改善",
    textEn: "Torikizoku: Structured interviews + post-placement regular visits by recruiters + weekly selection meetings reduced first-year turnover from 25% to 11.1%",
    modelLayer: "TRANSFER",
    primaryValueAxis: "RETENTION",
    provenance: "PUBLIC_CODIFIED",
    confidence: "HIGH",
    estimatedImpactMin: 50,
    estimatedImpactMax: 60,
    impactKPI: "離職率",
    observedAt: "2024-01-01",
    tagCodes: ["coaching", "shadowing", "newbie_on_floor", "psychological_safety"],
  },
  {
    text: "ジャムの法則：24種類vs6種類の試食実験で選択肢過多が購買離脱を引き起こすことを実証（購買率2.8% vs 29.8%）",
    textEn: "Jam study: 24 vs 6 varieties tasting experiment demonstrated choice overload causes purchase abandonment (2.8% vs 29.8% purchase rate)",
    modelLayer: "BREAKDOWN",
    primaryValueAxis: "REVENUE_UP",
    provenance: "PUBLIC_CODIFIED",
    confidence: "HIGH",
    estimatedImpactMin: null,
    estimatedImpactMax: null,
    impactKPI: "購買率",
    observedAt: "2000-01-01",
    tagCodes: ["customer_confusion", "post_contact_drop", "browse_visit", "main_display", "paradox_of_choice"],
  },
  {
    text: "レストランメニュー視線追跡研究：顧客の視線はメニュー中央上部→左上に集中し業界定説と異なることを発見",
    textEn: "Restaurant menu eye-tracking study: Customer gaze concentrates on upper-center then upper-left of menu, contradicting industry assumptions",
    modelLayer: "MOVEMENT",
    primaryValueAxis: "REVENUE_UP",
    provenance: "PUBLIC_CODIFIED",
    confidence: "MEDIUM",
    estimatedImpactMin: 3,
    estimatedImpactMax: 8,
    impactKPI: "売上",
    observedAt: "2012-01-01",
    tagCodes: ["product_touch", "stop", "service_counter", "attention_bottleneck"],
  },
  {
    text: "家具店：IoTセンサーで店内動線を測定し主要動線上に売りたい商品を移動、滞在時間10%増・売上5%向上",
    textEn: "Furniture retailer: Measured in-store traffic with IoT sensors, relocated target products to main traffic paths, increasing dwell time 10% and sales 5%",
    modelLayer: "MOVEMENT",
    primaryValueAxis: "REVENUE_UP",
    provenance: "PUBLIC_CODIFIED",
    confidence: "MEDIUM",
    estimatedImpactMin: 3,
    estimatedImpactMax: 5,
    impactKPI: "売上",
    observedAt: "2023-06-01",
    tagCodes: ["circulation", "stop", "pass_through", "main_display", "sub_display", "gruen_transfer"],
  },
  {
    text: "Starbucks：バリスタの動作をOps Excellence Field Guideとして体系化し動画＋OJTの三層構造で全世界3万店超の品質維持",
    textEn: "Starbucks: Codified barista movements as Ops Excellence Field Guide, maintaining quality across 30,000+ stores via video + interactive modules + OJT",
    modelLayer: "TRANSFER",
    primaryValueAxis: "COST_DOWN",
    provenance: "PUBLIC_CODIFIED",
    confidence: "HIGH",
    estimatedImpactMin: 5,
    estimatedImpactMax: 15,
    impactKPI: "品質均一化",
    observedAt: "2020-01-01",
    tagCodes: ["shadowing", "pattern_replication", "staff_movement", "newbie_on_floor", "peak_hour", "workstation", "automaticity", "schema"],
  },
  {
    text: "ペルーのホテル：5S＋標準作業を客室清掃プロセスに適用しサイクルタイム大幅削減、顧客ロイヤルティ60.81%達成",
    textEn: "Peru hotel: Applied 5S and Standardized Work to room cleaning process, significantly reducing cycle time and achieving 60.81% customer loyalty",
    modelLayer: "MOVEMENT",
    primaryValueAxis: "COST_DOWN",
    provenance: "PUBLIC_CODIFIED",
    confidence: "MEDIUM",
    estimatedImpactMin: 10,
    estimatedImpactMax: 25,
    impactKPI: "業務時間",
    observedAt: "2024-06-01",
    tagCodes: ["staff_movement", "checklist", "pattern_replication", "workstation"],
  },
  {
    text: "スーパーマーケット：ミステリーショッピングで接客品質を定量評価しスタッフ研修設計に活用、サービス品質25%改善",
    textEn: "Supermarket: Mystery shopping quantified service quality, informed staff training design, improving service quality by 25%",
    modelLayer: "APPROACH",
    primaryValueAxis: "REVENUE_UP",
    provenance: "PUBLIC_CODIFIED",
    confidence: "MEDIUM",
    estimatedImpactMin: 15,
    estimatedImpactMax: 25,
    impactKPI: "サービス品質",
    observedAt: "2023-09-01",
    tagCodes: ["greeting", "explanation", "missed_contact", "main_display", "checkout"],
  },
  {
    text: "飲食チェーン：ロールプレイ型OJT＋評価シートで接客スキルを定量化し習熟度の可視化とモチベーション向上を両立",
    textEn: "Restaurant chain: Role-play OJT + evaluation sheets quantified service skills, achieving both visible skill progression and motivation improvement",
    modelLayer: "TRANSFER",
    primaryValueAxis: "COST_DOWN",
    provenance: "PUBLIC_CODIFIED",
    confidence: "MEDIUM",
    estimatedImpactMin: 5,
    estimatedImpactMax: 15,
    impactKPI: "定着率",
    observedAt: "2024-03-01",
    tagCodes: ["coaching", "peer_sharing", "pattern_replication", "newbie_on_floor", "mixed_experience", "service_counter"],
  },
  {
    text: "アパレル：接客フロー8ステップ（動的待機→観察→アプローチ→ニーズ把握→提案→クロージング→会計→見送り）を標準化し販売力向上",
    textEn: "Apparel retail: Standardized 8-step service flow (dynamic wait → observe → approach → needs assessment → propose → close → checkout → send-off), improving sales performance",
    modelLayer: "APPROACH",
    primaryValueAxis: "REVENUE_UP",
    provenance: "PUBLIC_CODIFIED",
    confidence: "MEDIUM",
    estimatedImpactMin: 5,
    estimatedImpactMax: 15,
    impactKPI: "売上",
    observedAt: "2024-06-01",
    tagCodes: ["greeting", "eye_contact", "needs_hearing", "proposal", "closing", "browse_visit", "purpose_visit", "main_display", "trial_area"],
  },
  {
    text: "セルソース：同部署チューター＋別部署メンターのダブル配置でオンボーディングを構造化し早期退職抑制・満足度20%増",
    textEn: "CellSource: Structured onboarding with dual support (same-dept tutor + cross-dept mentor), reducing early turnover and increasing satisfaction by 20%",
    modelLayer: "TRANSFER",
    primaryValueAxis: "RETENTION",
    provenance: "PUBLIC_CODIFIED",
    confidence: "MEDIUM",
    estimatedImpactMin: 15,
    estimatedImpactMax: 20,
    impactKPI: "満足度",
    observedAt: "2024-06-01",
    tagCodes: ["coaching", "peer_sharing", "newbie_on_floor", "psychological_safety"],
  },
];

async function main() {
  // Get admin user
  const admin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!admin) {
    console.error("Admin user not found");
    process.exit(1);
  }

  console.log(`Ingesting ${observations.length} observations as ${admin.email}...`);

  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i];
    const validTagIds = obs.tagCodes
      .map((code) => TAG_IDS[code])
      .filter(Boolean);

    try {
      const created = await prisma.observation.create({
        data: {
          text: obs.text,
          textEn: obs.textEn,
          modelLayer: obs.modelLayer,
          primaryValueAxis: obs.primaryValueAxis,
          provenance: obs.provenance,
          confidence: obs.confidence,
          trustScore: 1,
          estimatedImpactMin: obs.estimatedImpactMin,
          estimatedImpactMax: obs.estimatedImpactMax,
          impactKPI: obs.impactKPI,
          observedAt: new Date(obs.observedAt),
          createdById: admin.id,
          tags: {
            create: validTagIds.map((tagId) => ({ tagId })),
          },
        },
      });
      console.log(`  [${i + 1}/${observations.length}] Created: ${obs.text.slice(0, 40)}...`);
    } catch (err) {
      console.error(`  [${i + 1}] FAILED: ${obs.text.slice(0, 40)}...`, err);
    }
  }

  console.log("Done!");
  await prisma.$disconnect();
}

main();
