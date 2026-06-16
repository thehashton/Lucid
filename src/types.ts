import { z } from "zod";

export type DiscoveryMode = "sitemap" | "crawl" | "nextjs";

export type LucidNextjsDynamicRoutesConfig = {
  routes: Record<
    string,
    Record<
      string,
      string[]
    >
  >;
};

export type LucidViolationSeverity = "critical" | "serious" | "moderate" | "minor";

export type DiscoveryParams =
  | {
      mode: "sitemap";
      sitemapUrl: string;
    }
  | {
      mode: "crawl";
      crawlUrl: string;
    }
  | {
      mode: "nextjs";
      nextjsBaseUrl: string;
    };

export const crawlLinkSelector = "a[href]";

export type LucidAuditOptions = {
  discovery: DiscoveryParams;
  outputDir?: string;
  concurrency?: number;
  crawlMaxPages?: number;
  timeoutMs?: number;
  createIssues?: boolean;
  repo?: string;
  dryRun?: boolean;
};

export const nodeUrlSchema = z.string().url();

