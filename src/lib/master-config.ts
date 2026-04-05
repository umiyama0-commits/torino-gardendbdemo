import { prisma } from "@/lib/prisma";

export type MasterConfigEntry = {
  key: string;
  label: string;    // = labelEn (互換性)
  labelJa: string;
  labelEn: string;
  color: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type MasterConfigMap = Record<string, MasterConfigEntry>;

export type AppConfig = {
  modelLayers: MasterConfigMap;
  valueAxes: MasterConfigMap;
  provenances: MasterConfigMap;
  tagTypes: MasterConfigMap;
};

// カテゴリ名のマッピング
const CATEGORY_MAP = {
  modelLayers: "MODEL_LAYER",
  valueAxes: "VALUE_AXIS",
  provenances: "PROVENANCE",
  tagTypes: "TAG_TYPE",
} as const;

// サーバーサイドキャッシュ（60秒TTL）
let cache: { data: AppConfig; expiry: number } | null = null;
const CACHE_TTL = 60_000;

function toEntry(row: {
  key: string; labelEn: string; labelJa: string;
  color: string; description: string | null;
  sortOrder: number; isActive: boolean;
}): MasterConfigEntry {
  return {
    key: row.key,
    label: row.labelEn,
    labelJa: row.labelJa,
    labelEn: row.labelEn,
    color: row.color,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

/**
 * 全カテゴリのマスター設定を取得（キャッシュ付き）
 */
export async function loadAppConfig(): Promise<AppConfig> {
  if (cache && Date.now() < cache.expiry) {
    return cache.data;
  }

  const rows = await prisma.masterConfig.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  const config: AppConfig = {
    modelLayers: {},
    valueAxes: {},
    provenances: {},
    tagTypes: {},
  };

  for (const row of rows) {
    const entry = toEntry(row);
    switch (row.category) {
      case "MODEL_LAYER":
        config.modelLayers[row.key] = entry;
        break;
      case "VALUE_AXIS":
        config.valueAxes[row.key] = entry;
        break;
      case "PROVENANCE":
        config.provenances[row.key] = entry;
        break;
      case "TAG_TYPE":
        config.tagTypes[row.key] = entry;
        break;
    }
  }

  cache = { data: config, expiry: Date.now() + CACHE_TTL };
  return config;
}

/**
 * キャッシュを無効化（管理画面からの更新時に呼ぶ）
 */
export function invalidateMasterConfigCache() {
  cache = null;
}

/**
 * 特定カテゴリのマスター設定を取得
 */
export async function getMasterConfigs(category: string): Promise<MasterConfigEntry[]> {
  const rows = await prisma.masterConfig.findMany({
    where: { category, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map(toEntry);
}
