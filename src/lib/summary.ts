// 観測テキストから一覧表示用の短い要約を生成する
// LLMは使わず、テキスト処理で高速に生成

const MAX_SUMMARY_LENGTH = 50;

/**
 * テキストから一覧表示用の要約を生成
 * - 括弧内の引用情報（論文名・著者名等）を除去
 * - 最初の文を取得し、50文字以内に収める
 */
export function generateSummary(text: string): string {
  // 括弧内の引用を除去（全角・半角両方）
  let cleaned = text
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim();

  // 最初の文を取得（。で分割）
  const firstSentence = cleaned.split(/。/)[0];

  if (firstSentence.length <= MAX_SUMMARY_LENGTH) {
    return firstSentence;
  }

  // 50文字に収める: 読点（、）の位置で自然に切る
  const truncated = firstSentence.slice(0, MAX_SUMMARY_LENGTH);
  const lastComma = truncated.lastIndexOf("、");

  if (lastComma > MAX_SUMMARY_LENGTH * 0.5) {
    // 後半に読点があれば、そこで切る
    return truncated.slice(0, lastComma);
  }

  return truncated + "…";
}
