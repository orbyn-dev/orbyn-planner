import { useRef, useState } from "react";
import { usePopover } from "../../ui/primitives/usePopover";
import { LIST_COLOURS, type Tag } from "../../core/planner/types";
import { TagChip, tagLabels } from "./TagChips";

/**
 * The Tags row of the task panel, after List (Planner Designs v51, task-panel-tags and p-row-tags): the task's tag chips and a small "+", or a
 * muted "Add tag" when it has none. It opens a popover with a search field, the existing tags with checkboxes and "Create tag “…”" when no
 * tag has exactly that name. Changes apply at once; Escape or a click outside closes it and focus returns to the row.
 */
export function TagsRow({ tags, taskTags, max, onToggle, onCreate }: { tags: readonly Tag[]; taskTags: readonly string[]; max: number; onToggle: (tagId: string, on: boolean) => void; onCreate: (name: string, colour: (typeof LIST_COLOURS)[number]) => Tag }) {
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState("");
  const anchor = useRef<HTMLButtonElement>(null);
  const pop = usePopover(open, () => setOpen(false), anchor);
  const live = tags.filter((t) => t.deletedAt === null);
  const labels = tagLabels(tags);
  const chosen = live.filter((t) => taskTags.includes(t.id));
  const full = taskTags.length >= max;
  const query = find.trim();
  const shown = live.filter((t) => (labels.get(t.id) ?? t.name).toLowerCase().includes(query.toLowerCase()));
  const exact = live.some((t) => t.name.trim().toLowerCase() === query.toLowerCase());
  const canCreate = query !== "" && !exact && !full;
  const summary = chosen.length === 0 ? "none" : chosen.map((t) => labels.get(t.id) ?? t.name).join(", ");
  const create = () => {
    const tag = onCreate(query, LIST_COLOURS[live.length % LIST_COLOURS.length]!);
    onToggle(tag.id, true);
    setFind("");
  };
  return (
    <div className="kv">
      <span>Tags</span>
      <b className="ctl sync-wrap">
        <button ref={anchor} type="button" className="inp rowval tags-btn" aria-haspopup="dialog" aria-expanded={open} aria-label={`Tags, ${summary}`} onClick={() => {
          setFind("");
          setOpen(!open);
        }}>
          {chosen.length === 0 ? (
            <span className="t3">Add tag</span>
          ) : (
            <>
              {chosen.map((t) => <TagChip key={t.id} tag={t} label={labels.get(t.id)} />)}
              <span className="tagchip t3" aria-hidden="true">+</span>
            </>
          )}
        </button>
        {open && (
          <div ref={pop} className="card popover row-pop tags-pop" role="dialog" aria-label="Tags">
            <input
              className="field"
              aria-label="Search tags"
              placeholder="Search tags"
              value={find}
              autoFocus
              onChange={(e) => setFind(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) {
                  e.preventDefault();
                  create();
                }
              }}
            />
            <div className="opt-menu" role="group" aria-label="Tags">
              {shown.map((t) => {
                const on = taskTags.includes(t.id);
                return (
                  <label key={t.id} className="opt tag-opt">
                    <input type="checkbox" className="check" checked={on} disabled={!on && full} onChange={(e) => onToggle(t.id, e.target.checked)} />
                    <span>{labels.get(t.id) ?? t.name}</span>
                  </label>
                );
              })}
            </div>
            {canCreate && (
              <>
                <div className="cm-sep" role="separator" />
                <button type="button" className="opt" onClick={create}>
                  <span>Create tag “{query}”</span>
                  <span className="k t3" aria-hidden="true">Enter</span>
                </button>
              </>
            )}
            {full && <p className="t3 small" role="note">{`A task can have ${max} tags at most.`}</p>}
            <p className="t3 row-pop-note">Changes apply as you pick; there is no Save. Escape or a click outside closes it and focus returns to the row.</p>
          </div>
        )}
      </b>
    </div>
  );
}
