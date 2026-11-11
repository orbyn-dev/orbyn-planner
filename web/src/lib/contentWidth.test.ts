import { describe, expect, it } from "vitest";
import { DOTS_BELOW, NARROW_BELOW, OVERLAY_BELOW, TABLE_BELOW, TIGHT_BELOW, WEEK3_BELOW, overlayFlag, widthFlags } from "./contentWidth";

describe("content width flags", () => {
  it("a page is narrow under 720 px, a table drops columns under 640, it is tight under 560, the week shows 3 days under 760 and a month cell shows dots under 670", () => {
    const f = (narrow: boolean, tight: boolean, table: boolean, week3: boolean, dots: boolean) => ({ narrow, tight, table, week3, dots });
    expect(widthFlags(1160)).toEqual(f(false, false, false, false, false));
    expect(widthFlags(WEEK3_BELOW)).toEqual(f(false, false, false, false, false));
    expect(widthFlags(WEEK3_BELOW - 1)).toEqual(f(false, false, false, true, false));
    expect(widthFlags(NARROW_BELOW - 1)).toEqual(f(true, false, false, true, false));
    expect(widthFlags(DOTS_BELOW - 1)).toEqual(f(true, false, false, true, true));
    expect(widthFlags(TABLE_BELOW - 1)).toEqual(f(true, false, true, true, true));
    expect(widthFlags(TIGHT_BELOW - 1)).toEqual(f(true, true, true, true, true));
    expect(widthFlags(480)).toEqual(f(true, true, true, true, true));
  });

  it("a sheet under 880 px lets the side panel cover the page", () => {
    expect(overlayFlag(OVERLAY_BELOW)).toBe(false);
    expect(overlayFlag(OVERLAY_BELOW - 1)).toBe(true);
    expect(overlayFlag(936)).toBe(false);
  });
});
