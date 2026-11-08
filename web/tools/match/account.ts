// DEVELOPMENT AND TESTS ONLY (see fixture.ts). A pretend signed-in account for the frames that draw one ("Sam Arden", synced, three
// devices). It lives entirely in this page: the account sits on an in-memory mock engine, with the engine's real module for the
// crypto (as the sync tests use it), so nothing here reaches a real account, a real engine or the network. src/ never imports it.
import { registerAuthCrypto } from "../../src/api/authCrypto";
import { realAuthCrypto } from "../../src/api/testing/realModule";
import { FakeAuthCrypto } from "../../src/api/testing/FakeAuthCrypto";
import { createAuthServices, type AuthServices } from "../../src/auth/services";
import { createSyncRig } from "../../src/sync/testing/rig";
import { createMemoryKeyStore } from "../../src/api/keyStore";
import { createMockEngine } from "../../src/api/testing/MockEngine";
import { ACCOUNT } from "./fixture";

/** Services of a trusted device of an account with two more trusted devices, named Sam Arden. */
export async function pretendAccount(): Promise<AuthServices> {
  registerAuthCrypto(realAuthCrypto()); // the planner syncs only when its crypto module is there
  const rig = await createSyncRig({ third: true });
  await rig.a.services.tokens.set({ ...rig.a.session, name: ACCOUNT.name, email: ACCOUNT.email });
  return rig.a.services;
}

/** What a frame's steps can do to the signed-out page's pretend engine (see `signedOutAccount`). */
export interface MatchEngineControls {
  /** The in-page mock engine: `requireInvites(code)`, `spendInvite(code)`, `refuseNext(path, status, code)`, `latestEmailCode(address)`. */
  engine: ReturnType<typeof createMockEngine>;
  /** Paths whose requests wait for ever (a "Checking…" frame). */
  hold: Set<string>;
  /** When true every request fails as a lost connection does. */
  offline: { value: boolean };
}

/** Services with no one signed in, on an empty in-page mock engine: the planner opens at its landing page. The controls let a frame's steps set the engine up. */
export function signedOutAccount(): { services: AuthServices; controls: MatchEngineControls } {
  // The mock engine checks signatures with the test stand-in's verifier, so a sign-up against it needs the stand-in crypto, not the engine's module.
  const crypto = new FakeAuthCrypto();
  registerAuthCrypto(crypto);
  const wrap = new Uint8Array(32).fill(5);
  const engine = createMockEngine();
  const hold = new Set<string>();
  const offline = { value: false };
  const fetchThrough: typeof fetch = async (input, init) => {
    const path = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://engine.test").pathname;
    if (offline.value) throw new TypeError("Failed to fetch");
    if (hold.has(path)) return new Promise<Response>(() => undefined);
    return engine.fetch(input, init);
  };
  const services = createAuthServices({ fetch: fetchThrough, baseUrl: "http://engine.test", keys: createMemoryKeyStore(), crypto: () => crypto, wrapSecret: async () => wrap.slice() });
  return { services, controls: { engine, hold, offline } };
}
