/** Shared encrypted relationship protocol v1. Only references and the note title
 * are exposed to Planner. A URL from a remote record is never followed. */
export const NOTE_LINK_ZONE = "notes-links:";
export type LinkedNote = { id: string; zone: string; accountId: string; noteId: string; taskId: string; taskZone: string; noteTitle: string; active: boolean };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function noteAppLink(configured: unknown, accountId: string, noteId: string): URL | null {
  if (typeof configured !== "string") return null;
  try {
    const url = new URL(configured);
    if (url.username || url.password || !(url.protocol === "https:" || url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))) return null;
    url.hash = "";
    url.searchParams.set("orbynNote", noteId);
    url.searchParams.set("orbynAccount", accountId);
    return url;
  } catch { return null; }
}
export function isNoteLinkZone(zone: string): boolean { return zone.startsWith(NOTE_LINK_ZONE) && UUID.test(zone.slice(NOTE_LINK_ZONE.length)); }
export function readNoteLink(zone: string, id: string, record: { record_type: string; fields: Record<string, { value: unknown }> }, accountId: string): LinkedNote | null {
  const value = record.fields.link?.value as Partial<LinkedNote> | undefined;
  if (!isNoteLinkZone(zone) || !UUID.test(id) || record.record_type !== "orbyn_note_task_link_v1" || !value ||
      value.accountId !== accountId || typeof value.noteId !== "string" || !value.noteId || value.noteId.length > 4096 ||
      typeof value.taskId !== "string" || !UUID.test(value.taskId) || typeof value.taskZone !== "string" ||
      !value.taskZone.startsWith("list:") || !(value.taskZone === "list:inbox" || UUID.test(value.taskZone.slice(5))) || typeof value.noteTitle !== "string" ||
      value.noteTitle.length > 1000 || typeof value.active !== "boolean") return null;
  return { ...value, id, zone } as LinkedNote;
}
