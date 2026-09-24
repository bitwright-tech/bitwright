// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import axe from "axe-core";
import { doc, pages } from "./helpers";

/**
 * Accessibility, checked on the built pages with axe-core.
 *
 * The environment is jsdom and that is not a preference. axe needs
 * createHTMLDocument and getComputedStyle for most of its rules, and without
 * them it fails OPEN, which is indistinguishable from passing.
 *
 * Colour contrast stays disabled here: jsdom does not cascade the stylesheet, so
 * axe would be comparing transparent against transparent. Contrast is checked
 * against the tokens in design-system.test.ts instead, which holds for every
 * element using the token rather than only those on a page.
 */

async function violations(file: string) {
  document.open();
  document.write(readFileSync(file, "utf8"));
  document.close();
  const result = await axe.run(document.documentElement, {
    resultTypes: ["violations"],
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations;
}

describe("axe", () => {
  for (const file of pages()) {
    it(`${file.replace("dist/", "")} has no violations`, async () => {
      const found = await violations(file);
      const report = found
        .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html).join(", ")}`)
        .join("\n");
      expect(found.length, `\n${report}`).toBe(0);
    }, 30_000);
  }
});

describe("structure", () => {
  for (const file of pages()) {
    it(`${file.replace("dist/", "")} never skips a heading level`, () => {
      const levels = [...doc(file).querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) =>
        Number(h.tagName[1])
      );
      expect(levels[0], "first heading is not h1").toBe(1);
      for (let i = 1; i < levels.length; i++) {
        expect(
          levels[i] - levels[i - 1],
          `${levels[i - 1]} → ${levels[i]}`
        ).toBeLessThanOrEqual(1);
      }
    });

    it(`${file.replace("dist/", "")} labels every link`, () => {
      for (const link of doc(file).querySelectorAll("a")) {
        const name = (link.textContent ?? "").trim() || link.getAttribute("aria-label");
        expect(
          name,
          `link to ${link.getAttribute("href")} has no accessible name`
        ).toBeTruthy();
      }
    });
  }
});
