// @vitest-environment node
//
// Sync through the engine's real module against the mock record store: two paired devices, their stores
// in memory, a server that versions records and refuses stale writes like the real one.
import { describe, expect, it, vi } from "vitest";
import { emptySyncState } from "../../data/account/keyStore";
import { createEngineHost } from "../../data/account/engineHost";
import { StaleOperation } from "../../data/local/persistence";
import { runCycle } from "./syncCycle";
import { removeDevice } from "./flows";
import { createSyncRig, type SyncRig, type TestDevice } from "../../testing/syncRig";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { IdbPersistence } from "../../data/local/persistence";
import { LocalStore } from "../../data/local/LocalStore";

const sync = (_r: SyncRig, d: TestDevice) => runCycle(d.services, d.session, d.store);
const titles = (d: TestDevice) => d.store.getState().tasks.map((t) => t.title).sort();
/** The key ids the server holds for a zone, to one recipient device. */
const keyIds = (r: SyncRig, zone: string, recipient: string) =>
  [...r.engine.accounts.values()][0]!.records!.envelopes.filter((e) => e.zone === zone && e.recipient_device_id === recipient).map((e) => e.key_id).sort();

describe("outgoing and incoming", () => {
  it("a task made on A reaches B, and A's outbox is cleared only once it was acknowledged", async () => {
    const r = await createSyncRig();
    r.a.store.addTask({ title: "Buy milk" });
    expect(r.a.store.getState().outbox.length).toBeGreaterThan(0);
    const report = await sync(r, r.a);
    expect(report.uploaded).toBeGreaterThan(0);
    expect(r.a.store.getState().outbox).toEqual([]);
    await sync(r, r.b);
    expect(titles(r.b)).toEqual(["Buy milk"]);
    // What arrived is not an edit of B's: nothing to send back.
    expect(r.b.store.getState().outbox).toEqual([]);
    // The server holds only ciphertext.
    const zone = [...[...r.engine.accounts.values()][0]!.records!.zones.values()].find((z) => z.name.startsWith("list:"))!;
    const stored = [...zone.records.values()].find((x) => x.record_type === "task")!;
    expect(stored.ciphertext).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain("Buy milk");
  });

  it("zones are one per list, project and calendar, named by kind and id", async () => {
    const r = await createSyncRig();
    const list = r.a.store.addList("Home", "c2");
    r.a.store.addTask({ title: "Mow", listId: list.id });
    const project = r.a.store.addProject({ name: "House", colour: "c3" });
    await sync(r, r.a);
    const names = [...[...r.engine.accounts.values()][0]!.records!.zones.keys()].sort();
    expect(names).toContain(`list:${list.id}`);
    expect(names).toContain(`project:${project.id}`);
    expect(names.some((n) => n.startsWith("calendar:"))).toBe(true);
    expect(names).toContain("list:inbox");
  });

  it("a list made on B shows on A with its tasks, and the keys came through the keychain", async () => {
    const r = await createSyncRig();
    const list = r.b.store.addList("Trip", "c3");
    r.b.store.addTask({ title: "Passport", listId: list.id });
    await sync(r, r.b);
    await sync(r, r.a);
    expect(r.a.store.getState().lists.map((l) => l.name)).toContain("Trip");
    expect(titles(r.a)).toContain("Passport");
  });

  it("both edit offline and converge: different fields keep both, the same field keeps the later", async () => {
    const r = await createSyncRig();
    const task = r.a.store.addTask({ title: "Plan", notes: "" });
    await sync(r, r.a);
    await sync(r, r.b);
    r.clock.now += 1000;
    r.a.store.updateTask(task.id, { notes: "from A" });
    r.clock.now += 1000;
    r.b.store.updateTask(task.id, { priority: "high", title: "Plan it" });
    r.clock.now += 1000;
    r.a.store.updateTask(task.id, { title: "Plan it properly" }); // the latest edit of the title
    await sync(r, r.a);
    await sync(r, r.b);
    await sync(r, r.a);
    for (const [name, d] of [["A", r.a], ["B", r.b]] as const) {
      const t = d.store.getState().tasks.find((x) => x.id === task.id)!;
      expect({ name, title: t.title, notes: t.notes, priority: t.priority }).toEqual({ name, title: "Plan it properly", notes: "from A", priority: "high" });
    }
    expect(r.a.store.getState().outbox).toEqual([]);
    expect(r.b.store.getState().outbox).toEqual([]);
  });

  it("an edit made while an upload was out is not lost", async () => {
    const r = await createSyncRig();
    const task = r.a.store.addTask({ title: "One" });
    await sync(r, r.a);
    r.a.store.updateTask(task.id, { title: "Two" });
    const during = sync(r, r.a);
    r.a.store.updateTask(task.id, { title: "Three" }); // before the cycle reaches the acknowledgement
    await during;
    await sync(r, r.a);
    await sync(r, r.b);
    expect(r.b.store.getState().tasks.find((x) => x.id === task.id)?.title).toBe("Three");
  });

  it("a hard delete is a signed delete that removes the record on the other device", async () => {
    const r = await createSyncRig();
    const task = r.a.store.addTask({ title: "Doomed" });
    await sync(r, r.a);
    await sync(r, r.b);
    expect(titles(r.b)).toEqual(["Doomed"]);
    // The purge after 30 days, as the store makes it.
    await r.a.persistence.apply({ at: new Date(r.clock.now).toISOString(), patches: [{ type: "task", id: task.id, op: "purge", key: "k" }] });
    r.a.store = await r.reload(r.a);
    await sync(r, r.a);
    await sync(r, r.b);
    expect(titles(r.b)).toEqual([]);
  });

  it("a soft delete is an ordinary edit and travels as one", async () => {
    const r = await createSyncRig();
    const task = r.a.store.addTask({ title: "Soft" });
    await sync(r, r.a);
    await sync(r, r.b);
    r.clock.now += 1000;
    r.a.store.deleteTask(task.id);
    await sync(r, r.a);
    await sync(r, r.b);
    expect(r.b.store.getState().tasks.find((x) => x.id === task.id)?.deletedAt).not.toBeNull();
  });

  it("a task moved to another list moves zones", async () => {
    const r = await createSyncRig();
    const home = r.a.store.addList("Home", "c2");
    const task = r.a.store.addTask({ title: "Move me" });
    await sync(r, r.a);
    await sync(r, r.b);
    r.clock.now += 1000;
    r.a.store.updateTask(task.id, { listId: home.id });
    await sync(r, r.a);
    await sync(r, r.b);
    const moved = r.b.store.getState().tasks.find((x) => x.id === task.id)!;
    expect(moved.listId).toBe(home.id);
    expect(r.b.store.getState().tasks.filter((x) => x.id === task.id)).toHaveLength(1);
  });
});

