# Sponsor and protocol reference (verified)

Everything here was read from the vendor's own docs or source code on 20–23 Nov 2026. The source is listed under each section.
**Rule:** if a vendor's live docs disagree with this file, the vendor wins. Fix the code, fix this file, and note it in AGENTS.md → Decisions.
Anything marked **UNVERIFIED** has to be tested with a spike (see docs/celo/BUILD-PLAN.md) before code depends on it.

---

## 1. Celo mainnet basics

| Item | Value | Source |
|---|---|---|
| Chain ID | 42220 (CAIP-2 `eip155:42220`) | docs.celo.org x402 page |
| Testnet | Celo Sepolia 11142220 (`eip155:11142220`). **Testnet activity does not count** for the hackathon | Loops enrol page |
| Public RPC used in vendor examples | `https://forno.celo.org` (x402 skill) · `https://celo-rpc.publicnode.com` (Altana networks page) | x402.celo.org/skill.md, Altana docs |
| Explorer | https://celoscan.io | Altana networks page |
| Gas | CELO, or stablecoins as fee currency (e.g. USDC through the fee-currency adapter `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B`; omit `feeCurrency` to pay in CELO) | docs.celo.org ERC-8004 page |

### Tokens on Celo mainnet

| Token | Address | Decimals | Source |
|---|---|---|---|
| USD₮ (USDT) | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6 | Loops page, Textile address book, x402 config |
| USA₮ (USAT) | `0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771` | 6 | Textile address book, x402 config |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 | Textile address book, x402 config |
| cNGN | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` | 6 | Loops page, Textile address book, x402 config |
| IDRX | `0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22` | 2 | Textile address book |
| wARS | `0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D` | 18 | Loops page, Textile, x402 |
| wBRL | `0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0` | 18 | Loops page, Textile, x402 |
| wMXN | `0x337E7456B420bD3481e7FA61fA9850343d610d34` | 18 | Loops page, Textile, x402 |
| wCOP | `0x8a1D45e102e886510e891d2Ec656a708991e2D76` | 18 | Loops page, Textile, x402 |
| CELO (token) | `0x471EcE3750Da237f93B8E339c536989b8978a438` | 18 | Textile address book |
| Permit2 (canonical) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | n/a | Textile address book, x402 docs |

**Trap:** USD₮ and USA₮ also have **18-decimal fee-currency adapters** with the same `name()` and `symbol()`: `0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72` (USDT adapter) and `0x0357EE22278c922e1D36cFe6b899269b161880C4` (USAT adapter). Never pay or approve with the adapter addresses. Use the addresses in the table above and assert `decimals() == 6` at startup (x402.celo.org/skill.md).

Sources: https://www.loops.house/agents-open-for-business · https://fx-docs.textilecredit.com/protocol/address-book.html · https://x402.celo.org/api/config · https://x402.celo.org/skill.md

---

## 2. Attribution tags (ERC-8021)

| Item | Value |
|---|---|
| Errand's code | `celo_511bb691f2f0` (issued by Loops House). Already in `packages/celo/src/attribution.ts` with tests |
| Package | `@celo/attribution-tags` 0.5.0 (wraps `ox/erc8021`) |
| Exports | `toDataSuffix`, `withAttribution`, `codeFromHostname`, `codeFromRepo`, `fromDataSuffix`, `verifyTx`, `verifyUserOps` |

How to apply it:
1. **Plain wallet (EOA) with viem:** build the client once with `.extend(withAttribution(code))`. It tags `sendTransaction`, `writeContract` and their `*Sync` variants. It does **not** cover EIP-5792 `sendCalls`/batch APIs.
2. **Raw calldata:** `concat([callData, toDataSuffix(code)])`. The suffix goes after the call; the contract ignores it.
3. **Smart accounts (ERC-4337):** the suffix must sit at the end of the **UserOperation's `callData`**, and the on-chain tx is the bundler's `handleOps`. `verifyTx` decodes `handleOps` (EntryPoint v0.6 and v0.7) and returns `sender` (the smart account). Textile's docs say the same: for ERC-4337, append to `UserOperation.callData` before gas estimation and signing.
4. **Relayers that re-encode calldata can drop the suffix.** If a bundle shows no tag in any operation, test with an EOA to isolate the cause and contact the attribution-tags team.
5. **x402 settlements carry no tag yet.** The Celo facilitator does not write Schema 2 tags; the change is under review (x402-rs/x402-rs#99). Declaring the app code in `402` responses (x402 `builder-code` extension) is harmless now and picked up later. Until then, **register the PayTo address with Loops**.
6. After the first real transaction, run `verifyTx` and confirm the codes include `celo_511bb691f2f0`. Save the output in `evidence/`.
7. Use `celo_test1234` only for local experiments. Never on mainnet.

Source: https://github.com/celo-org/attribution-tags/blob/main/BUILDERS.md

---

## 3. ERC-8004 agent identity

| Item | Value |
|---|---|
| Identity Registry (Celo mainnet) | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Testnet registry (Celo Sepolia) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` (Altana ERC-8004 docs) |
| Cost | No protocol fee, gas only (`register` and `setAgentURI` are `nonpayable`) |
| Explorer | https://8004scan.io |

