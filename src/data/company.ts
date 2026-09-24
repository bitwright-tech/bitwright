/**
 * Single source of truth for what the site publishes about the company. Only the
 * CNPJ and the contact address are published; everything else stays out, and the
 * page and the JSON-LD both read from here so that cannot drift.
 */
export const company = {
  brand: "Bitwright",
  // Deliberately the only two identifying facts published. Nothing else
  // identifying belongs in this file.
  taxId: "68.150.870/0001-80",
  taxIdLabel: "CNPJ",
  email: "contact@bitwright.tech",
  github: "https://github.com/bitwright-tech",
  repo: "https://github.com/bitwright-tech/bitwright",
  /**
   * The JSON-LD Organization.description, so it is what an answer engine reads
   * to decide what this company is. The claim is SPAN, not category: naming any
   * single layer classifies the studio as that layer and stops. The six rows of
   * `capabilities` below are what keep the claim from being vague.
   */
  summary:
    "Bitwright is an independent software studio that designs, builds and operates software systems: mobile and web applications, the services behind them, and the infrastructure they depend on. Engagements are contracted and invoiced through a registered company, for clients worldwide.",
  /** Search results cut around 160 characters, and the sentence that survives
   * the cut should still be a whole one. The full summary stays in the
   * structured data, where there is no such limit. */
  metaDescription:
    "An independent software studio that designs, builds and operates mobile and web applications, the services behind them, and the infrastructure they depend on.",
  /** Order is read as priority by the engines that consume it. Capability
   * first, domain last. */
  knowsAbout: [
    "Software engineering",
    "Mobile application development",
    "React Native",
    "TypeScript",
    "Rust",
    "PostgreSQL",
    "Vue",
    "Python",
    "React",
    "API integration",
    "Payment integration",
    "Event sourcing",
    "Kubernetes",
    "Argo CD",
    "GitOps",
    "Containers",
    "GitHub Actions",
    "Observability",
    "Site reliability engineering",
    "Bitcoin",
    "Lightning Network",
    "Spark",
    "Liquid",
    "Miniscript",
    "Self-custody wallets",
  ],
} as const;

/**
 * Evidence that something has shipped, which is what makes the capability rows
 * checkable. The wallet repositories join this list when they go public.
 *
 * No client or product names, and no inventory of what the cluster carries.
 * Publishing that one self-hosted box runs a payment gateway and a Lightning
 * node is a map for anyone looking for one.
 *
 * The wording is "built for" rather than "we run". Describing Bitwright as
 * operating a payment service would name an activity it does not perform and is
 * not licensed for.
 */
export const systems = [
  {
    name: "A payment gateway",
    status: "In production",
    stack: "Rust · PostgreSQL · Event sourcing",
    description:
      "Built for a payment service on an event-sourced core, because reconciling money means being able to rebuild any balance at any point in its history rather than trusting a running total. Its API is closed, used by partners rather than published.",
  },
  {
    name: "A production cluster",
    status: "In production",
    stack: "Kubernetes · Argo CD · GitOps",
    description:
      "Self-hosted rather than managed, carrying several products' workloads at once, with delivery through Git and nothing applied by hand. It is what will serve this site once the origin moves.",
  },
] as const;

/* One wallet for the money that moves and one for the money that stays, which
 * is why their stacks share nothing below the interface.
 *
 * Offline receive is deliberately absent from the Voltz line. The code exists,
 * but the iOS delivery path is waiting on an Apple organisation account, and
 * the page's posture is that neither product has shipped.
 */
export const products = [
  {
    name: "Voltz Wallet",
    status: "In development",
    stack: "React Native · Spark · Breez SDK",
    description:
      "An everyday wallet, for the amounts that actually move. Built on the Spark network with on-chain and Lightning interoperability, so a payment can arrive on one rail and leave on another. Keys are generated on the device and never reach a server.",
  },
  {
    name: "Nyx Wallet",
    status: "In development",
    stack: "React Native · Miniscript · BitcoinerLab",
    description:
      "A wallet for the money that stays. The keys live on a hardware signer and the phone is watch-only, with an on-device mode for those who want one. The vault is a Miniscript policy with on-chain timelocks, so a chosen heir recovers the funds after a set period of inactivity. Bitcoin enforces that, and it holds if we disappear.",
  },
] as const;

/**
 * Six rows rather than three. A studio that says it does mobile, backend and
 * infrastructure has described every studio.
 *
 * The order is the stack read downwards: what a person touches, what serves it,
 * what runs it, then the domain.
 *
 * The Bitcoin row must not be cut for tidiness. Until there is somewhere else
 * to put that depth, it is the only place the specialism stays retrievable.
 */
export const capabilities = [
  {
    area: "Mobile",
    detail:
      "React Native and TypeScript for iOS and Android, through build, signing and store submission.",
  },
  {
    area: "Web",
    detail:
      "React and Vue front ends, from single page applications to static sites with no framework runtime.",
  },
  {
    area: "Backend",
    detail:
      "Services in Rust, Python and TypeScript over PostgreSQL, including a payment system built on event sourcing.",
  },
  {
    area: "Integrations",
    detail:
      "Payment providers and third party APIs, with the services and bots that sit between them.",
  },
  {
    area: "Infrastructure",
    detail:
      "Kubernetes, Argo CD, container images and GitHub Actions pipelines, self hosted or managed.",
  },
  {
    area: "Bitcoin",
    detail:
      "Non-custodial wallets on-chain and on Lightning, Liquid and Spark, where the keys never leave the device.",
  },
] as const;
