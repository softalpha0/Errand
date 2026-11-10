/**
 * Telegram front end. Send the bot an errand in plain words; it shows the plan,
 * sends the Kite Passport approval link (or an Approve button in demo mode and
 * for allowance plans), asks questions with buttons, and replies with the answer
 * and the receipt link. Every payment goes through the same guard as the web app.
 *
 * Setup: create a bot with @BotFather and set TELEGRAM_BOT_TOKEN.
 *
 * Who pays for a chat's errands:
 *   1. A Telegram account linked to a Kite Passport (one-time code from the website's
 *      Connect page, or the bot's deep link) pays from that person's own wallet, with
 *      their own passkey approving each session. Anyone can do this, on a live site too.
 *   2. Otherwise, people listed in TELEGRAM_ALLOWED_USERS use Errand's own Passport.
 *   3. In demo mode with an empty list, everyone can try it (payments are simulated).
 *   Anyone else is asked to link their Passport first.
 *
 * Uses the Telegram Bot API over long polling (getUpdates), so no public webhook is needed.
 */
import { formatUsd, type Errand } from "@errand/core";
import { subscribe } from "./bus";
import { env } from "./env";
import { log } from "./log";
import { normalizeLinkCode, passportForTelegram, redeemTelegramLink, unlinkTelegram } from "./passports";
import { answerQuestion, approveDemo, cancelErrand, createErrand } from "./runner";
import { store } from "./store";

const API = () => `${env.telegram.apiBase}/bot${env.telegram.token}`;

interface TgUser { id: number; username?: string; first_name?: string }
interface TgMessage { message_id: number; chat: { id: number }; from?: TgUser; text?: string }
interface TgCallback { id: string; from: TgUser; message?: TgMessage; data?: string }
interface TgUpdate { update_id: number; message?: TgMessage; callback_query?: TgCallback }

type Button = { text: string; callback_data: string };

async function call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${API()}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) log.warn("telegram.api_error", { method, description: json.description });
    return json.ok ? (json.result ?? null) : null;
  } catch (err) {
    log.warn("telegram.network", { method, error: String(err) });
    return null;
  }
}

