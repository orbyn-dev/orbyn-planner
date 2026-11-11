import { useEffect, type RefObject } from "react";

/**
 * The sheet's own width, not the window's: the sidebar (180 to 420 px) takes some of the window, so a media query on the viewport cannot tell how
 * much room a page has. These two limits set `data-narrow` and `data-tight` on the page column, and the styles key on them. The side panel is
 * not subtracted, so a page with its panel beside it keeps the layout it was designed with.
 */
export const NARROW_BELOW = 720;
export const TIGHT_BELOW = 560;

export function widthFlags(width: number): { narrow: boolean; tight: boolean } {
  return { narrow: width < NARROW_BELOW, tight: width < TIGHT_BELOW };
}

/** Watches `measure` (the sheet) and sets the flags on `target` (the page column inside it). */
export function useContentWidth(measure: RefObject<HTMLElement | null>, target: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = measure.current;
    const out = target.current;
    if (!el || !out || typeof ResizeObserver === "undefined") return;
    const apply = (width: number) => {
      const flags = widthFlags(width);
      out.toggleAttribute("data-narrow", flags.narrow);
      out.toggleAttribute("data-tight", flags.tight);
    };
    apply(el.getBoundingClientRect().width);
    const watch = new ResizeObserver((entries) => {
      for (const entry of entries) apply(entry.contentRect.width);
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, [measure, target]);
}
