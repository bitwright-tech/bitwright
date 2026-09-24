import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { distFiles, doc, pages } from "./helpers";
import { MAX_EM_DASH_PER_1000, SHAPE, VOCABULARY } from "../scripts/check-prose.mjs";

/**
 * The rules that are not about taste.
 *
 * Two of them are why the company exists in this shape at all: the site may
 * publish only the CNPJ and the contact address, and it may never describe the
 * products with vocabulary that names a regulated activity in Brazil. Both are
 * one careless sentence away from being broken, and neither is visible in a diff
 * unless someone is looking for it.
 */

/** Every text artefact that ships, not only the HTML. llms.txt, robots.txt, the
 * sitemap and _headers were all invisible to this scan, and llms.txt is a second
 * source of published copy, and it carried banned vocabulary while the pages were
 * clean. Binary files are handled separately below. */
const TEXT = /\.(html|txt|xml|json|webmanifest)$/;
const shipped = () =>
  distFiles()
    .filter((f) => TEXT.test(f))
    .map((f) => ({ file: f, text: readFileSync(f, "utf8") }));

const html = () => pages().map((f) => ({ file: f, text: readFileSync(f, "utf8") }));

/** Files git will actually publish. The repository is as public as the site. */
const tracked = () =>
  execSync("git ls-files", { encoding: "utf8" })
    .split("\n")
    .filter((f) => f && !f.startsWith("public/fonts/") && !f.endsWith(".png"))
    .map((f) => ({ file: f, text: readFileSync(f, "utf8") }));

describe("what the site may publish", () => {
  /**
   * The site publishes the registration number and the contact address. No other
   * identifier belongs in the output or in a tracked file.
   *
   * These are shapes rather than values, so this file names nothing it guards.
   */
  const identifiers: [string, RegExp][] = [
    ["a CPF", /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/],
    ["a CEP", /\b\d{5}-\d{3}\b/],
    ["a phone number", /\(\d{2}\)\s?9?\d{4}-\d{4}/],
    [
      "a street line",
      /\b(rua|avenida|alameda|travessa|rodovia|estrada)\s+[^,\n]{3,40},\s*\d/i,
    ],
  ];

  const scan = (text: string) => identifiers.find(([, re]) => re.test(text))?.[0] ?? null;

  it("publishes no personal identifier in the built site", () => {
    for (const { file, text } of shipped()) {
      const found = scan(text);
      expect(found, `${file} contains ${found}`).toBeNull();
    }
  });

  it("commits none to the repository either", () => {
    for (const { file, text } of tracked()) {
      const found = scan(text);
      expect(found, `${file} contains ${found}`).toBeNull();
    }
  });

  it("recognises every shape it looks for", () => {
    // A scan that matches nothing reads exactly like a clean repository, so each
    // pattern is exercised against an example. The examples are split across a
    // concatenation because the check above reads this file too, and a fixture
    // that trips it would be indistinguishable from the thing it tests for.
    expect(scan("cadastro " + "123.456.789-" + "01")).toBe("a CPF");
    expect(scan("CEP " + "01310-" + "100")).toBe("a CEP");
    expect(scan("(11) " + "91234-" + "5678")).toBe("a phone number");
    expect(scan("Avenida Paulista, " + "1578")).toBe("a street line");
    expect(scan("nothing to see here"), "false positive").toBeNull();
  });

  it("publishes the CNPJ, which is what ties the domain to the company", () => {
    const home = readFileSync("dist/index.html", "utf8");
    expect(home).toContain("68.150.870/0001-80");
  });
});

describe("regulated vocabulary", () => {
  // Each of these names a licensed financial activity. The studio performs none
  // of them, and describing a non-custodial wallet in those terms would be both
  // inaccurate and consequential.
  const banned = [
    "exchange",
    "brokerage",
    "broker",
    "trading",
    "\\btrade\\b",
    "deposit",
    "withdraw",
    "custodian",
    "\\bbank\\b",
  ];

  for (const word of banned) {
    it(`never describes the products as "${word.replace(/\\b/g, "")}"`, () => {
      // The whole document rather than only <body>. A title, a meta description, an
      // Open Graph tag and the JSON-LD are all published copy, and all four sat
      // outside this check.
      for (const { file, text } of shipped()) {
        const readable = file.endsWith(".html")
          ? [
              doc(file).querySelector("body")?.textContent ?? "",
              ...[
                ...doc(file).querySelectorAll(
                  "title, meta[content], script[type='application/ld+json']"
                ),
              ].map((n) => n.getAttribute("content") ?? n.textContent ?? ""),
            ].join(" ")
          : text;
        expect(new RegExp(word, "i").test(readable), `${file} uses "${word}"`).toBe(
          false
        );
      }
    });
  }
});

