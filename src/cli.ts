#!/usr/bin/env node
import { Command } from "commander";
import { z } from "zod";
import { runLucidAudit } from "./runLucidAudit.js";

const schema = z
  .object({
    sitemap: z.string().url().optional(),
    crawl: z.string().url().optional(),
    framework: z.enum(["nextjs"]).optional(),
    baseUrl: z.string().url().optional(),
    output: z.string().optional(),
    concurrency: z.coerce.number().int().positive().optional(),
    crawlMaxPages: z.coerce.number().int().positive().optional(),
    timeoutMs: z.coerce.number().int().positive().optional(),
    createIssues: z.boolean().optional(),
    repo: z.string().optional(),
    dryRun: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const modes = [v.sitemap ? 1 : 0, v.crawl ? 1 : 0, v.framework === "nextjs" ? 1 : 0].reduce(
      (a, b) => a + b,
      0,
    );
    if (modes !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "You must provide exactly one discovery mode: --sitemap, --crawl, or --framework nextjs.",
        path: [],
      });
    }
    if (v.framework === "nextjs" && !v.baseUrl) {
      ctx.addIssue({
        code: "custom",
        message: "When using --framework nextjs you must also provide --base-url.",
        path: ["baseUrl"],
      });
    }
  });

async function main() {
  const program = new Command();
  program
    .name("lucid")
    .description("Automated accessibility auditing across full web projects.")
    .option("--sitemap <url>", "Parse a sitemap.xml and extract URLs to audit.")
    .option("--crawl <url>", "Spider from a root URL, following internal anchor tags.")
    .option("--framework <name>", "Route discovery framework (currently: nextjs).")
    .option("--base-url <url>", "Base URL prepended to discovered routes (required for nextjs).")
    .option("--output <dir>", "Output directory for reports (default: ./lucid-report).")
    .option("--concurrency <n>", "Parallel page audits (default: 3).", "3")
    .option("--crawl-max-pages <n>", "Crawl safety cap (default: 500).", "500")
    .option("--timeout <ms>", "Per-page navigation timeout in ms (default: 30000).", "30000")
    .option("--create-issues", "Create GitHub issues from the JSON report.")
    .option("--repo <owner/name>", "Override GitHub repository owner/name for issue creation.")
    .option("--dry-run", "Print GitHub issue payloads without API calls.")
    .parse(process.argv);

  const opts = program.opts<{
    sitemap?: string;
    crawl?: string;
    framework?: "nextjs" | undefined;
    baseUrl?: string;
    output?: string;
    concurrency?: string;
    crawlMaxPages?: string;
    timeout?: string;
    createIssues?: boolean;
    repo?: string;
    dryRun?: boolean;
  }>();

  const validated = schema.parse({
    sitemap: opts.sitemap,
    crawl: opts.crawl,
    framework: opts.framework,
    baseUrl: opts.baseUrl,
    output: opts.output,
    concurrency: Number(opts.concurrency ?? 3),
    crawlMaxPages: Number(opts.crawlMaxPages ?? 500),
    timeoutMs: Number(opts.timeout ?? 30000),
    createIssues: Boolean(opts.createIssues),
    repo: opts.repo,
    dryRun: Boolean(opts.dryRun),
  });

  const discovery = validated.sitemap
    ? { mode: "sitemap" as const, sitemapUrl: validated.sitemap }
    : validated.crawl
      ? { mode: "crawl" as const, crawlUrl: validated.crawl }
      : { mode: "nextjs" as const, nextjsBaseUrl: validated.baseUrl! };

  const result = await runLucidAudit({
    discovery,
    outputDir: validated.output,
    concurrency: validated.concurrency ?? 3,
    crawlMaxPages: validated.crawlMaxPages ?? 500,
    timeoutMs: validated.timeoutMs ?? 30000,
    createIssues: validated.createIssues ?? false,
    repo: validated.repo,
    dryRun: validated.dryRun ?? false,
  });

  process.exit(result.exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

