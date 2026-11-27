import { registerAuthCrypto, type AuthCrypto } from "../core/account/authCrypto";
import { loadRealAuthCrypto } from "../data/account/realCrypto";
import { configuredEngine } from "../lib/engine";

/**
 * Loads the module and registers it, if this build has an engine to sign in to (VITE_ENGINE_URL).
 * A build without one never imports it. A browser that can't run WebAssembly leaves sign-in
 * unavailable, which the screens already say; the planner itself keeps working.
 */
export async function ensureRealAuthCrypto(): Promise<void> {
  if (!import.meta.env.VITE_ENGINE_URL || !configuredEngine()) return;
  await attempt();
}

/** Where loading the module stands. "idle" also covers a signed-out build that has not needed crypto yet. */
export type CryptoLoad = "idle" | "loading" | "ready" | "failed";
let load: CryptoLoad = "idle";
/** How many loads have failed in a row. */
let failures = 0;
let pending: Promise<void> | null = null;
let generation = 0;
const listeners = new Set<() => void>();
const set = (next: CryptoLoad) => {
  load = next;
  listeners.forEach((l) => l());
};
/** Puts the state back to "idle". For tests. */
export function resetCryptoLoad(): void {
  generation += 1;
  pending = null;
  failures = 0;
  set("idle");
}

export const cryptoLoad = {
  get: (): CryptoLoad => load,
  failures: (): number => failures,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** What loads the module; tests replace it to make the import fail or succeed. */
let loader: () => Promise<AuthCrypto> = loadRealAuthCrypto;
export function setCryptoLoader(next: () => Promise<AuthCrypto>): void {
  loader = next;
}

function attempt(): Promise<void> {
  if (load === "ready") return Promise.resolve();
  if (pending) return pending;
  const mine = generation;
  set("loading");
  pending = Promise.resolve().then(loader)
    .then((crypto) => {
      if (mine !== generation) return;
      registerAuthCrypto(crypto);
      failures = 0;
      set("ready");
    }).catch(() => {
      if (mine !== generation) return;
      // Keep failure visible to the existing Retry/Reload presentation.
      failures += 1;
      set("failed");
    }).finally(() => {
      if (mine === generation) pending = null;
    });
  return pending;
}

/** Tries the import again, for the Retry button. */
export async function retryRealAuthCrypto(): Promise<void> {
  await ensureRealAuthCrypto();
}
