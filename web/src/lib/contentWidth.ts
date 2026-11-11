import { useEffect, type RefObject } from "react";

/**
 * The sheet's own width, not the window's: the sidebar (180 to 420 px) takes some of the window, so a media query on the viewport cannot tell how
 * much room a page has. These two limits set `data-narrow` and `data-tight` on the page column, and the styles key on them. The side panel is
 * not subtracted, so a page with its panel beside it keeps the layout it was designed with.
 */
export const NARROW_BELOW = 720;
export const TIGHT_BELOW = 560;
/** A sheet narrower than this (420 px for the panel and at least 460 px for the page) has no room for the side panel beside a usable page, so the panel covers the page (`data-overlay`). */
export const OVERLAY_BELOW = 880;

export function widthFlags(width: number): { narrow: boolean; tight: boolean } {
  return { narrow: width < NARROW_BELOW, tight: width < TIGHT_BELOW };
}

export const overlayFlag = (width: number): boolean => width < OVERLAY_BELOW;

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

/** On the sheet that holds the page and its side panel: sets `data-overlay` on it while it is too narrow for the panel beside the page. */
export function useSheetOverlay(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = (width: number) => el.toggleAttribute("data-overlay", overlayFlag(width));
    apply(el.getBoundingClientRect().width);
    const watch = new ResizeObserver((entries) => {
      for (const entry of entries) apply(entry.contentRect.width);
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, [ref]);
}
