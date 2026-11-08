import { useEffect, useState } from "react";
import { motionMs } from "../styles/tokens";

/** True once `active` has lasted 400 ms: a quick load never flashes a skeleton. */
export function useSlow(active: boolean): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), motionMs("wait"));
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [active]);
  return active && slow;
}
