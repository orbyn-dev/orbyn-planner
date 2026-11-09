import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { usePopover } from "../../ui/primitives/usePopover";

export interface CardLane {
  key: string;
  label: string;
}

/** Alt+Left and Alt+Right on a focused card move it one lane: the key of the lane to go to, or null at an end (or for any other key). */
export function laneForKey(e: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">, lanes: readonly CardLane[], current: string): string | null {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return null;
  const at = lanes.findIndex((l) => l.key === current);
  const next = lanes[at + (e.key === "ArrowLeft" ? -1 : 1)];
  return at < 0 || !next ? null : next.key;
}

/** What a screen reader says about a card: its title, its lane and its place in the lane. */
export const cardLabel = (title: string, lane: string, index: number, of: number) => `${title}, in ${lane}, ${index + 1} of ${of}`;

/**
 * The "…" button of a board card and its menu (Planner Designs p-board-card-menu): Open, Mark done, and Move to with the lanes, the current
 * one checked and disabled. It shows on hover and on focus. Enter or Space opens it, the arrows move, Enter picks, Escape closes and puts
 * focus back on the button (the shared popover code).
 */
export function CardMenu({ title, lanes, current, done, onOpen, onMarkDone, onMove }: { title: string; lanes: readonly CardLane[]; current: string; done: boolean; onOpen: () => void; onMarkDone: () => void; onMove: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    setMoving(false);
  };
  const pop = usePopover(open, close, anchor);
  const menu = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  /** Both lists are placed on the screen, not inside the board, so a lane that scrolls or clips never cuts them off. */
  const [place, setPlace] = useState<{ menu: CSSProperties; sub: CSSProperties } | null>(null);
  useLayoutEffect(() => {
    if (!open || !anchor.current) return setPlace(null);
    const a = anchor.current.getBoundingClientRect();
    const m = pop.current?.getBoundingClientRect();
    const r = row.current?.getBoundingClientRect();
    const left = Math.min(a.left, window.innerWidth - (m?.width ?? 176) - 8);
    setPlace({
      menu: { position: "fixed", top: a.bottom + 4, left: Math.max(8, left), right: "auto" },
      sub: r && m ? { position: "fixed", top: r.top - 5, left: m.right + 4, right: "auto" } : {},
    });
  }, [open, moving, anchor, pop]);
  const items = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]:not(:disabled)") ?? [])];

  useEffect(() => {
    if (open) items()[0]?.focus();
  }, [open]);
  useEffect(() => {
    if (moving) menu.current?.querySelector<HTMLButtonElement>("[role=menuitemradio]:not(:disabled)")?.focus();
  }, [moving]);

  const onKey = (e: KeyboardEvent) => {
    const list = items();
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const next = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : e.key === "ArrowDown" ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
      list[next]!.focus();
    } else if (e.key === "ArrowRight" && (document.activeElement as HTMLElement | null)?.dataset.sub === "move") {
      e.preventDefault();
      setMoving(true);
    } else if (e.key === "ArrowLeft" && moving) {
      e.preventDefault();
      setMoving(false);
      requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>("[data-sub=move]")?.focus());
    }
  };

  return (
    <div className="sync-wrap card-more">
      <button ref={anchor} type="button" className="more-btn icon-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`More for ${title}`} onClick={() => (open ? close() : setOpen(true))}>
        <span aria-hidden="true">…</span>
      </button>
      {open && (
        <div ref={pop} className="card popover chip-menu card-menu" style={place?.menu}>
          <div ref={menu} role="menu" aria-label={`${title}`} onKeyDown={onKey}>
            <button type="button" role="menuitem" className="opt" onClick={() => { close(); onOpen(); }}>Open</button>
            <button type="button" role="menuitem" className="opt" disabled={done} onClick={() => { close(); onMarkDone(); }}>Mark done</button>
            <div className="cm-sep" role="separator" />
            <div className="cm-row" ref={row}>
              <button type="button" role="menuitem" className="opt" data-sub="move" aria-haspopup="menu" aria-expanded={moving} onClick={() => setMoving(!moving)}>
                <span>Move to</span>
                <span className="k t3" aria-hidden="true">›</span>
              </button>
              {moving && (
                <div className="card popover card-sub" role="menu" aria-label="Move to" style={place?.sub}>
                  {lanes.map((l) => (
                    <button key={l.key} type="button" role="menuitemradio" aria-checked={l.key === current} disabled={l.key === current} className="opt" onClick={() => { close(); onMove(l.key); }}>
                      {l.key === current && (
                        <svg className="ic sm" viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      <span>{l.label}</span>
                      {l.key === current && <span className="k" aria-hidden="true">Current</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