describe("offline and failures", () => {
  it("nothing is lost while the network is down, and the next cycle sends it", async () => {
    const r = await createSyncRig();
    r.a.store.addTask({ title: "Written offline" });
    r.network.down = true;
    await expect(sync(r, r.a)).rejects.toThrow();
    expect(r.a.store.getState().outbox.length).toBeGreaterThan(0);
    r.network.down = false;
    await sync(r, r.a);
    expect(r.a.store.getState().outbox).toEqual([]);
    await sync(r, r.b);
    expect(titles(r.b)).toEqual(["Written offline"]);
  });

  it("a lost answer replays instead of writing twice", async () => {
    const r = await createSyncRig();
    r.a.store.addTask({ title: "Once" });
    r.network.loseAnswer = true; // the first upload reaches the server; the answer doesn't come back
    await expect(sync(r, r.a)).rejects.toThrow();
    expect(r.a.store.getState().outbox.length).toBeGreaterThan(0); // not cleared: it was never acknowledged
    await sync(r, r.a); // the same batch, the same operation id: the server answers from its record of it
    expect(r.a.store.getState().outbox).toEqual([]);
    const zone = [...[...r.engine.accounts.values()][0]!.records!.zones.values()].find((z) => z.name === "list:inbox")!;
    expect(zone.operations.size).toBeGreaterThan(0);
    await sync(r, r.b);
    expect(titles(r.b)).toEqual(["Once"]);
    const task = [...zone.records.values()].find((x) => x.record_type === "task")!;
    expect(task.version).toBeGreaterThan(0);
  });

  it("an expired change token starts the zone over: it is fetched again from the start and nothing is lost or re-sent", async () => {
    const r = await createSyncRig();
    r.a.store.addTask({ title: "x" });
    await sync(r, r.a);
    await sync(r, r.b);
    r.a.store.addTask({ title: "new on A" });
    await sync(r, r.a);
    // The server refuses B's token once, as it would after the zone was purged past it.
    const real = r.engine.fetch;
    let refused = 0;
    let expired = 0;
    const asked: string[] = [];
    r.engine.fetch = (async (url: string, init?: RequestInit) => {
      if (/\/changes(\?|$)/.test(String(url)) && (init?.method ?? "GET") === "GET") {
        asked.push(String(url));
        if (String(url).includes("since=") && refused++ === 0) {
          expired++;
          return new Response(JSON.stringify({ code: "token_expired", message: "Too old." }), { status: 410, headers: { "content-type": "application/json" } });
        }
      }
      return real(url, init);
    }) as typeof fetch;
    r.b.store.addTask({ title: "unsent on B" });
    await sync(r, r.b);
    expect(expired).toBe(1);
    expect(asked.some((u) => !u.includes("since="))).toBe(true); // fetched again from the start
    expect(titles(r.b)).toEqual(["new on A", "unsent on B", "x"]);
    r.engine.fetch = real;
    await sync(r, r.a);
    expect(titles(r.a)).toEqual(["new on A", "unsent on B", "x"]);
    expect(r.b.store.getState().outbox).toEqual([]);
  });
});

