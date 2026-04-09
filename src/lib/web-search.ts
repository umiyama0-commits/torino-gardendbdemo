// Web検索抽象化: Google Custom Search / Brave Search API対応
// 公知(PUBLIC_CODIFIED)データの自動取得に使用

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

/**
 * Web検索を実行し、検索結果を返す
 * 環境変数によりGoogle / Brave / フォールバックを自動選択
 */
export async function searchWeb(query: string, count: number = 5): Promise<SearchResult[]> {
  // Google Custom Search API
  if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX) {
    return searchGoogle(query, count);
  }

  // Brave Search API
  if (process.env.BRAVE_SEARCH_API_KEY) {
    return searchBrave(query, count);
  }

  // フォールバック: 検索APIなし → LLMの内部知識に依存
  console.warn("No search API configured. Set GOOGLE_SEARCH_API_KEY+CX or BRAVE_SEARCH_API_KEY");
  return [];
}

async function searchGoogle(query: string, count: number): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    key: process.env.GOOGLE_SEARCH_API_KEY!,
    cx: process.env.GOOGLE_SEARCH_CX!,
    q: query,
    num: String(Math.min(count, 10)),
    lr: "lang_ja|lang_en",
  });

  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
  if (!res.ok) {
    const err = await res.text();
    console.error(`Google Search API error ${res.status}: ${err}`);
    return [];
  }

  const data = await res.json();
  return (data.items || []).map((item: { title: string; link: string; snippet: string }) => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet || "",
  }));
}

async function searchBrave(query: string, count: number): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(count, 10)),
  });

  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY!,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Brave Search API error ${res.status}: ${err}`);
    return [];
  }

  const data = await res.json();
  return (data.web?.results || []).map((item: { title: string; url: string; description: string }) => ({
    title: item.title,
    url: item.url,
    snippet: item.description || "",
  }));
}
