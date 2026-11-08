// DEVELOPMENT AND TESTS ONLY (see fixture.ts).
import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { App } from "../../src/app/App";
import { ClockProvider } from "../../src/app/clock";
import { applyChoice, type Theme } from "../../src/app/theme";
import { LocalStore } from "../../src/store/LocalStore";
import { MemoryPersistence } from "../../src/store/persistence";
import type { AuthServices } from "../../src/auth/services";
import { pretendAccount, signedOutAccount } from "./account";
import { PINNED_NOW, seed, type Scenario } from "./fixture";

export interface MatchOptions {
  scenario: Scenario;
  route: string;
  theme: Theme;
  /** An ISO time to pin instead of the fixture's, for a frame drawn at another time of day. */
  now?: string;
  /** Draw the planner signed in to the pretend account (the default); false is the planner of this device alone. */
  account?: boolean | "out";
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
export async function mountMatch(root: Root, { scenario, route, theme, now = PINNED_NOW, account = true }: MatchOptions): Promise<void> {
  const store = await seededStore(scenario, now);
  // The match runner's steps can change the store (a task deleted on "another device") through this.
  (window as unknown as { __match: unknown }).__match = store;
  const auth: AuthServices | undefined = account === "out" ? signedOutAccount() : account ? await pretendAccount() : undefined;
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
