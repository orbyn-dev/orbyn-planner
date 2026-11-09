import { useRef, type HTMLAttributes } from "react";
import { useRowMotion } from "./useRowMotion";

/** A `ul` whose rows move as the designs say when one arrives or leaves (see `useRowMotion`). */
export function MotionList(props: HTMLAttributes<HTMLUListElement>) {
  const ref = useRef<HTMLUListElement>(null);
  useRowMotion(ref);
  return <ul ref={ref} {...props} />;
}
