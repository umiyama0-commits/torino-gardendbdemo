// オントロジー階層化: フラットな98タグに親子関係を設定
// 改善点5: parentIdフィールドを活用して階層構造を構築

import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

// 親カテゴリの定義（Level 0）
const parentCategories = [
  // Behavior系の親
  { code: "behavior_movement", displayNameJa: "行動: 動線", type: "behavior", level: 0, modelLayer: "MOVEMENT", category: "behavior" },
  { code: "behavior_approach", displayNameJa: "行動: 接客", type: "behavior", level: 0, modelLayer: "APPROACH", category: "behavior" },
  { code: "behavior_breakdown", displayNameJa: "行動: 離脱", type: "behavior", level: 0, modelLayer: "BREAKDOWN", category: "behavior" },
  { code: "behavior_transfer", displayNameJa: "行動: 教育", type: "behavior", level: 0, modelLayer: "TRANSFER", category: "behavior" },
  // Context系の親
  { code: "context_time", displayNameJa: "文脈: 時間", type: "context", level: 0, category: "context" },
  { code: "context_staff", displayNameJa: "文脈: スタッフ", type: "context", level: 0, category: "context" },
  { code: "context_customer", displayNameJa: "文脈: 顧客", type: "context", level: 0, category: "context" },
  { code: "context_location", displayNameJa: "文脈: 立地", type: "context", level: 0, category: "context" },
  // Space系の親
  { code: "space_sales", displayNameJa: "空間: 売場", type: "space", level: 0, category: "space" },
  { code: "space_service", displayNameJa: "空間: サービス", type: "space", level: 0, category: "space" },
  // Theory系の親
  { code: "theory_cognitive", displayNameJa: "理論: 認知", type: "theory", level: 0, category: "theory" },
  { code: "theory_behavioral", displayNameJa: "理論: 行動経済", type: "theory", level: 0, category: "theory" },
  { code: "theory_learning", displayNameJa: "理論: 学習", type: "theory", level: 0, category: "theory" },
];

// 子タグ → 親カテゴリのマッピング
const childToParent: Record<string, string> = {
  // Behavior: MOVEMENT
  entry: "behavior_movement",
  exit: "behavior_movement",
  circulation: "behavior_movement",
  stop: "behavior_movement",
  pass_through: "behavior_movement",
  u_turn: "behavior_movement",
  route_choice: "behavior_movement",
  staff_movement: "behavior_movement",
  queue: "behavior_movement",
  right_turn_bias: "behavior_movement",
  dwell: "behavior_movement",
  customer_flow: "behavior_movement",
  route_deviation: "behavior_movement",
  shortcut: "behavior_movement",

  // Behavior: APPROACH
  greeting: "behavior_approach",
  eye_contact: "behavior_approach",
  product_touch: "behavior_approach",
  trial: "behavior_approach",
  needs_hearing: "behavior_approach",
  proposal: "behavior_approach",
  demonstration: "behavior_approach",
  explanation: "behavior_approach",
  closing: "behavior_approach",
  follow_up: "behavior_approach",
  first_contact: "behavior_approach",
  upsell: "behavior_approach",
  cross_sell: "behavior_approach",

  // Behavior: BREAKDOWN
  missed_contact: "behavior_breakdown",
  wait_abandonment: "behavior_breakdown",
  staff_absence: "behavior_breakdown",
  post_contact_drop: "behavior_breakdown",
  quality_degradation: "behavior_breakdown",
  capacity_overload: "behavior_breakdown",
  process_error: "behavior_breakdown",
  customer_confusion: "behavior_breakdown",
  complaint: "behavior_breakdown",
  hesitation: "behavior_breakdown",
  return_rate: "behavior_breakdown",
  browse_only: "behavior_breakdown",
  fatigue_curve: "behavior_breakdown",
  cognitive_load: "behavior_breakdown",
  service_counter: "behavior_breakdown",

  // Behavior: TRANSFER
  shadowing: "behavior_transfer",
  peer_sharing: "behavior_transfer",
  checklist: "behavior_transfer",
  handoff: "behavior_transfer",
  observational_learning: "behavior_transfer",
  role_play: "behavior_transfer",
  manual_update: "behavior_transfer",
  ojt: "behavior_transfer",
  feedback_session: "behavior_transfer",
  skill_assessment: "behavior_transfer",
  knowledge_base: "behavior_transfer",

  // Context: Time
  weekday: "context_time",
  weekend: "context_time",
  peak_hour: "context_time",
  off_peak: "context_time",
  event: "context_time",
  season: "context_time",

  // Context: Staff
  full_staff: "context_staff",
  under_staff: "context_staff",
  newbie_on_floor: "context_staff",
  expert_on_floor: "context_staff",

  // Context: Customer
  family: "context_customer",
  couple: "context_customer",
  solo: "context_customer",
  repeater: "context_customer",
  first_visit: "context_customer",
  impulse: "context_customer",
  planned: "context_customer",
  browsing: "context_customer",

  // Context: Location
  sc_location: "context_location",
  roadside: "context_location",
  station_front: "context_location",
  urban_core: "context_location",
  suburban: "context_location",
  resort: "context_location",

  // Space: Sales
  entrance: "space_sales",
  main_aisle: "space_sales",
  sub_aisle: "space_sales",
  end_cap: "space_sales",
  golden_zone: "space_sales",
  main_display: "space_sales",

  // Space: Service
  checkout_zone: "space_service",
  waiting_area: "space_service",
  fitting_room: "space_service",
  back_office: "space_service",

  // Theory: Cognitive
  paradox_of_choice: "theory_cognitive",
  hicks_law: "theory_cognitive",
  chunking: "theory_cognitive",
  wait_perception: "theory_cognitive",

  // Theory: Behavioral Economics
  mere_exposure: "theory_behavioral",
  goal_gradient: "theory_behavioral",
  peak_end_rule: "theory_behavioral",
  anchoring: "theory_behavioral",
  nudge: "theory_behavioral",

  // Theory: Learning
  spacing_effect: "theory_learning",
  desirable_difficulty: "theory_learning",
  psychological_safety: "theory_learning",
};

async function main() {
  console.log("Setting up ontology hierarchy...");

  // 1. 親カテゴリを作成（存在しなければ）
  for (const parent of parentCategories) {
    await prisma.ontologyTag.upsert({
      where: { code: parent.code },
      update: {
        level: parent.level,
        displayNameJa: parent.displayNameJa,
        modelLayer: parent.modelLayer || null,
        category: parent.category || null,
      },
      create: {
        code: parent.code,
        type: parent.type,
        level: parent.level,
        displayNameJa: parent.displayNameJa,
        modelLayer: parent.modelLayer || null,
        category: parent.category || null,
      },
    });
  }

  // 2. 子タグにparentIdを設定
  let updated = 0;
  for (const [childCode, parentCode] of Object.entries(childToParent)) {
    const parentTag = await prisma.ontologyTag.findUnique({ where: { code: parentCode } });
    if (!parentTag) {
      console.warn(`Parent tag not found: ${parentCode}`);
      continue;
    }

    const result = await prisma.ontologyTag.updateMany({
      where: { code: childCode },
      data: { parentId: parentTag.id, level: 1 },
    });

    if (result.count > 0) updated++;
  }

  console.log(`Hierarchy setup complete: ${parentCategories.length} parents created, ${updated} children linked`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
