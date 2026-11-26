import { StrictMode } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createIdbKeyStore, createMemoryKeyStore, KEY_DB_NAME, type StoredSession } from "../data/account/keyStore";
import { IDBFactory } from "fake-indexeddb";
import { sessionToken } from "../data/account/session";
import { AuthProvider, useAuth } from "./account";
import { createAuthServices } from "./services/auth";
import { FakeAuthCrypto } from "../testing/FakeAuthCrypto";
import { loadRealAuthCrypto } from "../data/account/realCrypto";
import { SignInUnavailable } from "../core/account/authCrypto";
import { AuthGate } from "../features/account/AuthGate";
import { cryptoLoad, ensureRealAuthCrypto, resetCryptoLoad, setCryptoLoader } from "./crypto";
import userEvent from "@testing-library/user-event";

const saved: StoredSession = { token: "synthetic-token", accountId: "account-a", deviceId: "device-a", deviceState: "trusted", expiresAt: "2099-01-01T00:00:00Z", email: "a@example.test", name: "A" };
function State() {
  const auth = useAuth();
  return <div data-testid="account">{auth?.status}:{auth?.session?.accountId}</div>;
}
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllEnvs(); resetCryptoLoad(); setCryptoLoader(loadRealAuthCrypto); });

describe("account identity before crypto", () => {
  it("shows a blocked upgrade and retries the saved account after the old tab closes", async () => {
    const previousFactory = globalThis.indexedDB;
    const factory = new IDBFactory();
    globalThis.indexedDB = factory;
    let old: IDBDatabase | undefined;
    try {
      old = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = factory.open(KEY_DB_NAME, 4);
        request.onupgradeneeded = () => { for (const name of ["device", "session", "snapshot", "wrap", "identity", "quarantine", "sync"]) request.result.createObjectStore(name); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = old.transaction("session", "readwrite");
      tx.objectStore("session").put(saved, "current");
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
      localStorage.setItem("orbyn-planner.local-only", "1");
      const ensureCrypto = vi.fn(async () => undefined);
      const services = createAuthServices({ keys: createIdbKeyStore(factory), ensureCrypto });
      render(<AuthProvider services={services}><State /><AuthGate><div>Account planner</div></AuthGate></AuthProvider>);
      expect(await screen.findByRole("alert")).toHaveTextContent(/close.*tabs/i);
      expect(screen.getByTestId("account")).toHaveTextContent("loading:");
      expect(screen.queryByText("Account planner")).toBeNull();
      expect(screen.queryByText("Use without an account")).toBeNull();
      expect(ensureCrypto).not.toHaveBeenCalled();
      expect(services.keys.inMemory).toBe(false);
      old.close();
      await userEvent.click(screen.getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(screen.getByTestId("account")).toHaveTextContent("signedIn:account-a"));
      expect(ensureCrypto).toHaveBeenCalled();
      expect(screen.getByText("Account planner")).toBeInTheDocument();
    } finally {
      cleanup();
      old?.close();
      globalThis.indexedDB = previousFactory;
    }
  });
  it("shows a confirmed signed-out landing without starting crypto", async () => {
    const ensureCrypto = vi.fn(async () => undefined);
    const services = createAuthServices({ keys: createMemoryKeyStore(), ensureCrypto });
    render(<StrictMode><AuthProvider services={services}><State /></AuthProvider></StrictMode>);
    await waitFor(() => expect(screen.getByTestId("account")).toHaveTextContent("landing:"));
    expect(ensureCrypto).not.toHaveBeenCalled();
  });

  it.each(["trusted", "pending"] as const)("keeps a saved %s account loading until crypto is ready despite a local-only hint", async (deviceState) => {
    localStorage.setItem("orbyn-planner.local-only", "1");
    const keys = createMemoryKeyStore();
    await keys.saveSession({ ...saved, deviceState });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const ensureCrypto = vi.fn(() => gate);
    const services = createAuthServices({ keys, ensureCrypto });
    render(<AuthProvider services={services}><State /></AuthProvider>);
    await waitFor(() => expect(ensureCrypto).toHaveBeenCalled());
    expect(screen.getByTestId("account")).toHaveTextContent("loading:");
    expect(sessionToken()).toBeNull();
    await act(async () => { release(); await gate; });
    await waitFor(() => expect(screen.getByTestId("account")).toHaveTextContent(`${deviceState === "trusted" ? "signedIn" : "pending"}:account-a`));
  });

  it("does not load crypto for an expired saved session", async () => {
    const keys = createMemoryKeyStore();
    await keys.saveSession({ ...saved, expiresAt: "2000-01-01T00:00:00Z" });
    const ensureCrypto = vi.fn(async () => undefined);
    const services = createAuthServices({ keys, ensureCrypto });
    render(<AuthProvider services={services}><State /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("account")).toHaveTextContent("landing:"));
    expect(ensureCrypto).not.toHaveBeenCalled();
  });

  it("ignores the old account's crypto completion after services change", async () => {
    const keys = createMemoryKeyStore();
    await keys.saveSession(saved);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const first = createAuthServices({ keys, ensureCrypto: () => gate });
    const second = createAuthServices({ keys: createMemoryKeyStore(), ensureCrypto: vi.fn(async () => undefined) });
    const view = render(<AuthProvider services={first}><State /></AuthProvider>);
    await waitFor(() => expect(first.tokens.getSession()).not.toBeNull());
    view.rerender(<AuthProvider services={second}><State /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("account")).toHaveTextContent("landing:"));
    await act(async () => { release(); await gate; });
    expect(screen.getByTestId("account")).toHaveTextContent("landing:");
    expect(sessionToken()).toBeNull();
  });

  it("keeps a saved account blocked on failure, then resumes from the existing Retry without rereading the session", async () => {
    vi.stubEnv("VITE_ENGINE_URL", "http://engine.test");
    const keys = createMemoryKeyStore();
    await keys.saveSession(saved);
    setCryptoLoader(vi.fn().mockRejectedValueOnce(new Error("blocked")).mockResolvedValue(new FakeAuthCrypto()));
    const services = createAuthServices({ keys, ensureCrypto: async () => {
      await ensureRealAuthCrypto();
      if (cryptoLoad.get() === "failed") throw new SignInUnavailable();
    } });
    const read = vi.spyOn(services.tokens, "load");
    render(<AuthProvider services={services}><State /><AuthGate>{null}</AuthGate></AuthProvider>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t load Orbyn’s security module");
    expect(screen.getByTestId("account")).toHaveTextContent("loading:");
    expect(sessionToken()).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByTestId("account")).toHaveTextContent("signedIn:account-a"));
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("does not restore the old identity after a sign-out during module loading", async () => {
    const keys = createMemoryKeyStore();
    await keys.saveSession(saved);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const services = createAuthServices({ keys, ensureCrypto: () => gate });
    render(<AuthProvider services={services}><State /></AuthProvider>);
    await waitFor(() => expect(services.tokens.getSession()).not.toBeNull());
    await act(async () => { await services.tokens.clear(); });
    await waitFor(() => expect(screen.getByTestId("account")).toHaveTextContent("landing:"));
    await act(async () => { release(); await gate; });
    expect(screen.getByTestId("account")).toHaveTextContent("landing:");
    expect(sessionToken()).toBeNull();
  });

  it("shows existing entry busy UI immediately and cancels the entry when the person continues without an account", async () => {
    window.history.replaceState(null, "", "/sign-in");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const crypto = vi.fn(() => new FakeAuthCrypto());
    const fetch = vi.fn(async () => { throw new TypeError("offline"); });
    const services = createAuthServices({ keys: createMemoryKeyStore(), ensureCrypto: () => gate, crypto, fetch });
    render(<AuthProvider services={services}><AuthGate>{null}</AuthGate></AuthProvider>);
    await userEvent.type(await screen.findByLabelText("Email"), "a@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "synthetic-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(crypto).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Use without an account" }));
    await act(async () => { release(); await gate; });
    expect(crypto).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(services.tokens.getSession()).toBeNull();
  });
});
