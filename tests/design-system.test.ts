import { describe, expect, it } from "vitest";
import {
  braceRanges,
  builtCss,
  contrast,
  css,
  doc,
  pages,
  rulesWith,
  tokens,
  typeUtilities,
} from "./helpers";
import { radii, typeScale } from "../src/data/tokens";

/**
 * The design system, as tests.
 *
 * Every rule in docs/design-system.md that can be checked is checked here. A rule
 * that lives only in prose is a rule that survives exactly as long as the next
 * person's memory of having read it.
 */

const rem = (v: string) => Number(v.replace("rem", ""));

describe("type scale", () => {
  it("puts every size on the major third: 1.25 raised to a whole number", () => {
    // The property is membership of the scale, not the ratio between neighbours.
    // The two display sizes are 1.25^4 and 1.25^7, because the scale deliberately
    // skips steps at the top where a display size needs a jump, so an
    // adjacent-ratio test would fail on them.
    for (const step of typeScale) {
      const n = Math.log(step.rem) / Math.log(1.25);
      expect(
        Math.abs(n - Math.round(n)),
        `${step.rem}rem is 1.25^${n.toFixed(2)}`
      ).toBeLessThan(0.02);
    }
  });

  it("puts EVERY font-size on the scale, not only the ones in type utilities", () => {
    // The old check read the `@utility type-*` blocks, so a font-size declared on
    // an ordinary class was invisible to it. .lm-label carried 0.875rem, which is 14px,
    // off the 1.25 ratio, with a 21px line box off the 4px grid, in the page's
    // one call to action, and every check reported green.
    const allowed = typeScale.map((s) => s.rem);
    for (const [, value] of css().matchAll(/font-size:\s*([^;]+);/g)) {
      if (value.trim().startsWith("clamp(")) continue; // fluid type is exempt and says so
      const n = Number(value.replace("rem", "").trim());
      expect(
        allowed.some((a) => Math.abs(a - n) < 0.001),
        `font-size: ${value.trim()} is not a step on the scale`
      ).toBe(true);
    }
  });

  it("has no two steps closer than 12%, which the eye cannot separate", () => {
    for (let i = 1; i < typeScale.length; i++) {
      expect(typeScale[i].rem / typeScale[i - 1].rem).toBeGreaterThan(1.12);
    }
  });

  it("puts every fixed line box on the 4px grid", () => {
    for (const t of typeUtilities()) {
      // Fluid type is exempt and says so: a clamp() cannot sit on a baseline.
      if (t.size.startsWith("clamp") || Number.isNaN(t.lineHeight)) continue;
      const box = rem(t.size) * 16 * t.lineHeight;
      expect(box % 4, `${t.name} line box is ${box}px`).toBeCloseTo(0, 1);
    }
  });

  it("declares only sizes that exist on the documented scale", () => {
    const allowed = typeScale.map((s) => s.rem);
    for (const t of typeUtilities()) {
      if (t.size.startsWith("clamp")) continue;
      expect(allowed, `${t.name} uses ${t.size}`).toContain(rem(t.size));
    }
  });
});

