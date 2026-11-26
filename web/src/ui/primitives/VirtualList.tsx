import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import { useRowMotion } from "./useRowMotion";

export interface VirtualListProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  getRowId?: (item: T) => string;
  children: (item: T, index: number) => ReactElement;
  className?: string;
  label?: string;
  estimateSize?: number;
  pinnedKeys?: readonly string[];
  /** Across grouped lists, use the full logical row count to activate viewport rendering for small groups too. */
  totalCount?: number;
  as?: "ul" | "div";
}

function scrollParent(element: HTMLElement): HTMLElement {
  let parent = element.parentElement;
  while (parent) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) return parent;
    parent = parent.parentElement;
  }
  return document.documentElement;
}

const focusable = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';
const NO_KEYS: readonly string[] = [];

/** Keeps ordinary list markup and its existing scroll container; only large lists omit offscreen rows. */
export function VirtualList<T>({ items, getKey, getRowId = getKey, children, className, label, estimateSize = 40, pinnedKeys = NO_KEYS, totalCount = items.length, as = "ul" }: VirtualListProps<T>) {
  "use no memo";
  const list = useRef<HTMLElement | null>(null);
  const List = as;
  const Gap = as === "ul" ? "li" : "div";
  const [port, setPort] = useState<HTMLElement | null>(null);
  const [margin, setMargin] = useState(0);
  const [gap, setGap] = useState(0);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [requestedKey, setRequestedKey] = useState<string | null>(null);
  const pendingFocus = useRef<{ key: string; last: boolean } | null>(null);
  const entryDirection = useRef<"first" | "last" | null>(null);
  const enabled = totalCount > 100 && typeof ResizeObserver !== "undefined";
  const keys = useMemo(() => items.map(getKey), [items, getKey]);
  const indexOf = useMemo(() => new Map(keys.map((key, index) => [key, index])), [keys]);
  const rangeExtractor = useCallback((range: Range) => {
    const start = port?.scrollTop ?? 0;
    const height = port?.clientHeight ?? 0;
    const measuredHeight = list.current?.offsetHeight ?? 0;
    const outside = height > 0 && (margin > start + height || measuredHeight > 0 && margin + measuredHeight < start);
    const indexes = new Set(outside ? [] : defaultRangeExtractor(range));
    const pinned = new Set([...pinnedKeys, focusedKey, requestedKey]);
    for (const key of pinned) { const index = key === null ? undefined : indexOf.get(key); if (index !== undefined) indexes.add(index); }
    return [...indexes].sort((a, b) => a - b);
  }, [indexOf, pinnedKeys, focusedKey, requestedKey, port, margin]);
  const virtual = useVirtualizer<HTMLUListElement | HTMLElement, HTMLElement>({
    count: items.length,
    getScrollElement: () => port,
    getItemKey: (index) => keys[index]!,
    estimateSize: () => estimateSize,
    overscan: 6,
    scrollMargin: margin,
    gap,
    rangeExtractor,
    enabled,
  });

  useLayoutEffect(() => {
    if (!list.current || !enabled) return;
    const element = list.current;
    const parent = scrollParent(element);
    setPort(parent);
    const measure = () => {
      setMargin(element.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop - parent.clientTop);
      // Read the stylesheet spacing before our virtual layout replaces flex gaps with measured row margins.
      const overridden = element.style.rowGap;
      element.style.rowGap = "";
      const spacing = Number.parseFloat(getComputedStyle(element).rowGap);
      element.style.rowGap = overridden;
      setGap(Number.isFinite(spacing) ? spacing : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    // Changes in preceding groups alter this list's offset, even when its own width stays the same.
    observer.observe(parent);
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [enabled]);

  const rows = enabled ? virtual.getVirtualItems() : items.map((item, index) => ({ index, key: getKey(item), start: 0, end: 0 }));
  useLayoutEffect(() => {
    if (!list.current) return;
    const elements = [...list.current.children].filter((child): child is HTMLElement => child instanceof HTMLElement && !child.hasAttribute("data-virtual-gap") && !child.hasAttribute("data-motion-ghost"));
    if (enabled) virtual.measureElement(null);
    elements.forEach((element, offset) => {
      const index = rows[offset]!.index;
      element.dataset.index = String(index);
      element.dataset.virtualKey = getKey(items[index]!);
      if (enabled) element.style.marginBottom = index === items.length - 1 ? "0px" : `${gap}px`;
      else element.style.removeProperty("margin-bottom");
      if (enabled && element.tagName === "LI") {
        element.setAttribute("aria-posinset", String(index + 1));
        element.setAttribute("aria-setsize", String(items.length));
      }
      if (enabled) virtual.measureElement(element);
    });
    const target = pendingFocus.current;
    if (target) {
      const row = elements.find((element) => element.dataset.virtualKey === target.key);
      if (row) {
        const targets = [...row.querySelectorAll<HTMLElement>(focusable)];
        const element = row.matches(focusable) ? row : target.last ? targets.at(-1) : targets[0];
        element?.focus({ preventScroll: true });
        pendingFocus.current = null;
      }
    }
  });
  useRowMotion(list, keys);

  useLayoutEffect(() => {
    if (!enabled) return;
    let reset: ReturnType<typeof setTimeout> | undefined;
    const remember = (event: globalThis.KeyboardEvent) => {
      entryDirection.current = event.key === "Tab" ? event.shiftKey ? "last" : "first" : null;
      clearTimeout(reset);
      reset = setTimeout(() => { entryDirection.current = null; }, 0);
    };
    const pointer = () => { entryDirection.current = null; };
    document.addEventListener("keydown", remember, true);
    document.addEventListener("pointerdown", pointer, true);
    return () => { document.removeEventListener("keydown", remember, true); document.removeEventListener("pointerdown", pointer, true); clearTimeout(reset); };
  }, [enabled]);

  useLayoutEffect(() => {
    if (!enabled) return;
    const reveal = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      const index = items.findIndex((item) => getKey(item) === id || getRowId(item) === id);
      if (index < 0) return;
      const key = getKey(items[index]!);
      pendingFocus.current = { key, last: false };
      setRequestedKey(key);
      virtual.scrollToIndex(index, { align: "auto" });
    };
    document.addEventListener("planner:reveal-row", reveal);
    return () => document.removeEventListener("planner:reveal-row", reveal);
  }, [enabled, items, getKey, getRowId, virtual]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!enabled || event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    const active = event.target as HTMLElement;
    const row = active.closest<HTMLElement>("[data-virtual-key]");
    if (!row) return;
    const targets = [...row.querySelectorAll<HTMLElement>(focusable)];
    if (row.matches(focusable)) targets.unshift(row);
    if (active !== (event.shiftKey ? targets[0] : targets.at(-1))) return;
    const index = Number(row.dataset.index) + (event.shiftKey ? -1 : 1);
    if (index < 0 || index >= items.length) return;
    event.preventDefault();
    const key = getKey(items[index]!);
    pendingFocus.current = { key, last: event.shiftKey };
    setRequestedKey(key);
    virtual.scrollToIndex(index, { align: "auto" });
  };

  let end = 0;
  const content = rows.map((row) => {
    const gap = enabled ? row.start - margin - end : 0;
    end = enabled ? row.end - margin + (row.index === items.length - 1 ? 0 : virtual.options.gap) : 0;
    return <Fragment key={row.key}>{gap > 0 && <Gap data-virtual-gap aria-hidden="true" style={{ height: gap, padding: 0, border: 0 }} />}{children(items[row.index]!, row.index)}</Fragment>;
  });
  return <List ref={(element: HTMLElement | null) => { list.current = element; }} className={className} aria-label={label} style={enabled ? { rowGap: 0 } : undefined} onKeyDown={onKeyDown}
    onFocusCapture={(event) => {
      const row = (event.target as HTMLElement).closest<HTMLElement>("[data-virtual-key]");
      setFocusedKey(row?.dataset.virtualKey ?? null);
      if (enabled && entryDirection.current && !pendingFocus.current && !event.currentTarget.contains(event.relatedTarget) && items.length) {
        const index = entryDirection.current === "last" ? items.length - 1 : 0;
        const key = keys[index]!;
        if (row?.dataset.virtualKey !== key) {
          pendingFocus.current = { key, last: entryDirection.current === "last" };
          setRequestedKey(key);
          virtual.scrollToIndex(index, { align: "auto" });
        }
      }
    }}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setFocusedKey(null); setRequestedKey(null); } }}>
    {content}
    {enabled && virtual.getTotalSize() > end && <Gap data-virtual-gap aria-hidden="true" style={{ height: virtual.getTotalSize() - end, padding: 0, border: 0 }} />}
  </List>;
}
