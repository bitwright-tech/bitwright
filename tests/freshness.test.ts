import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pages } from "./helpers";
import { legacyTlsProblem } from "../scripts/tls-refusal.mjs";

/**
 * The suite reads dist/. That makes it honest about what ships and dishonest
 * about when the build is missing or old, because the per-page tests are
 * generated from the list of built pages at collection time: with no dist/ the
 * suite quietly shrinks from 63 tests to 47 and reports success, and with a stale
 * dist/ it happily verifies last week's output against this week's source.
 *
 * These three run first and fail loudly instead.
 */

const newest = (dir: string): number =>
  readdirSync(dir).reduce((latest, entry) => {
    if (entry === "node_modules" || entry.startsWith(".")) return latest;
    const path = join(dir, entry);
    const stat = statSync(path);
    return Math.max(latest, stat.isDirectory() ? newest(path) : stat.mtimeMs);
  }, 0);

describe("the build under test", () => {
  it("exists", () => {
    expect(existsSync("dist"), "no dist/, so run npm run build first").toBe(true);
  });

  it("is newer than the source it was built from", () => {
    const source = Math.max(
      newest("src"),
      newest("public"),
      statSync("astro.config.mjs").mtimeMs
    );
    const built = newest("dist");
    expect(built, `dist/ is older than src/, so the build is stale`).toBeGreaterThan(
      source
    );
  });

  it("built every route, and only the routes it has", () => {
    // Exact count, not "at least". The per-page suites are generated from this
    // list, so a partially written dist/ would not fail. It would quietly produce
    // fewer tests and report success.
    const expected = readdirSync("src/pages").filter((f) => f.endsWith(".astro")).length;
    expect(pages().length, `built ${pages().length} pages, expected ${expected}`).toBe(
      expected
    );
  });

  it("contains a page for every route in src/pages", () => {
    const routes = readdirSync("src/pages")
      .filter((f) => f.endsWith(".astro"))
      .map((f) => f.replace(/\.astro$/, ""));
    const built = pages().join(" ");
    for (const route of routes) {
      const expected =
        route === "index"
          ? "dist/index.html"
          : route === "404"
            ? "dist/404.html"
            : `dist/${route}/index.html`;
      expect(built, `${route} did not build`).toContain(expected);
    }
  });
});

describe("the legacy TLS probe", () => {
  /**
   * check:live guards dashboard state, and min_tls_version ships defaulted to
   * 1.0. The assertion that watches it used to resolve a pass on any socket
   * error, which included the one OpenSSL 3 raises when it declines to offer
   * the old protocol in the first place. Measured against a host that does
   * accept TLS 1.1, the old reading still printed "TLS below 1.2 is refused".
   *
   * These are the outcomes observed on the wire, not invented ones.
   */

  it("fails when the host completes a handshake below 1.2", () => {
    expect(legacyTlsProblem({ handshake: true, protocol: "TLSv1.1" })).toMatch(
      /TLSv1\.1/
    );
  });

  it("passes only when the refusal came from the peer", () => {
    // A Cloudflare zone held at TLS 1.2 answers the first; tls-v1-2.badssl.com
    // answers the second.
    expect(legacyTlsProblem({ code: "ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION" })).toBeNull();
    expect(legacyTlsProblem({ code: "ECONNRESET" })).toBeNull();
  });

  it("refuses to call a question never asked an answer", () => {
    // The exact error the old assertion swallowed, on every host tried.
    const problem = legacyTlsProblem({ code: "ERR_SSL_NO_PROTOCOLS_AVAILABLE" });
    expect(problem, "a local failure to ask was read as a refusal").toBeTruthy();
    expect(problem).toContain("ERR_SSL_NO_PROTOCOLS_AVAILABLE");
  });

  it("treats a timeout and an unnamed error as learning nothing", () => {
    expect(legacyTlsProblem({ timedOut: true })).toBeTruthy();
    expect(legacyTlsProblem({})).toBeTruthy();
  });
});
