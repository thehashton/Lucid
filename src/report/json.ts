import fs from "node:fs/promises";
import path from "node:path";
import type { LucidReport } from "./types.js";

export async function writeJsonReport(report: LucidReport, outputDir: string): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, "report.json");
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return reportPath;
}

