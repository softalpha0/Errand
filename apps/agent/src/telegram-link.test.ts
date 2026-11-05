import { describe, expect, it } from "vitest";
import { createTelegramLink, disconnect, me, normalizeLinkCode, passportForTelegram, redeemTelegramLink, startLogin, unlinkTelegram, verifyLogin } from "./passports";

// Demo mode (the default in tests): the Kite login is simulated, everything else is real.
async function connected(email: string) {
  const { passportId } = await startLogin(email);
  const { token } = await verifyLogin(passportId, "DEMO1234");
  return { passportId, token };
}

describe("linking Telegram to a Kite Passport", () => {
  it("links with a one-time code, then the chat pays from that Passport", async () => {
    const a = await connected("ada@example.com");
    const { code } = await createTelegramLink(a.token);
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(await passportForTelegram(111)).toBeNull();

    expect(await redeemTelegramLink(code, { id: 111, username: "ada" })).toEqual({ email: "ada@example.com" });
    expect((await passportForTelegram(111))?.id).toBe(a.passportId);
    expect((await me(a.token))?.telegram?.username).toBe("ada");
  });

  it("a code works only once", async () => {
    const a = await connected("bea@example.com");
    const { code } = await createTelegramLink(a.token);
    expect(await redeemTelegramLink(code, { id: 222 })).not.toBeNull();
    expect(await redeemTelegramLink(code, { id: 333 })).toBeNull();
    expect(await passportForTelegram(333)).toBeNull();
  });

  it("rejects a wrong code and accepts spaces, dashes and lower case", async () => {
    const a = await connected("cal@example.com");
    const { code } = await createTelegramLink(a.token);
    expect(await redeemTelegramLink("ZZZZZZZZ", { id: 444 })).toBeNull();
    const messy = `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`;
    expect(normalizeLinkCode(messy)).toBe(code);
    expect(await redeemTelegramLink(messy, { id: 444 })).not.toBeNull();
  });

  it("needs a connected Passport to make a code", async () => {
    await expect(createTelegramLink("not-a-token")).rejects.toThrow(/Connect your Kite Passport/);
  });

  it("one Telegram account maps to one Passport", async () => {
    const a = await connected("dan@example.com");
    const b = await connected("eve@example.com");
    await redeemTelegramLink((await createTelegramLink(a.token)).code, { id: 555 });
    await redeemTelegramLink((await createTelegramLink(b.token)).code, { id: 555 });
    expect((await passportForTelegram(555))?.id).toBe(b.passportId);
    expect((await me(a.token))?.telegram).toBeNull();
  });

  it("/unlink and Disconnect both cut the link", async () => {
    const a = await connected("fay@example.com");
    await redeemTelegramLink((await createTelegramLink(a.token)).code, { id: 666 });
    expect(await unlinkTelegram({ telegramUserId: 666 })).toBe(true);
    expect(await passportForTelegram(666)).toBeNull();

    await redeemTelegramLink((await createTelegramLink(a.token)).code, { id: 666 });
    await disconnect(a.token);
    expect(await passportForTelegram(666)).toBeNull();
  });
});
