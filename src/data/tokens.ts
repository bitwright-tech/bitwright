/**
 * The scales, as data.
 *
 * `global.css` declares the custom properties; this file is the machine-readable
 * copy that `check:tokens` compares them against, and that the tests read to
 * check what docs/design-system.md claims. The duplication cannot drift because
 * `npm run check:tokens` parses global.css and fails the build if the two
 * disagree.
 */
export const radii = [
  { token: "--radius-control", name: "control", rem: 0.75, use: "Buttons, nav links" },
  { token: "--radius-card", name: "card", rem: 1, use: "Product cards" },
  { token: "--radius-panel", name: "panel", rem: 1.25, use: "The docked header" },
  { token: "--radius-shell", name: "shell", rem: 2, use: "Footer shell" },
] as const;

export const typeScale = [
  { rem: 0.64, role: "fine" },
  { rem: 0.8, role: "label · caption · mono" },
  { rem: 1, role: "body · wordmark" },
  { rem: 1.25, role: "heading · lead" },
  { rem: 1.5625, role: "title, small end" },
  { rem: 2.44, role: "title large end · display small end" },
  { rem: 4.77, role: "display, large end" },
] as const;

/** rem to px at the browser default, for captions that quote both. */
export const px = (rem: number) => `${Math.round(rem * 16 * 100) / 100}px`;
