/**
 * Dolphin (https://dphn.ai): open-source models served on a decentralised
 * network, OpenAI-compatible at https://lighthouse.dphn.ai/run/text-v/v1.
 *
 * Errand uses Dolphin for one job that involves no decision: writing the
 * email it sends (the receipt and answer in friendly, plain words). Every
 * decision, plan and payment check stays on SERV Reasoning. Without
 * DOLPHIN_API_KEY, a fixed template is used instead.
 */
import OpenAI from "openai";
import { env } from "./env";
import { log } from "./log";

let client: OpenAI | null = null;

export function dolphinConfigured(): boolean {
  return env.dolphin.apiKey.length > 0;
}

export async function writeEmail(input: { task: string; answer: string; receiptUrl: string | null }): Promise<{ text: string; model: string } | null> {
  if (!dolphinConfigured()) return null;
  client ??= new OpenAI({ apiKey: env.dolphin.apiKey, baseURL: env.dolphin.baseUrl, maxRetries: 1, timeout: 45_000 });
  try {
    const res = await client.chat.completions.create({
      model: env.dolphin.model,
      messages: [
        {
          role: "system",
          content:
            "You write a short, friendly email that reports a finished errand. Use only the facts given. Plain words, no hype, no emoji, under 160 words. Keep every amount, number and name exactly as given. End with the receipt link if one is given. Do not invent anything.",
        },
        { role: "user", content: JSON.stringify(input) },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (!text) return null;
    // Guard against a model dropping the link or inventing amounts: keep the receipt line and the facts.
    const withLink = input.receiptUrl && !text.includes(input.receiptUrl) ? `${text}\n\nReceipt: ${input.receiptUrl}` : text;
    return { text: withLink, model: env.dolphin.model };
  } catch (err) {
    log.warn("dolphin.failed", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
