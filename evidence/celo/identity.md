# Errand agent identity (Celo mainnet)

Public facts only. The agent's private key lives in `.self/agent.key` on Benjamin's machine (git-ignored) and in his offline backup. Never in the repo, chat, or evidence.

## Agent wallet

| | |
|---|---|
| Address | `0xc64d2153Bd39053913667A5c2eec8250d8AbC005` |
| Created by | Self Agent ID CLI `@selfxyz/agent-sdk` 0.3.1, `register init --mode wallet-free --minimum-age 18 --network mainnet` (the key is generated locally) |
| Roles (AGENTS.md → Decisions, PRD §5) | Session signer on users' Altana wallets · ERC-8004 owner · Errand Guard PayTo · Loops agent wallet |
| Celoscan | https://celoscan.io/address/0xc64d2153Bd39053913667A5c2eec8250d8AbC005 |

## Self Agent ID (done 23 Nov 2026)

| | |
|---|---|
| Registry | `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` (Self Agent ID, Celo mainnet 42220) |
| agentId | **214** (soulbound NFT; `ownerOf(214)` = the agent address, checked on forno 23 Nov) |
| Registration tx | [`0xe46d880c3de064bc578effbc8f01cd430d0f665b231630cc3e95984a67296fb9`](https://celoscan.io/tx/0xe46d880c3de064bc578effbc8f01cd430d0f665b231630cc3e95984a67296fb9) · block 83527059 · 2026-11-23T09:56:57Z |
| Sent by | Self's relayer `0xa848b04b78e359d29ed3017314d6953deff3c07f` (Self pays the gas). Not an Errand transaction, so it carries no Errand tag |
| Status (`SelfAgent.getAgentInfo(214)`, mainnet API) | `isVerified: true`, `hasHumanProof: true`, `isProofFresh: true`, `strengthLabel: passport`, `verificationStrength: 100` |
| Disclosures | `olderThan: 18` only. No nationality, no name, OFAC not requested |
| Proof expires | 2027-11-23T09:56:57Z |
| Human verification | Benjamin's passport in the Self app (zero-knowledge proof; no passport data on chain) |

## ERC-8004 canonical registry

Not done yet (Phase 2): `register(agentURI)` on `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` from the agent address, tagged `celo_511bb691f2f0`. Needs a little CELO on the agent address for gas.
