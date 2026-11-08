/**
 * Puts focus back on a row after something took it away, such as Undo restoring a deleted item.
 * Rows carry `data-row-id`; the row's own button (its title) gets focus. Waits a tick for the row to be drawn.
 */
export function focusRow(id: string): void {
  setTimeout(() => {
    const el = document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`);
    if (!el) return;
    const target = el.matches("button, input") ? el : (el.querySelector<HTMLElement>(".tt, .what, button") ?? el);
    target.focus();
  }, 0);
}

/** Puts focus on a board card itself (it has a tab stop), once it is drawn in its new lane: a card moved with the keyboard keeps focus. */
export function focusCard(id: string): void {
  setTimeout(() => {
    document.querySelector<HTMLElement>(`li[data-row-id="${CSS.escape(id)}"]`)?.focus();
  }, 0);
}
