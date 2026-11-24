/**
 * x402 seller setup for Celo mainnet, following https://x402.celo.org/skill.md (read 24 Nov 2026):
 *  - facilitator https://api.x402.celo.org with X-API-Key on verify/settle/supported
 *  - @x402/hono paymentMiddleware(routes, server) (v2 signature), ExactEvmScheme registered for eip155:*
 *  - explicit price { amount, asset, extra } — never a bare "$0.01" (that silently prices in USDC)
 *  - USD₮: extra.name "Tether USD" (EIP-712 domain name, not the symbol), version "1", 6 decimals
 *  - builder-code extension declares Errand's ERC-8021 code in the 402 response (x402 settlements
 *    carry no tag yet; the PayTo address is registered with Loops instead)
 */
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { BUILDER_CODE, builderCodeResourceServerExtension, declareBuilderCodeExtension } from "@x402/extensions/builder-code";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { USDT } from "@errand/celo/tokens";

export const CELO_MAINNET = "eip155:42220";
export const FACILITATOR_URL = "https://api.x402.celo.org";

export function x402Routes(opts: { payTo: string; priceAtomic: string; attributionCode: string }) {
  return {
    "POST /check": {
      accepts: [
        {
          scheme: "exact",
          network: CELO_MAINNET,
          payTo: opts.payTo,
          price: { amount: opts.priceAtomic, asset: USDT.address, extra: { name: "Tether USD", version: "1" } },
        },
      ],
      description: "Errand Guard: check a Celo payment before you make it (approve / ask / block with reasons).",
      mimeType: "application/json",
      extensions: { [BUILDER_CODE]: declareBuilderCodeExtension(opts.attributionCode) },
    },
  } as const;
}

export function x402PaymentMiddleware(opts: { payTo: string; priceAtomic: string; attributionCode: string; apiKey: string | undefined }) {
  const facilitator = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
    createAuthHeaders: async () => {
      const h: Record<string, string> = opts.apiKey ? { "X-API-Key": opts.apiKey } : {};
      return { verify: h, settle: h, supported: h };
    },
  });
  const server = new x402ResourceServer(facilitator);
  server.register(CELO_MAINNET, new ExactEvmScheme());
  server.registerExtension(builderCodeResourceServerExtension);
  return paymentMiddleware(x402Routes(opts) as never, server);
}
