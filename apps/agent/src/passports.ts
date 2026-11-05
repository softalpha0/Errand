/**
 * Each person connects their own Kite Passport.
 *
 * The person types their email, Kite emails them an 8-character code (the same
 * `kpass login init` / `login verify` flow Kite's authenticate-user skill uses),
 * and Errand keeps that login in a folder of its own. Errands they start are
 * paid from their wallet, with sessions approved by their passkey, never from
 * the operator's Passport.
 *
 * Errand gives the browser a random token for the connection and stores only
 * its SHA-256 hash. Logging out runs `kpass logout` and deletes the folder.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import type { AllowanceStatus, PassportPublic, ShippingInput } from "@errand/core";
import { env } from "./env";
import * as kite from "./kite";
import { log } from "./log";
import { store } from "./store";

interface PassportRecord {
  id: string;
  email: string;
  state: "pending" | "connected";
  createdAt: string;
  connectedAt: string | null;
  simulated: boolean;
  loginId: string | null;
  loginExpiresAt: string | null;
  tokenHash: string | null;
  walletAddress: string | null;
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const newId = () => `pp_${randomBytes(8).toString("base64url")}`;

export function passportHome(id: string): string {
  // ids are generated here (pp_ + base64url), never taken from a request path, but keep them inside the folder anyway.
  const safe = id.replace(/[^A-Za-z0-9_-]/g, "");
  return path.join(env.kite.passportsDir, safe);
}

const SIMULATED_ALLOWANCE: AllowanceStatus = {
  state: "active",
  amount: 5,
  period: "week",
  spent: 0,
  left: 5,
  resetAt: null,
  dashboardUrl: "https://agentpassport.ai/overview",
  userMessage: "Simulated allowance (demo mode): $5 a week. No money moves in demo mode.",
};

export async function startLogin(email: string): Promise<{ passportId: string; expiresAt: string | null; simulated: boolean }> {
  const id = newId();
  const rec: PassportRecord = {
    id,
    email: email.trim().toLowerCase(),
    state: "pending",
    createdAt: new Date().toISOString(),
    connectedAt: null,
    simulated: env.mode === "demo",
    loginId: null,
    loginExpiresAt: null,
    tokenHash: null,
    walletAddress: null,
  };
  if (env.mode === "live") {
    const home = passportHome(id);
    // A project-local `.kite-passport/` folder keeps this login apart from every other one.
    mkdirSync(path.join(home, ".kite-passport"), { recursive: true });
    const r = await kite.loginInit(rec.email, home);
    if (!r.loginId) throw new Error("Kite did not start a login. Check the email address and try again.");
    rec.loginId = r.loginId;
    rec.loginExpiresAt = r.expiresAt;
  } else {
    rec.loginId = `login_demo_${randomBytes(4).toString("hex")}`;
  }
  await store.putDoc("passport", id, rec);
  return { passportId: id, expiresAt: rec.loginExpiresAt, simulated: rec.simulated };
}

export async function verifyLogin(passportId: string, code: string): Promise<{ token: string; passport: PassportPublic }> {
  const rec = await store.getDoc<PassportRecord>("passport", passportId);
  if (!rec || rec.state !== "pending" || !rec.loginId) throw new Error("That login has expired. Start again with your email.");
  if (!/^[A-Za-z0-9]{8}$/.test(code.trim())) throw new Error("The code from Kite's email has 8 letters and numbers.");

  if (!rec.simulated) {
    const home = passportHome(rec.id);
    await kite.loginVerify(rec.loginId, code.trim(), home);
    // The login must have landed in this person's folder, not the operator's home folder.
    const saved = path.join(home, ".kite-passport");
    if (!existsSync(saved) || readdirSync(saved).length === 0) {
      await kite.logout(home).catch(() => undefined);
      throw new Error("Kite saved the login outside this person's folder, so Errand refused to use it. See docs/kite-integration.md, 'Each person's own Passport'.");
    }
    await kite.registerAgent(home).catch((err) => log.warn("passport.register_failed", { id: rec.id, error: String(err) }));
    rec.walletAddress = await kite.walletAddress(home).catch(() => null);
  }

  const token = randomBytes(32).toString("base64url");
  rec.state = "connected";
  rec.connectedAt = new Date().toISOString();
  rec.tokenHash = hash(token);
  rec.loginId = null;
  await store.putDoc("passport", rec.id, rec);
  log.info("passport.connected", { id: rec.id, simulated: rec.simulated });
  return { token, passport: await publicView(rec) };
}

async function byToken(token: string | undefined | null): Promise<PassportRecord | null> {
  if (!token) return null;
  const h = hash(token);
  const all = await store.listDocs<PassportRecord>("passport");
  return all.find((r) => r.state === "connected" && r.tokenHash === h) ?? null;
}

/** The connected Passport for a request's x-passport-token header, or null. Throws if a token was sent but is unknown. */
export async function resolve(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const rec = await byToken(token);
  if (!rec) throw new Error("Your Kite Passport connection has expired. Connect it again.");
  return rec.id;
}

export async function isSimulated(passportId: string): Promise<boolean> {
  return (await store.getDoc<PassportRecord>("passport", passportId))?.simulated ?? true;
}

export async function allowanceFor(passportId: string | null): Promise<AllowanceStatus> {
  if (env.mode === "demo") return SIMULATED_ALLOWANCE;
  return kite.allowanceStatus(passportId ? passportHome(passportId) : null);
}

async function publicView(rec: PassportRecord): Promise<PassportPublic> {
  let allowance: AllowanceStatus | null = null;
  try {
    allowance = rec.simulated ? SIMULATED_ALLOWANCE : await kite.allowanceStatus(passportHome(rec.id));
  } catch (err) {
    log.warn("passport.allowance_failed", { id: rec.id, error: String(err) });
  }
  return { id: rec.id, email: rec.email, connectedAt: rec.connectedAt ?? rec.createdAt, simulated: rec.simulated, walletAddress: rec.walletAddress, allowance };
}

export async function me(token: string | undefined | null): Promise<PassportPublic | null> {
  const rec = await byToken(token);
  return rec ? publicView(rec) : null;
}

export async function updateShipping(token: string | undefined | null, s: ShippingInput): Promise<{ complete: boolean; missing: string[] }> {
  const rec = await byToken(token);
  if (!rec) throw new Error("Connect your Kite Passport first.");
  if (rec.simulated) return { complete: true, missing: [] };
  // Sent straight to Kite. Errand does not store the address.
  const r = await kite.shopShippingUpdate(s, passportHome(rec.id));
  return { complete: r.complete, missing: r.missing };
}

export async function disconnect(token: string | undefined | null): Promise<boolean> {
  const rec = await byToken(token);
  if (!rec) return false;
  if (!rec.simulated) {
    const home = passportHome(rec.id);
    await kite.logout(home).catch(() => undefined);
    rmSync(home, { recursive: true, force: true });
  }
  rec.state = "pending";
  rec.tokenHash = null;
  await store.putDoc("passport", rec.id, rec);
  return true;
}
