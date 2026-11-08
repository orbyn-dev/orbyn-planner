import { describe, expect, it } from "vitest";
import { formatSignupCode, isWholeSignupCode, normaliseSignupCode, SIGNUP_CODE_ALPHABET } from "./signupCode";

describe("the sign-up email code", () => {
  it("has the 30 symbols of the engine's alphabet: no 0, 1, I, L, O or U", () => {
    expect(SIGNUP_CODE_ALPHABET).toHaveLength(30);
    for (const ch of "01ILOU") expect(SIGNUP_CODE_ALPHABET).not.toContain(ch);
  });

  it("ignores case, the hyphen and spaces, in a paste or by hand", () => {
    for (const text of ["K7QM-R4TW", "k7qm-r4tw", "k7qmr4tw", " K7QM R4TW ", "K7QM - R4TW", "k7 qm r4 tw"]) expect(normaliseSignupCode(text)).toBe("K7QMR4TW");
  });

  it("changes no other character into a symbol: an O is not a 0, and a 1 or an L is not an I", () => {
    expect(normaliseSignupCode("OO0011IILLUU")).toBe("");
    expect(normaliseSignupCode("K7OM-R4TW")).toBe("K7MR4TW"); // the O is simply not a symbol
  });

  it("stops at eight symbols", () => {
    expect(normaliseSignupCode("K7QMR4TWXYZ")).toBe("K7QMR4TW");
  });

  it("shows the hyphen after four characters, once there is a fifth", () => {
    expect(formatSignupCode("k7q")).toBe("K7Q");
    expect(formatSignupCode("k7qm")).toBe("K7QM");
    expect(formatSignupCode("k7qmr")).toBe("K7QM-R");
    expect(formatSignupCode("k7qmr4tw")).toBe("K7QM-R4TW");
  });

  it("is whole at eight symbols only", () => {
    expect(isWholeSignupCode("K7QM-R4T")).toBe(false);
    expect(isWholeSignupCode("K7QM-R4TW")).toBe(true);
  });
});
