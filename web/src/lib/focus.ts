/**
 * Puts focus back on a row after something took it away, such as Undo restoring a deleted item.
 * Rows carry `data-row-id`; the row's own button (its title) gets focus. Waits a tick for the row to be drawn.
 */
export function focusRow(id: string): void {
  document.dispatchEvent(new CustomEvent("planner:reveal-row", { detail: id }));
  setTimeout(() => {
    const el = document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`);
    if (!el) return;
    const target = el.matches("button, input") ? el : (el.querySelector<HTMLElement>(".tt, .what, button") ?? el);
    target.focus();
  }, 0);
}

let pendingCard: { id: string; source: Element | null; path: string } | null = null;

/** Read the pending request without walking a list when no move is waiting. */
export function pendingCardId(): string | null {
  if (pendingCard && pendingCard.path !== window.location.pathname) pendingCard = null;
  return pendingCard?.id ?? null;
}

/** A destination list claims the move after its new items have committed. */
export function takePendingCard(id: string, destination: Element): boolean {
  if (pendingCard && pendingCard.path !== window.location.pathname) pendingCard = null;
  if (!pendingCard || pendingCard.id !== id || pendingCard.source === destination) return false;
  pendingCard = null;
  return true;
}

/** Puts focus on a board card after it is drawn in its new lane. */
export function focusCard(id: string): void {
  const card = document.querySelector<HTMLElement>(`li[data-row-id="${CSS.escape(id)}"]`);
  const request = { id, source: card?.parentElement ?? null, path: window.location.pathname };
  pendingCard = request;
  setTimeout(() => { if (pendingCard === request) pendingCard = null; }, 5000);
  setTimeout(() => {
    if (window.location.pathname !== request.path) { if (pendingCard === request) pendingCard = null; return; }
    if (pendingCard && pendingCard !== request) return;
    document.dispatchEvent(new CustomEvent("planner:reveal-row", { detail: id }));
    const target = document.querySelector<HTMLElement>(`li[data-row-id="${CSS.escape(id)}"]`);
    if (target && target.parentElement !== request.source) {
      if (pendingCard === request) pendingCard = null;
      target.focus();
    }
  }, 0);
}
