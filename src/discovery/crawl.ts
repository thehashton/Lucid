import { chromium } from "playwright";
import { crawlLinkSelector } from "../types.js";

export function normalizeForRouteDiscovery(url: string): string {
  const u = new URL(url);
  u.hash = "";
  // Normalize trailing slash except for root.
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

function isLikelyNavigableHref(href: string): boolean {
  const v = href.trim();
  if (!v) return false;
  if (v.startsWith("mailto:") || v.startsWith("tel:")) return false;
  if (v.startsWith("javascript:")) return false;
  return true;
}

export async function discoverCrawlUrls(
  rootUrl: string,
  opts: { crawlMaxPages?: number; timeoutMs?: number } = {},
): Promise<string[]> {
  const crawlMaxPages = opts.crawlMaxPages ?? 500;
  const timeoutMs = opts.timeoutMs ?? 30000;

  const visited = new Set<string>();
  const queue: string[] = [normalizeForRouteDiscovery(rootUrl)];
  const base = new URL(rootUrl);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    while (queue.length > 0 && visited.size < crawlMaxPages) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      await page.goto(current, { waitUntil: "domcontentloaded", timeout: timeoutMs });

      const hrefs: string[] = await page.$$eval(crawlLinkSelector, (els) =>
        (els as any[])
          .map((a) => (typeof a?.getAttribute === "function" ? a.getAttribute("href") : ""))
          .filter(Boolean),
      );

      for (const href of hrefs) {
        if (!isLikelyNavigableHref(href)) continue;
        let resolved: URL;
        try {
          resolved = new URL(href, current);
        } catch {
          continue;
        }

        if (resolved.origin !== base.origin) continue;
        const normalized = normalizeForRouteDiscovery(resolved.toString());
        if (!visited.has(normalized) && queue.length + visited.size < crawlMaxPages) {
          queue.push(normalized);
        }
      }
    }
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  return [...visited];
}

