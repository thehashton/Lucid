import type { LucidViolationSeverity } from "../types.js";

export type LucidViolationInstance = {
  url: string;
  selector: string;
  html: string;
  failureSummary: string;
  screenshotPath: string | null;
};

export type LucidViolation = {
  id: string;
  impact: LucidViolationSeverity;
  description: string;
  help: string;
  helpUrl: string | null;
  wcag: string[];
  instances: LucidViolationInstance[];
};

export type LucidReport = {
  meta: {
    toolVersion: string;
    timestamp: string;
    discoveryMode: string;
    baseUrl?: string;
    urlCount: number;
    pagesAudited: number;
    durationMs: number;
  };
  summary: {
    totalsBySeverity: Record<LucidViolationSeverity, number>;
    totalViolations: number;
  };
  violationsBySeverity: Record<LucidViolationSeverity, LucidViolation[]>;
  violations: LucidViolation[];
};

