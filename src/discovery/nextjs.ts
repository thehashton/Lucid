import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

type Token =
  | { kind: "static"; value: string }
  | { kind: "single"; name: string }
  | { kind: "catchall"; name: string }
  | { kind: "optionalCatchall"; name: string };

function hasDynamicToken(routePattern: string): boolean {
  return /\[.*\]/.test(routePattern);
}

function tokenizeRoutePath(routePattern: string): Token[] {
  const trimmed = routePattern === "/" ? "" : routePattern.replace(/(^\/|\/$)/g, "");
  if (!trimmed) return [];

  return trimmed.split("/").map((seg) => {
    if (/^\[\[\.\.\..+\]\]$/.test(seg)) {
      // [[...slug]]
      return { kind: "optionalCatchall", name: seg.slice(5, -2) };
    }
    if (/^\[\.\.\..+\]$/.test(seg)) {
      // [...slug]
      return { kind: "catchall", name: seg.slice(4, -1) };
    }
    if (/^\[.+\]$/.test(seg)) {
      // [slug]
      return { kind: "single", name: seg.slice(1, -1) };
    }
    return { kind: "static", value: seg };
  });
}

function joinBaseUrl(baseUrl: string, routePath: string): string {
  const u = new URL(baseUrl);
  let basePath = u.pathname;
  basePath = basePath.replace(/\/+$/, ""); // strip trailing slash
  if (basePath === "/") basePath = "";
  const route = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${u.origin}${basePath}${route}`;
}

function cartesianExpand(
  tokens: Token[],
  routePattern: string,
  config: any | null,
): string[] {
  if (!config) return [];

  const getValues = (paramName: string): string[] | undefined =>
    config?.routes?.[routePattern]?.[paramName];

  let candidates: string[] = [""];
  for (const t of tokens) {
    const next: string[] = [];
    for (const prefix of candidates) {
      if (t.kind === "static") {
        next.push(prefix ? `${prefix}/${t.value}` : t.value);
        continue;
      }

      if (t.kind === "single") {
        const values = getValues(t.name);
        if (!values?.length) continue;
        for (const val of values) {
          next.push(prefix ? `${prefix}/${val}` : val);
        }
        continue;
      }

      if (t.kind === "catchall") {
        const values = getValues(t.name);
        if (!values?.length) continue;
        for (const val of values) {
          // Value may include slashes; insert as-is.
          next.push(prefix ? `${prefix}/${val}` : val);
        }
        continue;
      }

      if (t.kind === "optionalCatchall") {
        const values = getValues(t.name);
        if (!values?.length) continue;
        for (const val of values) {
          next.push(prefix ? `${prefix}/${val}` : val);
        }
        // Omit this segment entirely.
        next.push(prefix);
        continue;
      }
    }
    candidates = next;
  }

  return candidates
    .map((s) => (s ? `/${s.replace(/^\/+/, "")}` : "/"))
    .map((s) => s.replace(/\/{2,}/g, "/"));
}

function buildRoutePatternFromAppFile(appDir: string, filePath: string): string | null {
  const rel = path.relative(appDir, filePath).replace(/\\/g, "/");
  const parts = rel.split("/");
  const last = parts[parts.length - 1];
  if (!/^page\.(t|j)sx?$/.test(last)) return null;

  const segmentParts = parts.slice(0, -1);
  if (segmentParts.some((s) => s === "api")) return null;

  const routeSegments: string[] = [];
  for (const seg of segmentParts) {
    // Route groups: (marketing) is not part of the URL.
    if (/^\(.+\)$/.test(seg)) continue;
    // Parallel route slots: @modal
    if (seg.startsWith("@")) continue;
    // Intercepting route segments: (.)photo, (..)slug, etc.
    if (/^\(\./.test(seg)) continue;
    if (seg.startsWith("_")) continue;
    routeSegments.push(seg);
  }

  if (routeSegments.length === 0) return "/";
  return `/${routeSegments.join("/")}`;
}

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walkFiles(p)));
      continue;
    }
    if (ent.isFile()) out.push(p);
  }
  return out;
}

function buildRoutePatternFromPagesFile(pagesDir: string, filePath: string): string | null {
  const rel = path.relative(pagesDir, filePath).replace(/\\/g, "/");
  const segments = rel.split("/");
  const filename = segments[segments.length - 1];
  const extMatch = filename.match(/\.(t|j)sx?$/);
  if (!extMatch) return null;

  const dotIdx = filename.lastIndexOf(".");
  const baseNoExt = filename.slice(0, dotIdx);

  if (baseNoExt.startsWith("_")) return null;
  const dirSegs = segments.slice(0, -1);
  if (dirSegs.some((s) => s === "api")) return null;

  const routeSegments = baseNoExt === "index" ? dirSegs : [...dirSegs, baseNoExt];
  const filtered = routeSegments.filter((s) => !s.startsWith("_"));
  if (filtered.some((s) => s === "api")) return null;
  if (filtered.length === 0) return "/";
  return `/${filtered.join("/")}`;
}

export async function discoverNextjsUrls(
  baseUrl: string,
  opts: { cwd?: string; nextjsConfig?: any | null } = {},
): Promise<string[]> {
  const cwd = opts.cwd ?? process.cwd();
  const config = opts.nextjsConfig ?? null;

  const appDir = path.join(cwd, "app");
  const pagesDir = path.join(cwd, "pages");

  const routePatterns = new Set<string>();
  const warnings: string[] = [];

  if (fs.existsSync(appDir) && fs.statSync(appDir).isDirectory()) {
    const files = await walkFiles(appDir);
    for (const f of files) {
      const route = buildRoutePatternFromAppFile(appDir, f);
      if (route) routePatterns.add(route);
    }
  } else if (fs.existsSync(pagesDir) && fs.statSync(pagesDir).isDirectory()) {
    const files = await walkFiles(pagesDir);
    for (const f of files) {
      const route = buildRoutePatternFromPagesFile(pagesDir, f);
      if (route) routePatterns.add(route);
    }
  } else {
    throw new Error(`Could not find Next.js routes: expected ${appDir} or ${pagesDir}.`);
  }

  const discovered = new Set<string>();
  for (const pattern of routePatterns) {
    if (!hasDynamicToken(pattern)) {
      discovered.add(joinBaseUrl(baseUrl, pattern));
      continue;
    }

    if (!config) {
      warnings.push(`Skipped dynamic route without config: ${pattern}`);
      continue;
    }

    const tokens = tokenizeRoutePath(pattern);
    const expanded = cartesianExpand(tokens, pattern, config);
    if (!expanded.length) {
      warnings.push(`Skipped dynamic route due to missing param values: ${pattern}`);
      continue;
    }

    for (const concretePath of expanded) {
      discovered.add(joinBaseUrl(baseUrl, concretePath));
    }
  }

  if (warnings.length) {
    // eslint-disable-next-line no-console
    console.warn(warnings.join("\n"));
  }

  return [...discovered];
}

