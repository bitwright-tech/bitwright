import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { distFiles, doc, pages } from "./helpers";

/**
 * What actually ships.
 *
 * Every check here reads dist/, not src/. A build step can rewrite what was
 * authored. This project has been bitten twice by a minifier doing exactly
 * that, so the source is a claim and the output is the evidence.
 */

const JS_BUDGET = 15 * 1024;

describe("pages", () => {
  it("builds the routes a visitor and a crawler need", () => {
    for (const file of [
      "dist/index.html",
      "dist/404.html",
      "dist/robots.txt",
      "dist/sitemap-index.xml",
      "dist/llms.txt",
      "dist/og.png",
      "dist/_headers",
    ]) {
      expect(() => statSync(file), `${file} missing`).not.toThrow();
    }
  });

  // Every route is one of two things and has to be declared as one, so a page
  // added next month is caught without anyone remembering to update a test.
  //
  // This used to read "the home page and nothing else", which was right while
  // everything else was scaffolding. It is not right now: a store will not accept
  // a submission whose privacy and support addresses are disallowed to crawlers,
  // and hiding a privacy policy is a strange thing for a site to do.
  const PUBLISHED = ["/", "/privacy", "/support"];

  const routes = () =>
    pages()
      .map((f) => f.replace(/^dist/, "").replace(/\/index\.html$/, "") || "/")
      .filter((r) => r !== "/404.html");

  it("publishes exactly the routes meant to be found", () => {
    const sitemap = readFileSync("dist/sitemap-0.xml", "utf8");
    const robots = readFileSync("dist/robots.txt", "utf8");

    for (const route of routes()) {
      if (PUBLISHED.includes(route)) {
        expect(sitemap.includes(`bitwright.tech${route}`), `sitemap omits ${route}`).toBe(
          true
        );
        expect(robots.includes(`Disallow: ${route}`), `robots hides ${route}`).toBe(
          false
        );
      } else {
        expect(sitemap.includes(route), `sitemap lists ${route}`).toBe(false);
        expect(robots, `robots.txt does not disallow ${route}`).toContain(
          `Disallow: ${route}`
        );
      }
    }

    // The other direction. A route named here but never built is a promise the
    // sitemap keeps making to crawlers that will 404 on it.
    for (const route of PUBLISHED) {
      expect(routes(), `${route} is published but not built`).toContain(route);
    }
  });
});

describe("links that go nowhere", () => {
  it("resolves every in-page anchor on the page that carries it", () => {
    // A bare `#products` in a component that renders on every page is a link that
    // silently does nothing everywhere except the one page holding that id. No
    // error, no 404, just a click that goes nowhere.
    for (const file of pages()) {
      const d = doc(file);
      for (const a of d.querySelectorAll('a[href^="#"]')) {
        const id = a.getAttribute("href")!.slice(1);
        expect(
          d.getElementById(id),
          `${file} links to #${id}, which is not on it`
        ).toBeTruthy();
      }
    }
  });

  it("points every rooted anchor at a page that exists and an id on it", () => {
    for (const file of pages()) {
      for (const a of doc(file).querySelectorAll('a[href^="/"]')) {
        const [path, hash] = a.getAttribute("href")!.split("#");
        const target = path === "/" ? "dist/index.html" : `dist${path}/index.html`;
        expect(existsSync(target), `${file} links to ${path}, which is not built`).toBe(
          true
        );
        if (hash) {
          expect(
            doc(target).getElementById(hash),
            `${file} links to ${path}#${hash}, and ${path} has no such id`
          ).toBeTruthy();
        }
      }
    }
  });
});

