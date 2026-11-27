import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createMemoryKeyStore, type StoredSession } from "../data/account/keyStore";
import { LocalStore } from "../data/local/LocalStore";
import { MemoryPersistence } from "../data/local/persistence";
import { createAuthServices } from "../state/services/auth";
import { App } from "./App";

const lookup = vi.hoisted(() => vi.fn());
vi.mock("../data/local/planners", async (original) => ({ ...await original<typeof import("../data/local/planners")>(), plannerFor: lookup }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); lookup.mockReset(); });

it("does not open the device database while discovering a saved account or awaiting its crypto", async () => {
  const store = new LocalStore({ persistence: new MemoryPersistence(), broadcast: false });
  await store.ready;
  lookup.mockReturnValue(store);
  const keys = createMemoryKeyStore();
  const saved: StoredSession = { token: "synthetic-token", accountId: "account-a", deviceId: "device-a", deviceState: "trusted", expiresAt: "2099-01-01T00:00:00Z", email: "a@example.test", name: "A" };
  await keys.saveSession(saved);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const ensureCrypto = vi.fn(() => gate);
  const services = createAuthServices({ keys, ensureCrypto, fetch: async () => { throw new TypeError("offline"); } });
  const view = render(<App auth={services} />);
  await waitFor(() => expect(ensureCrypto).toHaveBeenCalled());
  expect(lookup).not.toHaveBeenCalled();
  await act(async () => { release(); await gate; });
  await waitFor(() => expect(lookup.mock.calls[0]?.[0]).toBe("account-a"));
  view.unmount();
  store.close();
});
