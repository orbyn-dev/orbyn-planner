import { useState } from "react";
import { useUi } from "../../app/ui";
import { MONTHS } from "../../lib/dates";
import { usePlanner, useStore } from "../../store/context";
import { DuplicateTagName, LIST_COLOURS, type ListColour, type Tag } from "../../store/types";
import { TAG_COLOUR_NAMES, tagLabels } from "../tasks/TagChips";
import { Swatch } from "../tasks/TaskRow";

/** The four content colours, as a row of swatches: the chosen one has a ring (Planner Designs v63 p-set-tags "Tag colour"). */
function Colours({ label, value, onPick }: { label: string; value: ListColour; onPick: (c: ListColour) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="colours tag-colours">
      {LIST_COLOURS.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={TAG_COLOUR_NAMES[c]} className="colour-btn" onClick={() => onPick(c)}>
          <Swatch colour={c} />
        </button>
      ))}
    </div>
  );
}

/** One tag: its colour (click the swatch to choose another), name, how many tasks use it, Rename (the name is edited in place) and Delete. */
function TagRow({ tag, label, uses }: { tag: Tag; label: string; uses: number }) {
  const store = useStore();
  const [name, setName] = useState(tag.name);
  const [renaming, setRenaming] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const next = name.trim();
    setError(null);
    setRenaming(false);
    if (!next) setName(tag.name);
    else if (next !== tag.name) {
      try {
        store.updateTag(tag.id, { name: next });
      } catch (e) {
        if (!(e instanceof DuplicateTagName)) throw e;
        setError(`You already have a tag called ${next}.`);
        setName(tag.name);
      }
    }
  };
  return (
    <div className="kv tag-row">
      <span className="tag-name">
        <button type="button" className="tag-swatch" aria-label={`Colour of ${tag.name}`} aria-expanded={picking} onClick={() => setPicking(!picking)}>
          <Swatch colour={tag.colour} />
        </button>
        {renaming ? (
          <input
            className="inp"
            aria-label={`Name of tag ${tag.name}`}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setName(tag.name);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <span className="tag-title">{tag.name}</span>
        )}
        {label !== tag.name && <span className="t3 small">shown as {label}</span>}
      </span>
      <b className="tag-actions">
        <span className="t3">{uses} {uses === 1 ? "task" : "tasks"}</span>
        <button type="button" className="link-btn" aria-label={`Rename tag ${tag.name}`} onClick={() => setRenaming(true)}>Rename</button>
        <button type="button" className="link-btn" aria-label={`Delete tag ${tag.name}`} onClick={() => store.deleteTag(tag.id)}>Delete</button>
      </b>
      {picking && (
        <div className="tag-picker">
          <Colours label={`Colour of ${tag.name}`} value={tag.colour} onPick={(c) => { store.updateTag(tag.id, { colour: c }); setPicking(false); }} />
        </div>
      )}
      {error && <span className="err tag-error" role="alert">{error}</span>}
    </div>
  );
}

/** "3 Nov". */
const shortDate = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)}`;
};

/**
 * Settings · Tags (Planner Designs v64 p-set-tags, -empty, -add-error, -deleted-empty, -restored): the Add tag row on top, the tags with
 * their task counts, and the deleted tags with the day they went and Restore. Deleted tags are hidden while there are none.
 */
export function TagsSettings() {
  const store = useStore();
  const ui = useUi();
  const { tags, tasks } = usePlanner();
  const [name, setName] = useState("");
  const [colour, setColour] = useState<ListColour>(LIST_COLOURS[0]);
  const live = tags.filter((t) => t.deletedAt === null);
  const deleted = tags.filter((t) => t.deletedAt !== null);
  const uses = (id: string) => tasks.filter((t) => t.deletedAt === null && t.tags.includes(id)).length;
  const labels = tagLabels(tags);

  // The name is compared without regard to capitals; the error shows at once and Add stays off until the name changes.
  const taken = live.find((t) => t.name.trim().toLowerCase() === name.trim().toLowerCase());
  const add = () => {
    const next = name.trim();
    if (!next || taken) return;
    try {
      store.addTag(next, colour);
      setName("");
    } catch (e) {
      if (!(e instanceof DuplicateTagName)) throw e;
    }
  };

  return (
    <>
      <div className="card tag-add">
        <div className={taken ? "fld error" : "fld"}>
          <input
            className={taken ? "field err" : "field"}
            aria-label="New tag name"
            placeholder="New tag"
            value={name}
            aria-invalid={taken ? true : undefined}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          {taken && <span className="err" role="alert">You already have a tag called {taken.name}.</span>}
        </div>
        <Colours label="Tag colour" value={colour} onPick={setColour} />
        <button type="button" className="btn" disabled={!name.trim() || !!taken} onClick={add}>Add</button>
      </div>
      {live.length === 0 ? (
        <div className="card tags-empty">
          <b>No tags yet.</b>
          <span className="t3">Add one above, or from a task. It appears here, where you can rename it, change its colour or delete it.</span>
        </div>
      ) : (
        <div className="card" style={{ gap: 0, padding: "0 var(--sp-14)" }}>
          {live.map((t) => <TagRow key={t.id} tag={t} label={labels.get(t.id) ?? t.name} uses={uses(t.id)} />)}
        </div>
      )}
      <span className="t3 tags-note">Deleting a tag hides it. You can restore it for 30 days.</span>
      {deleted.length > 0 && (
        <>
          <div className="bh"><b>Deleted tags</b><span></span></div>
          <div className="card" style={{ gap: 0, padding: "0 var(--sp-14)" }}>
            {deleted.map((t) => (
              <div key={t.id} className="kv tag-row">
                <span className="tag-name tag-gone"><span style={{ opacity: 0.5 }}><Swatch colour={t.colour} /></span>{t.name}</span>
                <b className="tag-actions">
                  <span className="t3">Deleted {shortDate(t.deletedAt!)}</span>
                  <button
                    type="button"
                    className="link-btn"
                    aria-label={`Restore tag ${t.name}`}
                    onClick={() => {
                      store.restoreTag(t.id);
                      ui.showToast("Tag restored");
                    }}
                  >
                    Restore
                  </button>
                </b>
              </div>
            ))}
          </div>
          <span className="t3 tags-note">Restoring a tag puts it back on its tasks. Deleted tags are kept for 30 days.</span>
        </>
      )}
    </>
  );
}
