import { IDBFactory } from "fake-indexeddb";
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KEY_DB_NAME, KEY_DB_VERSION, KeyStoreUnavailable, emptySyncState, createIdbKeyStore, createMemoryKeyStore, type StoredSession } from "./keyStore";
import { TokenStore } from "./tokenStore";
import { wrapSecretFrom } from "./wrapSecret";

const session: StoredSession = {
  token: "secret-token",
  accountId: "a",
  deviceId: "d",
  deviceState: "trusted",
  expiresAt: "2030-01-01T00:00:00.000Z",
  email: "sam@example.com",
  name: "Sam",
};

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
  sessionStorage.clear();
});

describe("the key store", () => {
  it("keeps keys and the session in a database of its own", async () => {
    const store = createIdbKeyStore();
    await store.saveKeys(new Uint8Array([1, 2, 3]));
    await store.saveSession(session);
    expect(KEY_DB_NAME).toBe("orbyn-planner-keys");
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).toEqual(["orbyn-planner-keys"]); // not the planner's own database
    // A second store on the same database reads them back.
    const again = createIdbKeyStore();
    expect(Array.from((await again.loadKeys())!)).toEqual([1, 2, 3]);
    expect(await again.loadSession()).toEqual(session);
  });

  it("never writes to localStorage or sessionStorage", async () => {
    const store = createIdbKeyStore();
    await store.saveKeys(new Uint8Array([9]));
    await store.saveSession(session);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    const memory = createMemoryKeyStore();
    await memory.saveSession(session);
    expect(localStorage.length).toBe(0);
  });

  it("clears them separately", async () => {
    const store = createIdbKeyStore();
    await store.saveKeys(new Uint8Array([1]));
    await store.saveSession(session);
    await store.clearSession();
    expect(await store.loadSession()).toBeNull();
    expect(await store.loadKeys()).not.toBeNull();
    await store.clearKeys();
    expect(await store.loadKeys()).toBeNull();
  });
});

describe("forgetting a device in IndexedDB", () => {
  it("removes the keys, the snapshot, the wrapping key, the identity and the quarantine together", async () => {
    const store = createIdbKeyStore();
    const wrap = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    await store.saveKeys(new Uint8Array([1]));
    await store.saveSnapshot(new Uint8Array([2]));
    await store.saveWrapKey(wrap);
    await store.saveIdentity({ accountId: "a", deviceId: "d" });
    await store.quarantineSnapshot(new Uint8Array([3]));
    expect(await store.loadWrapKey()).not.toBeNull();
    await createIdbKeyStore().clearDevice(); // another store object on the same database
    expect(await store.loadKeys()).toBeNull();
    expect(await store.loadSnapshot()).toBeNull();
    expect(await store.loadWrapKey()).toBeNull();
    expect(await store.loadIdentity()).toBeNull();
    expect(await store.loadQuarantine()).toEqual([]); // it was sealed under the wrapping key just removed
  });

  it("pins the first unreadable snapshot and keeps the newest after it", async () => {
    const store = createIdbKeyStore();
    for (let i = 1; i <= 5; i++) await store.quarantineSnapshot(new Uint8Array([i]));
    expect((await store.loadQuarantine()).map((b) => b[0])).toEqual([1, 4, 5]);
  });

  it("does not keep the same unreadable snapshot twice, so repeated failures can't push the original out", async () => {
    const store = createIdbKeyStore();
    await store.quarantineSnapshot(new Uint8Array([7]));
    for (let i = 0; i < 10; i++) await store.quarantineSnapshot(new Uint8Array([8]));
    for (let i = 0; i < 10; i++) await store.quarantineSnapshot(new Uint8Array([8]));
    expect((await store.loadQuarantine()).map((b) => b[0])).toEqual([7, 8]);
  });

  it("the wrapping secret comes from a key that is stored but never readable", async () => {
    const store = createIdbKeyStore();
    const a = await wrapSecretFrom(store);
    const b = await wrapSecretFrom(createIdbKeyStore());
    expect(a).toHaveLength(32);
    expect(Array.from(b)).toEqual(Array.from(a)); // the same stored key gives the same secret
    expect((await store.loadWrapKey())!.extractable).toBe(false);
    await store.clearDevice();
    expect(Array.from(await wrapSecretFrom(store))).not.toEqual(Array.from(a)); // a new key after forgetting
  });
});

