/**
 * テキスト類似度ユーティリティ
 * SQLiteベースの軽量キーワードマッチング
 * 将来的にembeddingsに置き換え可能
 */

// 日本語ストップワード（助詞・助動詞・接続詞等）
const STOP_WORDS = new Set([
  "の", "に", "は", "を", "た", "が", "で", "て", "と", "し", "れ", "さ",
  "ある", "いる", "する", "なる", "から", "こと", "それ", "これ", "その",
  "この", "もの", "ため", "よう", "よる", "また", "まで", "など",
  "おり", "より", "について", "おける", "ない", "なく", "ている",
  "された", "される", "として", "という", "という", "ました", "ます",
  "です", "だった", "している", "された", "the", "is", "of", "and", "to",
  "in", "a", "that", "for", "it", "with", "as", "was", "on", "are", "be",
]);

/**
 * テキストからキーワードを抽出
 * 漢字列・カタカナ列・英単語を取り出す
 */
export function extractKeywords(text: string): string[] {
  const patterns = [
    /[\u4e00-\u9faf\u3400-\u4dbf]{2,}/g,   // 漢字2文字以上
    /[\u30a0-\u30ff]{2,}/g,                   // カタカナ2文字以上
    /[a-zA-Z]{3,}/g,                           // 英語3文字以上
    /\d+[%％件人倍秒分時日月年回]/g,          // 数値＋単位
  ];

  const keywords = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        const lower = m.toLowerCase();
        if (!STOP_WORDS.has(lower) && !STOP_WORDS.has(m)) {
          keywords.add(lower);
        }
      }
    }
  }
  return Array.from(keywords);
}

/**
 * 2つのキーワードセット間のJaccard類似度
 */
export function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 共有キーワード数ベースのスコア（Jaccardより直感的）
 */
export function sharedKeywordScore(a: string[], b: string[]): { score: number; shared: string[] } {
  const setA = new Set(a);
  const shared: string[] = [];
  for (const word of b) {
    if (setA.has(word)) shared.push(word);
  }
  // min(a,b)で正規化して片方が短くても高スコアになるようにする
  const minLen = Math.min(a.length, b.length);
  const score = minLen === 0 ? 0 : shared.length / minLen;
  return { score, shared };
}

/**
 * 観測テキスト群をクラスタリング（単純な連結成分ベース）
 * threshold以上の類似度を持つ観測をグループ化
 */
export function clusterTexts(
  items: { id: string; text: string; keywords?: string[] }[],
  threshold = 0.25
): { members: string[]; keywords: string[] }[] {
  // キーワード抽出
  const itemsWithKw = items.map(item => ({
    ...item,
    keywords: item.keywords || extractKeywords(item.text),
  }));

  // 隣接リスト作成
  const adjacency = new Map<string, Set<string>>();
  for (const item of itemsWithKw) {
    adjacency.set(item.id, new Set());
  }

  for (let i = 0; i < itemsWithKw.length; i++) {
    for (let j = i + 1; j < itemsWithKw.length; j++) {
      const sim = jaccardSimilarity(itemsWithKw[i].keywords, itemsWithKw[j].keywords);
      if (sim >= threshold) {
        adjacency.get(itemsWithKw[i].id)!.add(itemsWithKw[j].id);
        adjacency.get(itemsWithKw[j].id)!.add(itemsWithKw[i].id);
      }
    }
  }

  // BFSで連結成分を取得
  const visited = new Set<string>();
  const clusters: { members: string[]; keywords: string[] }[] = [];

  for (const item of itemsWithKw) {
    if (visited.has(item.id)) continue;
    const component: string[] = [];
    const queue = [item.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      for (const neighbor of adjacency.get(current) || []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    if (component.length >= 2) {
      // クラスタのキーワード = メンバー全員のキーワードの頻度上位
      const kwFreq = new Map<string, number>();
      for (const memberId of component) {
        const m = itemsWithKw.find(x => x.id === memberId)!;
        for (const kw of m.keywords) {
          kwFreq.set(kw, (kwFreq.get(kw) || 0) + 1);
        }
      }
      // 2件以上に出現するキーワードを抽出
      const commonKw = Array.from(kwFreq.entries())
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([kw]) => kw);

      clusters.push({ members: component, keywords: commonKw });
    }
  }

  return clusters.sort((a, b) => b.members.length - a.members.length);
}
