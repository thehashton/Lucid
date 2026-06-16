import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { writeJsonReport } from "../../src/report/json.js";
import type { LucidReport } from "../../src/report/types.js";

describe("report json writer", () => {
  test("writes report.json to output directory", async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "lucid-report-"));
    const report = {
      meta: {
        toolVersion: "0.1.0",
        timestamp: new Date().toISOString(),
        discoveryMode: "sitemap",
        urlCount: 1,
        pagesAudited: 1,
        durationMs: 1,
      },
      summary: {
        totalsBySeverity: { critical: 0, serious: 0, moderate: 0, minor: 1 },
        totalViolations: 1,
      },
      violationsBySeverity: {
        critical: [],
        serious: [],
        moderate: [],
        minor: [],
      },
      violations: [],
    } satisfies LucidReport;

    const reportPath = await writeJsonReport(report, outDir);
    const raw = await fs.readFile(reportPath, "utf8");
    expect(JSON.parse(raw).meta.discoveryMode).toBe("sitemap");
  });
});

