# First real errand on the live site (Celo mainnet)

25 Nov 2026, 22:27 UTC (23:27 Lagos). Run inside the **MiniPay** app ("Mini App Test" → https://errand-thgw.vercel.app/errand) by a person **outside the team**, from their own MiniPay wallet funded with their own USD₮ (user 1; name pending their consent). The recipient is a second person outside the team (MetaMask wallet on Celo).

| | |
|---|---|
| Payer (user 1, independent) | `0xd80fc279ba93ec7a89c9daf8b1e430770b13d57c` |
| Recipient (outside the team) | `0x82ac58F4BE1BB904bbe99Eb6f97Bf526A43806ED` |
| Errand | exactly **₦2,000 cNGN** (exact-output quote) |
| Cost | 1.387379 USD₮ (Textile fee 0.000277 included); network fees paid in USD₮ via the adapter, about $0.006 net in total |
| Textile RFQ | `rfq_QoLfOy6xctjILf6f`, filled |

## Transactions (read back from forno.celo.org on 25 Nov with `assertTagged`)

| Step | Tx | Status | Tag | Network fee in |
|---|---|---|---|---|
| USD₮ approval for Textile | [`0xed7cea6c…7a21b5b`](https://celoscan.io/tx/0xed7cea6c68f20c2cf33d9b3d54d24a23142ebddad4da14ed7d65962a27a21b5b) | success | `celo_511bb691f2f0` | USD₮ adapter `0x0e2a…6f72` |
| Conversion on Textile FX | [`0x1a260a0d…f4a004e`](https://celoscan.io/tx/0x1a260a0db329d452ed7c25d48c7e83bc6c217e8a37c2c5f50b0d6975df4a004e) | success | `celo_511bb691f2f0` | USD₮ adapter |
| Payment to the recipient | [`0xbc98dba3…fd1e4e7`](https://celoscan.io/tx/0xbc98dba3494297855374c797b939fc761964de23d119ab86f9e2541a1fd1e4e7) | success | `celo_511bb691f2f0` | USD₮ adapter |
| Errand's tool call on buy ($0.01, tools wallet → buy) | [`0xa0ac79b7…6e91304`](https://celoscan.io/tx/0xa0ac79b7c953592e46bdd84a11c9f2250171189a8bffbc42543727e796e91304) | success | none (x402 settlement, sent by buy's facilitator) | CELO (facilitator) |

Token movements in those txs: payer → Textile maker `0xa601…ba40` 1.387102 USD₮ + 0.000277 USD₮ fee; maker → payer 2,000 cNGN; payer → recipient 2,000 cNGN. Recipient's cNGN balance after: 2,000. Tools wallet `0x18aE…fFb6` → buy payTo `0x20fa…333B` 0.01 USD₮.

Independent check (Chainstack Celo RPC bought on buy) confirmed all 3 errand txs succeeded and carry the tag. Shareable receipt: the link the user shared (the receipt page re-checks every line on Celo when opened).

Notes
- First attempt (~22:09 UTC) stopped at the approval before anything was sent ("reading '_request'" bug, fixed in `405570f`); no money moved.
- Not under an Altana session yet (Q2): the user confirmed each tx in MiniPay.
- Independent-user rule: Benjamin confirmed on 25 Nov that he sent the payer no money; the payer funded their own MiniPay wallet. The recipient confirmed receiving the ₦2,000.