describe("what a machine reads", () => {
  it("gives the organisation a logo a search engine will accept", () => {
    const org = JSON.parse(
      [...doc("dist/index.html").querySelectorAll('script[type="application/ld+json"]')]
        .map((n) => n.textContent!)
        .find((t) => t.includes('"Organization"'))!
    );
    expect(org.logo?.url, "the Organization declares no logo").toBeTruthy();
    expect(
      existsSync("dist" + new URL(org.logo.url).pathname),
      "the declared logo is not built"
    ).toBe(true);
    // Google will not take an SVG for this field, and the minimum is 112px.
    expect(org.logo.url.endsWith(".png"), "the logo is not a raster").toBe(true);
    expect(Math.min(org.logo.width, org.logo.height)).toBeGreaterThanOrEqual(112);
  });

  it("describes each product as an entity, without implying it can be had", () => {
    const apps = [
      ...doc("dist/index.html").querySelectorAll('script[type="application/ld+json"]'),
    ]
      .map((n) => JSON.parse(n.textContent!))
      .filter((j) => j["@type"] === "MobileApplication");
    expect(apps.length, "the products carry no structured data").toBe(2);
    for (const app of apps) {
      expect(app.name).toBeTruthy();
      expect(app.description.length).toBeGreaterThan(60);
      // Neither has shipped. These are the fields a result renders as "available",
      // and any of them would put the markup at odds with the words beside it.
      for (const field of ["offers", "downloadUrl", "installUrl", "price"]) {
        expect(app[field], `${app.name} advertises ${field} and has not shipped`).toBe(
          undefined
        );
      }
    }
  });

  it("keeps security.txt in date", () => {
    // RFC 9116 makes Expires mandatory, and a file past it reads as abandoned,
    // worse than publishing none. Sixty days of warning is enough to act on and
    // short enough that nobody forgets twice.
    const txt = readFileSync("dist/.well-known/security.txt", "utf8");
    const expires = txt.match(/^Expires:\s*(.+)$/m)?.[1];
    expect(expires, "security.txt declares no Expires").toBeTruthy();
    const left = (Date.parse(expires!) - Date.now()) / 86400000;
    expect(left, `security.txt expires in ${Math.round(left)} days`).toBeGreaterThan(60);
    expect(txt, "security.txt names no contact").toMatch(/^Contact:\s*\S+/m);
  });

  it("tells crawlers when the pages last changed", () => {
    // A lastmod set to the build date claims every page changed every build,
    // which is a signal a crawler learns to discard. This one comes from git.
    const sitemap = readFileSync("dist/sitemap-0.xml", "utf8");
    const stamps = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
    expect(stamps.length, "the sitemap carries no lastmod").toBeGreaterThan(0);
    for (const stamp of stamps) {
      expect(Number.isNaN(Date.parse(stamp)), `unparseable lastmod: ${stamp}`).toBe(
        false
      );
      expect(Date.parse(stamp), `lastmod is in the future: ${stamp}`).toBeLessThanOrEqual(
        Date.now() + 60_000
      );
    }
  });
});

describe("the not-found page", () => {
  it("tells crawlers not to index it", () => {
    // The 404 status does the real work and the host is configured to send it
    // (not_found_handling in wrangler.jsonc). This is the belt: the page is also
    // reachable at its own URL, and an error page that gets indexed is a result
    // someone searching for the studio can land on.
    //
    // The generic canonical-or-noindex rule cannot catch this. A 404 carrying
    // only a canonical satisfies it perfectly, which is exactly the state this
    // page was in.
    const robots =
      doc("dist/404.html")
        .querySelector('meta[name="robots"]')
        ?.getAttribute("content") ?? "";
    expect(robots, "the not-found page does not declare noindex").toContain("noindex");
  });

  it("gives a lost visitor the whole set of ways out", () => {
    // Header and footer both. Someone who lands here is the visitor most in need
    // of options, and the footer is the only place carrying all of them.
    const d = doc("dist/404.html");
    expect(d.querySelector("header"), "no header on the 404").toBeTruthy();
    expect(d.querySelector("footer"), "no footer on the 404").toBeTruthy();
    expect(
      d.querySelector('main a[href="/"]'),
      "the 404 offers no route back to the home page"
    ).toBeTruthy();
  });
});

describe("assets the head promises", () => {
  it("ships every icon and image the document references", () => {
    // A head that points at a missing file fails silently: the browser asks, gets
    // a 404 and falls back to its own default. Nobody sees an error, and the share
    // card is simply blank in whatever app someone pasted the link into.
    const d = doc("dist/index.html");
    const refs = [
      ...[...d.querySelectorAll("link[rel*='icon']")].map((n) => n.getAttribute("href")),
      ...[
        ...d.querySelectorAll("meta[property='og:image'], meta[name='twitter:image']"),
      ].map((n) => n.getAttribute("content")),
    ].filter(Boolean) as string[];
    expect(refs.length, "the head references no icon at all").toBeGreaterThan(2);
    for (const ref of refs) {
      const path = "dist" + new URL(ref, "https://bitwright.tech").pathname;
      expect(existsSync(path), `${ref} is referenced but not built`).toBe(true);
    }
  });

  it("declares the share image at the size it actually is", () => {
    // The dimensions are asserted in meta tags, and a card scaled against the
    // wrong ones is stretched in every app that trusts them.
    const d = doc("dist/index.html");
    const w = Number(
      d.querySelector("meta[property='og:image:width']")?.getAttribute("content")
    );
    const h = Number(
      d.querySelector("meta[property='og:image:height']")?.getAttribute("content")
    );
    const png = readFileSync("dist/og.png");
    expect(
      [png.readUInt32BE(16), png.readUInt32BE(20)],
      "og.png is not the size the head declares"
    ).toEqual([w, h]);
  });
});

describe("weight", () => {
  it("ships JavaScript under budget", () => {
    // Emitted files AND inline scripts. The budget counted only .js files, which
    // meant the one script this site actually depends on, the inline
    // enhancement and the only JavaScript on the page that is ours, was the one
    // piece that could grow without limit. A ceiling with a hole in it reports
    // the same green as a ceiling.
    const emitted = distFiles()
      .filter((f) => f.endsWith(".js"))
      .map((f) => readFileSync(f));
    const inline = pages().flatMap((f) =>
      [
        ...doc(f).querySelectorAll("script:not([src]):not([type='application/ld+json'])"),
      ].map((n) => Buffer.from(n.textContent ?? "", "utf8"))
    );
    const all = [...emitted, ...inline];
    const bytes = all.length ? gzipSync(Buffer.concat(all)).length : 0;
    expect(
      inline.length,
      "no inline script found; has the selector stopped matching?"
    ).toBeGreaterThan(0);
    expect(bytes, `${bytes} bytes gzipped`).toBeLessThanOrEqual(JS_BUDGET);
  });

  it("ships no framework runtime", () => {
    for (const file of distFiles().filter((f) => f.endsWith(".js"))) {
      const source = readFileSync(file, "utf8");
      for (const marker of ["react", "preact", "vue", "svelte"]) {
        expect(
          source.toLowerCase().includes(`${marker}.`),
          `${file} bundles ${marker}`
        ).toBe(false);
      }
    }
  });
});