describe("an upload refused for an expired token", () => {
  it("starts the zone over and sends the edit on the next pass, once", async () => {
    const r = await createSyncRig();
    r.a.store.addTask({ title: "Seed" });
    await sync(r, r.a);
    await sync(r, r.b);
    await sync(r, r.a); // A now holds a change token for the zone
    r.a.store.addTask({ title: "Edited once the token expired" });
    const real = r.engine.fetch;
    let refused = 0;
    r.engine.fetch = (async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && /\/v1\/zones\/[^/]+\/changes$/.test(String(url)) && refused++ === 0) {
        return new Response(JSON.stringify({ code: "token_expired", message: "Too old." }), { status: 410, headers: { "content-type": "application/json" } });
      }
      return real(url, init);
    }) as typeof fetch;
    const asked: string[] = [];
    const wrapped = r.engine.fetch;
    r.engine.fetch = (async (url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET" && /\/v1\/zones\/list%3Ainbox\/changes/.test(String(url))) asked.push(String(url));
      return wrapped(url, init);
    }) as typeof fetch;
    await sync(r, r.a); // the upload is refused: the zone is started over
    await sync(r, r.a); // fetched again from the start (no since), then the edit goes up
    expect(asked.some((u) => !u.includes("since="))).toBe(true);
    await sync(r, r.b);
    expect(titles(r.b)).toEqual(["Edited once the token expired", "Seed"]);
    expect(r.a.store.getState().outbox).toEqual([]);
  });
});

describe("a refetch after an expired token doesn't trash this device's own unsent changes", () => {
  const trashOf = (d: TestDevice, zone: string) => d.services.engine.run(d.session, (e) => Object.keys(JSON.parse(e.sync!.trash(zone)) as Record<string, unknown>));

  it("an unsent create whose upload was refused for an expired token is re-staged, reaches B and isn't trashed", async () => {
    const r = await createSyncRig();
    r.a.store.addTask({ title: "Seed" });
    await sync(r, r.a);
    await sync(r, r.b);
    const created = r.a.store.addTask({ title: "Created, upload refused" });
    const real = r.engine.fetch;
    let refused = 0;
    r.engine.fetch = (async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && /\/v1\/zones\/[^/]+\/changes$/.test(String(url)) && refused++ === 0) {
        return new Response(JSON.stringify({ code: "token_expired", message: "Too old." }), { status: 410, headers: { "content-type": "application/json" } });
      }
      return real(url, init);
    }) as typeof fetch;
    await sync(r, r.a); // abandonUpload, tokenExpired: the zone is fetched again from the start next
    await sync(r, r.a);
    await sync(r, r.b);
    expect(titles(r.b)).toEqual(["Created, upload refused", "Seed"]);
    expect(titles(r.a)).toContain("Created, upload refused");
    expect(await trashOf(r.a, "list:inbox")).not.toContain(created.id);
    expect(r.a.store.getState().outbox).toEqual([]);
  });

  it("a record that was on the server and is now gone keeps its unsent edit in the 30-day trash: delete wins, nothing is re-uploaded, the person is told", async () => {
    const r = await createSyncRig({ third: true });
    const task = r.a.store.addTask({ title: "Held", notes: "original notes" });
    await sync(r, r.a);
    await sync(r, r.b);
    r.b.store.addTask({ title: "From B so A fetches" });
    await sync(r, r.b);
    await sync(r, r.a);
    r.clock.now += 1000;
    r.a.store.updateTask(task.id, { title: "Held, edited offline" });
    // The server purged the record (and the tombstone), and refuses the token this device holds.
    const account = [...r.engine.accounts.values()][0]!;
    const zone = account.records!.zones.get("list:inbox")!;
    zone.records.delete(task.id);
    zone.changedAt.delete(task.id);
    zone.sequence += 1;
    const real = r.engine.fetch;
    let expired = 0;
    r.engine.fetch = (async (url: string, init?: RequestInit) => {
      if (/\/changes(\?|$)/.test(String(url)) && (init?.method ?? "GET") === "GET" && String(url).includes("since=") && expired++ === 0) {
        return new Response(JSON.stringify({ code: "token_expired", message: "Too old." }), { status: 410, headers: { "content-type": "application/json" } });
      }
      return real(url, init);
    }) as typeof fetch;
    // The zone's upload is refused this pass, so the outbox can't be cleared as "sent": the entry has to go with the record.
    r.network.refuseUploads.set("list:inbox", { status: 403, code: "forbidden" });
    const report = await sync(r, r.a);
    expect(report.trashedEdits).toEqual(["Held, edited offline"]); // "‘<title>’ was deleted on another device…"
    expect(titles(r.a)).not.toContain("Held, edited offline"); // gone from the screen
    expect(await trashOf(r.a, "list:inbox")).toContain(task.id); // kept for 30 days, edits included
    expect(r.a.store.getState().outbox.some((o) => o.id === task.id)).toBe(false); // dropped in the same step, not uploaded
    expect((await r.a.keys.loadSyncState())?.staged[`task:${task.id}`]).toBeUndefined();
    r.network.refuseUploads.clear();
    r.clock.now += 3_600_000; // past the backoff
    await sync(r, r.a);
    await sync(r, r.b);
    await sync(r, r.c); // a device that never held the record
    // The record is not re-uploaded, so a device that never held it never sees it (B held it from before; the server's purge
    // would expire B's token in practice, and B would drop it the same way).
    for (const d of [r.a, r.c]) expect(d.store.getState().tasks.some((t) => t.id === task.id)).toBe(false);
    expect(zone.records.has(task.id)).toBe(false); // and nothing, not even a fragment of it, was put back on the server
    expect(await trashOf(r.a, "list:inbox")).toContain(task.id);
  });
});

