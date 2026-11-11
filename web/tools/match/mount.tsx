// DEVELOPMENT AND TESTS ONLY (see fixture.ts).
import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { App } from "../../src/app/App";
import { ClockProvider } from "../../src/state/clock";
import { applyChoice, type Theme } from "../../src/ui/theme";
import { LocalStore } from "../../src/data/local/LocalStore";
import { MemoryPersistence } from "../../src/data/local/persistence";
import type { AuthServices } from "../../src/state/services/auth";
import { fakeSignedInAccount, pretendAccount, signedOutAccount } from "./account";
import { PINNED_NOW, seed, type Scenario } from "./fixture";

export interface MatchOptions {
  scenario: Scenario;
  route: string;
  theme: Theme;
  /** An ISO time to pin instead of the fixture's, for a frame drawn at another time of day. */
  now?: string;
  /** Draw the planner signed in to the pretend account (the default); false is the planner of this device alone. */
  /** `"fake"`: signed in to an account on the stand-in crypto, so a frame can make requests the mock engine accepts (two-factor, protection). */
  account?: boolean | "out" | "fake";
  /** Draw the planner while it is still opening (a store that is not ready), for the loading frames. */
  loading?: boolean;
}

/** An in-memory planner with one scenario seeded and every change acknowledged, so the screen shows a settled planner. Nothing is stored or sent. */
export async function seededStore(scenario: Scenario, pinned: string = PINNED_NOW): Promise<LocalStore> {
  let n = 0;
  const store = new LocalStore({
    persistence: new MemoryPersistence(),
    broadcast: false,
    now: () => new Date(pinned),
    // UUID-shaped, because tags are only kept for ids of that form.
    newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    onReload: () => undefined,
  });
  await store.ready;
  seed(store, scenario);
  await store.acknowledge(store.getState().outbox.map((e) => ({ type: e.type, id: e.id, idempotencyKey: e.idempotencyKey })));
  return store;
}

/** Renders the planner (no accounts, no engine) on a seeded store at the pinned time. */
export async function mountMatch(root: Root, { scenario, route, theme, now = PINNED_NOW, account = true, loading = false }: MatchOptions): Promise<void> {
  const seeded = await seededStore(scenario, now);
  // A loading frame shows the planner before its data is here: the same store, reporting that it is not ready (one object, so React sees a stable snapshot).
  const notReady = { ...seeded.getState(), ready: false, events: [], tasks: [] };
  const store = loading ? Object.assign(Object.create(seeded) as LocalStore, { getState: () => notReady }) : seeded;
  // The match runner's steps can change the store (a task deleted on "another device") through this.
  (window as unknown as { __match: unknown }).__match = store;
  let auth: AuthServices | undefined;
  if (account === "out") {
    const out = signedOutAccount();
    auth = out.services;
    // A frame's steps set the pretend engine up through this (an invite code, a refused call, a held request).
    (window as unknown as { __matchEngine: unknown }).__matchEngine = out.controls;
  } else if (account === "fake") auth = await fakeSignedInAccount();
  else if (account) auth = await pretendAccount();
  applyChoice(theme);
  window.history.replaceState(null, "", route);
  root.render(
    <StrictMode>
      <ClockProvider value={() => new Date(now)}>
        <App store={store} auth={auth} />
      </ClockProvider>
    </StrictMode>,
  );
}
