// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { createSyncRig } from "../../testing/syncRig";
import { runCycle } from "./syncCycle";
import { readNoteLinkIndex } from "../../data/account/noteLinkIndex";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function fixture() {
  vi.stubEnv("VITE_ECOSYSTEM_SYNC", "1");
  const r = await createSyncRig();
  const task = r.a.store.addTask({ title: "Linked task" });
  const zone = `notes-links:${r.a.session.deviceId}`, id = crypto.randomUUID();
  await r.a.services.api.createZone(zone);
  const stage = async (recordId: string, title: string) => r.a.services.engine.run(r.a.session, engine => {
    const sync = engine.sync!; sync.createZoneKey(zone);
    sync.stage(zone, "orbyn_note_task_link_v1", recordId, JSON.stringify({ link: { stamp: JSON.parse(sync.tick(r.clock.now)), value: {
      accountId: r.a.session.accountId, noteId: "saved-note", taskId: task.id,
      taskZone: "list:inbox", noteTitle: title, active: true,
    } } }));
  });
  await stage(id, "First note title"); await runCycle(r.a.services, r.a.session, r.a.store);
  return { r, zone, id, stage };
}
it("recovers backlink IDs after the engine token commits but metadata saving fails", async () => {
  const { r, zone, id } = await fixture();
  const keys = r.b.keys;
  const load = keys.loadSyncState.bind(keys), save = keys.saveSyncState.bind(keys);
  vi.spyOn(keys, "loadSyncState").mockImplementation(async () => structuredClone(await load()));
  let failed = false;
  vi.spyOn(keys, "saveSyncState").mockImplementation(async state => {
    if (!failed && state.noteLinks?.[zone]?.includes(id)) { failed = true; throw new Error("Metadata save failed"); }
    await save(structuredClone(state));
  });
  r.b.store.addTask({ title: "Unsent Planner edit" });
  await expect(runCycle(r.b.services, r.b.session, r.b.store)).rejects.toThrow("Metadata save failed");
  expect((await load())?.noteLinks?.[zone] ?? []).not.toContain(id);
  await runCycle(r.b.services, r.b.session, r.b.store);
  expect((await load())?.noteLinks?.[zone]).toContain(id);
  expect(r.b.store.getState().outbox).toEqual([]);
});
it("replays an old advanced cursor when upgrading an incomplete backlink index", async () => {
  const { r, zone, id } = await fixture();
  await runCycle(r.b.services, r.b.session, r.b.store);
  const state = (await r.b.keys.loadSyncState())!;
  state.noteLinks = {}; await r.b.keys.saveSyncState(state);
  await r.b.services.engine.run(r.b.session, engine => {
    const sync = engine.sync!, stamp = JSON.parse(sync.tick(r.clock.now + 1));
    sync.stage("planner-local-note-links-v1", "planner_note_link_index_v1", "index", JSON.stringify({ index: { value: {}, stamp }, replay_complete: { value: false, stamp } }));
  });
  r.clock.now += 2;
  await runCycle(r.b.services, r.b.session, r.b.store);
  expect((await r.b.keys.loadSyncState())?.noteLinks?.[zone]).toContain(id);
});
it("quarantines excess relationships while syncing Planner edits and existing relationships", async () => {
  const { r, zone, id, stage } = await fixture();
  await runCycle(r.b.services, r.b.session, r.b.store);
  const state = (await r.b.keys.loadSyncState())!;
  state.noteLinks = { [zone]: [id, ...Array.from({ length: 9999 }, () => crypto.randomUUID())] };
  await r.b.keys.saveSyncState(state);
  // Seed the encrypted index protocol as a saved full-cap library, too.
  await r.b.services.engine.run(r.b.session, engine => {
    const sync = engine.sync!, local = "planner-local-note-links-v1";
    sync.createZoneKey(local);
    sync.stage(local, "planner_note_link_index_v1", "index", JSON.stringify({ index: { value: state.noteLinks, stamp: JSON.parse(sync.tick(r.clock.now)) } }));
  });
  r.clock.now++;
  const excess = crypto.randomUUID();
  await stage(id, "Updated existing title"); await stage(excess, "Excess link");
  await runCycle(r.a.services, r.a.session, r.a.store);
  r.b.store.addTask({ title: "Must still upload" });
  const report = await runCycle(r.b.services, r.b.session, r.b.store);
  expect(report.uploaded).toBeGreaterThan(0);
  const saved = (await r.b.keys.loadSyncState())!;
  expect(saved.noteLinks?.[zone]).toHaveLength(10000);
  expect(saved.quarantined[zone]).toContain(excess);
  await r.b.services.engine.run(r.b.session, engine => {
    expect(engine.sync!.record(zone, id)).toContain("Updated existing title");
  });
});
it("retains new backlink IDs after correcting a two-hour-fast clock without advancing remote edit stamps", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const { r, zone, id, stage } = await fixture();
  const corrected = r.clock.now + 100;
  r.clock.now += 2 * 60 * 60 * 1000;
  await runCycle(r.b.services, r.b.session, r.b.store);
  r.clock.now = corrected;
  const next = crypto.randomUUID();
  await stage(next, "Arrived after correcting the clock");
  await runCycle(r.a.services, r.a.session, r.a.store);
  await runCycle(r.b.services, r.b.session, r.b.store);
  await r.b.services.engine.run(r.b.session, engine => {
    expect(readNoteLinkIndex(engine.sync!)?.[zone]).toEqual(expect.arrayContaining([id, next]));
    expect(JSON.parse(engine.sync!.tick(r.clock.now)).millis).toBeLessThanOrEqual(r.clock.now);
  });
  await runCycle(r.b.services, r.b.session, r.b.store);
  expect((await r.b.keys.loadSyncState())?.noteLinks?.[zone]).toContain(next);
});
