import { useNow } from "../../state/clock";
import { useUi } from "../../ui/product/UiProvider";
import { useStore } from "../../state/store";
import { LANE_LABELS, laneOf, moveTo, type Lane } from "../../core/planner/taskStatus";
import { undoableTasks } from "../../core/planner/taskRepeat";
import type { Task } from "../../core/planner/types";

/**
 * Moves a card to a lane of the Tasks board (the contract in `taskStatus.ts`). Out of Done the card is no longer done and takes the lane's
 * status, and a quiet toast says where it went, with Undo (Planner Designs p-board-from-done); to Done it says "Marked done." with Undo.
 * Undo puts the exact earlier status, done and done time back in one write. A repeating task moved to Done goes to its next date, in To do.
 */
export function useMoveTask() {
  const store = useStore();
  const ui = useUi();
  const now = useNow();
  return (task: Task, lane: Lane) => {
    const from = laneOf(task);
    if (from === lane) return;
    const stamp = new Date(now).toISOString();
    if (lane === "done" && task.repeat) {
      store.setDone(task.id, true);
      return;
    }
    const { undo } = undoableTasks(store, () => store.updateTask(task.id, moveTo(task, lane, stamp)));
    // A quiet toast with Undo for every move; a screen reader hears which card went where (Planner Designs p-board-card-moved).
    if (lane === "done") ui.showToast("Marked done.", undo, { focusRowOnUndo: task.id, ms: 5_000, spoken: "Marked done" });
    // Out of Done it names the task ("Moved “Reply to the school” to In progress"); between open lanes it is "Moved to Blocked", and a screen reader hears the task too.
    else if (from === "done") ui.showToast(`Moved “${task.title}” to ${LANE_LABELS[lane]}.`, undo, { focusRowOnUndo: task.id });
    else ui.showToast(`Moved to ${LANE_LABELS[lane]}.`, undo, { focusRowOnUndo: task.id, spoken: `Moved “${task.title}” to ${LANE_LABELS[lane]}` });
  };
}
