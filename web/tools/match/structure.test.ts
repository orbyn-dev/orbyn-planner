import { describe, expect, it } from "vitest";
// @ts-expect-error a plain module shared with the runner script
import { diffStructure, unexplained } from "./structure.mjs";

type Entry = { key: string; look: Record<string, string> };
const entry = (key: string, look: Record<string, string>): Entry => ({ key, look });
const diff = diffStructure as (a: Entry[], b: Entry[], labels?: string[]) => string[];
const left = unexplained as (lines: string[], allowed: { match: string; why: string }[]) => string[];

describe("structure check between desktop widths", () => {
  const tiles = (align: string) => [entry("ol.fr-tiles #1", { display: "grid", textAlign: align, listStyleType: "none" })];

  it("agrees when the screens are alike", () => expect(diff(tiles("center"), tiles("center"))).toEqual([]));

  it("names the element and the property that differ, as a rule that only applies at some widths would", () => {
    expect(diff(tiles("start"), tiles("center"), ["1160", "1440"])).toEqual(["ol.fr-tiles #1: textAlign is start at 1160 and center at 1440"]);
  });

  it("names a part that is shown at one width only", () => {
    expect(diff([entry("span.lbl #1", {})], [], ["1160", "1440"])).toEqual(["span.lbl #1: only at 1160"]);
    expect(diff([], [entry("span.lbl #1", {})], ["1160", "1440"])).toEqual(["span.lbl #1: only at 1440"]);
  });

  it("lets a difference through only when an allowance names it", () => {
    const lines = ["button.cal-btn: padding is 0 at 1160 and 8 at 1440", "ol.fr-tiles #1: textAlign is start at 1160 and center at 1440"];
    expect(left(lines, [{ match: "button.cal-btn", why: "icon-only at 1240 px and below" }])).toEqual([lines[1]]);
  });
});
