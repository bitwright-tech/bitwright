// @ts-check
import { defineConfig } from "astro/config";

import { execSync } from "node:child_process";

import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

/**
 * When the site last changed, from git rather than from the clock.
 *
 * A `lastmod` set to the build date claims every page changed on every build,
 * which is a signal a crawler learns to ignore. One date for every URL is the
 * honest reading, since each page is assembled from the shared layout, the
 * shared components and one data file. With no git in the environment the field
 * is omitted rather than guessed.
 */
function lastContentChange() {
  try {
    const iso = execSync("git log -1 --format=%cI -- src public", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return iso ? new Date(iso) : undefined;
  } catch {
    return undefined;
  }
}

// https://astro.build/config
export default defineConfig({
  // Absolute URLs for canonical links, Open Graph and the sitemap all derive from this.
  site: "https://bitwright.tech",

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [sitemap({ lastmod: lastContentChange() })],
});
