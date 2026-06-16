import type { DiscoveryParams } from "../types.js";
import { discoverSitemapUrls } from "./sitemap.js";
import { discoverCrawlUrls } from "./crawl.js";
import { discoverNextjsUrls } from "./nextjs.js";

export type DiscoveredUrl = {
  url: string;
};

export type DiscoverOptions = {
  crawlMaxPages?: number;
  timeoutMs?: number;
  nextjsConfig?: any;
  cwd?: string;
};

export async function discoverUrls(
  params: DiscoveryParams,
  options: DiscoverOptions = {},
): Promise<DiscoveredUrl[]> {
  if (params.mode === "sitemap") {
    const urls = await discoverSitemapUrls(params.sitemapUrl);
    return urls.map((u) => ({ url: u }));
  }
  if (params.mode === "crawl") {
    const urls = await discoverCrawlUrls(params.crawlUrl, options);
    return urls.map((u) => ({ url: u }));
  }
  const urls = await discoverNextjsUrls(params.nextjsBaseUrl, options);
  return urls.map((u) => ({ url: u }));
}