Steps (docs.celo.org):
1. **Choose the owner key.** The address you register from receives the NFT and is published as the agent's payment wallet. Ownership is harder to undo than the payee. For the hackathon this must be **the agent wallet** entered on Loops.
2. **Host a registration file** (HTTPS URL, IPFS, or `data:` URI) with `type` = `https://eips.ethereum.org/EIPS/eip-8004#registration-v1`, `name`, `description`, `image`, `services` (each `name`, `endpoint`, optional `version`), `x402Support`, `active`, `supportedTrust`. Leave out `registrations` for now.
3. **Call `register(agentURI)`.** Simulate first, then send. Read `agentId` from the `Registered` event in the receipt, not the return value.
4. **Add the ID to the file:** a `registrations` entry with `agentId` and `agentRegistry` = `eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`. If the file is on IPFS or a `data:` URI, call `setAgentURI(agentId, newURI)`.

The registration transaction must carry the attribution tag.

**Watch out:** the Altana SDK automatically registers every *new* Altana wallet as an ERC-8004 agent ("Altana Agent") after its first action, unless `agentIdentity: false` is passed on `createClient` or on the call. Errand's user wallets must pass `agentIdentity: false`, so only the Errand agent is an agent.

Sources: https://docs.celo.org/build-on-celo/build-with-ai/8004 · Altana `docs/pages/sdk/erc8004.mdx` (github.com/altananetwork/altana-sdk)

---

## 4. Self Agent ID

| Item | Value |
|---|---|
| What | Binds an AI agent's key to a verified human's passport proof on-chain. The human scans a QR with the Self app (zero-knowledge proof on the phone). The registry mints a **soulbound ERC-8004 NFT on Celo** bound to the human's nullifier |
| Registry (Celo mainnet 42220) | `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` |
| Registry (Celo Sepolia) | `0x043DaCac8b0771DD5b444bCC88f2f8BBDBEdd379` (mock passports only) |
| SDK | `@selfxyz/agent-sdk` (npm 0.3.1 on 23 Nov 2026). License BUSL-1.1 |
| API | `https://agent-api.self.xyz` (env `SELF_AGENT_API_BASE`) |
| API key | **None needed** to verify |
| Verified when | `hasHumanProof && isProofFresh`. Proofs expire at the earlier of the document expiry or 365 days after registration |
| Sybil limit | `SelfAgentVerifier` defaults to **1 agent per human**; `.sybilLimit(0)` = no limit |
| Request headers (agent signs every request) | `x-self-agent-address`, `x-self-agent-signature`, `x-self-agent-timestamp` (+ `x-self-agent-keytype`, `x-self-agent-key` for Ed25519) |

