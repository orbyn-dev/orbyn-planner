import { describe, expect, it } from "vitest";
import { NARROW_BELOW, TIGHT_BELOW, widthFlags } from "./contentWidth";

describe("content width flags", () => {
  it("a page under 720 px is narrow and under 560 px is also tight", () => {
    expect(widthFlags(1160)).toEqual({ narrow: false, tight: false });
    expect(widthFlags(NARROW_BELOW)).toEqual({ narrow: false, tight: false });
    expect(widthFlags(NARROW_BELOW - 1)).toEqual({ narrow: true, tight: false });
    expect(widthFlags(TIGHT_BELOW - 1)).toEqual({ narrow: true, tight: true });
    expect(widthFlags(480)).toEqual({ narrow: true, tight: true });
  });
});
