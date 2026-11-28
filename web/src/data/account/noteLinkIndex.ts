import type { SyncApi } from "../../core/account/authCrypto";
import { isNoteLinkZone } from "../../core/planner/noteLinks";

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
  const stamp = JSON.parse(engine.tick(now));
  engine.stage(ZONE, "planner_note_link_index_v1", "index", JSON.stringify({ index: { value: index, stamp }, ...(replayComplete ? { replay_complete: { value: true, stamp } } : {}) }));
}
