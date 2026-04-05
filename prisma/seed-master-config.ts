import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_DATA = [
  // MODEL_LAYER
  { category: "MODEL_LAYER", key: "MOVEMENT", labelEn: "Movement", labelJa: "動線", color: "#2563eb", description: "お客さまの歩き方・動線・滞在に関する発見", sortOrder: 1 },
  { category: "MODEL_LAYER", key: "APPROACH", labelEn: "Approach", labelJa: "接客", color: "#0891b2", description: "声掛け・接客・提案など、お客さまとの関わり方", sortOrder: 2 },
  { category: "MODEL_LAYER", key: "BREAKDOWN", labelEn: "Breakdown", labelJa: "離脱", color: "#dc2626", description: "離脱・混乱・待ち時間など、マイナスの事象", sortOrder: 3 },
  { category: "MODEL_LAYER", key: "TRANSFER", labelEn: "Transfer", labelJa: "伝承", color: "#16a34a", description: "ノウハウの共有・教育・マニュアル化に関すること", sortOrder: 4 },

  // VALUE_AXIS
  { category: "VALUE_AXIS", key: "REVENUE_UP", labelEn: "Revenue UP", labelJa: "売上向上", color: "#2563eb", description: "売上や購買率の向上につながる", sortOrder: 1 },
  { category: "VALUE_AXIS", key: "COST_DOWN", labelEn: "Cost DOWN", labelJa: "コスト削減", color: "#0891b2", description: "コスト削減・業務効率化につながる", sortOrder: 2 },
  { category: "VALUE_AXIS", key: "RETENTION", labelEn: "Retention", labelJa: "定着・離職防止", color: "#d97706", description: "スタッフの定着や離職防止につながる", sortOrder: 3 },
  { category: "VALUE_AXIS", key: "CSAT_UP", labelEn: "CSAT UP", labelJa: "顧客満足度向上", color: "#8b5cf6", description: "顧客満足度やリピート率の向上につながる", sortOrder: 4 },

  // PROVENANCE
  { category: "PROVENANCE", key: "FIELD_OBSERVED", labelEn: "Proprietary", labelJa: "①固有知", color: "#18181b", description: "フィールド調査から得られた固有の知見", sortOrder: 1 },
  { category: "PROVENANCE", key: "ANONYMIZED_DERIVED", labelEn: "Anonymized", labelJa: "②汎用知", color: "#2563eb", description: "匿名化・一般化された業界横断の知見", sortOrder: 2 },
  { category: "PROVENANCE", key: "PUBLIC_CODIFIED", labelEn: "Public", labelJa: "③公知", color: "#71717a", description: "公開論文・書籍・業界レポート等の知見", sortOrder: 3 },

  // TAG_TYPE
  { category: "TAG_TYPE", key: "BEHAVIOR", labelEn: "Behavior", labelJa: "行動", color: "#3b82f6", description: "何が起きた？", sortOrder: 1 },
  { category: "TAG_TYPE", key: "CONTEXT", labelEn: "Context", labelJa: "文脈", color: "#71717a", description: "どんな状況？", sortOrder: 2 },
  { category: "TAG_TYPE", key: "SPACE", labelEn: "Space", labelJa: "空間", color: "#52525b", description: "どこで？", sortOrder: 3 },
  { category: "TAG_TYPE", key: "THEORY", labelEn: "Theory", labelJa: "理論", color: "#7c3aed", description: "なぜ起きる？", sortOrder: 4 },
];

async function main() {
  for (const item of SEED_DATA) {
    await prisma.masterConfig.upsert({
      where: { category_key: { category: item.category, key: item.key } },
      update: { ...item },
      create: { ...item },
    });
  }
  console.log(`Seeded ${SEED_DATA.length} master config entries`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
