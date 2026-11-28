import { useEffect, useState } from "react";
import { useAuth } from "../../state/account";
import { useSyncState } from "../../state/sync";
import { readNoteLink, type LinkedNote } from "../../core/planner/noteLinks";

/** Notes Designs 2be4f2d planner-task: note titles with Open in Notes. */
export function LinkedNotes({ taskId }: { taskId: string }) {
  const auth = useAuth(), sync = useSyncState();
  const [links, setLinks] = useState<LinkedNote[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const session = auth?.session, services = auth?.services;
    if (!session || auth?.status !== "signedIn" || !services || import.meta.env.VITE_ECOSYSTEM_SYNC !== "1") return;
    let active = true;
    void services.keys.loadSyncState().then(state => services.engine.run(session, engine => {
      if (!engine.sync) throw new Error("The sync engine is unavailable.");
      const found: LinkedNote[] = [];
      for (const [zone, ids] of Object.entries(state?.noteLinks ?? {})) for (const id of ids) {
        const raw = engine.sync.record(zone, id);
        if (!raw) continue;
        const link = readNoteLink(zone, id, JSON.parse(raw), session.accountId);
        if (link && link.active && link.taskId === taskId) found.push(link);
      }
      return found;
    })).then(value => { if (active) { setLinks(value); setError(""); } }).catch(() => { if (active) setError("Couldn’t load linked notes. Try syncing again."); });
    return () => { active = false; };
  }, [taskId, auth?.session, auth?.services, auth?.status, sync?.lastSyncedAt]);
  if (import.meta.env.VITE_ECOSYSTEM_SYNC !== "1") return null;
  let base: URL | null = null;
  try {
    const url = new URL(import.meta.env.VITE_NOTES_URL);
    if (!url.username && !url.password && (url.protocol === "https:" || url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))) base = url;
  } catch { /* An unconfigured app address cannot open external destinations. */ }
  const current = links.filter(link => link.accountId === auth?.session?.accountId && link.taskId === taskId);
  return <section aria-label="Linked notes">
    <div className="bh"><b>Notes</b><span>{current.length} linked</span></div>
    {current.map(link => {
      const url = base && new URL("/", base);
      if (url) { url.searchParams.set("orbynNote", link.noteId); url.searchParams.set("orbynAccount", link.accountId); }
      return <div className="note-links" key={link.id}><b>{link.noteTitle}</b>{url && <a href={url.href} target="_blank" rel="noopener noreferrer">Open in Notes</a>}</div>;
    })}
    {error && <p role="alert">{error}</p>}
  </section>;
}
