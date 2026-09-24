import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseHTML } from "linkedom";

export const css = () => readFileSync("src/styles/global.css", "utf8");

export const distFiles = (dir = "dist"): string[] =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((e) => {
        const p = join(dir, e);
        return statSync(p).isDirectory() ? distFiles(p) : [p];
      })
    : [];

export const pages = () => distFiles().filter((f) => f.endsWith(".html"));

export const doc = (file: string) => parseHTML(readFileSync(file, "utf8")).document;

/** The stylesheet the browser actually gets, after Astro, Tailwind and the
 * minifier have each had a turn. Every motion assertion in this suite reads this
 * rather than the source, because the defect this guards was authored correctly and
 * destroyed on the way out. */
export const builtCss = () =>
  distFiles()
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(f, "utf8"))
    .join("");

/** The [start, end) offsets of every block opened by an at-rule matching `open`.
 *
 * Scope is a brace range, so measuring it needs brace counting. The first attempt
 * at this sliced from the at-rule to the end of the file and asked whether a
 * declaration appeared after it. Everything appears after it, so a rule that had
 * escaped to global scope passed. A check that cannot fail is worse than no
 * check, because it also reports success. */
export function braceRanges(source: string, open: RegExp): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const m of source.matchAll(open)) {
    let depth = 1;
    let i = m.index! + m[0].length;
    while (depth > 0 && i < source.length) {
      depth += Number(source[i] === "{") - Number(source[i] === "}");
      i++;
    }
    ranges.push([m.index!, i]);
  }
  return ranges;
}

/** Every rule in `source` whose selector matches `selector` and whose body
 * contains `declaration`, with the offset each was found at. */
export function rulesWith(source: string, selector: string, declaration: string) {
  const re = new RegExp(`[^{}]*${selector}[^{}]*\\{[^}]*${declaration}`, "g");
  return [...source.matchAll(re)].map((m) => ({ text: m[0], index: m.index! }));
}

/** Relative luminance per WCAG 2.x. */
function luminance(hex: string) {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Custom properties declared in a given block of the stylesheet. */
export function tokens(scope: "dark" | "light") {
  const source = css();
  const block =
    scope === "dark"
      ? source.slice(
          source.indexOf("@theme {"),
          source.indexOf("@media (prefers-color-scheme: light)")
        )
      : source.slice(source.indexOf("@media (prefers-color-scheme: light)"));
  const found: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    found[name] = value.trim();
  }
  return found;
}

/** font-size / line-height pairs declared by the @utility type-* blocks. */
export function typeUtilities() {
  return [...css().matchAll(/@utility (type-[\w-]+) \{([^}]+)\}/g)].map(
    ([, name, body]) => ({
      name,
      size: body.match(/font-size:\s*([^;]+);/)?.[1].trim() ?? "",
      lineHeight: Number(body.match(/line-height:\s*([\d.]+)/)?.[1] ?? NaN),
    })
  );
}
