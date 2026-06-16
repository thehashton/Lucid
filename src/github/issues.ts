import fs from "node:fs/promises";
import path from "node:path";
import childProcess from "node:child_process";
import { Octokit } from "@octokit/rest";
import type { LucidReport, LucidViolation } from "../report/types.js";

type CreateIssuesOpts = {
  reportPath: string;
  repoOverride?: string;
  dryRun: boolean;
};

function parseGitRemoteToOwnerRepo(remoteUrl: string): { owner: string; repo: string } | null {
  // Examples:
  // - https://github.com/owner/repo.git
  // - git@github.com:owner/repo.git
  const cleaned = remoteUrl.trim().replace(/\.git$/, "");
  const match =
    cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)$/) ||
    cleaned.match(/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2];
  if (!owner || !repo) return null;
  return { owner, repo };
}

function resolveRepo(cwd: string, repoOverride?: string): { owner: string; repo: string } {
  if (repoOverride) {
    const [owner, repo] = repoOverride.split("/");
    if (!owner || !repo) throw new Error(`--repo must be in the form owner/name, got: ${repoOverride}`);
    return { owner, repo };
  }

  let remoteUrl: string;
  try {
    remoteUrl = childProcess.execSync("git remote get-url origin", { cwd, encoding: "utf8" }).trim();
  } catch (err) {
    throw new Error(`Failed to resolve git origin remote from ${cwd}. Provide --repo owner/name.`);
  }

  const resolved = parseGitRemoteToOwnerRepo(remoteUrl);
  if (!resolved) throw new Error(`Could not parse owner/repo from git origin URL: ${remoteUrl}`);
  return resolved;
}

function getToken(): string | null {
  return process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;
}

function impactToLabel(impact: LucidViolation["impact"]): string {
  return `a11y-${impact}`;
}

function getBestInstance(violation: LucidViolation): LucidViolation["instances"][number] | null {
  if (!violation.instances?.length) return null;
  return violation.instances.find((i) => i.screenshotPath) ?? violation.instances[0] ?? null;
}

function escapeMarkdown(value: string): string {
  return value.replace(/[_*[\]()`~]/g, "\\$&");
}

async function maybeEmbedScreenshotAsDataUri(absoluteScreenshotPath: string | null): Promise<string | null> {
  if (!absoluteScreenshotPath) return null;
  try {
    const stat = await fs.stat(absoluteScreenshotPath);
    // Keep body sizes reasonable; large images can exceed GitHub limits.
    if (stat.size > 250_000) return null;
    const b64 = await fs.readFile(absoluteScreenshotPath, { encoding: "base64" });
    return `![Lucid screenshot](data:image/png;base64,${b64})`;
  } catch {
    return null;
  }
}

async function issueExistsByRule(octokit: Octokit, args: { owner: string; repo: string; ruleId: string }) {
  const { owner, repo, ruleId } = args;
  const prefix = `[A11y] ${ruleId}:`;
  try {
    const res = await octokit.search.issuesAndPullRequests({
      q: `repo:${owner}/${repo} in:title "${prefix}" state:open`,
      per_page: 1,
    });
    return res.data.total_count > 0;
  } catch {
    return false;
  }
}

function buildIssueBody(violation: LucidViolation, bestInstanceUrl: string | null, maxInstances = 25): string {
  const wcagRefs = violation.wcag?.length ? violation.wcag.join(", ") : "(none)";
  const examples = violation.instances.slice(0, maxInstances).map((inst) => {
    return `- ${inst.url}\n  - selector: \`${escapeMarkdown(inst.selector)}\`\n  - failure: ${escapeMarkdown(inst.failureSummary)}`;
  });

  const firstLine = `[${violation.id}] ${violation.description}`;
  const help = violation.helpUrl ? `Help: ${violation.helpUrl}` : `Help: ${violation.help}`;

  const reproUrl = bestInstanceUrl ? `Visit: ${bestInstanceUrl}` : "Visit one of the affected URLs below.";

  return [
    `## Summary`,
    firstLine,
    ``,
    `## Severity`,
    `${violation.impact.toUpperCase()}`,
    ``,
    `## WCAG references`,
    wcagRefs,
    ``,
    `## Why this matters`,
    violation.help?.trim() ? violation.help.trim() : "",
    ``,
    `## Help`,
    help,
    ``,
    `## Reproduction steps`,
    `1. ${reproUrl}`,
    `2. Open DevTools and inspect the element matching the reported selector(s).`,
    `3. Verify the reported failure summary.`,
    ``,
    `## Affected instances`,
    examples.join("\n"),
    ``,
  ].join("\n");
}

export async function createGitHubIssuesFromReport(opts: CreateIssuesOpts): Promise<void> {
  const token = getToken();
  const cwd = process.cwd();
  const reportRaw = await fs.readFile(opts.reportPath, "utf8");
  const report: LucidReport = JSON.parse(reportRaw);

  const { owner, repo } = resolveRepo(cwd, opts.repoOverride);
  if (!token) throw new Error(`Missing GitHub token. Set GITHUB_TOKEN or GH_TOKEN.`);

  const octokit = new Octokit({ auth: token });

  const violations = report.violations ?? [];
  for (const violation of violations) {
    const bestInstance = getBestInstance(violation);
    const screenshotMarkdown = await maybeEmbedScreenshotAsDataUri(bestInstance?.screenshotPath ?? null);

    const title = `[A11y] ${violation.id}: ${violation.description}`;
    const bodyBase = buildIssueBody(violation, bestInstance?.url ?? null);
    const body = screenshotMarkdown ? `${bodyBase}\n${screenshotMarkdown}\n` : bodyBase;

    if (opts.dryRun) {
      // eslint-disable-next-line no-console
      console.log(`DRY RUN: would create issue in ${owner}/${repo}:\n- ${title}\n`);
      continue;
    }

    const exists = await issueExistsByRule(octokit, { owner, repo, ruleId: violation.id });
    if (exists) continue;

    const labels = ["accessibility", impactToLabel(violation.impact)];
    try {
      await octokit.issues.create({
        owner,
        repo,
        title,
        body,
        labels,
      });
    } catch (err: any) {
      // If label names don't exist, retry without labels.
      try {
        await octokit.issues.create({ owner, repo, title, body });
      } catch (err2) {
        throw err2;
      }
    }
  }
}

