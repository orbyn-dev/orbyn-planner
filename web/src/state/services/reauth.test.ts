import { describe, expect, it } from "vitest";
import { ApiFailure } from "../../core/account/errors";
import { createMemoryKeyStore } from "../../data/account/keyStore";
import { FakeAuthCrypto } from "../../testing/FakeAuthCrypto";
import { createMockEngine, type MockEngine } from "../../testing/MockEngine";
import { signedUp } from "../../testing/signedUp";
import { confirmIdentity, removeDevice } from "./flows";
import { createAuthServices, type AuthServices } from "./auth";

const crypto = new FakeAuthCrypto();
const SAM = { name: "Sam", email: "sam@example.com", password: "correct horse battery" };
const time = Date.UTC(2026, 10, 7, 10, 0, 0);
const now = () => time;

const browser = (engine: MockEngine, fetchImpl: typeof fetch = engine.fetch): AuthServices =>
  createAuthServices({ fetch: fetchImpl, baseUrl: "http://e.test", keys: createMemoryKeyStore(), crypto: () => crypto, wrapSecret: async () => new Uint8Array(32).fill(4), now });

/** Signed up on `services`, with a second trusted device the first could remove. */
async function twoDevices() {
  const engine = createMockEngine(now);
  const services = browser(engine);
  const session = await signedUp(engine, services, SAM);
  const account = engine.accounts.get(SAM.email)!;
  const material = crypto.deviceKeys.create();
  const other = {
    id: "00000000-0000-4000-8000-0000000000d2", name: "Tablet", platform: "ios" as const, state: "trusted" as const, signing_key: material.signingKey(),
    agreement_key: material.agreementKey(), created_at: new Date(now()).toISOString(), approved_by: null, approval_signature: null, current: false,
  };
  account.devices.push(other);
  return { engine, services, session, account, other };
}

describe("Confirm it’s you: the sign-in the engine asks for", () => {
  it("a stale session is refused, one sign-in with the same keys makes it fresh, and the same removal then goes through", async () => {
    const { engine, services, session, account, other } = await twoDevices();
    engine.ageSessions();
    const refused = await removeDevice(services, session, other).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(ApiFailure);
    expect((refused as ApiFailure).code).toBe("reauthentication_required");
    expect(account.devices).toHaveLength(2); // nothing was removed
    expect(services.tokens.getSession()).not.toBeNull(); // about this request, not the session

    const asked = engine.calls.filter((c) => c.path === "/v1/sessions/login/start").length;
    const fresh = await confirmIdentity(services, session, SAM.password);
    expect(fresh.deviceId).toBe(session.deviceId); // the same device
    expect(fresh.token).not.toBe(session.token);
    expect(services.tokens.getSession()?.token).toBe(fresh.token);
    const start = engine.calls.filter((c) => c.path === "/v1/sessions/login/start").at(-1)!.body as { trusted_device?: unknown };
    expect(engine.calls.filter((c) => c.path === "/v1/sessions/login/start").length).toBe(asked + 1);
    expect(start.trusted_device).toBeTruthy(); // a trusted start: only the password is needed

    await removeDevice(services, fresh, other);
    expect(account.devices.map((d) => d.name)).toEqual([account.devices[0]!.name]);
  });

  it("a wrong password is login_failed and the removal is still not done", async () => {
    const { engine, services, session, account, other } = await twoDevices();
    engine.ageSessions();
    const wrong = await confirmIdentity(services, session, "not the password").catch((e: unknown) => e);
    expect((wrong as ApiFailure).code).toBe("login_failed");
    expect(services.tokens.getSession()?.token).toBe(session.token); // the old session is untouched
    expect(((await removeDevice(services, session, other).catch((e: unknown) => e)) as ApiFailure).code).toBe("reauthentication_required");
    expect(account.devices).toHaveLength(2);
  });

  it("too many tries says how long to wait, and an unreachable engine says it is network", async () => {
    const { engine, services, session } = await twoDevices();
    engine.refuseNext("/v1/sessions/login/start", 429, "too_many_attempts", "Too many attempts.", 1, 720);
    const limited = (await confirmIdentity(services, session, SAM.password).catch((e: unknown) => e)) as ApiFailure;
    expect(limited.code).toBe("too_many_attempts");
    expect(limited.retryAfter).toBe(720);

    const offline = browser(engine, () => Promise.reject(new TypeError("offline")));
    const down = (await confirmIdentity(offline, session, SAM.password).catch((e: unknown) => e)) as ApiFailure;
    expect(down.code).toBe("network");
  });
});
