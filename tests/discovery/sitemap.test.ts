import { describe, expect, test } from "vitest";
import { parseSitemapUrlsFromXml } from "../../src/discovery/sitemap.js";

describe("sitemap discovery", () => {
  test("parses urlset loc entries", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset>
        <url><loc>https://example.com/a</loc></url>
        <url><loc>http://example.com/b</loc></url>
        <url><loc>/relative</loc></url>
      </urlset>`;

    const urls = parseSitemapUrlsFromXml(xml);
    expect(urls).toEqual(["https://example.com/a", "http://example.com/b"]);
  });

  test("parses sitemapindex loc entries as nested sitemaps", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex>
        <sitemap><loc>https://example.com/s1.xml</loc></sitemap>
        <sitemap><loc>https://example.com/s2.xml</loc></sitemap>
      </sitemapindex>`;

    const urls = parseSitemapUrlsFromXml(xml);
    expect(urls).toEqual(["https://example.com/s1.xml", "https://example.com/s2.xml"]);
  });
});