Registration modes: `wallet-free` (generated agent key, no human wallet; **the agent key owns the NFT**), `linked` (generated agent key linked to the human's wallet; the human's wallet owns the NFT), `privy`, `smartwallet`, `ed25519`, `ed25519-linked`. In EVM modes the SDK **generates** the agent key, and `session.exportKey()` returns it **within 30 minutes of completion**.

Disclosures at registration: `minimumAge` 0 (default), 18 or 21; `ofac` true/false. `requireAge(18)` on the verifier fails for agents registered without an age disclosure.

Agent side:
```ts
import { SelfAgent } from "@selfxyz/agent-sdk";
const agent = new SelfAgent({ privateKey, network: "mainnet" });
await agent.fetch(url, { method: "POST", body });
```
Service side (Express shown in docs; Hono: call `verifier.verify({ signature, timestamp, method, url, body })` with the raw header values and the **exact raw body bytes**):
```ts
import { SelfAgentVerifier } from "@selfxyz/agent-sdk";
const verifier = SelfAgentVerifier.create().network("mainnet").sybilLimit(1).build();
```
Gotchas from the SDK README: body bytes must not be re-serialised; clock skew over 5 min fails; the **CLI defaults to testnet** while the **SDK classes default to mainnet**.

CLI (registration):
```
npx -p @selfxyz/agent-sdk self-agent register init --mode wallet-free --minimum-age 18 --network mainnet --out .self/session.json
npx -p @selfxyz/agent-sdk self-agent register open --session .self/session.json
npx -p @selfxyz/agent-sdk self-agent register wait --session .self/session.json
npx -p @selfxyz/agent-sdk self-agent register export --session .self/session.json --unsafe --print-private-key
```
`--network mainnet` is required: the CLI defaults to testnet (Celo Sepolia), per its own help text. `.self/` must be in `.gitignore` (the exported key is a secret).

Sources: https://docs.self.xyz/docs/agent-id/overview/ · https://github.com/selfxyz/self-agent-id (typescript-sdk/README.md, src/registration.ts, src/constants.ts, src/SelfAgent.ts)

---

## 5. Altana (non-custodial agent wallets)

| Item | Value |
|---|---|
| SDK | `npm install @altananetwork/sdk viem` (1.1.0 on 23 Nov 2026). Default chain is BNB, so pass `chains: [CELO]` |
| Celo | Standalone KeyStore + wallet execution. KeyStore `0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c`, KeyStoreController `0x47bA5fc2A5b0CcB24BA3fAC9D4B59400eE9fd1D6`. Relay `https://relay.altana.network` |
| Relay fee tokens on Celo | CELO, USDC, USD₮, USA₮, EURm (`client.feeCurrencies()` lists live rates) |
| Wallet types | `createPasskeyWallet` (browser, passkey) or `createWallet({ signer: signerFromPrivateKey(...) })` |
| Wallet accounts | EIP-7702 delegated account code. Native payouts via Solidity `.transfer()`/`.send()` can't reach it; ERC-20 transfers are fine |

### Sessions (the Altana track)

```ts
const session = await client.grantSession({
  wallet, signer: admin,
  permissions: {
    calls: [{ to: "0x..." }, { signature: "transfer(address,uint256)", to: "0x..." }],
    spend: [{ limit: <raw units>, period: "day", token: "0x..." }],
  },
  expiry: Math.floor(Date.now() / 1000) + <seconds>,
  sessionSigner, // optional: bring your own key; omitted = SDK generates one
  feeToken,      // optional: lets the session pay relay fees in a stablecoin
});
await client.execute({ session, calls: [{ to, data, value: 0n }] });
await client.revokeSession(/* see docs/pages/sdk/revoke-session.mdx */);
```

