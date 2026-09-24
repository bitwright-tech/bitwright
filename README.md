# bitwright.tech

[![CI](https://github.com/bitwright-tech/bitwright/actions/workflows/ci.yml/badge.svg)](https://github.com/bitwright-tech/bitwright/actions/workflows/ci.yml)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-black)](LICENSE)

The website of **Bitwright**, an independent software studio. Three pages and a
not-found, 69 KB over the wire, no framework runtime, and no request to any origin but
this one.

It is public because the site is part of what it advertises. A studio that claims it
operates what it builds should be willing to show the build.

```bash
npm ci        # exact lockfile install, honouring the dependency quarantine
npm run dev   # http://localhost:4321
npm run verify   # everything CI runs
```

Node 26, per `.nvmrc`. Do not use `npm install`: `.npmrc` refuses any release younger
than seven days, and `install` ignores that setting while `ci` respects it.

## What is here

| Layer     | Choice                                | Why                                                            |
| --------- | ------------------------------------- | -------------------------------------------------------------- |
| Framework | [Astro](https://astro.build) 7        | Static HTML at build time, no runtime shipped to the browser   |
| Styling   | Tailwind CSS v4                       | Tokens in CSS, no config file, sources declared not discovered |
| Type      | Instrument Sans, IBM Plex Mono        | Self-hosted `woff2`, so no request leaves the visitor          |
| Motion    | 0.6 KB of inline JavaScript           | One `IntersectionObserver` and one clipboard handler           |
| Metal     | `@paper-design/shaders`, 8 KB gzipped | A WebGL shader, ported off its React wrapper                   |
| Hosting   | Cloudflare Worker, assets only        | No `main` script, so a page view never starts an isolate       |

Six KB of HTML, six of CSS, eight of JavaScript, and 49 KB of fonts. The fonts are four
fifths of the page, which is the honest shape of a site with no images and no framework.

## Commands

| Command                          | What it does                                               |
| -------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                    | Dev server on port 4321                                    |
| `npm run build`                  | Static output in `dist/`                                   |
| `npm run preview`                | Serve the build                                            |
| `npm run test`                   | Build, then 91 tests against `dist/`                       |
| `npm run verify`                 | Format, types, design system, prose, secrets, build, tests |
| `npm run check:live`             | Ask the deployed site what `dist/` cannot answer           |
| `node scripts/render-assets.mjs` | Redraw the icons and the share card (needs Chrome)         |

`lefthook` runs the fast checks before every commit and the full `verify` before every
push.

## What CI refuses to ship

Four jobs behind one `Ready to deploy` status. The tests read `dist/`, never `src/`,
because a build step can rewrite what was authored and this repository has been bitten by
exactly that twice.

| Area          | What fails the build                                                           |
| ------------- | ------------------------------------------------------------------------------ |
| Design system | A raw value in markup, a token nothing uses, a property defined as itself      |
| Type          | A size off the 1.25 scale, a fixed line box off the 4px grid                   |
| Colour        | Any ink under WCAG AA on its ground, in either mode, or a token with hue       |
| Motion        | A literal duration or a third easing curve inside a transition                 |
| Prose         | More than two em dashes per thousand words, or a word from the list            |
| Privacy       | A personal identifier anywhere in the output or in a tracked file              |
| Regulation    | Any of nine words naming a licensed activity in Brazil, near the products      |
| Accessibility | An axe-core violation, a skipped heading level, a link with no name            |
| Weight        | JavaScript over 15 KB gzipped, counting inline, or a framework runtime         |
| Integrity     | A dead link, a missing meta tag, a page that is neither indexed nor noindexed  |
| Supply chain  | A known high-severity advisory                                                 |
| Live config   | Plain HTTP, weak TLS, a missing header, a rewritten `robots.txt`, a stale cert |

Every rule is there because the defect it names already happened here, and the reasoning
lives in a comment beside the code it constrains.

## Deploy

A push to `main` that clears every check deploys itself. The job runs only on a
push to that branch, publishes the same `dist/` the tests read rather than
rebuilding it, and then interrogates the live host.

That last step exists because everything else here can only see `dist/`, and
`dist/` cannot know what the host does with it. A directory route answering 307
before 200, plain HTTP answering 200 with no redirect, TLS 1.0 still accepted,
and a managed `robots.txt` injected at the edge all reached production through
that gap. They live in dashboard state, so a click can undo any of them without
touching a file here. `npm run check:live` asks the deployed site directly and
fails the build when the answer changes.

It also runs on a clock, every Monday, because running only after a deploy means
a quiet month is exactly when a flipped setting would go unnoticed.

`wrangler` is a devDependency pinned by the lockfile, so no third-party action
ever holds the credential. Two secrets live on the `production` environment
rather than on the repository, which keeps them out of every other workflow:

| Secret                  | What it is                                            |
| ----------------------- | ----------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Scoped to one account and one zone, with three grants |
| `CLOUDFLARE_ACCOUNT_ID` | The account the Worker belongs to                     |

The token needs `Workers Scripts: Edit` on the account, plus `Workers Routes:
Edit` and `DNS: Edit` on the `bitwright.tech` zone, because the hostname is
declared in `wrangler.jsonc` and Cloudflare writes the DNS record on the first
deploy. Nothing else. Not the Global API Key, which cannot be scoped and cannot
be narrowed after the fact.

## Layout

```
src/
├── data/company.ts     single source for everything the site publishes
├── data/tokens.ts      the scales as data, so the docs can be checked against them
├── layouts/Base.astro  document shell, meta, structured data, the inline enhancement
├── components/         Header, Footer, Mark, MetalButton, Reveal
├── pages/              index, privacy, support, 404
└── styles/global.css   tokens, self-hosted faces, motion
docs/design-system.md   the only description of the system, checked against the CSS
scripts/                the four checks CI runs, plus the asset renderer
```

`data/company.ts` exists so the published identity cannot drift. The visible page, the
structured data and `llms.txt` all read the same values, and the file records that only
the CNPJ and the contact address are ever published.

## Contributing

This is one company's website, so pull requests changing what it says will be declined.
Bug reports are welcome, especially about rendering, accessibility or anything the
checks above should have caught and did not.

## Licence

Source is [MIT](LICENSE). The Bitwright name, the mark and the product names are not
covered by it.

The two typefaces are not MIT either. Instrument Sans and IBM Plex Mono are both under
the SIL Open Font License 1.1, and each copy in `public/fonts/` travels with the
licence text and copyright notice its authors published.
