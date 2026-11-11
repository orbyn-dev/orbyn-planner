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
import { createMockEngine, MOCK_TOTP_CODE, type MockEngine } from "../../testing/MockEngine";
import { signedUp } from "../../testing/signedUp";

const NOW = new Date(2026, 10, 7, 10, 0);
const crypto = new FakeAuthCrypto();
const SAM = { name: "Sam", email: "sam@example.com", password: "correct horse battery" };
let engine: MockEngine;
let now = NOW.getTime();

async function open(options: { twoFactor?: boolean; aged?: boolean } = {}) {
  window.history.replaceState(null, "", "/protection/two-factor");
  const services = createAuthServices({ fetch: engine.fetch, baseUrl: "http://e.test", keys: createMemoryKeyStore(), crypto: () => crypto, wrapSecret: async () => new Uint8Array(32).fill(4), now: () => now });
  await signedUp(engine, services, SAM);
  if (options.twoFactor) engine.accounts.get(SAM.email)!.totp = { enabled: true, recovery: ["A"] };
  if (options.aged) engine.ageSessions();
  const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW, broadcast: false });
  await store.ready;
  render(
    <ClockProvider value={() => NOW}>
      <App store={store} auth={services} />
    </ClockProvider>,
  );
  return services;
}

const turnOn = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Turn on" }));
  await screen.findByRole("img", { name: "QR code for your authenticator app" });
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
  now = NOW.getTime();
  engine = createMockEngine(() => now);
});
afterEach(() => cleanup());

describe("Two-factor sign-in on the account site (/protection/two-factor)", () => {
  it("off: one row with Turn on", async () => {
    await open();
    expect(await screen.findByText(/^Off · ask for a code from an authenticator app/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Two-factor sign-in" })).toBeInTheDocument();
  });

  it("set up: a QR code, the key to type, an app link, a code field, and Turn on only once six digits are typed; a wrong code is said under the field", async () => {
    await open();
    await turnOn();
    expect(screen.getByLabelText("Secret key")).toHaveTextContent("JBSW Y3DP EHPK 3PXP");
    expect(screen.getByText("This key works for 10 minutes.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "open it in your authenticator app" })).toHaveAttribute("href", expect.stringMatching(/^otpauth:/));
    const field = screen.getByLabelText("2. Enter the 6-digit code from the app");
    const submit = screen.getByRole("button", { name: "Turn on" });
    expect(submit).toBeDisabled();
    await userEvent.type(field, "000000");
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    expect(await screen.findByText("That code isn’t right. Check the time on your device and try again.")).toBeInTheDocument();
    expect(field).toHaveValue("000000"); // kept, so it can be retyped
  });

  it("a key older than ten minutes says it expired (the engine's totp_setup_expired), dims it, and Start again makes a new one", async () => {
    await open();
    await turnOn();
    engine.accounts.get(SAM.email)!.totp!.startedAt = now - 11 * 60_000; // the secret is eleven minutes old (the sign-in is not)
    await userEvent.type(screen.getByLabelText("2. Enter the 6-digit code from the app"), MOCK_TOTP_CODE);
    await userEvent.click(screen.getByRole("button", { name: "Turn on" }));
    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("This key has expired. Start again to get a new one.");
    expect(screen.getByLabelText("2. Enter the 6-digit code from the app")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Turn on" })).toBeDisabled();
    await userEvent.click(within(banner).getByRole("button", { name: "Start again" }));
    await waitFor(() => expect(screen.queryByText("This key has expired. Start again to get a new one.")).toBeNull());
    expect(screen.getByLabelText("2. Enter the 6-digit code from the app")).toBeEnabled();
  });

  it("the right code shows ten recovery codes once, Done stays off until “I saved them”, then it is on; Turn off asks, and Cancel leaves it on", async () => {
    await open();
    await turnOn();
    await userEvent.type(screen.getByLabelText("2. Enter the 6-digit code from the app"), MOCK_TOTP_CODE);
    await userEvent.click(screen.getByRole("button", { name: "Turn on" }));
    const list = await screen.findByRole("list", { name: "Recovery codes" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("Protection · Recovery codes")).toBeInTheDocument();
    const done = screen.getByRole("button", { name: "Done" });
    expect(done).toBeDisabled();
    await userEvent.click(screen.getByLabelText("I saved them"));
    await userEvent.click(done);
    expect(await screen.findByText("On · authenticator app")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Turn off" }));
    const dialog = screen.getByRole("dialog", { name: "Turn off two-factor" });
    expect(within(dialog).getByText("Signing in on a new device will only need your password. Your recovery codes stop working.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(engine.accounts.get(SAM.email)!.totp?.enabled).toBe(true);
  });

  it("Turn off with an old sign-in asks “Confirm it’s you” first, and turns it off after the password", async () => {
    await open({ twoFactor: true, aged: true });
    await userEvent.click(await screen.findByRole("button", { name: "Turn off" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Turn off two-factor" })).getByRole("button", { name: "Turn off" }));
    const ask = await screen.findByRole("dialog", { name: "Confirm it’s you" });
    expect(within(ask).getByText("To turn off two-factor")).toBeInTheDocument();
    expect(engine.accounts.get(SAM.email)!.totp?.enabled).toBe(true);
    await userEvent.type(within(ask).getByLabelText("Password"), SAM.password);
    await userEvent.click(within(ask).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText(/^Off · ask for a code/)).toBeInTheDocument();
    expect(engine.accounts.get(SAM.email)!.totp).toBeUndefined();
  });

  it("Turn on with an old sign-in asks “Confirm it’s you” first", async () => {
    await open({ aged: true });
    await userEvent.click(await screen.findByRole("button", { name: "Turn on" }));
    const ask = await screen.findByRole("dialog", { name: "Confirm it’s you" });
    expect(within(ask).getByText("To turn on two-factor")).toBeInTheDocument();
    await userEvent.type(within(ask).getByLabelText("Password"), SAM.password);
    await userEvent.click(within(ask).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("img", { name: "QR code for your authenticator app" })).toBeInTheDocument();
  });
});
