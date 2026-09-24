import { describe, expect, it } from "vitest";
import { SHAPES, scan } from "../scripts/check-secrets.mjs";

/**
 * The detector, tested against each shape it claims to catch.
 */
/**
 * Assembled from fragments rather than written out, because a file containing a
 * credential-shaped literal is a file the detector rejects, as it should.
 */
const samples: Record<string, string> = {
  "AWS access key id": `AK${"IA"}IOSFODNN7EXAMPL${"E"}`,
  "GitHub token": `gh${"p"}_${"a".repeat(36)}`,
  "OpenAI-style key": `s${"k"}-${"b".repeat(40)}`,
  "Cloudflare API token": `cf${"at"}_${"c".repeat(30)}`,
  "Slack token": `xo${"xb"}-000000000000-abcdefghijkl`,
  "Google API key": `AI${"za"}${"d".repeat(35)}`,
  "private key block": `-----BE${"GIN"} RSA PRIV${"ATE"} KEY-----`,
  "JSON Web Token": `ey${"Jh"}bGciOiJIUzI1NiJ9.ey${"Jz"}dWIiOiIxMjM0NTYifQ.sig`,
  "assigned password": `pass${"word"} = "hunter2hunter2"`,
};

describe("credential shapes", () => {
  for (const { name } of SHAPES) {
    it(`catches a ${name}`, () => {
      expect(samples[name], `no sample for ${name}`).toBeTruthy();
      // Scanned as raw text, not embedded in a JSON string: quoting the sample
      // escapes its own quotes and the assigned-password shape stops matching
      // itself, which says nothing about the detector.
      expect(scan(`some surrounding text ${samples[name]} and more`)).toContain(name);
    });
  }

  it("stays quiet on the things that are not credentials", () => {
    const innocent = [
      "--color-token: #ffffff;",
      "const secret = process.env.SOMETHING;",
      "// the API key lives in an environment variable",
      '"token": "--radius-card"',
      "password reset flow",
    ].join("\n");
    expect(scan(innocent)).toEqual([]);
  });
});
