#!/usr/bin/env node
/**
 * Looks for credential-shaped strings.
 *
 * Rule 3 says no credential ever enters this repository, and until now that rule
 * was carried by a grep embedded in a YAML hook: it fired on any line containing
 * "token" or "secret" near a colon, which is most of a design system, and
 * still missed every real credential, because credentials are recognisable by
 * their shape, not by the words around them.
 *
 * As a script it can be run by the hook, by CI, and by a test that proves it
 * catches each shape. A detector nobody can test is a detector nobody should
 * trust.
 *
 *   node scripts/check-secrets.mjs            # scans tracked files
 *   node scripts/check-secrets.mjs --staged   # scans the staged diff
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const SHAPES = [
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "OpenAI-style key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: "Cloudflare API token", re: /\bcfat_[A-Za-z0-9]{20,}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "private key block", re: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
  { name: "JSON Web Token", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./ },
  {
    name: "assigned password",
    re: /\b(?:password|passwd|pwd)\s*[=:]\s*["'][^"']{8,}["']/i,
  },
];

export function scan(text) {
  return SHAPES.filter(({ re }) => re.test(text)).map(({ name }) => name);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const staged = process.argv.includes("--staged");
  let failures = 0;

  if (staged) {
    const found = scan(execSync("git diff --cached -U0", { encoding: "utf8" }));
    for (const name of found) {
      console.error(`staged diff contains a ${name}`);
      failures++;
    }
  } else {
    for (const file of execSync("git ls-files", { encoding: "utf8" }).split("\n")) {
      if (!file || /\.(woff2?|png|jpe?g|ico)$/.test(file)) continue;
      // A file can be indexed and absent, as with a staged addition that was later
      // deleted from the working tree. Skipping is right: there is nothing to
      // read, and crashing here would take out the check for every other file.
      let contents;
      try {
        contents = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      for (const name of scan(contents)) {
        console.error(`${file} contains a ${name}`);
        failures++;
      }
    }
  }

  if (failures) {
    console.error("\nthis repository is public");
    process.exit(1);
  }
  console.log("Secrets: nothing credential-shaped found.");
}
