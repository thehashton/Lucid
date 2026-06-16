<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="assets/readme/light.png" />
    <img src="assets/lucid-logo.png" alt="Lucid — automated accessibility auditing" width="480" />
  </picture>
</p>

# Lucid

Automated accessibility auditing that brings clarity to your codebase for hitting those a11y goals.

Lucid audits an entire web project for accessibility violations — not just a single URL. It discovers routes via sitemap, crawl, or Next.js static analysis, runs axe-core checks in headless Chromium, captures screenshots of affected elements, and outputs a terminal summary plus a structured JSON report.

## Quick start

No config file is required in the target project.

```bash
# Install Chromium for Playwright (one-time per machine)
npx playwright install chromium

# Recommended: audit all URLs from a sitemap
npx lucid --sitemap http://localhost:3000/sitemap.xml

# Spider internal links from a root URL
npx lucid --crawl http://localhost:3000

# Next.js: derive routes from app/ or pages/ and audit against a dev server
npx lucid --framework nextjs --base-url http://localhost:3000
```

## Route discovery

Lucid supports three discovery modes (provide exactly one):

| Mode | Flag | Description |
|------|------|-------------|
| **Sitemap** (recommended) | `--sitemap <url>` | Parse `sitemap.xml`, including nested sitemap indexes |
| **Crawl** | `--crawl <url>` | BFS spider from a root URL, following same-origin anchor tags |
| **Next.js** | `--framework nextjs --base-url <url>` | Statically analyse `app/` or `pages/` in the current directory |

### Next.js dynamic routes

Static routes are discovered automatically. Dynamic segments (`[slug]`, `[...slug]`, `[[...slug]]`) require an optional `lucid.config.json` in the project root:

```json
{
  "routes": {
    "/blog/[slug]": {
      "slug": ["hello-world", "getting-started"]
    },
    "/products/[...slug]": {
      "slug": ["a/b", "c"]
    }
  }
}
```

Without this config, dynamic routes are skipped with a warning.

## CLI options

| Flag | Default | Description |
|------|---------|-------------|
| `--output <dir>` | `./lucid-report` | Report output directory |
| `--concurrency <n>` | `3` | Parallel page audits |
| `--crawl-max-pages <n>` | `500` | Maximum pages to crawl |
| `--timeout <ms>` | `30000` | Per-page navigation timeout |
| `--create-issues` | — | Create GitHub Issues from the JSON report |
| `--repo <owner/name>` | git remote `origin` | Override target repository for issues |
| `--dry-run` | — | Print issue payloads without calling the GitHub API |

**Exit codes:** `1` if any critical or serious violations are found (CI-friendly); `0` otherwise.

## Output

Reports are written to `./lucid-report/` (or your `--output` path):

```
lucid-report/
├── report.json
└── screenshots/
    └── {url}__{ruleId}__{index}.png
```

The JSON report groups violations by severity (`critical`, `serious`, `moderate`, `minor`) with WCAG success criteria references. Each violation instance includes the URL, selector, HTML snippet, failure summary, and screenshot path.

The terminal summary prints a human-readable overview with severity-colored sections and the top affected URLs.

## GitHub Issues

Use `--create-issues` to open one GitHub Issue per unique violation type (axe rule ID), with reproduction steps and a representative screenshot embedded in the issue body.

**Requirements:**

- `GITHUB_TOKEN` or `GH_TOKEN` environment variable
- Repository resolved from `git remote get-url origin`, or override with `--repo owner/name`

```bash
npx lucid --sitemap http://localhost:3000/sitemap.xml --create-issues
```

Use `--dry-run` to preview issue titles without creating them. Existing open issues with the same `[A11y] {ruleId}` title prefix are skipped.

## CI integration

```yaml
- name: Install Playwright Chromium
  run: npx playwright install chromium

- name: Run Lucid accessibility audit
  run: npx lucid --sitemap http://localhost:3000/sitemap.xml

- name: Create GitHub Issues on failure
  if: failure()
  run: npx lucid --sitemap http://localhost:3000/sitemap.xml --create-issues
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Upload `lucid-report/` as a CI artifact to retain screenshots and the full JSON report.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

### Project structure

```
src/
├── cli.ts              # Commander CLI entry
├── discovery/          # sitemap, crawl, nextjs route discovery
├── audit/              # Playwright + axe-core auditing
├── report/             # JSON + terminal output
└── github/             # GitHub Issues integration
assets/
├── lucid-logo.png        # Source logo (transparent)
├── lucid-logo-dark.png   # README variant for dark mode (#0d1117)
└── lucid-logo-light.png  # README variant for light mode
```

## License

MIT