describe("binary assets", () => {
  it("carry no embedded metadata", () => {
    // og.png and the favicon were excluded from every scan because they are not
    // text. PNG tEXt/iTXt chunks and SVG comments carry author names and paths
    // from whatever produced them.
    for (const file of distFiles().filter((f) => /\.(png|jpe?g|svg|ico)$/.test(f))) {
      const bytes = readFileSync(file);
      const ascii = bytes.toString("latin1");
      for (const marker of [
        "tEXt",
        "iTXt",
        "zTXt",
        "exif",
        "Exif",
        "xmp",
        "XMP",
        "/Users/",
        "Adobe",
        "Creator",
      ]) {
        expect(ascii.includes(marker), `${file} embeds ${marker}`).toBe(false);
      }
    }
  });
});

describe("honesty", () => {
  it("carries no placeholder text", () => {
    for (const { file, text } of html()) {
      for (const marker of ["lorem ipsum", "TODO", "FIXME", "placeholder text"]) {
        expect(text.toLowerCase().includes(marker.toLowerCase()), `${file}`).toBe(false);
      }
    }
  });

  it("does not claim either product has shipped", () => {
    const body = doc("dist/index.html").querySelector("body")?.textContent ?? "";
    for (const claim of ["download", "available on the app store", "get it on"]) {
      expect(body.toLowerCase().includes(claim), `claims "${claim}"`).toBe(false);
    }
    expect(body).toContain("In development");
  });
});

describe("without JavaScript", () => {
  it("shows every word of the page", () => {
    // The central promise: content that needs JavaScript in order to be
    // visible is a bug wearing an animation's clothes. The reveal system hides
    // nothing until a script adds .js-reveal to <html>, so the served HTML must
    // carry the text and the stylesheet must not hide [data-reveal] on its own.
    const html = readFileSync("dist/index.html", "utf8");
    for (const phrase of [
      "We design, build and operate",
      "Voltz Wallet",
      "Contract engineering for clients worldwide",
      "contact@bitwright.tech",
    ]) {
      expect(html, `served HTML is missing "${phrase}"`).toContain(phrase);
    }

    const css = distFiles()
      .filter((f) => f.endsWith(".css"))
      .map((f) => readFileSync(f, "utf8"))
      .join("");
    // The selector prefix matters: without it a correctly scoped
    // `.js-reveal [data-reveal]` reads as a rule that hides content
    // unconditionally.
    const hidden = css.match(/[^{};]*\[data-reveal\][^{]*\{[^}]*opacity:\s*0/g) ?? [];
    for (const rule of hidden) {
      expect(
        rule.includes("js-reveal"),
        `a rule hides content unconditionally: ${rule}`
      ).toBe(true);
    }
  });
});

describe("with JavaScript", () => {
  it("reveals what the observer never reaches", () => {
    // The observer trims 8% off the bottom of the root, so an element closer to
    // the end of the document than that inset is never intersected and stays at
    // opacity 0. The footer registration line sits 56px above the document end,
    // which put it past the trigger on any viewport taller than 700px: the CNPJ
    // and the contact address, the two facts the site exists to publish, were
    // invisible on a normal desktop window.
    //
    // The script runs here, from dist/, against a DOM whose observer never
    // fires. That is the failure this guards, and the assertion is on the
    // outcome rather than on the presence of the code that produces it.
    const html = readFileSync("dist/index.html", "utf8");
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
      .map((m) => m[1])
      .find((source) => source.includes("data-reveal"));
    expect(inline, "no inline script drives the reveal").toBeTruthy();

    const stub = () => {
      const classes = new Set<string>();
      return {
        classList: {
          add: (c: string) => classes.add(c),
          remove: (c: string) => classes.delete(c),
          toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)),
          contains: (c: string) => classes.has(c),
        },
        has: (c: string) => classes.has(c),
        addEventListener() {},
        querySelector: () => null,
        scrollHeight: 3000,
      };
    };

    const reveals = [stub(), stub(), stub()];
    const root = stub();
    const handlers: Record<string, Array<() => void>> = {};
    const on = (type: string, fn: () => void) => void (handlers[type] ??= []).push(fn);

    // The script reads scrollY and innerHeight at the moment it runs, so they
    // have to be live globals. Handing them to `new Function` as parameters
    // freezes them at call time and the scroll below moves nothing.
    const saved = new Map<string, PropertyDescriptor | undefined>();
    const define = (name: string, value: unknown) => {
      saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true,
      });
    };

    try {
      define("window", globalThis);
      define("document", {
        documentElement: root,
        readyState: "complete",
        addEventListener: on,
        querySelector: () => null,
        querySelectorAll: (sel: string) =>
          sel === "[data-reveal]"
            ? reveals
            : sel === "[data-reveal]:not(.is-visible)"
              ? reveals.filter((r) => !r.has("is-visible"))
              : [],
      });
      // Motion is not reduced, which is the path that hides anything at all.
      define("matchMedia", () => ({ matches: false }));
      // The defect is precisely that this never calls back.
      define(
        "IntersectionObserver",
        class {
          observe() {}
          unobserve() {}
        }
      );
      define("navigator", { clipboard: null });
      define("innerHeight", 900);
      define("scrollY", 0);
      define("addEventListener", on);

      new Function(inline!)();

      expect(root.has("js-reveal"), "the script did not arm the reveal").toBe(true);
      expect(reveals.filter((r) => r.has("is-visible")).length).toBe(0);

      Object.defineProperty(globalThis, "scrollY", {
        value: 3000 - 900, // the bottom of the document
        configurable: true,
        writable: true,
      });
      for (const fn of handlers.scroll ?? []) fn();

      expect(
        reveals.filter((r) => r.has("is-visible")).length,
        "content the observer never reached is still invisible at the end of the page"
      ).toBe(reveals.length);
    } finally {
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete (globalThis as Record<string, unknown>)[name];
      }
    }
  });
});

