import { useMemo, useState } from "react";
import { useNow } from "../../state/clock";
import { useUi } from "../../ui/product/UiProvider";
import { usePlannerSelector, useStore } from "../../state/store";
import { describeParse, parseQuickAdd } from "./quickAdd";

/** `listId` is where a task goes when the words name no list of their own (the open list on the Lists page). */
export function QuickAddField({ listId, example = "Call Sam tomorrow 3pm #work !high" }: { listId?: string; example?: string } = {}) {
  const store = useStore();
  const lists = usePlannerSelector((state) => state.lists);
  const ready = usePlannerSelector((state) => state.ready);
  const ui = useUi();
  const now = useNow();
  const [text, setText] = useState("");
  const [keep, setKeep] = useState(false);
  const typed = text.trim();
  const parsed = useMemo(
    () => (keep ? { title: typed, due: null, listId: null, priority: "none" as const, repeat: null } : parseQuickAdd(text, now, lists)),
    [text, typed, keep, now, lists],
  );
  const preview = keep ? "" : describeParse(parsed, lists, now);

  return (
    <div className="addbar">
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!typed) return;
        const task = store.addTask({ title: parsed.title, due: parsed.due, listId: parsed.listId ?? listId, priority: parsed.priority, repeat: parsed.repeat });
        ui.showToast(`Added “${task.title}”`);
        setText("");
      }}
    >
      <input
        className="field"
        aria-label="Add a task"
        placeholder={`Add a task: ${example}`}
        value={text}
        disabled={!ready}
        onChange={(e) => setText(e.target.value)}
      />
    </form>
    <div className="hint-row">
      <p className="hint" aria-live="polite">{preview}</p>
      {(preview !== "" || keep) && (
        <label className="check-row">
          <input type="checkbox" className="check" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          Keep as typed
        </label>
      )}
    </div>
    </div>
  );
}
