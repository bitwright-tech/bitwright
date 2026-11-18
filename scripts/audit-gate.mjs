#!/usr/bin/env node
/**
 * The dependency gate CI runs: fails on any high or critical npm advisory outside a short, dated
 * allowlist.
 *
 * An entry clears named advisories for one package, until a date, with the reason none of them can
 * reach a visitor. The site ships static files only, so a package that runs while building or
 * deploying can wait for its fix, and nothing that ships can. A clearance is keyed by package as well
 * as by advisory, because the same advisory id can later be reported against another dependency.
 *
 * The gate also fails once an entry's date has passed, and when an entry matches no reported
 * advisory, so the list empties as the fixes land instead of outliving them.
 *
 *   node scripts/audit-gate.mjs
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const broken = (message) => {
  console.error(`audit-gate: ${message}`);
  process.exit(2);
};

// An entry is { package, ids, until, why }, for a build-only package whose fix does not exist yet
// or is still inside the seven-day release quarantine (.npmrc min-release-age, ADR-0003). Empty
// while nothing waits.
const ALLOW = [
  {
    package: "picomatch",
    ids: ["GHSA-fc5q-39xc-vjpf"],
    until: "2026-12-01",
    why: "picomatch matches globs while the site builds and tests (vite, astro, vitest, tinyglobby, anymatch), over patterns this repository writes, and never ships in dist/; the advisory covers every published release (4.0.7 of 2026-08-24 is the newest), so no fix can be installed yet",
  },
];

const BLOCKING = new Set(["high", "critical"]);

/** The advisories an `npm audit --json` report names, one per id. */
function advisories(report) {
  const found = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    // A string in `via` is the package an advisory travels through, not an advisory of its own.
    for (const via of vulnerability.via ?? []) {
      if (typeof via !== "object" || !via.url) continue;
      const id = via.url.split("/").pop();
      found.set(`${id} ${via.name}`, {
        id,
        name: via.name,
        severity: via.severity,
        title: via.title,
      });
    }
  }
  return [...found.values()];
}

/** Every reason the report fails the gate on `today` (YYYY-MM-DD), and what the allowlist let pass. */
export function judge(report, allow, today) {
  const failures = [];
  const passed = [];
  const used = new Set();
  for (const advisory of advisories(report)) {
    if (!BLOCKING.has(advisory.severity)) continue;
    const entry = allow.find((e) => e.ids.includes(advisory.id));
    const where = `${advisory.id} (${advisory.severity}) in ${advisory.name}: ${advisory.title}`;
    if (!entry) {
      failures.push(`${where}, outside the allowlist`);
    } else if (entry.package !== advisory.name) {
      failures.push(`${where}, cleared for ${entry.package} only`);
    } else {
      used.add(`${entry.package} ${advisory.id}`);
      if (today > entry.until) failures.push(`${where}, cleared until ${entry.until}`);
      else passed.push(`${where} (until ${entry.until}: ${entry.why})`);
    }
  }
  for (const entry of allow) {
    for (const id of entry.ids) {
      if (!used.has(`${entry.package} ${id}`)) {
        failures.push(
          `${id} in ${entry.package} is allowlisted but no longer reported; remove it`
        );
      }
    }
  }
  return { failures, passed };
}

// The gate is measured against reports it must refuse and one it must pass before npm is asked.
const sample = (name, id, severity = "high") => ({
  vulnerabilities: {
    [name]: {
      via: [{ url: `https://github.com/advisories/${id}`, name, severity, title: "t" }],
    },
  },
});
const ONE = [{ package: "pkg", ids: ["GHSA-aaaa"], until: "2026-01-02", why: "w" }];
const CONTROLS = [
  [
    "passes an allowlisted advisory before its date",
    sample("pkg", "GHSA-aaaa"),
    "2026-01-02",
    0,
  ],
  ["refuses an advisory outside the list", sample("other", "GHSA-bbbb"), "2026-01-01", 2],
  [
    "refuses an id reported against another package",
    sample("other", "GHSA-aaaa"),
    "2026-01-01",
    2,
  ],
  ["refuses an entry past its date", sample("pkg", "GHSA-aaaa"), "2026-01-03", 1],
  ["refuses an entry nothing reports any more", { vulnerabilities: {} }, "2026-01-01", 1],
  [
    "ignores a moderate advisory, leaving only the unused entry",
    sample("other", "GHSA-cccc", "moderate"),
    "2026-01-01",
    1,
  ],
];
for (const [name, report, today, expected] of CONTROLS) {
  const got = judge(report, ONE, today).failures.length;
  if (got !== expected)
    broken(`the control "${name}" found ${got} failure(s), expected ${expected}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let raw;
  try {
    raw = execFileSync("npm", ["audit", "--json"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    // npm audit exits non-zero whenever it finds anything; the report is still on stdout.
    if (!error.stdout) broken(`npm audit gave no report: ${error.message}`);
    raw = error.stdout;
  }
  const report = JSON.parse(raw);
  if (!report.vulnerabilities || !report.metadata)
    broken("npm audit returned no vulnerabilities section, so nothing was judged");

  const today = new Date().toISOString().slice(0, 10);
  const { failures, passed } = judge(report, ALLOW, today);
  for (const line of passed) console.log(`allowlisted: ${line}`);
  if (failures.length) {
    for (const line of failures) console.error(`audit-gate: ${line}`);
    process.exit(1);
  }
  console.log(
    `audit-gate: no high or critical advisory outside the allowlist (${today}).`
  );
}
