import { useLayoutEffect, useRef, type RefObject } from "react";
import { EASING, motionMs } from "../styles/tokens";

const SLOT_SHIFT_PX = 6;
/** More rows than this arriving or leaving at once is a page loading or a bulk change, not one row, and does not move. */
const MOST_ROWS_THAT_MOVE = 2;

const reducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Seen {
  top: number;
  node: HTMLElement;
}

/**
 * Rows arriving and leaving a list (Motion Designs `additem` and `delete`). A new row fades in and rises 6 px (200 ms) while the rows
 * below it make room; a deleted row fades out (140 ms) while the rows below it close up at once, in the same moment, and it takes no
 * space. Under reduced motion a new row only fades in, the rows jump, and a deleted row only fades. Rows are the children that carry
 * `data-row-id`; the list itself is a positioned element. Only transform and opacity animate.
 */
export function useRowMotion(list: RefObject<HTMLElement | null>): void {
  const before = useRef<Map<string, Seen> | null>(null);
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const rows = [...el.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.dataset.rowId !== undefined);
    const base = el.getBoundingClientRect().top;
    const now = new Map<string, Seen>();
    for (const row of rows) now.set(row.dataset.rowId!, { top: row.getBoundingClientRect().top - base, node: row });
    const was = before.current;
    before.current = new Map([...now].map(([id, s]) => [id, { top: s.top, node: s.node.cloneNode(true) as HTMLElement }]));
    if (!was || typeof el.animate !== "function") return;

    const arrived = [...now.keys()].filter((id) => !was.has(id));
    const left = [...was.keys()].filter((id) => !now.has(id));
    if (arrived.length > MOST_ROWS_THAT_MOVE || left.length > MOST_ROWS_THAT_MOVE) return;
    const reduced = reducedMotion();

    for (const [id, seen] of now) {
      const old = was.get(id);
      if (old) {
        const dy = old.top - seen.top;
        if (dy !== 0 && !reduced) seen.node.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], { duration: motionMs("base"), easing: EASING.out });
      } else {
        const frames = reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: `translateY(-${SLOT_SHIFT_PX}px)` }, { opacity: 1, transform: "translateY(0)" }];
        seen.node.animate(frames, { duration: motionMs("base"), easing: EASING.out });
      }
    }
    for (const id of left) {
      const gone = was.get(id)!;
      // A copy where the row was, over the list, so it can fade while the list has already closed up.
      const ghost = gone.node;
      ghost.setAttribute("aria-hidden", "true");
      ghost.removeAttribute("data-row-id");
      ghost.style.cssText = `position:absolute;left:0;right:0;top:${gone.top}px;pointer-events:none;`;
      el.appendChild(ghost);
      const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: motionMs("baseOut"), easing: EASING.io });
      fade.onfinish = () => ghost.remove();
    }
  });
}