describe("colour", () => {
  const cases = [
    { mode: "dark" as const, ground: "--color-canvas" },
    { mode: "light" as const, ground: "--color-canvas" },
  ];

  for (const { mode, ground } of cases) {
    it(`clears WCAG AA for every ink in ${mode} mode`, () => {
      const t = tokens(mode);
      for (const ink of ["--color-ink", "--color-ink-2", "--color-ink-3"]) {
        const ratio = contrast(t[ink], t[ground]);
        expect(
          ratio,
          `${ink} on ${ground} in ${mode} is ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("carries no hue: every colour token is a grey or fully transparent", () => {
    for (const mode of ["dark", "light"] as const) {
      for (const [name, value] of Object.entries(tokens(mode))) {
        if (!name.startsWith("--color-")) continue;
        // Only hex was understood, so rgb(), hsl(), oklch() and colour keywords
        // all passed silently. Anything that is not hex now fails rather than
        // being skipped: this palette has no reason to use another syntax.
        expect(
          /^#[0-9a-f]{3,8}$/i.test(value) || value.startsWith("var("),
          `${name} = ${value} is not a hex colour and cannot be checked for hue`
        ).toBe(true);
        if (value.startsWith("var(")) continue;
        const hex = value.replace("#", "").slice(0, 6);
        if (hex.length < 6) continue;
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
        expect(new Set([r, g, b]).size, `${name} = ${value} is not neutral`).toBe(1);
      }
    }
  });
});

describe("geometry", () => {
  it("keeps every radius on the 4px grid", () => {
    for (const r of radii) {
      expect((r.rem * 16) % 4, `${r.token} is ${r.rem * 16}px`).toBe(0);
    }
  });

  it("keeps spacing tokens on the 4px grid", () => {
    const t = tokens("dark");
    for (const [name, value] of Object.entries(t)) {
      if (!name.startsWith("--space-")) continue;
      expect((rem(value) * 16) % 4, `${name} is ${value}`).toBe(0);
    }
  });

  it("draws every corner from the scale", () => {
    // The call to action was a stadium for weeks: the one shape on the page not
    // from the scale, nested inside a 20px panel so its arc ran against the
    // panel's rather than parallel to it. Nothing could see it, because
    // check:tokens reads class names and this radius was set in CSS.
    //
    // Two halves, because the defect can arrive from either side. Hand-written
    // rules are checked in the source; rendered classes are checked in the built
    // HTML, since the stylesheet also carries utilities Tailwind generated from prose
    // that nothing renders, and those are dead weight rather than a design
    // decision.
    for (const [, value] of css().matchAll(/border-radius:\s*([^;]+);/g)) {
      const v = value.trim();
      expect(
        v === "0" || v === "inherit" || /^var\(--radius-[a-z]+\)$/.test(v),
        `border-radius: ${v} is not a step on the scale`
      ).toBe(true);
    }

    const named: string[] = radii.map((r) => r.name);
    for (const file of pages()) {
      for (const el of doc(file).querySelectorAll("[class*='rounded']")) {
        for (const cls of (el.getAttribute("class") ?? "").split(/\s+/)) {
          if (!cls.startsWith("rounded")) continue;
          const step = cls.replace(/^rounded(-[trblse]{1,2})?-?/, "");
          expect(
            step === "" ? false : named.includes(step),
            `${file} renders ${cls}, which is not on the radius scale`
          ).toBe(true);
        }
      }
    }
  });

  it("lets the docked header hold its controls concentrically", () => {
    // outer radius − padding = inner radius, or the two curves pinch at the corner.
    const panel = radii.find((r) => r.name === "panel")!.rem * 16;
    const control = radii.find((r) => r.name === "control")!.rem * 16;
    const padding = 8;
    expect(panel - padding).toBe(control);
  });
});

describe("tokens", () => {
  it("defines no custom property in terms of itself", () => {
    // A blanket find-and-replace once rewrote `--ease-soft: cubic-bezier(...)`
    // into `--ease-soft: var(--ease-soft)`. Circular is still valid CSS, so the
    // build stayed green and every eased transition silently fell back to the
    // browser default for three commits.
    for (const [, name, value] of css().matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      expect(value.includes(`var(${name})`), `${name} is defined as itself`).toBe(false);
    }
  });

  it("times every transition from the scale, and eases it from the two curves", () => {
    // A transition is a response to a person, so both of its numbers are design
    // decisions and both belong to the system. The audit that produced this test
    // found 350ms and 80ms written by hand inside one component, 200ms written as
    // a number beside the token holding exactly that value, and, worst because
    // it arrived by omission, 150ms on a curve nobody chose, which is what
    // Tailwind falls back to when a `transition-*` class carries no duration.
    // Two pages were running on it.
    //
    // Animations are exempt and stay literal. An ambient loop is not answering
    // anybody, and --duration-* is the scale for things that are.
    for (const [, body] of css().matchAll(/\btransition(?:-duration)?:\s*([^;]+);/g)) {
      const decl = body.replace(/var\(--reveal-delay,\s*0s\)/g, ""); // a delay, not a duration
      expect(
        /\d+\.?\d*m?s/.test(decl.replace(/var\([^)]*\)/g, "")),
        `transition: ${decl.trim()} times itself with a literal`
      ).toBe(false);
      expect(
        /\b(ease|ease-in|ease-out|ease-in-out|step-|cubic-bezier)\b/.test(
          decl.replace(/var\([^)]*\)/g, "")
        ),
        `transition: ${decl.trim()} eases itself with a curve outside the two`
      ).toBe(false);
    }

    // The prose has to keep up. It said "three durations" for as long as there
    // were three, which was true right up until the audit named a fourth, and a
    // count in a sentence is exactly the kind of claim that goes stale in silence.
    const doc = require("node:fs").readFileSync("docs/design-system.md", "utf8");
    const motion = doc.slice(doc.indexOf("## Motion"), doc.indexOf("## Grid"));
    const declared = [...css().matchAll(/--duration-([a-z]+):/g)].map((m) => m[1]);
    for (const name of declared) {
      expect(motion, `the Motion section never mentions --duration-${name}`).toContain(
        `--duration-${name}`
      );
    }
    const WORDS = ["one", "two", "three", "four", "five", "six"];
    expect(
      motion.includes(`${WORDS[declared.length - 1]} durations`),
      `the docs count the durations wrong: there are ${declared.length}`
    ).toBe(true);

    // And the fallback itself. Left at Tailwind's own values, every omission in
    // markup silently lands off the system, which is exactly how it got here.
    expect(css(), "Tailwind's default transition is not the system's").toMatch(
      /--default-transition-duration:\s*var\(--duration-/
    );
    expect(css(), "Tailwind's default easing is not the system's").toMatch(
      /--default-transition-timing-function:\s*var\(--ease-/
    );
  });

  it("resolves every var() reference to a property that exists", () => {
    const source = css();
    const declared = new Set([...source.matchAll(/(--[\w-]+):/g)].map((m) => m[1]));
    for (const [, used] of source.matchAll(/var\((--[\w-]+)/g)) {
      // Tailwind declares its own; only ours are ours to guarantee.
      if (
        !/^--(color|radius|space|layer|opacity|duration|ease|weight|shadow|focus|touch|reveal|metal|lm)/.test(
          used
        )
      )
        continue;
      if (
        used.startsWith("--reveal") ||
        used.startsWith("--lm") ||
        used.startsWith("--metal")
      )
        continue;
      expect(declared.has(used), `var(${used}) has no declaration`).toBe(true);
    }
  });

  it("declares no colour, radius or space token that nothing uses", () => {
    const source =
      css() +
      require("node:fs")
        .readdirSync("src", { recursive: true })
        .filter(
          (f: string) =>
            typeof f === "string" && (f.endsWith(".astro") || f.endsWith(".ts"))
        )
        .map((f: string) => require("node:fs").readFileSync(`src/${f}`, "utf8"))
        .join("");
    for (const name of Object.keys(tokens("dark"))) {
      if (
        !/^--(color|radius|space|layer|opacity|duration|ease|weight|shadow|focus|touch|grid)/.test(
          name
        )
      )
        continue;
      const uses = source.split(name).length - 1;
      expect(uses, `${name} is declared but never referenced`).toBeGreaterThan(1);
    }
  });
});

describe("consistency", () => {
  it("draws every divider the same way", () => {
    // A rounded corner cannot carry a hairline without the line ending in mid-air,
    // and the fix attempted for that, a fading gradient, gave the footer its own
    // divider technique and its own weight. One function, one treatment.
    const components = require("node:fs")
      .readdirSync("src", { recursive: true })
      .filter((f: string) => typeof f === "string" && f.endsWith(".astro"))
      .map((f: string) => require("node:fs").readFileSync(`src/${f}`, "utf8"))
      .join("");
    // Only a gradient PAINTED as a background draws a line. The same function
    // inside mask-image is shaping how something ends, which is not a second
    // divider treatment.
    const painted =
      components.match(/background(?:-image)?:\s*linear-gradient\(\s*90deg/g) ?? [];
    expect(painted.length, "a divider drawn as a gradient").toBe(0);
  });
});

describe("features the docs promise", () => {
  it("ships continuous corners", () => {
    // A missing corner-shape looks exactly like a browser that does not support
    // it, so nothing on screen reports the rule going away.
    const shipped = require("node:fs")
      .readdirSync("dist/_astro")
      .filter((f: string) => f.endsWith(".css"))
      .map((f: string) => require("node:fs").readFileSync(`dist/_astro/${f}`, "utf8"))
      .join("");
    expect(shipped, "corner-shape is documented but absent from the build").toContain(
      "corner-shape"
    );
  });

  it("keeps the hero entrance in the build, where the page cannot be read without it", () => {
    // This one guards a hole that predates it. `.rise` starts at opacity 0 with
    // `backwards` fill and, unlike the below-the-fold reveal, has no `.js-reveal`
    // escape hatch, so if the minifier ever eats these keyframes the entire hero
    // above the fold is invisible, with the build green and no error anywhere.
    const built = builtCss();
    expect(built, "@keyframes rise did not survive").toMatch(/@keyframes rise\{/);
    expect(built, "the headline sweep lost its mask-position").toMatch(
      /@keyframes rise-lines\{[^@]*mask-position/
    );
    expect(built, "the stagger is not being computed").toMatch(
      /\.rise\{[^}]*animation-delay:calc/
    );

    // .rise-lines only overrides the headline's animation because it is declared
    // AFTER .rise, whose `animation` shorthand resets name and duration. Reorder
    // the stylesheet and the headline silently gets the plain block entrance back.
    // A comment already says so; a comment cannot fail.
    expect(
      built.indexOf(".rise-lines{"),
      ".rise-lines is declared before .rise and no longer overrides it"
    ).toBeGreaterThan(built.indexOf(".rise{"));
  });

  it("scopes every still state to reduced motion", () => {
    // `mask:none` and `animation:none` belong to reduced motion. One escaping that
    // block stops the entrance or the trace for everyone, which looks exactly like
    // a page that was never animated.
    const built = builtCss();
    const reduced = braceRanges(built, /@media \(prefers-reduced-motion:reduce[^{]*\{/g);
    expect(reduced.length, "no reduced-motion block at all").toBeGreaterThan(0);

    for (const selector of ["\\.rise[a-z-]*"]) {
      for (const declaration of ["mask:none", "animation:none"]) {
        const hits = rulesWith(built, selector, declaration);
        expect(
          hits.length,
          `nothing gives ${selector} a still state (${declaration})`
        ).toBeGreaterThan(0);
        for (const hit of hits) {
          expect(
            reduced.some(([a, b]) => hit.index > a && hit.index < b),
            `\`${hit.text}\` sits outside reduced motion and stops it for everyone`
          ).toBe(true);
        }
      }
    }
  });

  it("never ships a copy button that cannot copy", () => {
    // The button is markup only a browser with a clipboard can honour, so it
    // ships display:none and the enhancement reveals it. Two ways that breaks
    // silently: the rule stops hiding it, and every visitor without the script
    // gets a button that does nothing when pressed; or the reveal rule goes and
    // nobody ever sees it.
    const built = builtCss();
    expect(built, ".js-copy is not hidden by default").toMatch(
      /\.js-copy\{[^}]*display:none/
    );
    expect(built, "nothing reveals .js-copy").toMatch(
      /\.js-copy\.is-ready\{[^}]*display:(inline-flex|flex)/
    );

    const d = doc("dist/index.html");
    const button = d.querySelector("[data-copy]");
    expect(button, "no copy button in the built page").toBeTruthy();

    // A display utility in the class list out-specifies the rule above and shows
    // the dead button anyway. This is why the `hidden` attribute was not used.
    const cls = button!.getAttribute("class") ?? "";
    expect(
      /\b(inline-flex|flex|inline-block|block|grid|inline-grid)\b/.test(cls),
      `the copy button carries a display utility that defeats .js-copy: "${cls}"`
    ).toBe(false);

    // Copying an address that is not the one shown is the worst version of this
    // working: silent, and wrong only for the person who used the button.
    const mailto = button!.parentElement?.querySelector('a[href^="mailto:"]');
    expect(mailto, "the copy button has no address beside it").toBeTruthy();
    expect(
      button!.getAttribute("data-copy"),
      "the copy button copies a different address than the one on the page"
    ).toBe(mailto!.getAttribute("href")!.replace("mailto:", ""));

    expect(
      (button!.textContent ?? "").trim().length,
      "the copy button has no accessible name"
    ).toBeGreaterThan(0);
  });

  it("agrees with the type scale the docs state", () => {
    // The documentation used to have a second describer: a page that painted the
    // scale from the live tokens, so prose that drifted was visible beside the
    // truth. That page is gone, which leaves this file as the only description of
    // the system and this test as the only thing keeping it honest.
    const doc = require("node:fs").readFileSync("docs/design-system.md", "utf8");
    const table = doc.slice(doc.indexOf("## Type"), doc.indexOf("## Measure"));
    for (const step of typeScale) {
      expect(table, `the type table omits ${step.rem}rem`).toContain(
        `\`${step.rem}rem\``
      );
    }
    const listed = [...table.matchAll(/\|\s*`([\d.]+)rem`/g)].map((m) => Number(m[1]));
    expect(listed.sort(), "the type table lists a size the scale does not have").toEqual(
      typeScale.map((s) => s.rem).sort()
    );
  });

  it("agrees with the radius scale the docs state", () => {
    const doc = require("node:fs").readFileSync("docs/design-system.md", "utf8");
    for (const r of radii) {
      const px = r.rem * 16;
      expect(doc, `docs do not state ${r.name} as ${px}px`).toContain(
        `\`${r.name}\` (${px}px)`
      );
    }
  });
});
