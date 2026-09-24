#!/usr/bin/env node
/**
 * Fails when a design decision escapes the system.
 *
 * Arbitrary Tailwind brackets for type, radius and tracking are how a design
 * system rots: the value is fine, the second slightly different copy of it three
 * files away is not. Named tokens live in src/styles/global.css; the reasoning
 * is in docs/design-system.md, and this script is what stops that file from
 * describing a system the stylesheet does not have.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BANNED = [
  { re: /\btext-\[(?!clamp)[^\]]+\]/g, what: "font size", fix: "use a type-* class" },
  { re: /\btracking-\[[^\]]+\]/g, what: "letter spacing", fix: "use a type-* class" },
  { re: /\bleading-\[[^\]]+\]/g, what: "line height", fix: "use a type-* class" },
  {
    // The axis goes in the middle, as in rounded-t-[3rem].
    // `inherit` and `full` are not magic numbers. The first takes the parent's
    // radius, the second is a stadium. Flagging them trains people to ignore this
    // check, which costs more than the rule earns.
    re: /\brounded(?:-[trblse]{1,2})?-\[(?!inherit\]|full\])[^\]]+\]/g,
    what: "radius",
    fix: "use rounded-control|card|panel|shell",
  },
  {
    // Both forms. The bracket form was banned from the start; the bare number was
    // not, so six transitions in markup wrote 200ms and 300ms as digits while the
    // tokens holding exactly those values went unreferenced, one of them until
    // the unused-token test finally noticed it.
    re: /\bduration-(?:\[[^\]]+\]|\d+)\b/g,
    what: "duration",
    fix: "use duration-(--duration-fast|--duration-base|--duration-slow)",
  },
  {
    // The named rules above cover the values that have escaped so far. This one
    // covers the rest: any arbitrary bracket that is not a length or position
    // the system has no opinion about. Enumerating seven forms was a list of
    // past mistakes, not a rule.
    re: /\b(?:font|leading|tracking|text|rounded|shadow|ring|opacity|z)(?:-[a-z]+)*-\[(?!inherit\]|full\]|currentColor\])[^\]]+\]/g,
    what: "arbitrary value",
    fix: "name it in the design system, or use an existing token",
  },
  {
    // Tailwind's own sizes are 12, 14, 16, 18, 20, a different scale from this
    // project's 1.25 ratio, and mixing two scales is the same as having none.
    re: /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g,
    what: "off-scale font size",
    fix: "use a type-* class",
  },
  {
    re: /\b-?z-\d+\b/g,
    what: "z-index",
    fix: "use z-(--layer-behind|--layer-sticky|--layer-grain)",
  },
  {
    // Tailwind's .5 steps are 2px and 6px: off the 4px grid the rest of the
    // system is built on.
    re: /\b(?:p|m|gap|space)[trblxy]?-\d+\.5\b/g,
    what: "off-grid spacing",
    fix: "round to the 4px grid",
  },
];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

let failures = 0;
for (const file of walk("src").filter((f) => f.endsWith(".astro"))) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const { re, what, fix } of BANNED) {
        for (const hit of line.match(re) ?? []) {
          console.error(`${file}:${i + 1}  raw ${what} \`${hit}\`, ${fix}`);
          failures++;
        }
      }
    });
}

// The theme page documents the scales. If its data and the stylesheet disagree,
// the page is lying about the system it claims to be, which is worse than not
// having the page at all.
const css = readFileSync("src/styles/global.css", "utf8");
const data = readFileSync("src/data/tokens.ts", "utf8");

for (const [, token, value] of css.matchAll(/(--radius-[a-z]+):\s*([\d.]+)rem/g)) {
  const declared = data.match(new RegExp(`token:\\s*"${token}",[^}]*?rem:\\s*([\\d.]+)`));
  if (!declared) {
    console.error(`src/data/tokens.ts  ${token} is declared in CSS but not documented`);
    failures++;
  } else if (Number(declared[1]) !== Number(value)) {
    console.error(
      `src/data/tokens.ts  ${token} documented as ${declared[1]}rem, stylesheet says ${value}rem`
    );
    failures++;
  }
}

if (failures) {
  console.error(`\n${failures} raw value(s) outside the design system.`);
  process.exit(1);
}
console.log("Design system: no raw values in markup.");
