/** Minimal structured logger. Never log secrets: callers pass data, not env. */
function line(level: string, msg: string, data?: unknown) {
  const out = { t: new Date().toISOString(), level, msg, ...(data === undefined ? {} : { data }) };
  const text = JSON.stringify(out, (_k, v) => (typeof v === "string" && v.length > 2000 ? `${v.slice(0, 2000)}…` : v));
  if (level === "error") console.error(text);
  else console.log(text);
}

export const log = {
  info: (msg: string, data?: unknown) => line("info", msg, data),
  warn: (msg: string, data?: unknown) => line("warn", msg, data),
  error: (msg: string, data?: unknown) => line("error", msg, data),
};
