import path from "node:path";
import type { Page, Locator } from "playwright";

function slugifyForFilename(input: string): string {
  return input
    .replace(/^https?:\/\//i, "")
    .replace(/[?#]/g, "_")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function highlightLocator(locator: Locator, color: string) {
  await locator.evaluate(
    (el, c) => {
      const prevOutline = (el as HTMLElement).style.outline;
      const prevOutlineOffset = (el as HTMLElement).style.outlineOffset;
      (el as HTMLElement).dataset.__lucidPrevOutline = prevOutline;
      (el as HTMLElement).dataset.__lucidPrevOutlineOffset = prevOutlineOffset;
      (el as HTMLElement).style.outline = `3px solid ${c}`;
      (el as HTMLElement).style.outlineOffset = "2px";
    },
    color,
  );
}

async function clearHighlight(locator: Locator) {
  await locator.evaluate((el) => {
    const e = el as HTMLElement;
    const prevOutline = e.dataset.__lucidPrevOutline;
    const prevOutlineOffset = e.dataset.__lucidPrevOutlineOffset;
    e.style.outline = prevOutline ?? "";
    e.style.outlineOffset = prevOutlineOffset ?? "";
    delete e.dataset.__lucidPrevOutline;
    delete e.dataset.__lucidPrevOutlineOffset;
  });
}

export async function captureViolationScreenshot(opts: {
  page: Page;
  url: string;
  ruleId: string;
  nodeIndex: number;
  targetSelectors: string[];
  screenshotDir: string;
}): Promise<string | null> {
  const { page, url, ruleId, nodeIndex, targetSelectors, screenshotDir } = opts;
  const urlSlug = slugifyForFilename(url);
  const filename = `${urlSlug}__${ruleId}__${nodeIndex}.png`;
  const outPath = path.join(screenshotDir, filename);

  const selector = targetSelectors.join(" ").trim();
  try {
    if (selector) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) > 0) {
        await locator.scrollIntoViewIfNeeded();
        await highlightLocator(locator, "#ff2d2d");
        await page.waitForTimeout(50);
        await page.screenshot({ path: outPath });
        await clearHighlight(locator).catch(() => {});
        return outPath;
      }
    }

    await page.screenshot({ path: outPath, fullPage: true });
    return outPath;
  } catch {
    return null;
  }
}

