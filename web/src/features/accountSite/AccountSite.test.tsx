import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { ClockProvider } from "../../state/clock";
import { createMemoryKeyStore } from "../../data/account/keyStore";
import { LocalStore } from "../../data/local/LocalStore";
import { MemoryPersistence } from "../../data/local/persistence";
import { createAuthServices } from "../../state/services/auth";
import { FakeAuthCrypto } from "../../testing/FakeAuthCrypto";
import { createMockEngine, type MockEngine } from "../../testing/MockEngine";
import { signedUp } from "../../testing/signedUp";
import { isAccountSitePath } from "./AccountSite";

const NOW = new Date(2026, 10, 7, 10, 0);
const crypto = new FakeAuthCrypto();
const SAM = { name: "Sam", email: "sam@example.com", password: "correct horse battery" };
let engine: MockEngine;

async function open(path: string, options: { twoFactor?: boolean } = {}) {
  window.history.replaceState(null, "", path);
  const services = createAuthServices({ fetch: engine.fetch, baseUrl: "http://e.test", keys: createMemoryKeyStore(), crypto: () => crypto, wrapSecret: async () => new Uint8Array(32).fill(4), now: () => NOW.getTime() });
  await signedUp(engine, services, SAM);
  if (options.twoFactor) engine.accounts.get(SAM.email)!.totp = { enabled: true, recovery: ["A"] };
  const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW, broadcast: false });
  await store.ready;
  render(
    <ClockProvider value={() => NOW}>
      <App store={store} auth={services} />
    </ClockProvider>,
  );
  return services;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
  engine = createMockEngine(() => NOW.getTime());
});
afterEach(() => cleanup());

describe("the account site", () => {
  it("knows its paths", () => {
    expect(isAccountSitePath("/protection")).toBe(true);
    expect(isAccountSitePath("/protection/two-factor")).toBe(true);
    expect(isAccountSitePath("/protectionx")).toBe(false);
    expect(isAccountSitePath("/settings")).toBe(false);
  });

  it("/protection shows the account's own shell, not the planner's, with Data protection and Two-factor sign-in", async () => {
    await open("/protection");
    const nav = await screen.findByRole("navigation", { name: "Account pages" });
    expect(within(nav).getByRole("link", { name: "Protection" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(SAM.email.toLowerCase())).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull(); // the planner's sidebar is not here
    expect(screen.getByRole("heading", { name: "Protection" })).toBeInTheDocument();
    expect(screen.getByText("Standard protection")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/^Off · ask for a code/)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Set up" })).toHaveAttribute("href", "/protection/two-factor");
  });

  it("says two-factor is on, and offers to manage it", async () => {
    await open("/protection", { twoFactor: true });
    expect(await screen.findByText("On · authenticator app")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute("href", "/protection/two-factor");
  });

  it("Sign out signs this device out", async () => {
    const services = await open("/protection");
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(services.tokens.getSession()).toBeNull());
  });
});