- Permissions are enforced on-chain. A call outside the allowlist or beyond a cap reverts at validation.
- `permissions.calls` omitted = **unrestricted**. Always set it.
- `limit` is in the token's smallest unit (USD₮ on Celo = 6 decimals).
- **The spend cap also pays relay fees.** Leave headroom. A session pays fees only from its capped tokens; pass `feeToken` to add a stablecoin cap.
- **x402 payments are signed, not sent, by the session, so the session's daily spend caps do not bound them** (Altana changelog 1.1.0). Errand's own guard must cap x402 spend.
- Revoke is one transaction and monotonic (a revoked key can't be reactivated). Expiry needs no transaction.
- Persist sessions with `serializeSession` / `deserializeSession(stored, signer)`. Never `JSON.stringify` a `Session` (it holds the private key and bigints).
- `execute` returns `status: "CONFIRMED" | "FAILED" | "PENDING"` and **does not throw on failure**. Check `status`; `statusCode` 300–499 = relay rejected before inclusion, 500+ = on-chain failure. `client.quoteExecute` quotes the fee first.

### Costs

- A new wallet's first transaction pays the **KeyStore registration fee + relay fee in native CELO** from the wallet's balance. Unfunded, it throws. **Measured 23 Nov 2026:** `KeyStoreController.getRegistrationFeeInWei()` = 9.1047 CELO = $0.50 (a fixed $0.50 converted with Chainlink CELO/USD `0x0568fD19986748cEfF3301e55c0eb1E729E0Ab7e`, then 0.0549). The SDK sends fee + 10% (`REGISTRATION_FEE_MARGIN_PERCENT`) and the controller refunds the excess. The CELO amount moves with the CELO price; read it fresh.

### ERC-8004 auto-registration

On by default for a new wallet on Celo (name "Altana Agent"). Turn off with `agentIdentity: false` (client or per call), or pass `agentIdentity: { name, description, image, endpoint }`.

### x402 from a session

`client.fetchWithX402({ session, url })`. Rails: **permit2-exact** (any token approved to Permit2) and **exact / EIP-3009** (only for tokens whose EIP-3009 is ERC-1271-aware). A session paying over Permit2 needs two approvals (token → Permit2 as ERC-20 spender, and Permit2 as signature checker for the key); over EIP-3009, one. `grantSession` can make them in the same intent. Changelog 1.1.0: USD₮ on Celo serves the EIP-3009 rail, and a Celo mainnet fork test settles USDC, USD₮ and USA₮ on that rail.

### Open questions (test before relying on them)

| # | Question | Why it matters |
|---|---|---|
| A1 | Does a tag survive into the on-chain tx? The SDK has **no `dataSuffix` option**. A tag appended to an inner `call.data` ends up mid-calldata, not at the end of the UserOperation's `callData` | Untagged txs are never credited |
| A2 | Does the relay go through a standard EntryPoint `handleOps`? (`verifyTx` only decodes v0.6/v0.7 bundles) | Same |
| A3 | Can `sessionSigner` be a public-key-only signer (server holds the private key) when the user grants from the browser? `Signer` = `{ type, address, publicKey, signDigest }` | The user grants in the browser; Errand's server holds the agent key |
| A4 | ~~Real KeyStore registration cost on Celo mainnet~~ **Answered 23 Nov: $0.50 in CELO (9.10 CELO at $0.0549)** | Each independent user pays it from their own wallet |

Sources: https://docs.altana.network · https://github.com/altananetwork/altana-sdk (README.md, CHANGELOG.md, docs/pages/concepts/networks/index.mdx, concepts/sessions.mdx, concepts/keystore.mdx, sdk/grant-session.mdx, sdk/execute.mdx, sdk/x402.mdx, sdk/erc8004.mdx, sdk/errors.mdx, sdk/create-wallet.mdx, packages/wallet/src/internal/signer.ts)

---

## 6. Textile FX (RFQ API v2)

| Item | Value |
|---|---|
| Base URL | `https://api.textilecredit.com/v2` |
| Celo corridors (live) | cNGN, wARS, wBRL, wMXN, wCOP, COPM, IDRX, VGBP, VCHF, G$, USAT, USDC, CELO, WETH ↔ USDT; cNGN ↔ G$. **Hackathon corridors:** USD₮ ↔ cNGN, IDRX, wARS, wBRL, wMXN, wCOP |
| LimitOrderReactor (Celo) | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` |
| Fee controller (Celo) | `0x356f4FBe18893997D2F893AE8860eD6060b4521d` (taker fee 0.02% / 2 bps) |
| Minimum size | About $1 notional on mainnet (smaller returns 400) |
| Testnets | 97 (BSC) and 84532 (Base Sepolia) only. **No Celo testnet.** Test with real ~$1 swaps |

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/v2/rfq/preview` | Indicative price, free, nothing reserved, no credential |
| POST | `/v2/rfq/request` | Firm quote (blocks while makers respond) |
| POST | `/v2/rfq/{id}/submit` | Report the broadcast tx hash `{ "txHash": "0x…" }` (idempotent for the same hash; a different hash returns 409) |
| POST | `/v2/rfq/{id}/cancel` | Release a quote you won't execute (only while `quoted`) |
| GET | `/v2/rfq/{id}` | Status and settled amounts |

### `/request` body

`chainId` (42220) · `sellToken` · `buyToken` · exactly one of `sellAmount` (exact input, gross, fee-inclusive) or `buyAmount` (exact output), atomic units as strings · `taker` (wallet that signs and broadcasts; quote bound to it) · `takerProof` `{ nonce, issuedAt, signature }` (required on the first keyless request; ignored with an API key) · optional `preferredLiquidityWallets` / `restrictedLiquidityWallets` (max 10, mutually exclusive) · `includeAttribution` (partner keys only) · `builderCodes` (up to 3 codes, `a-z0-9_`, 1–32 chars; prefixes `textile_` and `tp_` reserved).

### Auth

- **Keyless:** `takerProof` = EIP-712 `TakerControl` v1 by default. `issuedAt` within 60 s of server time. One proof covers that wallet + chain for about 12 hours; then `401 proof_of_control_required`. Follow-up calls use the `X-Rfq-Claim` header (claim token, returned once only; store it).
- **API key:** `Authorization: Bearer tx_live_…` or `X-API-Key`. Replaces `takerProof`. "Your key makes you accountable for the `taker`." `tx_test_…` keys only work on 97 and 84532. Scopes `trades:write`, `trades:read`. Get one: https://fx-docs.textilecredit.com/api/how-to-get-an-api-key.html (optional per the Loops page: "quotes work with just a wallet").

### Response (firm quote)

`data.rfqId`, `data.claimToken`, `data.status` (`quoted`), `data.quote` { `sellAmount`, `buyAmount`, `feeAmount`, `takerPays`, `rateRay`, `expiresAt`, `orderDeadline`, `latestOrderDeadline`, `reactor`, `taker`, `encodedOrder`, `signature`, `orders[]` }, `data.transactions.approval` { to, data, value, chainId }, `data.transactions.swap` { to, data, value, chainId }, `data.routing`.
`no_quote` comes back as **HTTP 200** with `reason` = `no_makers_online` (back off) | `no_restricted_liquidity` | `no_valid_quote` (retry promptly); honour `retryAfterMs`.

### Execute on-chain (in this order)

1. If allowance < `takerPays`, approve `takerPays` of the sell token to `quote.reactor` with `transactions.approval`. USDT-style tokens may reject nonzero→nonzero approvals: reset to 0 first.
2. **Wait for the approval receipt.** Don't send approve and swap in the same block; the swap can revert.
3. If `now >= expiresAt`, request a new quote. Don't send.
4. Broadcast `transactions.swap` from the `taker` wallet with `value: "0"`. **Append Errand's attribution suffix to `transactions.swap.data`** (Loops FAQ) when not using `includeAttribution`. Always broadcast `transactions.swap`, even for split fills.
5. `POST /v2/rfq/{id}/submit` with the hash. Poll `GET /v2/rfq/{id}` (or use webhooks) until `filled`. `failed`/`expired` can flip to `filled` for up to 24 h.

Client timeout: **75 seconds** (worst case ~70 s on a cold corridor).

### Open questions

| # | Question |
|---|---|
| T1 | Keyless `takerProof` from an **Altana smart wallet**: the docs list EIP-712 `TakerControl`, the app's Proof of Funds v2, `eip191`, and `nonceSecret` proofs "for Safe and custody co-signing". ERC-1271 isn't mentioned. If it fails, use a Textile API key (no `takerProof`) |
| T2 | Live depth for USD₮→cNGN at Errand's sizes ($1–$20) |

Sources: https://fx-docs.textilecredit.com/api/v2/rfq.html · /api/v2/authentication.html · /protocol/address-book.html · /fees.html · / (corridors) · Loops FAQ

---

## 7. x402 on Celo (Celo-hosted facilitator)

| Item | Value |
|---|---|
| Mainnet facilitator | `https://api.x402.celo.org` (don't point a server at the dashboard x402.celo.org) |
| Endpoints | `POST /verify` (open; 60/min per IP without key), `POST /settle` (**needs API key**), `GET /supported`, `GET /health` |
| API key | Human connects a wallet at https://x402.celo.org → **Create API key** → sign (no gas). Shown once, starts with `x402_`. Store as `X402_API_KEY` on the server only |
| Pricing | Gas at cost + 0.3% of payment value (gas only for assets without a USD price). Free credits: **100 settlements on mainnet**, 1000 on testnet. Then deposit USDC/USD₮/USA₮ on the dashboard |
| Packages | `@x402/hono @x402/core @x402/evm viem` (seller) · `@x402/fetch @x402/evm viem` (buyer). `@x402/core` ≥ 2.23 for spend controls. **Legacy `x402-express`, `x402-fetch`, `x402-hono` have no Celo support** |
| PayTo | The seller's wallet that receives payments. No separate registration with the facilitator. **Register it with Loops House** (rule 4) |

### Assets (mainnet)

| Asset | Address | `extra.name` | `extra.version` | Decimals | Transfer |
|---|---|---|---|---|---|
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | `USDC` | `2` | 6 | eip3009 |
| USD₮ | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | `Tether USD` | `1` | 6 | eip3009 |
| USA₮ | `0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771` | `Tether America USD` | `1` | 6 | eip3009 |
| cNGN | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` | `cNGN` | `1` | 6 | permit2 |
| wARS / wBRL / wMXN / wCOP / wPEN / wCLP | see x402 config | `Peso Argentino` / `Real Brasileño` / `Peso Mexicano` / `Peso Colombiano` / `Sol Peruano` / `Peso Chileno` | `1` | 18 | permit2 |

Rules:
- `extra.name` is the **EIP-712 domain name, not the symbol**. Use the table; USD₮/USA₮ have no `version()`, and `eip712Domain()` reverts on every listed token.
- Always use an explicit `price: { amount, asset, extra }`. A bare `"$0.01"` throws or silently prices in USDC.
- Permit2 routes need `extra.assetTransferMethod: "permit2"`. wFIAT routes also need `extensions.eip2612GasSponsoring`. **cNGN must not have it**: cNGN has no EIP-2612, so a first-time payer must `approve(Permit2, amount)` on cNGN.
- Buyers: `client.setSpendControls(...)`. USDC/USDT/USAT allowed by default, capped at `"$1"` per payment. Permit2 assets must be added to `allowedAssets`.
- Use `paymentMiddleware(routes, server)` (v2 signature). Consecutive payments within seconds can race on the permit nonce and return 402 once: retry. Settlement takes ~2–3.5 s.

Seller skeleton (from the skill, Hono):
```ts
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
const facilitator = new HTTPFacilitatorClient({
  url: "https://api.x402.celo.org",
  createAuthHeaders: async () => { const h = { "X-API-Key": process.env.X402_API_KEY! }; return { verify: h, settle: h, supported: h }; },
});
const server = new x402ResourceServer(facilitator);
server.register("eip155:*", new ExactEvmScheme());
// routes: { "POST /check": { accepts: [{ scheme: "exact", network: "eip155:42220", payTo, price: { amount, asset, extra } }], description } }
app.use(paymentMiddleware(routes, server));
```

Sources: https://docs.celo.org/build-on-celo/build-with-ai/x402 · https://x402.celo.org/skill.md · https://x402.celo.org/llms.txt · https://x402.celo.org/api/config

---

## 8. buy (Celo Core Co. agent service marketplace)

| Item | Value |
|---|---|
| Install | `npm install -g @celo/buy` (Node 22+). usebuy.ai shows `@celo/buy@0.8.7`; npm `latest` showed 0.8.6 on 23 Nov. Use whatever `npm view @celo/buy version` says |
| Wallet | `buy setup --name <name>` creates a wallet in the OS keychain and prints its address. "No CELO is needed; the gateway pays gas" |
| Tokens | USDC (default), USD₮, USA₮ on Celo mainnet (`--token USAT`) |
| Call | `buy curl --max-amount <cap> ... https://gateway.usebuy.ai/...` (quote first; the 402 for the exact request is authoritative) |
| MCP | `buy mcp install --client all` (tool `buy_curl`) |
| Catalog | `https://gateway.usebuy.ai/v1/catalog` (price + input schema per capability) · health `https://gateway.usebuy.ai/health` |
| Services (snapshot 2026-10-13) | Google Cloud VMs, Instagram/TikTok/YouTube/Reddit/LinkedIn data, Cencori LLM inference ($0.01/completion), browser sessions, Chainstack Celo RPC ($0.01/request), SQD (free), Google Places/Routes/Address Validation. **No airtime, data, gift cards or FX** |
| Self | Some services (larger VMs, a demo quote route) need a Self proof of personhood |
| Free funds | The wallet owner verifies once with Self at Google Cloud's Celo faucet and claims free USA₮ (a human step) |
| Sandbox | Celo Sepolia, https://usebuy.ai/docs#sandbox |
| Hackathon | Optional. Paid calls from your agent count in your favour as real use |

Sources: https://usebuy.ai · https://usebuy.ai/llms.txt · npm `@celo/buy`

---

## 9. Agent Vault (stretch only)

What the docs say: the agent receives mock tokens (e.g. `av_card_1_number_u7x2k`) and drives a browser inside the Agent Vault proxy. At each fill the proxy checks your rules and types the real value into the merchant page. Logins fill only on their registered site, other details only on sites you authorised, cards only within an agent card's limits. Controls: caps per transaction/day/week/rolling 30 days, merchant blocking (allow-listing is Enterprise-only), approval above an amount, human handoff for bank checks/OTP/CAPTCHA, kill switch. Supported agents include Claude Code and Codex; any MCP client with streamable HTTP + OAuth.
**UNVERIFIED for Errand:** supported countries and card networks, x402-on-Celo details, pricing. Check before building. The track needs **real** purchases (kickoff stream: start with small amounts).

Source: https://docs.agentvault.io

---

## 10. Other links

| What | Link |
|---|---|
| Celopedia coding-agent skill | `npx skills add celo-org/celopedia-skills` (150+ verified contract addresses) |
| Celo docs: build with AI | https://docs.celo.org |
| cNGN | https://cngn.co |
| Ripio wFIAT ramps | https://ramp.ripio.com |
| Textile FX app | https://app.textilecredit.com |
| Loops agent skill | `npx loopshouse add agents-open-for-business` |
