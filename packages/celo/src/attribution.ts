import { fromDataSuffix, fromOrchestratorCalldata, toDataSuffix, verifyTx, withAttribution } from "@celo/attribution-tags";
import { concat, type Hex, type PublicClient } from "viem";

/**
 * Errand's attribution code for Celo's "Agents Open for Business" hackathon (Loops House).
 * Every Celo mainnet transaction Errand sends must end with this tag, or it is never credited.
 * It is not a secret. ATTRIBUTION_CODE in .env can override it; the override must look like a code.
 */
export const DEFAULT_ATTRIBUTION_CODE = "celo_511bb691f2f0";

const CODE_PATTERN = /^[a-z0-9_]{1,32}$/;

export function attributionCode(): string {
  const fromEnv = process.env.ATTRIBUTION_CODE?.trim();
  const code = fromEnv ? fromEnv : DEFAULT_ATTRIBUTION_CODE;
  if (!CODE_PATTERN.test(code)) {
    throw new Error(`ATTRIBUTION_CODE "${code}" is not a valid code (a-z, 0-9, _; 1-32 characters)`);
  }
  return code;
}

/** The ERC-8021 suffix to put at the very end of a transaction's calldata. */
export function attributionSuffix(): Hex {
  return toDataSuffix(attributionCode()) as Hex;
}

/** Adds Errand's tag to the end of calldata. Use it where a client extension can't be used. */
export function tagCalldata(data: Hex | undefined): Hex {
  return concat([data ?? "0x", attributionSuffix()]);
}

/** viem wallet-client extension: tags every sendTransaction / writeContract on that client. */
export function errandAttribution() {
  return withAttribution(attributionCode());
}

/** True if this calldata already ends with Errand's code. */
export function hasErrandTag(data: Hex): boolean {
  const decoded = fromDataSuffix(data);
  return decoded !== null && decoded.codes.includes(attributionCode());
}

/**
 * True if a transaction's input carries Errand's code, offline (no RPC):
 *  - a direct transaction: the tag at the very end of the input (EOA / MiniPay errands);
 *  - an Altana relayed intent (`Orchestrator.execute`): the tag on a call inside the signed intent,
 *    e.g. `altana,celo_511bb691f2f0` when the Altana SDK is created with `appCode` (SDK 1.2.0).
 * For crediting, prefer `assertTagged`, which also checks that a relayed intent executed.
 */
export function carriesErrandTag(input: Hex): boolean {
  if (hasErrandTag(input)) return true;
  const intents = fromOrchestratorCalldata(input);
  return Boolean(intents?.some((i) => i.attribution?.codes.includes(attributionCode())));
}

/**
 * Reads a sent transaction back from the chain and confirms Errand's code is on it.
 * Handles smart-account (ERC-4337) bundles too. Returns the decoded result, or throws.
 */
export async function assertTagged(client: PublicClient, hash: Hex) {
  const result = await verifyTx({ client, hash });
  if (!result || !result.codes.includes(attributionCode())) {
    throw new Error(`Transaction ${hash} is not tagged with ${attributionCode()}`);
  }
  return result;
}
