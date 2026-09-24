import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    reporters: "default",
    // The accessibility run parses built pages into jsdom. Their inline scripts
    // are the site's runtime, not the subject of the check, and executing them
    // in a DOM with no layout only produces noise that looks like test failure.
    environmentOptions: { jsdom: { runScripts: "outside-only" } },
  },
});
