export interface WikiSummary {
  title: string;
  extract: string;
  thumbnail?: string;
  url: string;
}

const cache = new Map<string, WikiSummary | null>();

/** Optional enrichment. Fails soft (returns null) when offline or when the article is missing. */
export async function fetchWikiSummary(title: string, signal?: AbortSignal): Promise<WikiSummary | null> {
  if (cache.has(title)) return cache.get(title) ?? null;
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!res.ok) {
      cache.set(title, null);
      return null;
    }
    const d = (await res.json()) as {
      title?: string;
      extract?: string;
      thumbnail?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };
    const out: WikiSummary = {
      title: d.title ?? title,
      extract: d.extract ?? "",
      thumbnail: d.thumbnail?.source,
      url: d.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    };
    cache.set(title, out);
    return out;
  } catch {
    return null;
  }
}
