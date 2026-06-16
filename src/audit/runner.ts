import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";
import type { LucidViolation, LucidViolationInstance } from "../report/types.js";
import { captureViolationScreenshot } from "./screenshot.js";
import type { LucidViolationSeverity } from "../types.js";

function impactToSeverity(impact: string): LucidViolationSeverity {
  if (impact === "critical") return "critical";
  if (impact === "serious") return "serious";
  if (impact === "moderate") return "moderate";
  return "minor";
}

function getWcagRefs(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t) => typeof t === "string" && (t.startsWith("wcag") || t === "best-practice"));
}

async function auditSingleUrl(opts: {
  url: string;
  page: any;
  violationsById: Map<string, LucidViolation>;
  screenshotDir: string;
}) {
  const { url, page, violationsById, screenshotDir } = opts;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: opts.page?.__lucidTimeoutMs });

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const violations = (results as any)?.violations;
  if (!Array.isArray(violations)) return;

  for (const v of violations) {
    const ruleId = String(v?.id ?? "");
    if (!ruleId) continue;

    const impact = impactToSeverity(String(v?.impact ?? "minor"));
    const existing = violationsById.get(ruleId);
    const entry: LucidViolation =
      existing ??
      ({
        id: ruleId,
        impact,
        description: String(v?.description ?? ""),
        help: String(v?.help ?? ""),
        helpUrl: v?.helpUrl ? String(v.helpUrl) : null,
        wcag: getWcagRefs(v?.tags),
        instances: [],
      } satisfies LucidViolation);

    const nodes = Array.isArray(v?.nodes) ? v.nodes : [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const targetSelectors: string[] = Array.isArray(node?.target) ? node.target.map((t: unknown) => String(t)) : [];
      const selector = targetSelectors.join(" ").trim();
      const html = typeof node?.html === "string" ? node.html : "";
      const failureSummary = typeof node?.failureSummary === "string" ? node.failureSummary : entry.description;

      const screenshotPath = await captureViolationScreenshot({
        page,
        url,
        ruleId,
        nodeIndex: i,
        targetSelectors,
        screenshotDir,
      });

      const instance: LucidViolationInstance = {
        url,
        selector,
        html,
        failureSummary,
        screenshotPath,
      };

      entry.instances.push(instance);
    }

    violationsById.set(ruleId, entry);
  }
}

export async function auditUrls(opts: {
  urls: string[];
  concurrency: number;
  timeoutMs: number;
  screenshotDir: string;
}): Promise<{ violations: LucidViolation[]; pagesAudited: number; urlCount: number }> {
  const { urls, concurrency, timeoutMs, screenshotDir } = opts;
  const violationsById = new Map<string, LucidViolation>();

  const browser = await chromium.launch({ headless: true });
  try {
    let cursor = 0;
    const workers: Promise<void>[] = [];
    const workerCount = Math.max(1, Math.floor(concurrency));

    for (let w = 0; w < workerCount; w++) {
      workers.push(
        (async () => {
          const context = await browser.newContext();
          const page: any = await context.newPage();
          page.__lucidTimeoutMs = timeoutMs;
          try {
            while (true) {
              const idx = cursor++;
              if (idx >= urls.length) break;
              const url = urls[idx]!;
              await auditSingleUrl({
                url,
                page,
                violationsById,
                screenshotDir,
              });
            }
          } finally {
            await page.close();
            await context.close();
          }
        })(),
      );
    }

    await Promise.all(workers);
  } finally {
    await browser.close();
  }

  return {
    violations: [...violationsById.values()],
    pagesAudited: urls.length,
    urlCount: urls.length,
  };
}

