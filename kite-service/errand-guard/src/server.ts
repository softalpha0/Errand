/**
 * Errand Guard: "should my agent make this payment?" as a paid x402 service on the Kite chain.
 *
 * The payment side is kite-x402-hono (https://github.com/BrKDDD/kite-x402-hono): it answers
 * POST /v1/check with a 402 challenge, verifies the buyer's payment, forwards the request to the
 * Errand agent's POST /check with a server-side secret header, and settles only when the agent
 * answers successfully. This file adds a free description at GET / and starts the server.
 */
import { Hono } from "hono";
import { createApp, loadConfig } from "kite-x402-hono";

const config = loadConfig();
const paid = createApp(config);

const app = new Hono();

app.get("/", (c) =>
  c.json({
    name: "Errand Guard",
    summary: "Ask before you pay. Send the task and the payment your agent is about to make; get approve, ask or block with a reason.",
    endpoint: "POST /v1/check",
    priceUsd: config.price,
    network: config.chain.network,
    discovery: "/.well-known/x402",
    health: "/healthz",
    source: "https://github.com/softalpha0/Errand/tree/main/kite-service/errand-guard",
  }),
);

app.route("/", paid);

const server = Bun.serve({
  port: config.port,
  fetch: (request, srv) => app.fetch(request, { clientIp: srv.requestIP(request)?.address ?? null }),
  maxRequestBodySize: config.maxBodyBytes,
  // Settlement can take a while; don't let Bun drop the connection mid-payment.
  idleTimeout: 0,
});
console.log(`Errand Guard on ${server.url} (${config.chain.network}), $${config.price} per check`);

const stop = () => {
  setTimeout(() => process.exit(0), 10_000).unref();
  void server.stop(false).finally(() => process.exit(0));
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