function send(chatId: number, text: string, buttons?: Button[][]) {
  return call("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4000),
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

function listed(u: TgUser): boolean {
  const list = env.telegram.allowed;
  return list.includes(String(u.id)) || (!!u.username && list.includes(u.username.toLowerCase()));
}

type Payer = { ok: true; passportId: string | null; label: string } | { ok: false };

/** Whose wallet pays for this person's errands, or not allowed. */
async function payerFor(u: TgUser | undefined): Promise<Payer> {
  if (!u) return { ok: false };
  const linked = await passportForTelegram(u.id);
  if (linked) return { ok: true, passportId: linked.id, label: `your Kite Passport (${linked.email})` };
  if (listed(u)) return { ok: true, passportId: null, label: env.mode === "demo" ? "a simulated wallet (demo)" : "Errand's own Kite Passport" };
  if (env.mode === "demo" && env.telegram.allowed.length === 0) return { ok: true, passportId: null, label: "a simulated wallet (demo)" };
  return { ok: false };
}

function connectUrl() {
  return `${env.webOrigin.split(",")[0]}/connect`;
}

const NOT_LINKED = () =>
  `To run errands here, link your Kite Passport so they're paid from your own wallet:\n\n1. Open ${connectUrl()}\n2. Connect your Kite Passport (Kite emails you a code)\n3. Tap "Link Telegram" and send me the code it shows.\n\nEvery spending session still needs your passkey.`;

let myUsername: string | null = null;

/** The bot's @username (from getMe), for deep links on the Connect page. */
export function botUsername(): string | null {
  return myUsername;
}

const HELP = `Send me an errand in plain words, for example:

• Find a 7-day Ghana eSIM and buy the cheapest under $8
• Is a $12 Spotify gift card a good birthday present for a 15-year-old?
• $2 What do people in Lagos say about MTN vs Airtel data?

Start with an amount like "$2" to set the budget (default ${formatUsd(env.telegram.budgetUsd)}).
I'll show you the plan and every payment decision. /stop cancels the current errand.
/link CODE links your Kite Passport (get the code on the website's Connect page) · /me shows whose wallet pays · /unlink`;

// chat -> latest errand, and free-text questions waiting for a reply
const latest = new Map<number, string>();
const pendingText = new Map<number, { errandId: string; questionId: string }>();

function receiptUrl(id: string) {
  return `${env.webOrigin.split(",")[0]}/r/${id}`;
}

function liveUrl(id: string) {
  return `${env.webOrigin.split(",")[0]}/e/${id}`;
}

/** Follow one errand and turn its new events into messages. */
function follow(chatId: number, errandId: string) {
  let seen = 0;
  let off: (() => void) | null = null;
  const onUpdate = (e: Errand) => {
    const fresh = e.events.slice(seen);
    seen = e.events.length;
    for (const ev of fresh) {
      if (ev.type === "plan_ready" && e.plan) {
        const lines = e.plan.steps.map((s, i) => `${i + 1}. ${s.purpose} (up to ${formatUsd(s.maxUsd)})`);
        void send(chatId, `Plan: ${e.plan.summary}\n\n${lines.join("\n")}${e.plan.constraints.length ? `\n\nChecked against: ${e.plan.constraints.join(" · ")}` : ""}`);
      } else if (ev.type === "awaiting_approval") {
        const url = (ev.data as { approvalUrl?: string } | undefined)?.approvalUrl;
        if (url) void send(chatId, `${ev.message}\n\nApprove with your passkey: ${url}`);
        else void send(chatId, `${ev.message}${e.mode === "demo" ? "\n\n(Demo mode: payments are simulated.)" : ""}`, [[{ text: "Approve", callback_data: `ap:${e.id}` }, { text: "Cancel", callback_data: `cx:${e.id}` }]]);
      } else if (ev.type === "question") {
        const d = ev.data as { questionId: string; options: string[] };
        if (d.options.length) {
          void send(chatId, ev.message, [d.options.slice(0, 4).map((o, i) => ({ text: o.slice(0, 40), callback_data: `q:${e.id}:${d.questionId}:${i}` }))]);
        } else {
          pendingText.set(chatId, { errandId: e.id, questionId: d.questionId });
          void send(chatId, `${ev.message}\n\nReply to this message with your answer.`);
        }
      } else if (ev.type === "decision" && /^(Blocked|Needs you)/.test(ev.message)) {
        void send(chatId, ev.message);
      } else if (ev.type === "payment") {
        void send(chatId, ev.message);
      } else if (ev.type === "answer" && e.answer) {
        void send(chatId, `${e.answer.text}\n\nReceipt: ${receiptUrl(e.id)}`);
      } else if (ev.type === "error") {
        void send(chatId, `Stopped: ${ev.message}`);
      }
    }
    if (["done", "failed", "cancelled"].includes(e.status)) {
      if (e.status === "done") void send(chatId, `Done. Spent ${formatUsd(e.payments.reduce((a, p) => a + p.amountUsd, 0))} of ${formatUsd(e.budgetUsd)}.`);
      off?.();
    }
  };
  off = subscribe(errandId, onUpdate);
  void store.get(errandId).then((e) => e && onUpdate(e));
}

async function startErrand(chatId: number, text: string, payer: Extract<Payer, { ok: true }>) {
  const m = text.match(/^\s*\$(\d+(\.\d+)?)\s+/);
  const budgetUsd = Math.min(m ? Number(m[1]) : env.telegram.budgetUsd, env.maxBudgetUsd);
  const task = m ? text.slice(m[0].length) : text;
  if (task.trim().length < 8) return send(chatId, HELP);
  const e = await createErrand({
    task: task.trim(),
    budgetUsd,
    maxPerPaymentUsd: env.telegram.maxPerPaymentUsd > 0 ? Math.min(env.telegram.maxPerPaymentUsd, budgetUsd) : budgetUsd,
    validFor: "1h",
    askAboveUsd: null,
    privacy: "public",
    network: "mainnet",
  }, { passportId: payer.passportId });
  latest.set(chatId, e.id);
  await send(chatId, `Planning with SERV… Budget ${formatUsd(budgetUsd)}, paid from ${payer.label}. Follow along: ${liveUrl(e.id)}`);
  follow(chatId, e.id);
}

async function onMessage(m: TgMessage) {
  const text = m.text?.trim() ?? "";
  if (!text || !m.from) return;

  // Linking works for anyone: /start CODE (deep link), /link CODE or "LINK CODE".
  const link = text.match(/^(?:\/start|\/link|link)\s+([A-Za-z0-9-]{6,20})$/i);
  if (link) {
    const r = await redeemTelegramLink(normalizeLinkCode(link[1]!), { id: m.from.id, username: m.from.username ?? null });
    return void send(
      m.chat.id,
      r
        ? `Linked to your Kite Passport (${r.email}). Errands you send here are paid from your own wallet, and each spending session still needs your passkey.\n\n${HELP}`
        : "That code didn't work. Codes work once and for 10 minutes: get a new one on the Connect page.",
    );
  }
  if (/^\/unlink$/i.test(text)) {
    const ok = await unlinkTelegram({ telegramUserId: m.from.id });
    return void send(m.chat.id, ok ? "Unlinked. This chat can no longer pay from your Kite Passport." : "This chat isn't linked to a Kite Passport.");
  }

  const payer = await payerFor(m.from);
  if (text === "/start" || text === "/help") return void send(m.chat.id, payer.ok ? HELP : NOT_LINKED());
  if (!payer.ok) return void send(m.chat.id, NOT_LINKED());
  if (/^\/me$/i.test(text)) return void send(m.chat.id, `Errands from this chat are paid from ${payer.label}.`);
  if (text === "/stop") {
    const id = latest.get(m.chat.id);
    const ok = id ? await cancelErrand(id) : false;
    return void send(m.chat.id, ok ? "Cancelled. Nothing else will be paid." : "No errand is running.");
  }
  const waiting = pendingText.get(m.chat.id);
  if (waiting) {
    pendingText.delete(m.chat.id);
    const ok = await answerQuestion(waiting.errandId, waiting.questionId, text.slice(0, 500));
    if (ok) return;
  }
  await startErrand(m.chat.id, text.replace(/^\/errand\s*/, ""), payer);
}

/** Only the person whose wallet pays can approve, answer or cancel that errand. */
async function mayAct(u: TgUser, errandId: string): Promise<boolean> {
  const e = await store.get(errandId);
  const payer = await payerFor(u);
  return !!e && payer.ok && e.passportId === payer.passportId;
}

async function onCallback(q: TgCallback) {
  const chatId = q.message?.chat.id;
  const data = q.data ?? "";
  const errandId = data.split(":")[1] ?? "";
  if (!chatId || !(await mayAct(q.from, errandId))) return void call("answerCallbackQuery", { callback_query_id: q.id, text: "Only the person paying for this errand can do that." });
  let note = "";
  if (data.startsWith("ap:")) {
    note = (await approveDemo(data.slice(3))) ? "Approved." : "Not waiting for approval.";
  } else if (data.startsWith("cx:")) {
    note = (await cancelErrand(data.slice(3))) ? "Cancelled." : "Already finished.";
  } else if (data.startsWith("q:")) {
    const [, errandId, questionId, idx] = data.split(":");
    const e = errandId ? await store.get(errandId) : null;
    const question = e?.questions.find((x) => x.id === questionId);
    const option = question?.options[Number(idx)];
    note = option && (await answerQuestion(errandId!, questionId!, option)) ? `You chose: ${option}` : "That question has already been answered.";
  }
  await call("answerCallbackQuery", { callback_query_id: q.id, text: note.slice(0, 190) });
  if (note) await send(chatId, note);
}

let running = false;

export function startTelegramBot() {
  if (!env.telegram.token || running) return;
  running = true;
  log.info("telegram.started", {
    linkedPassports: "anyone who links their own Kite Passport",
    errandWallet: env.telegram.allowed.length ? `${env.telegram.allowed.length} listed user(s)` : env.mode === "demo" ? "everyone (demo)" : "nobody",
  });
  void (async () => {
    const me = await call<{ username?: string }>("getMe", {});
    myUsername = me?.username ?? null;
    let offset = 0;
    while (running) {
      const updates = await call<TgUpdate[]>("getUpdates", { offset, timeout: 50, allowed_updates: ["message", "callback_query"] });
      if (!updates) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      for (const u of updates) {
        offset = u.update_id + 1;
        try {
          if (u.message) await onMessage(u.message);
          else if (u.callback_query) await onCallback(u.callback_query);
        } catch (err) {
          log.error("telegram.update_failed", { error: String(err) });
        }
      }
    }
  })();
}
