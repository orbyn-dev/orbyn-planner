import { createContext, useContext, useEffect, useState, type RefObject } from "react";

/**
 * The sheet's own width, not the window's: the sidebar (180 to 420 px) takes some of the window, so a media query on the viewport cannot tell how
 * much room a page has. These two limits set `data-narrow` and `data-tight` on the page column, and the styles key on them. The side panel is
 * not subtracted, so a page with its panel beside it keeps the layout it was designed with.
 */
export const NARROW_BELOW = 720;
export const TIGHT_BELOW = 560;
/** Tables drop their secondary columns below this and show the detail under the title (`data-table`). */
export const TABLE_BELOW = 640;
/** Calendar week shows 3 days below this, and the toolbar moves to a second row (`week3`). */
export const WEEK3_BELOW = 760;
/** A month cell is under 90 px wide below this, so it shows colour dots instead of text chips (`dots`). */
export const DOTS_BELOW = 670;
/** A sheet narrower than this (420 px for the panel and at least 460 px for the page) has no room for the side panel beside a usable page, so the panel covers the page (`data-overlay`). */
export const OVERLAY_BELOW = 880;

export interface WidthFlags { narrow: boolean; tight: boolean; table: boolean; week3: boolean; dots: boolean }

export function widthFlags(width: number): WidthFlags {
  return { narrow: width < NARROW_BELOW, tight: width < TIGHT_BELOW, table: width < TABLE_BELOW, week3: width < WEEK3_BELOW, dots: width < DOTS_BELOW };
}

export const overlayFlag = (width: number): boolean => width < OVERLAY_BELOW;

const WIDE: WidthFlags = { narrow: false, tight: false, table: false, week3: false, dots: false };
/** The flags for pages that change what they render (not just how it looks) when narrow. Without a provider (tests, the first paint) the page is wide. */
export const ContentWidthContext = createContext<WidthFlags>(WIDE);
export const useContentFlags = (): WidthFlags => useContext(ContentWidthContext);

/** Watches `measure` (the sheet), sets the flags on `target` (the page column inside it) and returns them for the context. */
export function useContentWidth(measure: RefObject<HTMLElement | null>, target: RefObject<HTMLElement | null>): WidthFlags {
  const [flags, setFlags] = useState<WidthFlags>(WIDE);
  useEffect(() => {
    const el = measure.current;
    const out = target.current;
    if (!el || !out || typeof ResizeObserver === "undefined") return;
    const apply = (width: number) => {
      const next = widthFlags(width);
      out.toggleAttribute("data-narrow", next.narrow);
      out.toggleAttribute("data-tight", next.tight);
      out.toggleAttribute("data-table", next.table);
      // The phone has its own layouts: pages that render differently when narrow only do so on a desktop window.
      const desktop = typeof window.matchMedia !== "function" || window.matchMedia("(min-width: 768px)").matches;
      const shown = desktop ? next : WIDE;
      setFlags((cur) => (cur.narrow === shown.narrow && cur.tight === shown.tight && cur.table === shown.table && cur.week3 === shown.week3 && cur.dots === shown.dots ? cur : shown));
    };
    apply(el.getBoundingClientRect().width);
    const watch = new ResizeObserver((entries) => {
      for (const entry of entries) apply(entry.contentRect.width);
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, [measure, target]);
  return flags;
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
