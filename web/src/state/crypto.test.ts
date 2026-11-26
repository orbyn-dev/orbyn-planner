import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeAuthCrypto } from "../testing/FakeAuthCrypto";
import { loadRealAuthCrypto } from "../data/account/realCrypto";
import { cryptoLoad, ensureRealAuthCrypto, resetCryptoLoad, setCryptoLoader } from "./crypto";

afterEach(() => {
  vi.unstubAllEnvs();
  setCryptoLoader(loadRealAuthCrypto);
  resetCryptoLoad();
});

describe("the shared security module loader", () => {
  it("shares concurrent imports and never imports again after success", async () => {
    vi.stubEnv("VITE_ENGINE_URL", "http://engine.test");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const loader = vi.fn(async () => { await gate; return new FakeAuthCrypto(); });
    setCryptoLoader(loader);
    const first = ensureRealAuthCrypto();
    const second = ensureRealAuthCrypto();
    await Promise.resolve();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cryptoLoad.get()).toBe("loading");
    release();
    await Promise.all([first, second]);
    await ensureRealAuthCrypto();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cryptoLoad.get()).toBe("ready");
  });

  it("shares a failed attempt but permits a subsequent retry", async () => {
    vi.stubEnv("VITE_ENGINE_URL", "http://engine.test");
    const loader = vi.fn().mockRejectedValueOnce(new Error("blocked")).mockResolvedValue(new FakeAuthCrypto());
    setCryptoLoader(loader);
    await Promise.all([ensureRealAuthCrypto(), ensureRealAuthCrypto()]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cryptoLoad.failures()).toBe(1);
    await ensureRealAuthCrypto();
    expect(loader).toHaveBeenCalledTimes(2);
    expect(cryptoLoad.get()).toBe("ready");
  });

  it("does not import in a build without an engine", async () => {
    vi.stubEnv("VITE_ENGINE_URL", "");
    const loader = vi.fn();
    setCryptoLoader(loader);
    await ensureRealAuthCrypto();
    expect(loader).not.toHaveBeenCalled();
    expect(cryptoLoad.get()).toBe("idle");
  });

  it("permits retry even when a loader throws before returning a promise", async () => {
    vi.stubEnv("VITE_ENGINE_URL", "http://engine.test");
    setCryptoLoader(() => { throw new Error("blocked before import"); });
    await ensureRealAuthCrypto();
    expect(cryptoLoad.get()).toBe("failed");
    setCryptoLoader(async () => new FakeAuthCrypto());
    await ensureRealAuthCrypto();
    expect(cryptoLoad.get()).toBe("ready");
  });
});
