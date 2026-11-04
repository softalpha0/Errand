import { serve } from "@hono/node-server";
import { env, reppoConfigured, servConfigured } from "./env";
import { log } from "./log";
import { startReppoWorker } from "./reppo";
import { createApp, VERSION } from "./server";
import { initStore } from "./store";

async function main() {
  await initStore();
  const app = createApp();
  serve({ fetch: app.fetch, port: env.port, hostname: "0.0.0.0" }, (info) => {
    log.info("agent.listening", {
      port: info.port,
      version: VERSION,
      mode: env.mode,
      serv: servConfigured() ? (env.serv.guardGraphId ? "graph" : "shadow-agent") : "scripted (demo only)",
      reppo: reppoConfigured() ? (env.reppo.sandbox ? "sandbox" : "live") : "off",
    });
  });
  startReppoWorker();
}

main().catch((err) => {
  log.error("agent.crashed", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