describe("privacy", () => {
  it("contacts no third-party origin", () => {
    const allowed = [
      "bitwright.tech",
      "github.com",
      "schema.org",
      "astro.build",
      "w3.org",
      "sitemaps.org",
    ];
    for (const file of pages()) {
      const html = readFileSync(file, "utf8");
      for (const [, url] of html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)) {
        const host = new URL(url).hostname.replace(/^www\./, "");
        expect(
          allowed.some((a) => host.endsWith(a)),
          `${file} loads from ${host}`
        ).toBe(true);
      }
    }
  });

  it("serves security headers", () => {
    const headers = readFileSync("dist/_headers", "utf8");
    for (const header of [
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "Referrer-Policy",
    ]) {
      expect(headers).toContain(header);
    }
  });
});

describe("metadata", () => {
  for (const file of pages()) {
    it(`${file.replace("dist/", "")} carries the tags a crawler reads`, () => {
      const d = doc(file);
      expect(d.querySelector("title")?.textContent?.length, "title").toBeGreaterThan(10);
      const description =
        d.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
      expect(description.length, "description").toBeGreaterThan(30);
      // Canonical OR noindex, never neither and never both. A page that says
      // "do not index me" while naming itself canonical is telling a crawler two
      // different things, and a page with neither is leaving the decision to
      // whoever finds it.
      const canonical = d.querySelector('link[rel="canonical"]');
      const noindex = d
        .querySelector('meta[name="robots"]')
        ?.getAttribute("content")
        ?.includes("noindex");
      expect(
        Boolean(canonical) !== Boolean(noindex),
        canonical ? "canonical and noindex together" : "neither canonical nor noindex"
      ).toBe(true);
      expect(d.querySelector('meta[property="og:image"]'), "og:image").toBeTruthy();
      expect(d.documentElement.getAttribute("lang"), "lang").toBe("en");
    });
  }

  it("emits structured data that parses and names the company", () => {
    const blocks = [
      ...doc("dist/index.html").querySelectorAll('script[type="application/ld+json"]'),
    ];
    expect(blocks.length).toBeGreaterThan(0);
    const parsed = blocks.map((b) => JSON.parse(b.textContent ?? "{}"));
    const org = parsed.find((p) => p["@type"] === "Organization");
    expect(org?.taxID).toBe("68.150.870/0001-80");
    expect(org?.email).toBe("contact@bitwright.tech");
  });
});

describe("links", () => {
  it("resolves every internal link to something the host serves directly", () => {
    // Not "to something that exists". The earlier version accepted both /privacy
    // and /privacy/ because it tried `${href}/index.html` for either, and the
    // host does not: a directory route without the slash answers 307 and only
    // then 200. That shipped, and every click on the footer paid a round trip
    // while the sitemap and the canonical already used the slash. A test looser
    // than the server is a test that certifies a redirect as an arrival.
    const built = new Set(distFiles().map((f) => f.replace(/^dist/, "")));
    for (const file of pages()) {
      for (const [, href] of readFileSync(file, "utf8").matchAll(/href="(\/[^"#]*)"/g)) {
        const served = href.endsWith("/")
          ? [`${href}index.html`]
          : [href, `${href}.html`];
        expect(
          served.some((c) => built.has(c)),
          `${file} → ${href} is not served without a redirect`
        ).toBe(true);
      }
    }
  });
});

describe("alignment", () => {
  it("gives the header, the sections and the footer the same column", () => {
    // The footer was carrying px-6 while every section above it had px-6 md:px-10,
    // so on a wide screen its content sat 16px to the left of everything else.
    // Nothing about that is visible in a diff; it is visible in a screenshot.
    const sources = [
      "src/pages/index.astro",
      "src/components/Footer.astro",
      "src/components/Header.astro",
    ].map((f) => readFileSync(f, "utf8"));
    for (const source of sources) {
      expect(source, "container width").toContain("max-w-5xl");
    }
    for (const source of sources.slice(0, 2)) {
      expect(source, "inline padding").toContain("px-6 md:px-10");
    }
  });

  it("keeps the docked header on the same grid as the content", () => {
    const css = readFileSync("src/styles/global.css", "utf8");
    const docked = css.slice(css.indexOf(".site-header.is-docked"));
    expect(
      docked.slice(0, 400).includes("max-width"),
      "docked header changes width"
    ).toBe(false);
  });
});
