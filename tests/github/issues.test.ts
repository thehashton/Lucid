import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { createGitHubIssuesFromReport } from "../../src/github/issues.js";

describe("github issue creator", () => {
  test("dry-run does not call API and does not throw", async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "lucid-gh-"));
    const screenshotPath = path.join(outDir, "shot.png");
    await fs.writeFile(screenshotPath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB", "utf8"));

    const reportPath = path.join(outDir, "report.json");
    await fs.writeFile(
      reportPath,
      JSON.stringify(
        {
          meta: {
            toolVersion: "0.1.0",
            timestamp: new Date().toISOString(),
            discoveryMode: "sitemap",
            urlCount: 1,
            pagesAudited: 1,
            durationMs: 1,
          },
          summary: { totalsBySeverity: { critical: 0, serious: 0, moderate: 0, minor: 1 }, totalViolations: 1 },
          violationsBySeverity: { critical: [], serious: [], moderate: [], minor: [] },
          violations: [
            {
              id: "color-contrast",
              impact: "minor",
              description: "Insufficient contrast",
              help: "Help text",
              helpUrl: null,
              wcag: ["wcag143"],
              instances: [
                {
                  url: "http://localhost:3000/",
                  selector: "body",
                  html: "<body></body>",
                  failureSummary: "failure summary",
                  screenshotPath,
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    process.env.GITHUB_TOKEN = "test-token";
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await createGitHubIssuesFromReport({
      reportPath,
      repoOverride: "owner/repo",
      dryRun: true,
    });

    expect(log).toHaveBeenCalled();
  });
});

