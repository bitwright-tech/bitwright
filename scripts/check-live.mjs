#!/usr/bin/env node
/**
 * Interrogates the deployed site, which is the only place these can be observed.
 *
 * Every other check in this repository reads dist/, and dist/ cannot know what
 * the host does with it. Four defects reached production that way: a directory
 * route answering 307 before 200, plain HTTP answering 200 with no redirect at
 * all, TLS 1.0 still accepted, and a managed robots.txt injected at the edge
 * that told the AI crawlers the file itself invites to go away.
 *
 * None of those live in the repository. They live in dashboard state, which
 * means a click can undo any of them and nothing here would notice. That is
 * what this converts into a failing build.
 *
 *   npm run check:live
 *
 * Not part of `npm run verify`, deliberately. verify runs before a push, when
 * the live site is still the previous commit.
 */
import { readFileSync } from "node:fs";
import { connect } from "node:tls";
import { legacyTlsProblem } from "./tls-refusal.mjs";

const site =
  process.env.SITE ??
  readFileSync(new URL("../astro.config.mjs", import.meta.url), "utf8").match(
    /site:\s*"([^"]+)"/
  )?.[1];
if (!site) {
  console.error("no site to check: astro.config.mjs has no `site`");
  process.exit(1);
}
const host = new URL(site).host;

const failures = [];
const check = async (name, fn) => {
  try {
    const problem = await fn();
    if (problem) failures.push(`${name}: ${problem}`);
    else console.log(`  ok    ${name}`);
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
};

const head = (url) => fetch(url, { redirect: "manual" });

/** The first request after a deploy can beat DNS, so only reachability retries. */
async function reachable() {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await head(site);
      if (r.status === 200) return r;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  return null;
}

const home = await reachable();
if (!home) {
  console.error(`${site} never answered 200`);
  process.exit(1);
}
console.log(`  ok    ${site} answers 200`);

await check("plain HTTP redirects to HTTPS", async () => {
  const r = await head(site.replace("https://", "http://"));
  if (![301, 308].includes(r.status))
    return `answered ${r.status}, not a permanent redirect`;
  const to = r.headers.get("location") ?? "";
  return to.startsWith("https://") ? null : `redirects to ${to}`;
});

await check("www redirects to the canonical host", async () => {
  const r = await head(`https://www.${host}/`);
  if (r.status !== 301) return `answered ${r.status}, not 301`;
  const to = r.headers.get("location") ?? "";
  return to.startsWith(site) ? null : `redirects to ${to}`;
});

await check("HSTS is declared for a year and covers subdomains", () => {
  const h = home.headers.get("strict-transport-security");
  if (!h) return "no header";
  const age = Number(h.match(/max-age=(\d+)/)?.[1] ?? 0);
  if (age < 31_536_000) return `max-age is ${age}, under a year`;
  return h.includes("includeSubDomains") ? null : "no includeSubDomains";
});

await check("the page cannot be framed or told to sniff", () => {
  const csp = home.headers.get("content-security-policy") ?? "";
  if (!csp.includes("frame-ancestors 'none'")) return "CSP allows framing";
  const sniff = home.headers.get("x-content-type-options");
  return sniff === "nosniff" ? null : `x-content-type-options is ${sniff}`;
});

await check("nothing at the edge rewrites robots.txt", async () => {
  // The status matters as much as the body. Reading an error page and finding no
  // Disallow in it is a pass that proves nothing, which is how this assertion
  // first behaved when it was pointed at a domain with no robots.txt at all.
  const r = await fetch(`${site}/robots.txt`);
  if (r.status !== 200) return `robots.txt answered ${r.status}`;
  const body = await r.text();
  if (/^\s*Disallow:/m.test(body))
    return "a Disallow appeared, which this site does not publish";
  return /Content-Signal/i.test(body) ? "a Content-Signal was injected" : null;
});

await check("the security contact is served at its standard path", async () => {
  // dist/ carried this file while production answered 404 for it, because
  // upload-artifact drops dot-prefixed paths unless told not to. No check that
  // reads the build could have seen that: the artefact deployed was not the
  // artefact tested. Asking the host is the only layer where the two are the
  // same thing, and every future .well-known asset fails the same way.
  const r = await fetch(`${site}/.well-known/security.txt`);
  if (r.status !== 200) return `answered ${r.status}`;
  const body = await r.text();
  return /^Contact:\s*\S+/m.test(body) ? null : "served, but names no contact";
});

await check("a route that does not exist answers 404", async () => {
  const r = await head(`${site}/a-path-that-is-not-built`);
  return r.status === 404 ? null : `answered ${r.status}, which reads as a soft 404`;
});

await check("the certificate is not about to expire", () => {
  // Cloudflare renews on its own, and nothing here would notice if it stopped.
  // A silent renewal failure ends as a browser warning that a visitor finds
  // first. Cloudflare renews around thirty days out, so twenty-one days left is
  // already the alarm rather than the deadline.
  return new Promise((resolve) => {
    const s = connect({ host, port: 443, servername: host }, () => {
      const cert = s.getPeerCertificate();
      s.destroy();
      if (!cert?.valid_to) return resolve("no certificate presented");
      const days = Math.floor((Date.parse(cert.valid_to) - Date.now()) / 86_400_000);
      resolve(days < 21 ? `expires in ${days} days` : null);
    });
    s.on("error", (e) => resolve(e.message));
    s.setTimeout(15_000, () => {
      s.destroy();
      resolve("timed out");
    });
  });
});

await check("TLS below 1.2 is refused", () => {
  return new Promise((resolve) => {
    const s = connect(
      {
        host,
        port: 443,
        servername: host,
        minVersion: "TLSv1",
        maxVersion: "TLSv1.1",
        // OpenSSL 3 will not put a legacy ClientHello on the wire at its default
        // security level, and the failure looks like any other socket error.
        // Without this the probe never reaches the host at all: measured against
        // tls-v1-1.badssl.com:1011, which does accept TLS 1.1, it still came back
        // as though the connection had been refused.
        ciphers: "DEFAULT:@SECLEVEL=0",
      },
      () => {
        const protocol = s.getProtocol();
        s.destroy();
        resolve(legacyTlsProblem({ handshake: true, protocol }));
      }
    );
    s.on("error", (e) => resolve(legacyTlsProblem({ code: e.code })));
    s.setTimeout(15_000, () => {
      s.destroy();
      resolve(legacyTlsProblem({ timedOut: true }));
    });
  });
});

if (failures.length) {
  console.error(`\n${failures.length} live problem(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\nLive configuration holds.`);
