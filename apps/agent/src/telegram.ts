/**
 * Telegram front end. Send the bot an errand in plain words; it shows the plan,
 * sends the Kite Passport approval link (or an Approve button in demo mode and
 * for allowance plans), asks questions with buttons, and replies with the answer
 * and the receipt link. Every payment goes through the same guard as the web app.
 *
 * Setup: create a bot with @BotFather, set TELEGRAM_BOT_TOKEN, and in live mode
 * list who may use it in TELEGRAM_ALLOWED_USERS (ids or @usernames), because
 * live errands on Errand's own Passport spend real money.
 *
 * Uses the Telegram Bot API over long polling (getUpdates), so no public webhook is needed.
 */
import { formatUsd, type Errand } from "@errand/core";
import { subscribe } from "./bus";
import { env } from "./env";
import { log } from "./log";
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

function allowed(u: TgUser | undefined): boolean {
  if (!u) return false;
  const list = env.telegram.allowed;
  if (list.length === 0) return env.mode === "demo";
  return list.includes(String(u.id)) || (!!u.username && list.includes(u.username.toLowerCase()));
}

const HELP = `Send me an errand in plain words, for example:

• Find a 7-day Ghana eSIM and buy the cheapest under $8
• Is a $12 Spotify gift card a good birthday present for a 15-year-old?
• $2 What do people in Lagos say about MTN vs Airtel data?

Start with an amount like "$2" to set the budget (default ${formatUsd(env.telegram.budgetUsd)}).
I'll show you the plan and every payment decision. /stop cancels the current errand.`;

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

async function startErrand(chatId: number, text: string) {
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
    // Chats are personal: nothing goes to Reppo's public network unless you use the web app.
    privacy: "private",
  });
  latest.set(chatId, e.id);
  await send(chatId, `Planning with SERV… Budget ${formatUsd(budgetUsd)}. Follow along: ${liveUrl(e.id)}`);
  follow(chatId, e.id);
}

async function onMessage(m: TgMessage) {
  const text = m.text?.trim() ?? "";
  if (!text) return;
  if (!allowed(m.from)) {
    await send(m.chat.id, env.mode === "live" ? "This bot runs live errands with real money, so only people the owner listed can use it. Try the demo on the website." : "This bot only takes errands from people its owner listed.");
    return;
  }
  if (text === "/start" || text === "/help") return void send(m.chat.id, HELP);
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
  await startErrand(m.chat.id, text.replace(/^\/errand\s*/, ""));
}

async function onCallback(q: TgCallback) {
  const chatId = q.message?.chat.id;
  const data = q.data ?? "";
  if (!chatId || !allowed(q.from)) return void call("answerCallbackQuery", { callback_query_id: q.id, text: "Not allowed." });
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
  if (env.mode === "live" && env.telegram.allowed.length === 0) {
    log.warn("telegram.disabled", { reason: "Live mode needs TELEGRAM_ALLOWED_USERS." });
    return;
  }
  running = true;
  log.info("telegram.started", { allowed: env.telegram.allowed.length || "everyone (demo)" });
  void (async () => {
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
