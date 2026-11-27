import { describe, expect, it } from "vitest";
import { createMemoryKeyStore, type StoredSession } from "./keyStore";
import { TokenStore } from "./tokenStore";

const saved: StoredSession = { token: "synthetic-token", accountId: "account-a", deviceId: "device-a", deviceState: "trusted", expiresAt: "2099-01-01T00:00:00Z", email: "a@example.test", name: "A" };

describe("session discovery generation", () => {
  it("cannot resurrect a session when sign-out completes during the saved-session read", async () => {
    const keys = createMemoryKeyStore();
    let finish!: (session: StoredSession) => void;
    keys.loadSession = () => new Promise((resolve) => { finish = resolve; });
    const tokens = new TokenStore(keys);
    const loading = tokens.load();
    await tokens.clear();
    finish(saved);
    expect(await loading).toBeNull();
    expect(tokens.getSession()).toBeNull();
  });

  it("cannot replace a new account with the old saved-session read", async () => {
    const keys = createMemoryKeyStore();
    let finish!: (session: StoredSession) => void;
    keys.loadSession = () => new Promise((resolve) => { finish = resolve; });
    const tokens = new TokenStore(keys);
    const loading = tokens.load();
    const next = { ...saved, accountId: "account-b", token: "next-token" };
    await tokens.set(next);
    finish(saved);
    expect(await loading).toEqual(next);
    expect(tokens.getSession()).toEqual(next);
  });

  it("cannot overwrite a new sign-in while the expired session is being cleared", async () => {
    const keys = createMemoryKeyStore();
    await keys.saveSession({ ...saved, expiresAt: "2000-01-01T00:00:00Z" });
    let finish!: () => void;
    let clearing!: () => void;
    const started = new Promise<void>((resolve) => { clearing = resolve; });
    keys.clearSession = () => { clearing(); return new Promise((resolve) => { finish = resolve; }); };
    const tokens = new TokenStore(keys);
    const loading = tokens.load();
    await started;
    const next = { ...saved, accountId: "account-b", token: "new-token" };
    await tokens.set(next);
    finish();
    expect(await loading).toEqual(next);
    expect(tokens.getSession()).toEqual(next);
  });
});
