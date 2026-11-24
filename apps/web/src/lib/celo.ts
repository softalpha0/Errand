/**
 * Public, verified facts about Errand on Celo mainnet, shown on the site.
 * Source of truth: evidence/celo/identity.md and evidence/celo/erc8004-register.json.
 * Only add a fact here after it has happened on mainnet.
 */
export const CELO = {
  chainId: 42220,
  explorer: "https://celoscan.io",
  attributionTag: "celo_511bb691f2f0",
  agentWallet: "0xc64d2153Bd39053913667A5c2eec8250d8AbC005",
  erc8004: {
    agentId: 10107,
    registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    registerTx: "0x8b6048637d36104e7c89d85efee0e1be8e9696fa7f00e485b79b9ee76f162b7c",
  },
  selfAgentId: {
    agentId: 214,
    registry: "0xaC3DF9ABf80d0F5c020C06B04Cced27763355944",
    registerTx: "0xe46d880c3de064bc578effbc8f01cd430d0f665b231630cc3e95984a67296fb9",
  },
  guardUrl: "https://errand-guard-celo.onrender.com",
  textilePreview: {
    // Spike S0, 23 Nov 2026 (evidence/celo/spikes.md). Indicative only.
    nairaPerUsdt: 1447.58,
    date: "23 Nov 2026",
  },
} as const;

export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/softalpha0/Errand";
export const REPO_CELO_URL = `${REPO_URL}/tree/celo`;

export const txUrl = (hash: string) => `${CELO.explorer}/tx/${hash}`;
export const addressUrl = (address: string) => `${CELO.explorer}/address/${address}`;
export const short = (hex: string) => `${hex.slice(0, 6)}…${hex.slice(-4)}`;
