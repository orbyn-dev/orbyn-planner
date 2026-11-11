import { useCallback, useState } from "react";

/** The sidebar's width, as in Engineering: 180 to 420 px, 224 until it is dragged, kept on this device. */
export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 420;
export const SIDEBAR_DEFAULT = 224;
export const SIDEBAR_STEP = 16;
const KEY = "orbyn-planner.sidebar-width";

export const clampSidebar = (width: number): number => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(width)));

function read(): number {
  try {
    const saved = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(saved) && saved > 0 ? clampSidebar(saved) : SIDEBAR_DEFAULT;
  } catch {
    return SIDEBAR_DEFAULT;
  }
}

export function useSidebarWidth(): [number, (width: number) => void] {
  const [width, setWidth] = useState(read);
  const save = useCallback((next: number) => {
    const clamped = clampSidebar(next);
    setWidth(clamped);
    try {
      window.localStorage.setItem(KEY, String(clamped));
    } catch {
      /* kept for this session only */
    }
  }, []);
  return [width, save];
}