describe("keys and the quarantine", () => {
  it("retries an unchanged no-key queue once per pass and keeps its unsent local edit", async () => {
    const r = await createSyncRig(); const task = r.a.store.addTask({ title: "Still waiting" });
    await sync(r, r.a); await sync(r, r.b);
    await r.a.services.engine.run(r.a.session, engine => engine.sync!.rotateZoneKey("list:inbox"));
    await r.a.keys.saveSyncState({ ...(await r.a.keys.loadSyncState())!, keysSent: {} });
    r.clock.now += 1000; r.a.store.updateTask(task.id, { title: "Encrypted update" }); await sync(r, r.a);
    const hidden = vi.spyOn(r.b.services.api, "keyEnvelopes").mockResolvedValue({ envelopes: [] });
    r.b.store.updateTask(task.id, { notes: "Keep while keyless" });
    try {
      await sync(r, r.b);
      const entry = r.b.store.getState().outbox.find(item => item.id === task.id)!;
      expect(entry).toBeDefined();
      const writes = vi.spyOn(r.b.keys, "saveSyncState");
      try {
        for (let pass = 0; pass < 2; pass++) {
          writes.mockClear();
          const report = await sync(r, r.b);
          expect(report.quarantined).toBeGreaterThan(0);
          expect(r.b.store.getState().outbox.find(item => item.id === task.id)?.idempotencyKey).toBe(entry.idempotencyKey);
          expect(r.b.store.getState().tasks.find(item => item.id === task.id)?.notes).toBe("Keep while keyless");
          const prepared = writes.mock.calls.filter(([state]) => state.mirrorPending?.some(intent => intent.zone === "list:inbox" && !intent.applied));
          expect(prepared).toHaveLength(1);
          expect((await r.b.keys.loadSyncState())?.mirrorPending).toEqual([]);
        }
      } finally { writes.mockRestore(); }
    } finally { hidden.mockRestore(); }
  });

  it("recovers quarantine after a crash commits a key before its retry intent, even when envelopes are duplicates", async () => {
    const r = await createSyncRig();
    const existing = r.a.store.addTask({ title: "Original row" });
    await sync(r, r.a); await sync(r, r.b);
    await r.a.services.engine.run(r.a.session, engine => engine.sync!.rotateZoneKey("list:inbox"));
    const sender = (await r.a.keys.loadSyncState())!;
    await r.a.keys.saveSyncState({ ...sender, keysSent: {} });
    r.clock.now += 1000;
    r.a.store.updateTask(existing.id, { title: "Updated encrypted row" });
    const unseen = r.a.store.addTask({ title: "Recovered encrypted row" });
    await sync(r, r.a);
    const hiddenKeys = vi.spyOn(r.b.services.api, "keyEnvelopes").mockResolvedValue({ envelopes: [] });
    r.b.store.updateTask(existing.id, { notes: "Unsent local notes" });
    try { await sync(r, r.b); } finally { hiddenKeys.mockRestore(); }
    expect((await r.b.keys.loadSyncState())?.quarantined["list:inbox"]).toContain(unseen.id);
    expect(r.b.store.getState().outbox.some(entry => entry.id === existing.id)).toBe(true);
    const keyEnvelopes = r.b.services.api.keyEnvelopes.bind(r.b.services.api);
    let acceptingKey = false;
    const armCrash = vi.spyOn(r.b.services.api, "keyEnvelopes").mockImplementation(async () => { const envelopes = await keyEnvelopes(); acceptingKey = true; return envelopes; });
    const saveSnapshot = r.b.keys.saveSnapshot.bind(r.b.keys);
    const crash = vi.spyOn(r.b.keys, "saveSnapshot").mockImplementation(async (bytes, mirror, outcome) => {
      await saveSnapshot(bytes, mirror, outcome);
      if (acceptingKey && !mirror) { acceptingKey = false; throw new Error("crash after accepted key snapshot"); }
    });
    try { await expect(sync(r, r.b)).rejects.toThrow("crash after accepted key snapshot"); }
    finally { armCrash.mockRestore(); crash.mockRestore(); }
    expect((await r.b.keys.loadSyncState())?.mirrorPending).toEqual([]);
    r.b.store = await r.reload(r.b);
    r.b.services.engine = createEngineHost({ keys: r.b.services.keys, crypto: r.b.services.crypto, wrapSecret: r.b.services.wrapSecret, now: r.b.services.now, wrapKeyPresent: async () => true });
    const devices = await r.b.services.api.devices();
    const envelopes = await keyEnvelopes();
    const duplicate = await r.b.services.engine.run(r.b.session, engine => JSON.parse(engine.sync!.acceptEnvelopes(JSON.stringify(envelopes), JSON.stringify(devices))) as { zones: string[] });
    expect(duplicate.zones).toEqual([]);
    const serverZones = await r.b.services.api.zones();
    const caughtUp = await r.b.services.engine.run(r.b.session, engine => JSON.parse(engine.sync!.checkZones(JSON.stringify(serverZones))) as { stale: string[] });
    expect(caughtUp.stale).not.toContain("list:inbox");
    expect(titles(r.b)).not.toContain("Recovered encrypted row");
    await sync(r, r.b);
    expect(titles(r.b)).toContain("Recovered encrypted row");
    expect(r.b.store.getState().tasks.find(task => task.id === existing.id)?.notes).toBe("Unsent local notes");
    expect((await r.b.keys.loadSyncState())?.quarantined["list:inbox"]).toBeUndefined();
    await sync(r, r.a);
    expect(r.a.store.getState().tasks.find(task => task.id === existing.id)?.notes).toBe("Unsent local notes");
  });

  it("records in a zone whose key hasn't arrived wait in the quarantine, and open when it does", async () => {
    const r = await createSyncRig();
    r.a.store.addTask({ title: "Secret plans" });
    await sync(r, r.a); // A makes the zones and sends the keys to B... which B hasn't taken yet
    // B fetches before reading its envelopes: stop the keychain from answering.
    const real = r.engine.fetch;
    let hide = true;
    r.engine.fetch = (async (url: string, init?: RequestInit) => {
      if (hide && String(url).includes("/v1/keychain/envelopes") && (init?.method ?? "GET") === "GET") {
        return new Response(JSON.stringify({ envelopes: [] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return real(url, init);
    }) as typeof fetch;
    const first = await sync(r, r.b);
    expect(first.quarantined).toBeGreaterThan(0);
    expect(titles(r.b)).toEqual([]);
    hide = false;
    const second = await sync(r, r.b);
    expect(second.quarantined).toBe(0);
    expect(titles(r.b)).toEqual(["Secret plans"]);
  });
});

describe("which zones' keys reached another device", () => {
  it("a zone made here is marked as reached only once an envelope with its key was put for the other trusted device", async () => {
    const r = await createSyncRig();
    r.a.store.addTask({ title: "Buy milk" });
    await sync(r, r.a); // A makes the zones, then sends their keys to B, whom it trusts
    const state = (await r.a.keys.loadSyncState())!;
    const made = Object.keys(state.made);
    expect(made.length).toBeGreaterThan(0);
    for (const zone of made) {
      expect(state.keysSent[zone], zone).toBeTruthy();
      expect(state.keysReached?.[zone], zone).toBe(true); // an envelope really went out, not just the "owed to nobody" marker
    }
  });

  it("a send the server refuses marks nothing as reached", async () => {
    const r = await createSyncRig();
    r.network.refuseKeys = true;
    r.a.store.addTask({ title: "Buy milk" });
    await sync(r, r.a);
    const state = (await r.a.keys.loadSyncState())!;
    expect(Object.keys(state.keysReached ?? {})).toEqual([]);
  });
});

describe("removing a device rotates the keys it still holds", () => {
  /** A, B and C synced, so all three hold the Inbox zone's key. */
  async function rig() {
    const r = await createSyncRig({ third: true });
    r.a.store.addTask({ title: "Before" });
    for (const d of [r.a, r.b, r.c]) await sync(r, d);
    return r;
  }

  it("replaces the key and sends the new one to the devices that stay", async () => {
    const r = await rig();
    const before = keyIds(r, "list:inbox", r.c.id);
    expect(before.length).toBeGreaterThan(0);
    await removeDevice(r.a.services, r.a.session, r.b.device);
    await sync(r, r.a);

    const after = keyIds(r, "list:inbox", r.c.id);
    expect(after).not.toEqual(before);
    // The removed device was sent the old key and no rotation: the new key never reaches it.
    const removedHolds = new Set(keyIds(r, "list:inbox", r.b.id));
    expect(after.some((id) => !removedHolds.has(id))).toBe(true);

    // What A writes after the removal opens on C with the new key.
    r.a.store.addTask({ title: "After" });
    await sync(r, r.a);
    await sync(r, r.c);
    expect(titles(r.c)).toContain("After");
  });

  it("survives a pass that can't reach the server, and runs on the next one", async () => {
    const r = await rig();
    const before = keyIds(r, "list:inbox", r.c.id);
    await removeDevice(r.a.services, r.a.session, r.b.device);
    r.network.down = true;
    await expect(sync(r, r.a)).rejects.toThrow();
    expect(keyIds(r, "list:inbox", r.c.id)).toEqual(before); // the pass stopped before rotating
    r.network.down = false;
    await sync(r, r.a);
    expect(keyIds(r, "list:inbox", r.c.id)).not.toEqual(before);
  });

  it("rotates once: a later pass keeps the key it made", async () => {
    const r = await rig();
    await removeDevice(r.a.services, r.a.session, r.b.device);
    await sync(r, r.a);
    const after = keyIds(r, "list:inbox", r.c.id);
    await sync(r, r.a);
    expect(keyIds(r, "list:inbox", r.c.id)).toEqual(after);
    expect((await r.a.keys.loadSyncState())?.rotateZones).toBeUndefined();
  });

  it("a second remaining device notices the removal and rotates too", async () => {
    const r = await rig();
    await removeDevice(r.a.services, r.a.session, r.b.device);
    await sync(r, r.a);
    // C holds no marker: it sees a device it verified gone from the trusted set, and replaces the keys it holds.
    const before = keyIds(r, "list:inbox", r.a.id);
    await sync(r, r.c);
    expect(keyIds(r, "list:inbox", r.a.id)).not.toEqual(before);
  });

  it("a refused removal rotates nothing", async () => {
    const r = await rig();
    const before = keyIds(r, "list:inbox", r.c.id);
    r.engine.refuseNext(`/v1/devices/${r.b.id}`, 409, "deletion_scheduled", "Your account is scheduled for deletion.");
    await expect(removeDevice(r.a.services, r.a.session, r.b.device)).rejects.toThrow();
    expect((await r.a.keys.loadSyncState())?.rotateZones).toBeUndefined();
    await sync(r, r.a);
    expect(keyIds(r, "list:inbox", r.c.id)).toEqual(before);
  });

  it("a removal whose answer is lost keeps the marking, because the device may be gone", async () => {
    const r = await rig();
    const before = keyIds(r, "list:inbox", r.c.id);
    // The server applied the removal; the connection dropped before it answered, which is not an answer at all.
    r.network.dropRemove = true;
    await expect(removeDevice(r.a.services, r.a.session, r.b.device)).rejects.toThrow();
    expect((await r.a.keys.loadSyncState())?.rotateZones).toContain("list:inbox");
    await sync(r, r.a);
    expect(keyIds(r, "list:inbox", r.c.id)).not.toEqual(before);
  });

  it("a pending device was never sent a key, so its removal marks nothing", async () => {
    const r = await rig();
    await removeDevice(r.a.services, r.a.session, { ...r.b.device, state: "pending" });
    expect((await r.a.keys.loadSyncState())?.rotateZones).toBeUndefined();
  });
});

describe("an account nobody used stays unused on the server", () => {
  // The engine calls an account unused (the Start over link may delete it) while it holds no zone and no signed protection setting.
  const unused = (r: SyncRig) => {
    const account = [...r.engine.accounts.values()][0]!;
    return (account.records?.zones.size ?? 0) === 0 && (account.protection ?? []).length === 0;
  };

  it("the Inbox and the Personal calendar every device makes send nothing, and the first real action sends them with the first protection setting", async () => {
    const r = await createSyncRig();
    await r.a.keys.saveSyncState(emptySyncState()); // a new account: nothing has been sent from this device yet
    expect(r.a.store.getState().outbox.length).toBeGreaterThan(0); // the defaults are waiting
    const first = await sync(r, r.a);
    expect(first.uploaded).toBe(0);
    expect(unused(r)).toBe(true);
    expect(r.engine.calls.filter((c) => c.path.startsWith("/v1/zones") && c.method !== "GET")).toEqual([]);

    r.a.store.addTask({ title: "Buy milk" });
    const second = await sync(r, r.a);
    expect(second.uploaded).toBeGreaterThan(0);
    expect(unused(r)).toBe(false);
    const account = [...r.engine.accounts.values()][0]!;
    const signed = () => r.engine.calls.filter((c) => c.path === "/v1/keychain/protection" && c.method === "POST").length;
    expect(signed()).toBe(1); // signed once, with the first real upload
    expect([...account.records!.zones.keys()]).toContain("list:inbox");
    await sync(r, r.a);
    expect(signed()).toBe(1);
  });

  it("two devices that sync before any action leave the account unused", async () => {
    const r = await createSyncRig();
    await r.a.keys.saveSyncState(emptySyncState());
    await r.b.keys.saveSyncState(emptySyncState());
    await sync(r, r.a);
    await sync(r, r.b);
    expect(unused(r)).toBe(true);
    expect(r.engine.calls.filter((c) => c.path === "/v1/keychain/protection" && c.method === "POST")).toEqual([]);
  });
});

describe("storage mirror preparation races", () => {
  it("fetches multiple successful pages without full reads of unrelated planner record stores", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    const r = await createSyncRig();
    await sync(r, r.a);
    // The mock's cursor is a batch sequence, so each page boundary needs its own committed batch.
    for (let index = 0; index < 5; index++) { r.a.store.addTask({ title: `page task ${index}` }); await sync(r, r.a); }
    const persistence = new IdbPersistence("sync-page-read-count");
    const local = new LocalStore({ persistence, now: () => new Date(r.clock.now), broadcast: false });
    await local.ready;
    local.addEvent({ title: "Unrelated local history", start: "2020-01-01T10:00", end: "2020-01-01T11:00" });
    await local.flush();
    await local.acknowledge(local.getState().outbox.map(entry => ({ type: entry.type, id: entry.id, idempotencyKey: entry.idempotencyKey })));
    r.b.store = local;
    const fetch = r.engine.fetch; let pages = 0;
    const pageSize = vi.spyOn(r.engine, "fetch").mockImplementation((url, init) => {
      const request = new URL(String(url), "http://engine.test");
      if ((init?.method ?? "GET") === "GET" && request.pathname.endsWith("/changes")) { request.searchParams.set("limit", "1"); pages++; }
      return fetch(request.toString(), init);
    });
    const load = vi.spyOn(persistence, "load");
    const readAll = vi.spyOn(IDBObjectStore.prototype, "getAll");
    try {
      await sync(r, r.b);
      expect(pages).toBeGreaterThan(2);
      expect(titles(r.b)).toEqual(Array.from({ length: 5 }, (_, index) => `page task ${index}`));
      expect(local.getState().events.map(event => event.title)).toContain("Unrelated local history");
      expect(load).not.toHaveBeenCalled();
      expect(readAll.mock.contexts.filter((context): context is IDBObjectStore => context instanceof IDBObjectStore).map(context => context.name).filter(name => ["tasks", "events", "lists", "calendars", "projects", "tags", "outbox"].includes(name))).toEqual([]);
    } finally { pageSize.mockRestore(); load.mockRestore(); readAll.mockRestore(); local.close(); vi.unstubAllGlobals(); }
  });

  it("retries the same engine page after a stale mirror and retains its records", async () => {
    const r = await createSyncRig(); r.a.store.addTask({ title: "raced page" }); await sync(r, r.a);
    const apply = r.b.store.applyRemote.bind(r.b.store);
    const spy = vi.spyOn(r.b.store, "applyRemote").mockRejectedValueOnce(new StaleOperation()).mockImplementation(apply);
    await sync(r, r.b);
    expect(titles(r.b)).toEqual(["raced page"]); expect(spy.mock.calls.length).toBeGreaterThan(1); spy.mockRestore();
  });

  it("refetches after bounded mirror retries instead of losing records behind an advanced token", async () => {
    const r = await createSyncRig(); r.a.store.addTask({ title: "retry next pass" }); await sync(r, r.a);
    const spy = vi.spyOn(r.b.store, "applyRemote").mockRejectedValue(new StaleOperation());
    await expect(sync(r, r.b)).rejects.toThrow("changed");
    expect(spy).toHaveBeenCalledTimes(3); spy.mockRestore();
    expect((await r.b.keys.loadSyncState())?.mirrorPending?.some(intent => intent.applied)).toBe(true);
    r.b.store = await r.reload(r.b);
    r.b.services.engine = createEngineHost({ keys: r.b.services.keys, crypto: r.b.services.crypto, wrapSecret: r.b.services.wrapSecret, now: r.b.services.now, wrapKeyPresent: async () => true });
    await sync(r, r.b);
    expect(titles(r.b)).toEqual(["retry next pass"]);
  });
});

describe("durable mirror restart", () => {
  it("replaces obsolete quarantine metadata with the restored engine's authoritative queue", async () => {
    const r = await createSyncRig(); r.a.store.addTask({ title: "restored page" }); await sync(r, r.a);
    const blocked = vi.spyOn(r.b.store, "applyRemote").mockRejectedValue(new StaleOperation());
    await expect(sync(r, r.b)).rejects.toThrow("changed"); blocked.mockRestore();
    const state = (await r.b.keys.loadSyncState())!;
    const zone = state.mirrorPending!.find(intent => intent.applied)!.zone;
    await r.b.keys.saveSyncState({ ...state, quarantined: { ...state.quarantined, [zone]: ["previously-evicted-id"] } });
    const envelopes = vi.spyOn(r.b.services.api, "keyEnvelopes").mockResolvedValue({ envelopes: [] });
    try {
      await sync(r, r.b);
      expect(titles(r.b)).toEqual(["restored page"]);
      expect((await r.b.keys.loadSyncState())?.quarantined[zone]).toBeUndefined();
    } finally { envelopes.mockRestore(); }
  });

  it("does not discard an intent promoted to applied after a stale prepared-only read", async () => {
    const r = await createSyncRig();
    r.a.store.addTask({ title: "racing snapshot" }); await sync(r, r.a);
    const blocked = vi.spyOn(r.b.store, "applyRemote").mockRejectedValue(new StaleOperation());
    await expect(sync(r, r.b)).rejects.toThrow("changed"); blocked.mockRestore();
    const read = r.b.keys.loadSyncState.bind(r.b.keys); let reads = 0;
    const stale = vi.spyOn(r.b.keys, "loadSyncState").mockImplementation(async () => {
      const current = await read();
      return ++reads === 2 && current ? { ...current, mirrorPending: current.mirrorPending?.map(intent => ({ ...intent, applied: false })) } : current;
    });
    await sync(r, r.b); stale.mockRestore();
    expect((await read())?.mirrorPending?.some(intent => intent.applied)).toBe(true);
    await sync(r, r.b);
    expect(titles(r.b)).toEqual(["racing snapshot"]);
  });

  it("does not treat a locally moved task absent from an unrelated page's zone as a confirmed deletion", async () => {
    const r = await createSyncRig();
    const target = r.a.store.addList("Target", "c2");
    const moved = r.a.store.addTask({ title: "unsent move" });
    const unrelated = r.a.store.addTask({ title: "other page", listId: target.id });
    await sync(r, r.a); await sync(r, r.b);
    r.clock.now += 1000; r.a.store.updateTask(unrelated.id, { title: "changed page" }); await sync(r, r.a);
    const changes = r.b.services.api.changes.bind(r.b.services.api); let movedDuringFetch = false;
    const fetch = vi.spyOn(r.b.services.api, "changes").mockImplementation(async (zone, since) => {
      const body = await changes(zone, since);
      if (zone === `list:${target.id}` && !movedDuringFetch) {
        movedDuringFetch = true; r.b.store.updateTask(moved.id, { listId: target.id }); await r.b.store.flush();
      }
      return body;
    });
    const blocked = vi.spyOn(r.b.store, "applyRemote").mockRejectedValue(new StaleOperation());
    await expect(sync(r, r.b)).rejects.toThrow("changed"); blocked.mockRestore(); fetch.mockRestore();
    r.b.store = await r.reload(r.b);
    r.b.services.engine = createEngineHost({ keys: r.b.services.keys, crypto: r.b.services.crypto, wrapSecret: r.b.services.wrapSecret, now: r.b.services.now, wrapKeyPresent: async () => true });
    r.network.refuseUploads.set(`list:${target.id}`, { status: 403, code: "forbidden" });
    const report = await sync(r, r.b);
    expect(report.trashedEdits).not.toContain("unsent move");
    expect(r.b.store.getState().outbox.some(entry => entry.id === moved.id)).toBe(true);
    r.network.refuseUploads.clear(); r.clock.now += 3_600_000;
    await sync(r, r.b); await sync(r, r.a);
    expect(r.a.store.getState().tasks.find(task => task.id === moved.id)?.listId).toBe(target.id);
  });

  it("never writes pre-reset staging metadata back after an applied intent's snapshot cannot restore", async () => {
    const r = await createSyncRig(); const task = r.a.store.addTask({ title: "before reset" });
    await sync(r, r.a); await sync(r, r.b);
    r.clock.now += 1000; r.b.store.updateTask(task.id, { notes: "unsent before reset" });
    r.a.store.updateTask(task.id, { title: "remote page" }); await sync(r, r.a);
    const blocked = vi.spyOn(r.b.store, "applyRemote").mockRejectedValue(new StaleOperation());
    await expect(sync(r, r.b)).rejects.toThrow("changed"); blocked.mockRestore();
    expect((await r.b.keys.loadSyncState())?.staged[`task:${task.id}`]).toBeDefined();
    expect(r.b.store.getState().outbox.some(entry => entry.id === task.id)).toBe(true);
    r.network.refuseUploads.set("list:inbox", { status: 403, code: "forbidden" });
    await r.b.keys.saveSnapshot(new Uint8Array([1, 2, 3]));
    r.b.services.engine = createEngineHost({ keys: r.b.services.keys, crypto: r.b.services.crypto, wrapSecret: r.b.services.wrapSecret, now: r.b.services.now, wrapKeyPresent: async () => true });
    try { await sync(r, r.b); } catch (error) { expect(String(error)).toContain("no_zone_key"); }
    const state = await r.b.keys.loadSyncState();
    expect(state?.reset).toBe(true);
    expect(state?.snapshotGeneration).toBeGreaterThan(0);
    const canonical = await r.b.services.engine.run(r.b.session, engine => engine.sync!.record("list:inbox", task.id));
    expect(canonical).toContain("unsent before reset");
    expect(r.b.store.getState().outbox.some(entry => entry.id === task.id)).toBe(true);
    r.network.refuseUploads.clear();
    await r.b.services.engine.run(r.b.session, engine => engine.sync!.pinDevice(r.a.id, r.a.device.signing_key, r.a.device.agreement_key));
    const peerState = (await r.a.keys.loadSyncState())!;
    await r.a.keys.saveSyncState({ ...peerState, keysSent: {} });
    await sync(r, r.a); await sync(r, r.b); await sync(r, r.a);
    expect(r.a.store.getState().tasks.find(item => item.id === task.id)?.notes).toBe("unsent before reset");
  });

  it("keeps a pending intent if the engine snapshot commit fails, then recovers with a new host", async () => {
    const r = await createSyncRig(); r.a.store.addTask({ title: "before snapshot failure" }); await sync(r, r.a);
    const save = r.b.keys.saveSnapshot.bind(r.b.keys);
    const spy = vi.spyOn(r.b.keys, "saveSnapshot").mockImplementation(async (bytes, applied) => { if (applied) throw new Error("snapshot refused"); return save(bytes, applied); });
    await expect(sync(r, r.b)).rejects.toThrow("snapshot refused");
    expect((await r.b.keys.loadSyncState())?.mirrorPending?.length).toBeGreaterThan(0);
    expect((await r.b.keys.loadSyncState())?.mirrorPending?.every(intent => !intent.applied)).toBe(true);
    spy.mockRestore();
    r.b.store = await r.reload(r.b);
    r.b.services.engine = createEngineHost({ keys: r.b.services.keys, crypto: r.b.services.crypto, wrapSecret: r.b.services.wrapSecret, now: r.b.services.now, wrapKeyPresent: async () => true });
    await sync(r, r.b); expect(titles(r.b)).toEqual(["before snapshot failure"]);
    expect((await r.b.keys.loadSyncState())?.mirrorPending).toEqual([]);
  });

  it("replays canonical removals after a controller restart without resurrecting pending edits", async () => {
    const r = await createSyncRig(); const t = r.a.store.addTask({ title: "deleted remotely" }); await sync(r, r.a); await sync(r, r.b);
    r.b.store.updateTask(t.id, { notes: "unsent edit" }); await r.b.store.flush();
    await r.a.persistence.apply({ at: new Date(r.clock.now).toISOString(), patches: [{ type: "task", id: t.id, op: "purge", key: "delete" }] });
    r.a.store = await r.reload(r.a); await sync(r, r.a);
    const spy = vi.spyOn(r.b.store, "applyRemote").mockRejectedValue(new StaleOperation()); await expect(sync(r, r.b)).rejects.toThrow("changed"); spy.mockRestore();
    r.b.store = await r.reload(r.b);
    r.b.services.engine = createEngineHost({ keys: r.b.services.keys, crypto: r.b.services.crypto, wrapSecret: r.b.services.wrapSecret, now: r.b.services.now, wrapKeyPresent: async () => true });
    await sync(r, r.b);
    expect(titles(r.b)).toEqual([]); expect(r.b.store.getState().outbox.some(o => o.id === t.id)).toBe(false);
  });
});
