import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
});

function asArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

export function parseSitemapUrlsFromXml(xml: string): string[] & { _source?: string } {
  const parsed = parser.parse(xml) as any;
  const urlset = parsed?.urlset;
  if (urlset?.url) {
    return asArray(urlset.url)
      .map((u: any) => u?.loc)
      .filter(isHttpUrl);
  }

  const sitemapIndex = parsed?.sitemapindex;
  if (sitemapIndex?.sitemap) {
    // In sitemapindex, loc values are nested sitemap URLs, not page URLs.
    return asArray(sitemapIndex.sitemap)
      .map((s: any) => s?.loc)
      .filter(isHttpUrl);
  }

  // If unknown format, return empty.
  return [];
}

export async function discoverSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const seen = new Set<string>();
  const pageUrls = new Set<string>();
  const queue: string[] = [sitemapUrl];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);

    const res = await fetch(current);
    if (!res.ok) {
      throw new Error(`Failed to fetch sitemap: ${current} (status ${res.status})`);
    }
    const xml = await res.text();

    // parseSitemapUrlsFromXml returns either page URLs (urlset) or nested sitemap URLs (sitemapindex).
    const locs = parseSitemapUrlsFromXml(xml);
    // Heuristic: determine whether this sitemap contained nested sitemaps by checking root tag shape again.
    const parsed = parser.parse(xml) as any;
    if (parsed?.urlset?.url) {
      for (const loc of locs) pageUrls.add(loc);
    } else if (parsed?.sitemapindex?.sitemap) {
      // Normalize nested sitemaps to absolute if needed.
      for (const loc of locs) queue.push(loc);
    }
  }

  return [...pageUrls];
}

