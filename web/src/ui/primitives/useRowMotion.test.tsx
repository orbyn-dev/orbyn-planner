import { act, render } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRowMotion } from "./useRowMotion";

type Call = { target: HTMLElement; frames: Keyframe[]; options: KeyframeAnimationOptions };
let calls: Call[] = [];

function List({ ids }: { ids: string[] }) {
  const ref = useRef<HTMLUListElement>(null);
  useRowMotion(ref);
  return (
    <ul ref={ref}>
      {ids.map((id) => <li key={id} data-row-id={id}>{id}</li>)}
    </ul>
  );
}

/** jsdom has no layout: each row is one 40 px slot at its index, and no animation runs. */
function fakeLayout() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const row = this.dataset?.rowId;
    const index = row ? [...(this.parentElement?.children ?? [])].filter((c) => (c as HTMLElement).dataset.rowId !== undefined).indexOf(this) : 0;
    return { top: row ? index * 40 : 0, left: 0, right: 0, bottom: 0, width: 0, height: 40, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
  HTMLElement.prototype.animate = function (this: HTMLElement, frames: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
    calls.push({ target: this, frames: frames as Keyframe[], options: options as KeyframeAnimationOptions });
    return { onfinish: null } as unknown as Animation;
  } as typeof HTMLElement.prototype.animate;
}

function Harness({ initial }: { initial: string[] }) {
  const [ids, setIds] = useState(initial);
  return (
    <>
      <button onClick={() => setIds(["new", ...ids])}>add</button>
      <button onClick={() => setIds(ids.filter((i) => i !== "b"))}>remove</button>
      <List ids={ids} />
    </>
  );
}

beforeEach(() => {
  calls = [];
  fakeLayout();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

describe("rows arriving and leaving (Motion Designs additem, delete)", () => {
  it("a new row fades in and rises 6 px over 200 ms while the rows below shift one slot", () => {
    const { getByText } = render(<Harness initial={["a", "b", "c"]} />);
    expect(calls).toEqual([]); // the first draw moves nothing
    act(() => getByText("add").click());
    const arrival = calls.find((c) => c.target.dataset.rowId === "new")!;
    expect(arrival.frames[0]).toMatchObject({ opacity: 0, transform: "translateY(-6px)" });
    expect(arrival.frames[1]).toMatchObject({ opacity: 1, transform: "translateY(0)" });
    expect(arrival.options.duration).toBe(200);
    const shifted = calls.filter((c) => c.target.dataset.rowId && c.target.dataset.rowId !== "new");
    expect(shifted.map((c) => c.target.dataset.rowId)).toEqual(["a", "b", "c"]);
    expect(shifted[0]!.frames[0]).toMatchObject({ transform: "translateY(-40px)" }); // from where it was, one slot up, to where it is
  });

  it("a deleted row fades out over 140 ms where it was, and the rows below close up at the same moment", () => {
    const { getByText, container } = render(<Harness initial={["a", "b", "c"]} />);
    act(() => getByText("remove").click());
    const fade = calls.find((c) => c.target.getAttribute("aria-hidden") === "true")!;
    expect(fade.frames).toEqual([{ opacity: 1 }, { opacity: 0 }]);
    expect(fade.options.duration).toBe(140);
    expect(fade.target.style.top).toBe("40px"); // where "b" was
    expect(fade.target.dataset.rowId).toBeUndefined(); // the copy takes no part in the list
    const closing = calls.find((c) => c.target.dataset.rowId === "c")!;
    expect(closing.frames[0]).toMatchObject({ transform: "translateY(40px)" });
    expect(closing.options.duration).toBe(200);
    expect(container.querySelectorAll("[data-row-id]")).toHaveLength(2);
  });

  it("under reduced motion a new row only fades in, a deleted one only fades, and nothing slides", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    const { getByText } = render(<Harness initial={["a", "b", "c"]} />);
    act(() => getByText("add").click());
    expect(calls.every((c) => c.frames.every((f) => !("transform" in f)))).toBe(true);
    expect(calls.map((c) => c.target.dataset.rowId)).toEqual(["new"]);
    expect(calls[0]!.frames).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    calls = [];
    act(() => getByText("remove").click());
    expect(calls.every((c) => c.frames.every((f) => !("transform" in f)))).toBe(true);
    expect(calls.map((c) => c.target.getAttribute("aria-hidden"))).toEqual(["true"]);
  });

  it("a page of rows arriving at once does not animate", () => {
    const { rerender } = render(<List ids={["a"]} />);
    rerender(<List ids={["a", "b", "c", "d", "e"]} />);
    expect(calls).toEqual([]);
  });
});
