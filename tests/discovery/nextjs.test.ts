import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { discoverNextjsUrls } from "../../src/discovery/nextjs.js";

function tempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "lucid-nextjs-"));
}

async function writeFileEnsured(filePath: string, contents = "export default function Page() {}") {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

describe("nextjs discovery", () => {
  afterEach(() => vi.restoreAllMocks());

  test("discovers static app router page routes", async () => {
    const cwd = await tempDir();
    const baseUrl = "http://localhost:3000/base";

    await writeFileEnsured(path.join(cwd, "app/about/page.tsx"));

    const urls = await discoverNextjsUrls(baseUrl, { cwd, nextjsConfig: null });
    expect(urls).toEqual([`${baseUrl}/about`]);
  });

  test("skips dynamic app router routes without config", async () => {
    const cwd = await tempDir();
    const baseUrl = "http://localhost:3000";

    await writeFileEnsured(path.join(cwd, "app/about/page.tsx"));
    await writeFileEnsured(path.join(cwd, "app/blog/[slug]/page.tsx"));

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const urls = await discoverNextjsUrls(baseUrl, { cwd, nextjsConfig: null });
    expect(urls).toEqual([`${baseUrl}/about`]);
    expect(warn).toHaveBeenCalled();
  });

  test("expands dynamic app router routes using lucid.config.json shape", async () => {
    const cwd = await tempDir();
    const baseUrl = "http://localhost:3000";

    await writeFileEnsured(path.join(cwd, "app/blog/[slug]/page.tsx"));

    const config = {
      routes: {
        "/blog/[slug]": {
          slug: ["hello-world", "getting-started"],
        },
      },
    };

    const urls = await discoverNextjsUrls(baseUrl, { cwd, nextjsConfig: config });
    expect(new Set(urls)).toEqual(new Set([`${baseUrl}/blog/hello-world`, `${baseUrl}/blog/getting-started`]));
  });

  test("expands optional catchall routes to include omitted segment", async () => {
    const cwd = await tempDir();
    const baseUrl = "http://localhost:3000";

    await writeFileEnsured(path.join(cwd, "app/docs/[[...slug]]/page.tsx"));

    const config = {
      routes: {
        "/docs/[[...slug]]": {
          slug: ["a/b"],
        },
      },
    };

    const urls = await discoverNextjsUrls(baseUrl, { cwd, nextjsConfig: config });
    expect(new Set(urls)).toEqual(new Set([`${baseUrl}/docs/a/b`, `${baseUrl}/docs`]));
  });

  test("discovers pages router static + dynamic routes with config", async () => {
    const cwd = await tempDir();
    const baseUrl = "http://localhost:3000";

    await writeFileEnsured(path.join(cwd, "pages/index.tsx"));
    await writeFileEnsured(path.join(cwd, "pages/blog/index.tsx"));
    await writeFileEnsured(path.join(cwd, "pages/blog/[slug].tsx"));

    const config = {
      routes: {
        "/blog/[slug]": { slug: ["hello"] },
      },
    };

    const urls = await discoverNextjsUrls(baseUrl, { cwd, nextjsConfig: config });
    expect(new Set(urls)).toEqual(new Set([`${baseUrl}/`, `${baseUrl}/blog`, `${baseUrl}/blog/hello`]));
  });
});

