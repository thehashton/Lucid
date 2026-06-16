import picocolors from "picocolors";
import type { LucidReport, LucidViolation, LucidViolationSeverity } from "./types.js";

function colorForSeverity(sev: LucidViolationSeverity) {
  if (sev === "critical") return picocolors.red;
  if (sev === "serious") return picocolors.yellow;
  if (sev === "moderate") return picocolors.cyan;
  return picocolors.gray;
}

function countInstancesForViolation(v: LucidViolation): number {
  return v.instances.length;
}

export function printTerminalSummary(report: LucidReport, outputDir: string) {
  const urlCounts = new Map<string, number>();
  for (const v of report.violations) {
    for (const inst of v.instances) {
      urlCounts.set(inst.url, (urlCounts.get(inst.url) ?? 0) + 1);
    }
  }
  const topUrls = [...urlCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const { summary, meta } = report;
  const hasAny = summary.totalViolations > 0;

  // Header
  // eslint-disable-next-line no-console
  console.log(
    [
      picocolors.bold("Lucid accessibility audit"),
      `Discovery: ${meta.discoveryMode}`,
      `URLs audited: ${meta.urlCount} (pages: ${meta.pagesAudited})`,
      `Duration: ${meta.durationMs}ms`,
      `Report: ${outputDir}/report.json`,
      "",
    ].join("\n"),
  );

  if (!hasAny) {
    // eslint-disable-next-line no-console
    console.log(picocolors.green("No accessibility violations found."));
    return;
  }

  const order: LucidViolationSeverity[] = ["critical", "serious", "moderate", "minor"];
  for (const sev of order) {
    const color = colorForSeverity(sev);
    const violations = report.violationsBySeverity[sev] ?? [];
    if (violations.length === 0) continue;

    // eslint-disable-next-line no-console
    console.log(color(picocolors.bold(`\n${sev.toUpperCase()} (${violations.length} rules)`)));

    for (const v of violations) {
      const wcagRefs = v.wcag?.length ? ` WCAG: ${v.wcag.join(", ")}` : "";
      // eslint-disable-next-line no-console
      console.log(
        `- ${v.id} (${countInstancesForViolation(v)} instances): ${v.description}${wcagRefs}`,
      );
    }
  }

  if (topUrls.length > 0) {
    // eslint-disable-next-line no-console
    console.log(picocolors.bold("\nTop affected URLs:"));
    for (const [u, n] of topUrls) {
      // eslint-disable-next-line no-console
      console.log(`- ${u}: ${n} violation instances`);
    }
  }
}

