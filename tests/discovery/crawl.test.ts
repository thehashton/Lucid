import { describe, expect, test } from "vitest";
import { normalizeForRouteDiscovery } from "../../src/discovery/crawl.js";

describe("crawl discovery helpers", () => {
  test("normalizes hash and trailing slash", () => {
    const u1 = normalizeForRouteDiscovery("http://localhost:3000/about#team");
    const u2 = normalizeForRouteDiscovery("http://localhost:3000/about/");
    expect(u1).toBe("http://localhost:3000/about");
    expect(u2).toBe("http://localhost:3000/about");
  });
});

