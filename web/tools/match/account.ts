// DEVELOPMENT AND TESTS ONLY (see fixture.ts). A pretend signed-in account for the frames that draw one ("Sam Arden", synced, three
// devices). It lives entirely in this page: the account sits on an in-memory mock engine, with the engine's real module for the
// crypto (as the sync tests use it), so nothing here reaches a real account, a real engine or the network. src/ never imports it.
import { registerAuthCrypto } from "../../src/api/authCrypto";
import { realAuthCrypto } from "../../src/api/testing/realModule";
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

/** Services with no one signed in, on an empty in-page mock engine: the planner opens at its landing page. */
export function signedOutAccount(): AuthServices {
  registerAuthCrypto(realAuthCrypto());
  const wrap = new Uint8Array(32).fill(5);
  return createAuthServices({ fetch: createMockEngine().fetch, baseUrl: "http://engine.test", keys: createMemoryKeyStore(), crypto: () => realAuthCrypto(), wrapSecret: async () => wrap.slice() });
}
