import type { Errand } from "@errand/core";

/**
 * A snapshot of a real mainnet errand (receipt /r/e_My979K17, 5 Nov 2026): six payments through
 * Kite Passport, settled in USDC on Base. The phone number and email are masked; the live receipt has the full record.
 */
export const LIVE_ERRAND_ID = "e_My979K17";

export const LIVE_ERRAND = {
  "id": "e_My979K17",
  "kite": {
    "requestId": null,
    "sessionId": null,
    "approvalUrl": null,
    "approvedAt": "2026-11-05T18:54:10.809Z"
  },
  "mode": "live",
  "plan": {
    "steps": [
      {
        "id": "s1",
        "type": "buy.topup",
        "inputs": [
          {
            "key": "query",
            "value": "MTN"
          },
          {
            "key": "country",
            "value": "NG"
          },
          {
            "key": "recipient",
            "value": "+234 ••• ••• 0352"
          },
          {
            "key": "amountUsd",
            "value": "0.13"
          }
        ],
        "maxUsd": 0.137,
        "purpose": "Purchase MTN airtime for the recipient phone number in Nigeria.",
        "condition": ""
      },
      {
        "id": "s2",
        "type": "email.send",
        "inputs": [
          {
            "key": "to",
            "value": "me@example.com"
          },
          {
            "key": "subject",
            "value": "Receipt for MTN airtime top-up"
          }
        ],
        "maxUsd": 0.02,
        "purpose": "Email the receipt to the user after the airtime purchase.",
        "condition": ""
      }
    ],
    "summary": "Plan to buy NG MTN airtime for the supplied phone number and email the receipt to the supplied address, staying within budget.",
    "questions": [],
    "recipients": [
      {
        "email": "",
        "label": "mum",
        "phone": "+234 ••• ••• 0352"
      },
      {
        "email": "me@example.com",
        "label": "user",
        "phone": ""
      }
    ],
    "constraints": [
      "recipient: mum",
      "country: NG",
      "carrier: MTN",
      "price ceiling: NGN 200"
    ]
  },
  "task": "Send NGN 200 MTN airtime to my mum on +234 ••• ••• 0352, then email me the receipt at me@example.com.",
  "error": null,
  "steps": [
    {
      "note": "",
      "facts": [
        "Bitrefill product: MTN Nigeria (mtn-nigeria).",
        "Invoice 91b7be3a-f41f-4368-b220-b7fdc3371503: $0.08 for 100 NGN.",
        "Delivery: payment_confirmed / not_delivered."
      ],
      "output": {
        "product": "mtn-nigeria",
        "delivery": {
          "status": "payment_confirmed",
          "delivery": "not_delivered"
        },
        "priceUsd": 0.08,
        "purchase": "MTN Nigeria 100 NGN for $0.08 to +234706•••0352",
        "invoiceId": "91b7be3a-f41f-4368-b220-b7fdc3371503"
      },
      "status": "done",
      "stepId": "s1",
      "sources": [],
      "suggestions": []
    },
    {
      "note": "Emailed me@example.com.",
      "facts": [
        "Emailed the result to me@example.com."
      ],
      "status": "done",
      "stepId": "s2",
      "sources": [],
      "suggestions": []
    }
  ],
  "answer": {
    "text": "Done: I sent 100 NGN of MTN Nigeria airtime to +234706•••0352, and a copy is being emailed to me@example.com. I purchased MTN Nigeria 100 NGN for $0.08. The airtime was payment-confirmed but not delivered yet.",
    "citations": []
  },
  "events": [],
  "status": "done",
  "country": "NG",
  "funding": "session",
  "privacy": "private",
  "payments": [
    {
      "at": "2026-11-05T18:54:13.664Z",
      "id": "p_16NXhQOb",
      "url": "https://api.bitrefill.com/x402/topups/search?q=MTN&country=NG",
      "used": true,
      "chain": "eip155:8453",
      "method": "GET",
      "stepId": "s1",
      "txHash": "0x9325b08ba80b9a05be440a229c7e139cb7786de7663912f3d447360b504e9206",
      "amountUsd": 0.002,
      "simulated": false,
      "decisionId": "d_RB-65DfL",
      "endpointId": "bitrefill.topups.search",
      "explorerUrl": "https://basescan.org/tx/0x9325b08ba80b9a05be440a229c7e139cb7786de7663912f3d447360b504e9206",
      "requestHash": "3cc26279"
    },
    {
      "at": "2026-11-05T18:54:16.278Z",
      "id": "p_EW1f3WIQ",
      "url": "https://api.bitrefill.com/x402/products/detail?slug=mtn-nigeria",
      "used": true,
      "chain": "eip155:8453",
      "method": "GET",
      "stepId": "s1",
      "txHash": "0x439b13fab4f31acae28387427c61d51da367e413d07ce721e55e060108c2e32c",
      "amountUsd": 0.001,
      "simulated": false,
      "decisionId": "d_BEYernz6",
      "endpointId": "bitrefill.product.detail",
      "explorerUrl": "https://basescan.org/tx/0x439b13fab4f31acae28387427c61d51da367e413d07ce721e55e060108c2e32c",
      "requestHash": "8cbe56f9"
    },
    {
      "at": "2026-11-05T18:54:40.012Z",
      "id": "p_cl5y5krU",
      "url": "https://api.bitrefill.com/x402/invoice/create",
      "used": true,
      "chain": "eip155:8453",
      "method": "POST",
      "stepId": "s1",
      "txHash": "0x86a4160a67a9815af5386f4b4b8949abf41e6bd2e7f4bd6e1dbe696c23c2f115",
      "amountUsd": 0.002,
      "simulated": false,
      "decisionId": "d_GhPT49TK",
      "endpointId": "bitrefill.invoice.create",
      "explorerUrl": "https://basescan.org/tx/0x86a4160a67a9815af5386f4b4b8949abf41e6bd2e7f4bd6e1dbe696c23c2f115",
      "requestHash": "ff151aae"
    },
    {
      "at": "2026-11-05T18:55:19.107Z",
      "id": "p_WAB1cnZu",
      "url": "https://api.bitrefill.com/x402/invoice/pay",
      "used": true,
      "chain": "eip155:8453",
      "method": "POST",
      "stepId": "s1",
      "txHash": "0xc7861534e0a2e19948047654e3d8cbbefdab8e3c4628ef3edd6ae2cd39f428b1",
      "amountUsd": 0.08,
      "simulated": false,
      "decisionId": "d_DXr-lzaP",
      "endpointId": "bitrefill.invoice.pay",
      "explorerUrl": "https://basescan.org/tx/0xc7861534e0a2e19948047654e3d8cbbefdab8e3c4628ef3edd6ae2cd39f428b1",
      "requestHash": "5e85585d"
    },
    {
      "at": "2026-11-05T18:55:25.578Z",
      "id": "p_FkSg7TkY",
      "url": "https://api.bitrefill.com/x402/invoice/status?invoice_id=91b7be3a-f41f-4368-b220-b7fdc3371503",
      "used": true,
      "chain": "eip155:8453",
      "method": "GET",
      "stepId": "s1",
      "txHash": "0xe08a66f331fe5e8c72e1f05eadde1179c4d7692d5027ae3ac94ea4a227b2ef2e",
      "amountUsd": 0.001,
      "simulated": false,
      "decisionId": "d__UhNvRAk",
      "endpointId": "bitrefill.invoice.status",
      "explorerUrl": "https://basescan.org/tx/0xe08a66f331fe5e8c72e1f05eadde1179c4d7692d5027ae3ac94ea4a227b2ef2e",
      "requestHash": "ebe903be"
    },
    {
      "at": "2026-11-05T18:55:54.692Z",
      "id": "p_I87yyoqO",
      "url": "https://stableemail.dev/api/send",
      "used": null,
      "chain": "eip155:8453",
      "method": "POST",
      "stepId": "s2",
      "txHash": "0x85b183117a338d48406335ac2bf9614c396908461a5ba4ab41a627fd10bf510a",
      "amountUsd": 0.02,
      "simulated": false,
      "decisionId": "d_OOcQa-_E",
      "endpointId": "email.send",
      "explorerUrl": "https://basescan.org/tx/0x85b183117a338d48406335ac2bf9614c396908461a5ba4ab41a627fd10bf510a",
      "requestHash": "7099afd4"
    }
  ],
  "validFor": "1h",
  "budgetUsd": 2,
  "createdAt": "2026-11-05T18:53:13.640Z",
  "decisions": [
    {
      "at": "2026-11-05T18:54:11.049Z",
      "id": "d_RB-65DfL",
      "rule": "rules.pass",
      "reason": "All rule checks passed.",
      "source": "rules",
      "decision": "approve",
      "candidate": {
        "url": "https://api.bitrefill.com/x402/topups/search?q=MTN&country=NG",
        "note": "Seller quoted $0.002 before payment.",
        "method": "GET",
        "origin": "plan",
        "stepId": "s1",
        "priceUsd": 0.002,
        "endpointId": "bitrefill.topups.search"
      },
      "servModel": null,
      "servRequestId": null
    },
    {
      "at": "2026-11-05T18:54:13.738Z",
      "id": "d_BEYernz6",
      "rule": "rules.pass",
      "reason": "All rule checks passed.",
      "source": "rules",
      "decision": "approve",
      "candidate": {
        "url": "https://api.bitrefill.com/x402/products/detail?slug=mtn-nigeria",
        "note": "Seller quoted $0.001 before payment.",
        "method": "GET",
        "origin": "plan",
        "stepId": "s1",
        "priceUsd": 0.001,
        "endpointId": "bitrefill.product.detail"
      },
      "servModel": null,
      "servRequestId": null
    },
    {
      "at": "2026-11-05T18:54:36.035Z",
      "id": "d_GhPT49TK",
      "rule": "rules.pass",
      "reason": "All rule checks passed.",
      "source": "rules",
      "decision": "approve",
      "candidate": {
        "url": "https://api.bitrefill.com/x402/invoice/create",
        "body": {
          "items": [
            {
              "product_id": "mtn-nigeria",
              "refill_input": "+234 ••• ••• 0352",
              "package_value": "100"
            }
          ]
        },
        "note": "Seller quoted $0.002 before payment.",
        "method": "POST",
        "origin": "plan",
        "stepId": "s1",
        "priceUsd": 0.002,
        "endpointId": "bitrefill.invoice.create"
      },
      "servModel": null,
      "servRequestId": null
    },
    {
      "at": "2026-11-05T18:54:54.039Z",
      "id": "d_THsOKEVF",
      "rule": "serv.graph",
      "reason": "Please confirm that you want me to purchase 100 NGN of MTN airtime for +234 ••• ••• 0352 for $0.08.",
      "source": "serv",
      "decision": "ask",
      "candidate": {
        "url": "https://api.bitrefill.com/x402/invoice/pay",
        "body": {
          "invoice_id": "91b7be3a-f41f-4368-b220-b7fdc3371503"
        },
        "note": "MTN Nigeria 100 NGN for +234706•••0352",
        "method": "POST",
        "origin": "plan",
        "stepId": "s1",
        "priceUsd": 0.08,
        "recipient": "+234 ••• ••• 0352",
        "endpointId": "bitrefill.invoice.pay",
        "plannedProductUsd": 0.13
      },
      "servModel": "gr_51782a843582d99d",
      "servRequestId": "d31f5bb8-7fa9-4674-9f94-29680cb387d7"
    },
    {
      "at": "2026-11-05T18:55:16.660Z",
      "id": "d_DXr-lzaP",
      "rule": "user.answer",
      "reason": "You confirmed this payment.",
      "source": "rules",
      "decision": "approve",
      "candidate": {
        "url": "https://api.bitrefill.com/x402/invoice/pay",
        "body": {
          "invoice_id": "91b7be3a-f41f-4368-b220-b7fdc3371503"
        },
        "note": "MTN Nigeria 100 NGN for +234706•••0352",
        "method": "POST",
        "origin": "plan",
        "stepId": "s1",
        "priceUsd": 0.08,
        "recipient": "+234 ••• ••• 0352",
        "endpointId": "bitrefill.invoice.pay",
        "plannedProductUsd": 0.13
      },
      "servModel": "gr_51782a843582d99d",
      "servRequestId": "d31f5bb8-7fa9-4674-9f94-29680cb387d7"
    },
    {
      "at": "2026-11-05T18:55:19.336Z",
      "id": "d__UhNvRAk",
      "rule": "rules.pass",
      "reason": "All rule checks passed.",
      "source": "rules",
      "decision": "approve",
      "candidate": {
        "url": "https://api.bitrefill.com/x402/invoice/status?invoice_id=91b7be3a-f41f-4368-b220-b7fdc3371503",
        "note": "Seller quoted $0.001 before payment.",
        "method": "GET",
        "origin": "plan",
        "stepId": "s1",
        "priceUsd": 0.001,
        "endpointId": "bitrefill.invoice.status"
      },
      "servModel": null,
      "servRequestId": null
    },
    {
      "at": "2026-11-05T18:55:41.558Z",
      "id": "d_-ebX7O2F",
      "rule": "serv.graph",
      "reason": "Please confirm whether I should email this receipt for 100 NGN of MTN airtime, since you requested 200 NGN.",
      "source": "serv",
      "decision": "ask",
      "candidate": {
        "url": "https://stableemail.dev/api/send",
        "body": {
          "to": [
            "me@example.com"
          ],
          "text": "Done: I sent 100 NGN of MTN Nigeria airtime to +234706•••0352, and a copy is being emailed to me@example.com. I purchased MTN Nigeria 100 NGN for $0.08. The airtime was payment-confirmed but not delivered yet.\n\nReceipt: https://errand-pearl.vercel.app/r/e_My979K17\n\nSent by Errand. Every payment behind this message was checked before it was made.",
          "subject": "Receipt for MTN airtime top-up"
        },
        "note": "Seller quoted $0.02 before payment.",
        "method": "POST",
        "origin": "plan",
        "stepId": "s2",
        "priceUsd": 0.02,
        "recipient": "me@example.com",
        "endpointId": "email.send"
      },
      "servModel": "gr_51782a843582d99d",
      "servRequestId": "d8d17f5d-0c1d-4940-86ba-871dea649490"
    },
    {
      "at": "2026-11-05T18:55:51.714Z",
      "id": "d_OOcQa-_E",
      "rule": "user.answer",
      "reason": "You confirmed this payment.",
      "source": "rules",
      "decision": "approve",
      "candidate": {
        "url": "https://stableemail.dev/api/send",
        "body": {
          "to": [
            "me@example.com"
          ],
          "text": "Done: I sent 100 NGN of MTN Nigeria airtime to +234706•••0352, and a copy is being emailed to me@example.com. I purchased MTN Nigeria 100 NGN for $0.08. The airtime was payment-confirmed but not delivered yet.\n\nReceipt: https://errand-pearl.vercel.app/r/e_My979K17\n\nSent by Errand. Every payment behind this message was checked before it was made.",
          "subject": "Receipt for MTN airtime top-up"
        },
        "note": "Seller quoted $0.02 before payment.",
        "method": "POST",
        "origin": "plan",
        "stepId": "s2",
        "priceUsd": 0.02,
        "recipient": "me@example.com",
        "endpointId": "email.send"
      },
      "servModel": "gr_51782a843582d99d",
      "servRequestId": "d8d17f5d-0c1d-4940-86ba-871dea649490"
    }
  ],
  "questions": [
    {
      "at": "2026-11-05T18:54:16.288Z",
      "id": "q_dbZX0dh7",
      "text": "Which MTN Nigeria package should I buy? Your limit for it is $0.13.",
      "answer": "100 NGN",
      "context": "Purchase MTN airtime for the recipient phone number in Nigeria.",
      "options": [
        "5 NGN",
        "10 NGN",
        "20 NGN",
        "50 NGN",
        "100 NGN",
        "200 NGN",
        "500 NGN",
        "1000 NGN"
      ]
    },
    {
      "at": "2026-11-05T18:54:54.048Z",
      "id": "q_azwc8z3C",
      "text": "Please confirm that you want me to purchase 100 NGN of MTN airtime for +234 ••• ••• 0352 for $0.08. Pay $0.08 to Bitrefill?",
      "answer": "Pay it",
      "context": "Step: Purchase MTN airtime for the recipient phone number in Nigeria.",
      "options": [
        "Pay it",
        "Don't pay"
      ]
    },
    {
      "at": "2026-11-05T18:55:41.567Z",
      "id": "q_kH1aI8-T",
      "text": "Please confirm whether I should email this receipt for 100 NGN of MTN airtime, since you requested 200 NGN. Pay $0.02 to StableEmail?",
      "answer": "Pay it",
      "context": "Step: Email the receipt to the user after the airtime purchase.",
      "options": [
        "Pay it",
        "Don't pay"
      ]
    }
  ],
  "updatedAt": "2026-11-05T18:55:54.709Z",
  "evaluation": null,
  "passportId": "pp_hO9UKNbrCNI",
  "standingId": null,
  "askAboveUsd": null,
  "guardVersion": "guard-v2",
  "maxPerPaymentUsd": 1
} as unknown as Errand;
