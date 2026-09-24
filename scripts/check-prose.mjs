#!/usr/bin/env node
/**
 * Fails when the writing starts sounding like a machine wrote it.
 *
 * This repository is mostly prose. Comments explain why code is shaped the way
 * it is, the ADRs record what was thrown away, and the documentation is the only
 * description of a design system that has no page of its own. All of it is read
 * by people deciding whether the studio can write.
 *
 * The em dash is the measurement that matters. Language models reach for it
 * because it joins two clauses without committing to a comma, a colon, a
 * semicolon or a full stop, so it appears at several times the rate a human
 * editor produces. Counted across this repository before the rule existed: 126
 * of them in 14,375 words, which is 8.8 per thousand against a human baseline
 * near 1. Nobody notices a single one. Everybody feels a hundred.
 *
 * The word list and the "not just X, Y" shape are the other two tells with no
 * false positives worth arguing about. Colons and three-part lists are counted
 * and printed, not enforced: both are ordinary English, and a threshold on them
 * would push the writing somewhere worse than where it started.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

export const MAX_EM_DASH_PER_1000 = 2;
const MIN_WORDS = 120; // below this a single dash blows any rate out of proportion

export const VOCABULARY =
  /\b(delve|showcase|leverage|seamless|robust|testament|tapestry|landscape|realm|foster|underscore|pivotal|crucial|moreover|furthermore|utilize|myriad|plethora|holistic|paradigm|synerg|elevate|unlock|empower|embark|intricate|meticulous|multifaceted|nuanced|bustling|vibrant)\w*/gi;

export const SHAPE =
  /\b(not just|isn't just|is not just|rather than merely|it's not about .{0,40} it's about)\b/gi;

/* This file is exempt from itself, and the reason is worth keeping. Its own
 * documentation has to name the shapes it rejects in order to explain them, so
 * the rule failed on the file that states the rule. That is the second time this
 * repository has hit that shape: the Tailwind build was generating CSS for
 * `rounded-[14px]` because the document banning it quoted it as the example. A
 * rule that describes itself is always in its own blast radius. */
const files = execSync('git ls-files "*.md" "*.ts" "*.astro" "*.css" "*.mjs"', {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)
  .filter((f) => f !== "scripts/check-prose.mjs");

/** Prose only: comment bodies from code, everything but fences and tables from
 * markdown. A dash inside a code sample is code, not writing. */
function prose(file) {
  const text = readFileSync(file, "utf8");
  if (file.endsWith(".md")) {
    return text
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/^\s*\|.*$/gm, " ");
  }
  return [
    ...(text.match(/\/\*[\s\S]*?\*\//g) ?? []),
    ...(text.match(/^\s*\/\/.*$/gm) ?? []),
  ].join("\n");
}

/* Only scan when run, so a test can import the rules above without
 * triggering a repository sweep. Same guard as check-secrets.mjs. */
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

function main() {
  let failures = 0;
  let totalWords = 0;
  let totalDashes = 0;

  for (const file of files) {
    const text = prose(file);
    const words = text.split(/\s+/).filter(Boolean).length;
    const dashes = (text.match(/—/g) ?? []).length;
    totalWords += words;
    totalDashes += dashes;

    for (const [what, hits] of [
      [
        "vocabulary",
        [...new Set((text.match(VOCABULARY) ?? []).map((w) => w.toLowerCase()))],
      ],
      [
        "construction",
        [...new Set((text.match(SHAPE) ?? []).map((w) => w.toLowerCase()))],
      ],
    ]) {
      if (hits.length) {
        console.error(`${file}  ${what}: ${hits.join(", ")}`);
        failures += hits.length;
      }
    }

    if (words < MIN_WORDS) continue;
    const rate = (dashes / words) * 1000;
    if (rate > MAX_EM_DASH_PER_1000) {
      console.error(
        `${file}  ${dashes} em dashes in ${words} words — ${rate.toFixed(1)} per 1000, ceiling is ${MAX_EM_DASH_PER_1000}`
      );
      failures++;
    }
  }

  const overall = totalWords ? (totalDashes / totalWords) * 1000 : 0;
  if (overall > MAX_EM_DASH_PER_1000) {
    console.error(
      `\nrepository: ${totalDashes} em dashes in ${totalWords} words — ${overall.toFixed(1)} per 1000`
    );
    failures++;
  }

  if (failures) {
    console.error(`\n${failures} prose problem(s).`);
    process.exit(1);
  }
  console.log(
    `Prose: ${totalDashes} em dashes in ${totalWords} words (${overall.toFixed(1)} per 1000).`
  );
}
