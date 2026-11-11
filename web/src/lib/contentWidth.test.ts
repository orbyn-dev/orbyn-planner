import { describe, expect, it } from "vitest";
import { NARROW_BELOW, OVERLAY_BELOW, TIGHT_BELOW, overlayFlag, widthFlags } from "./contentWidth";

describe("content width flags", () => {
  it("a page under 720 px is narrow and under 560 px is also tight", () => {
    expect(widthFlags(1160)).toEqual({ narrow: false, tight: false });
    expect(widthFlags(NARROW_BELOW)).toEqual({ narrow: false, tight: false });
    expect(widthFlags(NARROW_BELOW - 1)).toEqual({ narrow: true, tight: false });
    expect(widthFlags(TIGHT_BELOW - 1)).toEqual({ narrow: true, tight: true });
    expect(widthFlags(480)).toEqual({ narrow: true, tight: true });
  });

  it("a sheet under 880 px lets the side panel cover the page", () => {
    expect(overlayFlag(OVERLAY_BELOW)).toBe(false);
    expect(overlayFlag(OVERLAY_BELOW - 1)).toBe(true);
    expect(overlayFlag(936)).toBe(false);
  });
});
