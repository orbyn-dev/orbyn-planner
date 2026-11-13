// @vitest-environment node
//
// Sync through the engine's real module against the mock record store: two paired devices, their stores
// in memory, a server that versions records and refuses stale writes like the real one.
import { describe, expect, it } from "vitest";
import { emptySyncState } from "../../data/account/keyStore";
import { runCycle } from "./syncCycle";
import { removeDevice } from "./flows";
import { createSyncRig, type SyncRig, type TestDevice } from "../../testing/syncRig";

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
