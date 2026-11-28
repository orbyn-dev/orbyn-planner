import type { SyncApi } from "../../core/account/authCrypto";
import { isNoteLinkZone } from "../../core/planner/noteLinks";
import type { Stamp } from "../../core/sync/mapping";

const ZONE = "planner-local-note-links-v1";
export type NoteLinkIndex = Record<string, string[]>;
/** This local-only encrypted record commits with the engine's change tokens.
 * It is never included in the server-zone/upload list. */
export function readNoteLinkIndex(engine: SyncApi): NoteLinkIndex | null {
  const raw = engine.record(ZONE, "index");
  if (!raw) return null;
  const record = JSON.parse(raw), index: unknown = record.fields?.index?.value;
  if (record.record_type !== "planner_note_link_index_v1" || !index || typeof index !== "object" || Array.isArray(index))
    throw new Error("The saved note-link index is invalid.");
  for (const [zone, ids] of Object.entries(index)) {
    if (!isNoteLinkZone(zone) || !Array.isArray(ids) || ids.length > 10000 || ids.some(id => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)))
      throw new Error("The saved note-link index is invalid.");
  }
  return index as NoteLinkIndex;
}
export function needsNoteLinkReplay(engine: SyncApi): boolean {
  const raw = engine.record(ZONE, "index");
  return !raw || JSON.parse(raw).fields?.replay_complete?.value !== true;
}
export function saveNoteLinkIndex(engine: SyncApi, index: NoteLinkIndex, now: number, replayComplete = false): void {
  engine.createZoneKey(ZONE);
  const stamp = JSON.parse(engine.tick(now)) as Stamp;
  const raw = engine.record(ZONE, "index");
  const fields = raw ? JSON.parse(raw).fields : {};
  // Restore intentionally skips far-future stamps when resuming the shared
  // clock. This local-only field must still replace its previous value. Advance
  // its private stamp, not the clock used to stamp remote Planner records.
  for (const name of replayComplete ? ["index", "replay_complete"] : ["index"]) {
    const previous = fields[name]?.stamp as Stamp | undefined;
    if (!previous || previous.millis < stamp.millis || previous.millis === stamp.millis && previous.counter < stamp.counter) continue;
    if (!Number.isSafeInteger(previous.millis)) throw new Error("The local note-link index clock is exhausted.");
    stamp.millis = previous.millis;
    if (previous.counter < 0xffff_ffff) stamp.counter = previous.counter + 1;
    else {
      if (!Number.isSafeInteger(previous.millis + 1)) throw new Error("The local note-link index clock is exhausted.");
      stamp.millis++; stamp.counter = 0;
    }
  }
  engine.stage(ZONE, "planner_note_link_index_v1", "index", JSON.stringify({ index: { value: index, stamp }, ...(replayComplete ? { replay_complete: { value: true, stamp } } : {}) }));
}
