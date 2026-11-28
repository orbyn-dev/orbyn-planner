import { describe, expect, it } from "vitest";
import { isNoteLinkZone, readNoteLink, noteAppLink } from "./noteLinks";
const accountId = "11111111-1111-4111-8111-111111111111", deviceId = "22222222-2222-4222-8222-222222222222";
const zone = `notes-links:${deviceId}`;
const record = (patch = {}) => ({ record_type: "orbyn_note_task_link_v1", fields: { link: { value: { accountId, noteId: "opaque-note", taskId: deviceId, taskZone: "list:inbox", noteTitle: "Synthetic note", active: true, ...patch } } } });
describe("encrypted note relationship boundary", () => {
  it("keeps the configured Notes subpath while replacing link identity and clearing stale fragments", () => {
    const link = noteAppLink("https://example.test/notes/?theme=dim&orbynNote=old#note/old", accountId, "new-note");
    expect(link?.pathname).toBe("/notes/");
    expect(link?.searchParams.get("theme")).toBe("dim");
    expect(link?.searchParams.get("orbynNote")).toBe("new-note");
    expect(link?.searchParams.get("orbynAccount")).toBe(accountId);
    expect(link?.hash).toBe("");
    expect(noteAppLink("http://external.test/notes/", accountId, "n")).toBeNull();
  });
  it("accepts an existing Inbox task and opaque note identity", () => {
    expect(readNoteLink(zone, deviceId, record(), accountId)?.noteId).toBe("opaque-note");
  });
  it("does not expose another account's relationship", () => {
    expect(readNoteLink(zone, deviceId, record({ accountId: deviceId }), accountId)).toBeNull();
  });
  it("rejects arbitrary zones and malformed link fields", () => {
    expect(isNoteLinkZone("notes-links:not-a-device")).toBe(false);
    expect(readNoteLink("list:inbox", deviceId, record(), accountId)).toBeNull();
    expect(readNoteLink(zone, deviceId, record({ taskZone: "https://example.test" }), accountId)).toBeNull();
    expect(readNoteLink(zone, deviceId, record({ active: "true" }), accountId)).toBeNull();
  });
});