describe("the token store", () => {
  it("holds the token in memory and in IndexedDB, and forgets it on clear", async () => {
    const keys = createIdbKeyStore();
    const tokens = new TokenStore(keys);
    expect(tokens.token()).toBeNull();
    await tokens.set(session);
    expect(tokens.token()).toBe("secret-token");
    // A new page load finds it again.
    const reloaded = new TokenStore(createIdbKeyStore());
    expect((await reloaded.load(Date.parse("2026-11-07")))?.token).toBe("secret-token");
    await tokens.clear();
    expect(tokens.token()).toBeNull();
    expect(await createIdbKeyStore().loadSession()).toBeNull();
  });

  it("drops a session that has expired", async () => {
    const keys = createIdbKeyStore();
    await keys.saveSession({ ...session, expiresAt: "2026-01-01T00:00:00.000Z" });
    const tokens = new TokenStore(keys);
    expect(await tokens.load(Date.parse("2026-11-07"))).toBeNull();
    expect(await keys.loadSession()).toBeNull();
  });

  it("tells listeners when the session changes", async () => {
    const tokens = new TokenStore(createMemoryKeyStore());
    let calls = 0;
    tokens.subscribe(() => calls++);
    await tokens.set(session);
    await tokens.update({ deviceState: "pending" });
    expect(tokens.getSession()?.deviceState).toBe("pending");
    await tokens.clear();
    expect(calls).toBe(3);
  });
});

describe("snapshot and mirror atomic writer boundary", () => {
  it("commits a sealed snapshot and applied intent together and preserves legacy session data", async () => {
    const old = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(KEY_DB_NAME, 4);
      req.onupgradeneeded = () => { for (const name of ["device", "session", "snapshot", "wrap", "identity", "quarantine", "sync"]) req.result.createObjectStore(name); };
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    const tx = old.transaction(["session", "snapshot", "sync"], "readwrite");
    const intent = { id: "intent", zone: "list:inbox", records: [{ id: "task", type: "task" }], applied: false };
    tx.objectStore("session").put(session, "current"); tx.objectStore("snapshot").put(new Uint8Array([1]), "current"); tx.objectStore("sync").put({ ...emptySyncState(), mirrorPending: [intent] }, "current");
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    old.onversionchange = () => old.close();
    const current = createIdbKeyStore(); expect(await current.loadSession()).toEqual(session);
    await current.saveSnapshot(new Uint8Array([2]), intent.id);
    expect([...(await current.loadSnapshot())!]).toEqual([2]);
    expect((await current.loadSyncState())?.mirrorPending).toEqual([{ ...intent, applied: true }]);
    expect((await indexedDB.databases())[0]?.version).toBe(KEY_DB_VERSION);
    await expect(new Promise((resolve, reject) => { const req = indexedDB.open(KEY_DB_NAME, 4); req.onsuccess = () => { req.result.close(); resolve(true); }; req.onerror = () => reject(req.error); })).rejects.toMatchObject({ name: "VersionError" });
  });
});

it("rolls back snapshot bytes and the applied marker together when their transaction aborts", async () => {
  const current = createIdbKeyStore();
  const intent = { id: "abort-intent", zone: "list:inbox", records: [{ id: "task" }], applied: false };
  await current.saveSyncState({ ...emptySyncState(), mirrorPending: [intent] }); await current.saveSnapshot(new Uint8Array([1]));
  const put = IDBObjectStore.prototype.put;
  const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    const result = put.call(this, value, key);
    if (this.name === "snapshot") result.addEventListener("success", () => this.transaction.abort());
    return result;
  });
  try { await expect(current.saveSnapshot(new Uint8Array([2]), intent.id)).rejects.toThrow("snapshot write was aborted"); }
  finally { spy.mockRestore(); }
  expect([...(await current.loadSnapshot())!]).toEqual([1]);
  expect((await current.loadSyncState())?.mirrorPending).toEqual([intent]);
});

it("rejects a blocked key upgrade explicitly, then retries without losing the saved identity", async () => {
  const old = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(KEY_DB_NAME, 4);
    req.onupgradeneeded = () => { for (const name of ["device", "session", "snapshot", "wrap", "identity", "quarantine", "sync"]) req.result.createObjectStore(name); };
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  const tx = old.transaction("session", "readwrite"); tx.objectStore("session").put(session, "current");
  await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); });
  const store = createIdbKeyStore(); const tokens = new TokenStore(store); const changed = vi.fn(); tokens.subscribe(changed);
  await expect(tokens.load()).rejects.toMatchObject({ name: "KeyStoreUnavailable", reason: "blocked" });
  expect(tokens.getSession()).toBeNull(); expect(changed).not.toHaveBeenCalled();
  old.close();
  expect(await tokens.load()).toEqual(session);
  expect(tokens.getSession()?.accountId).toBe(session.accountId);
});

it("rejects a failed account read as unknown identity instead of publishing signed-out", async () => {
  const store = createMemoryKeyStore(); vi.spyOn(store, "loadSession").mockRejectedValue(new KeyStoreUnavailable("open"));
  const tokens = new TokenStore(store); const changed = vi.fn(); tokens.subscribe(changed);
  await expect(tokens.load()).rejects.toMatchObject({ reason: "open" }); expect(changed).not.toHaveBeenCalled();
});