describe("the writing a visitor actually reads", () => {
  /**
   * `check:prose` pulls comments out of code and the whole text of markdown. It
   * cannot see a string literal, and every word on the page is a string
   * literal, so the one body of writing here with no gate on it was the one the
   * world reads. It reported zero em dashes while five sat in UI strings.
   *
   * This reads the built pages instead, which is also where the copy ends up
   * rather than where it was typed. The rules are imported rather than copied:
   * two lists of marked words drifting apart would be worse than one.
   *
   * `<title>` is out of scope on purpose, not to spare it. `Brand — Tagline` is
   * a label with a separator, which is what Google itself prints, and it is not
   * the tell this measures. What it measures is dashes inside sentences.
   */
  const visible = (file: string) => {
    const d = doc(file);
    for (const el of d.querySelectorAll("script, style")) el.remove();
    const body = d.querySelector("body")?.textContent ?? "";
    const meta = [
      ...d.querySelectorAll('meta[name="description"], meta[property="og:description"]'),
    ]
      .map((m) => m.getAttribute("content") ?? "")
      .join(" ");
    return `${body} ${meta}`;
  };

  it("uses none of the marked vocabulary", () => {
    for (const file of pages()) {
      const hits = [
        ...new Set(
          (visible(file).match(new RegExp(VOCABULARY.source, "gi")) ?? []).map((w) =>
            w.toLowerCase()
          )
        ),
      ];
      expect(hits, `${file} publishes ${hits.join(", ")}`).toEqual([]);
    }
  });

  it('carries no "not just X" construction', () => {
    for (const file of pages()) {
      const hits = visible(file).match(new RegExp(SHAPE.source, "gi")) ?? [];
      expect(hits, `${file} publishes ${hits.join(", ")}`).toEqual([]);
    }
  });

  it("keeps em dashes under the rate the rest of the repository holds to", () => {
    // Measured across every page at once rather than per page, because a short
    // page like the not-found puts a single dash far over any rate.
    let words = 0;
    let dashes = 0;
    for (const file of pages()) {
      const text = visible(file);
      words += text.split(/\s+/).filter(Boolean).length;
      dashes += (text.match(/—/g) ?? []).length;
    }
    const rate = words ? (dashes / words) * 1000 : 0;
    expect(
      rate,
      `${dashes} em dashes in ${words} published words, ${rate.toFixed(1)} per 1000`
    ).toBeLessThanOrEqual(MAX_EM_DASH_PER_1000);
  });
});
