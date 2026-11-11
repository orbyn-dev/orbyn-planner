import { useEffect, type RefObject } from "react";

/**
 * The page's own width, not the window's: the sidebar (180 to 420 px) and a side panel take some of the window, so a media query on the
 * viewport cannot tell how much room a page has. These two limits set `data-narrow` and `data-tight` on the element, and the styles key on them.
 */
export const NARROW_BELOW = 720;
export const TIGHT_BELOW = 560;

export function widthFlags(width: number): { narrow: boolean; tight: boolean } {
  return { narrow: width < NARROW_BELOW, tight: width < TIGHT_BELOW };
}

export function useContentWidth(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = (width: number) => {
      const flags = widthFlags(width);
      el.toggleAttribute("data-narrow", flags.narrow);
      el.toggleAttribute("data-tight", flags.tight);
    };
    apply(el.getBoundingClientRect().width);
    const watch = new ResizeObserver((entries) => {
      for (const entry of entries) apply(entry.contentRect.width);
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, [ref]);
}
