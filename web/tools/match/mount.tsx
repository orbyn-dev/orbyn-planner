// DEVELOPMENT AND TESTS ONLY (see fixture.ts).
import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { App } from "../../src/app/App";
import { ClockProvider } from "../../src/app/clock";
import { applyChoice, type Theme } from "../../src/app/theme";
import { LocalStore } from "../../src/store/LocalStore";
import { MemoryPersistence } from "../../src/store/persistence";
import { PINNED_NOW, seed, type Scenario } from "./fixture";

export interface MatchOptions {
  scenario: Scenario;
  route: string;
  theme: Theme;
  /** An ISO time to pin instead of the fixture's, for a frame drawn at another time of day. */
  now?: string;
}

/** An in-memory planner with one scenario seeded and every change acknowledged, so the screen shows a settled planner. Nothing is stored or sent. */
export async function seededStore(scenario: Scenario, pinned: string = PINNED_NOW): Promise<LocalStore> {
  let n = 0;
  const store = new LocalStore({
    persistence: new MemoryPersistence(),
    broadcast: false,
    now: () => new Date(pinned),
    newId: () => `match-${String(++n).padStart(4, "0")}`,
    onReload: () => undefined,
  });
  await store.ready;
  seed(store, scenario);
  await store.acknowledge(store.getState().outbox.map((e) => ({ type: e.type, id: e.id, idempotencyKey: e.idempotencyKey })));
  return store;
}

/** Renders the planner (no accounts, no engine) on a seeded store at the pinned time. */
export async function mountMatch(root: Root, { scenario, route, theme, now = PINNED_NOW }: MatchOptions): Promise<void> {
  const store = await seededStore(scenario, now);
  applyChoice(theme);
  window.history.replaceState(null, "", route);
  root.render(
    <StrictMode>
      <ClockProvider value={() => new Date(now)}>
        <App store={store} />
      </ClockProvider>
    </StrictMode>,
  );
}
