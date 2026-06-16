import path from "node:path";
import fs from "node:fs/promises";
import { discoverUrls } from "./discovery/index.js";
import type { LucidAuditOptions, LucidViolationSeverity } from "./types.js";
import { auditUrls } from "./audit/runner.js";
import { writeJsonReport } from "./report/json.js";
import { printTerminalSummary } from "./report/terminal.js";
import { loadLucidConfig } from "./config.js";
import type { LucidReport, LucidViolation } from "./report/types.js";
import { createGitHubIssuesFromReport } from "./github/issues.js";

function toolVersionFromPackageJson(): string {
  // tsup will inline this constant; avoiding dynamic JSON import keeps runtime simple.
  return "0.1.0";
}

function buildViolationsBySeverity(violations: LucidViolation[]) {
  const bySeverity: Record<LucidViolationSeverity, LucidViolation[]> = {
    critical: [],
    serious: [],
    moderate: [],
    minor: [],
  };
  for (const v of violations) {
    bySeverity[v.impact].push(v);
  }
  return bySeverity;
}

export async function runLucidAudit(opts: LucidAuditOptions): Promise<{ exitCode: number }> {
  const start = Date.now();
  const outputDir = path.resolve(process.cwd(), opts.outputDir ?? "./lucid-report");
  const screenshotDir = path.join(outputDir, "screenshots");
  await fs.mkdir(screenshotDir, { recursive: true });

  const nextjsConfig =
    opts.discovery.mode === "nextjs" ? await loadLucidConfig(process.cwd()) : null;

  const discovered = await discoverUrls(opts.discovery, {
    crawlMaxPages: opts.crawlMaxPages,
    timeoutMs: opts.timeoutMs,
    nextjsConfig,
    cwd: process.cwd(),
  });

  const urls = discovered.map((d) => d.url);
  const audit = await auditUrls({
    urls,
    concurrency: opts.concurrency ?? 3,
    timeoutMs: opts.timeoutMs ?? 30000,
    screenshotDir,
  });

  const violationsBySeverity = buildViolationsBySeverity(audit.violations);
  const totalViolations = audit.violations.reduce((sum, v) => sum + v.instances.length, 0);

  const report: LucidReport = {
    meta: {
      toolVersion: toolVersionFromPackageJson(),
      timestamp: new Date().toISOString(),
      discoveryMode: opts.discovery.mode,
      baseUrl: opts.discovery.mode === "nextjs" ? opts.discovery.nextjsBaseUrl : undefined,
      urlCount: urls.length,
      pagesAudited: audit.pagesAudited,
      durationMs: Date.now() - start,
    },
    summary: {
      totalsBySeverity: Object.fromEntries(
        (Object.keys(violationsBySeverity) as LucidViolationSeverity[]).map((sev) => [
          sev,
          violationsBySeverity[sev].reduce((n, v) => n + v.instances.length, 0),
        ]),
      ) as Record<LucidViolationSeverity, number>,
      totalViolations,
    },
    violationsBySeverity,
    violations: audit.violations,
  };

  const reportPath = await writeJsonReport(report, outputDir);
  printTerminalSummary(report, outputDir);

  if (opts.createIssues) {
    await createGitHubIssuesFromReport({
      reportPath,
      repoOverride: opts.repo,
      dryRun: opts.dryRun ?? false,
    });
  }

  const criticalOrSerious = report.violationsBySeverity.critical.length > 0 || report.violationsBySeverity.serious.length > 0;
  return { exitCode: criticalOrSerious ? 1 : 0 };
}

