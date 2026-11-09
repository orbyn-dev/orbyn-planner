import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import { ClockProvider } from "../../src/state/clock";
import { PINNED_NOW, SCENARIOS } from "./fixture";
import { pretendAccount } from "./account";
import { ACCOUNT } from "./fixture";
import { seededStore } from "./mount";

// The fixture runs the planner on an in-memory store. No scenario may reach the network at all, so none can reach an engine.

const calls: string[] = [];
function record(name: string) {
  return function (this: unknown, ...args: unknown[]) {
    calls.push(`${name}(${String(args[0])})`);
    throw new Error(`${name} is not allowed in the match fixture`);
  };
}

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: unknown) => { calls.push(`fetch(${String(input)})`); throw new Error("offline"); }));
  vi.stubGlobal("WebSocket", record("WebSocket") as unknown as typeof WebSocket);
  vi.stubGlobal("XMLHttpRequest", record("XMLHttpRequest") as unknown as typeof XMLHttpRequest);
  vi.stubGlobal("EventSource", record("EventSource") as unknown as typeof EventSource);
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: record("sendBeacon") });
});
afterEach(() => vi.unstubAllGlobals());

describe("the match fixture", () => {
  it.each(SCENARIOS)("seeds %s, settled, without touching the network", async (scenario) => {
    const store = await seededStore(scenario);
    expect(store.pendingChanges()).toBe(0); // acknowledged: the screen shows a settled planner
    expect(store.getState().calendars.length).toBeGreaterThan(0);
    expect(calls).toEqual([]);
  });

  it("seeding twice gives the same data (ids and times are pinned)", async () => {
    const a = await seededStore("today");
    const b = await seededStore("today");
    expect(a.getState().tasks).toEqual(b.getState().tasks);
    expect(a.getState().events.map((e) => e.id)).toEqual(b.getState().events.map((e) => e.id));
  });

  it("the planner on a seeded store makes no network call and does not need an account", async () => {
    window.history.replaceState(null, "", "/today");
    render(
      <ClockProvider value={() => new Date(PINNED_NOW)}>
        <App store={await seededStore("today")} />
      </ClockProvider>,
    );
    expect(await screen.findByText("Team planning: spring launch")).toBeInTheDocument();
    // The planner's own health check is the only thing that may ask, and with no engine address it asks a fixed local address: it is
    // what the runner answers itself. Nothing else (sync socket, sign-in, feeds) may be called.
    const others = calls.filter((c) => !/\/health\)$/.test(c));
    expect(others).toEqual([]);
  });

  it("the pretend account is signed in on a trusted device, in this page only: no network call at all", async () => {
    const services = await pretendAccount();
    const session = services.tokens.getSession();
    expect(session?.name).toBe(ACCOUNT.name);
    expect(session?.deviceState).toBe("trusted");
    expect(calls).toEqual([]);
  }, 30_000);
});
