/**
 * The sign-up email code (Account Designs v62 pv-signup-code, Planner Designs v57 verify): 8 characters from a 30-symbol alphabet, the digits
 * 2 to 9 and the letters A to Z without I, L, O and U, shown grouped as K7QM-R4TW. It is typed or pasted with any case and with or without the
 * hyphen or spaces; nothing else is turned into a symbol (an O never becomes a 0).
 */
export const SIGNUP_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const SIGNUP_CODE_LENGTH = 8;

/** What the engine takes: capitals, no hyphen or space, only symbols of the alphabet, at most 8. */
export function normaliseSignupCode(raw: string): string {
  let out = "";
  for (const ch of raw.toUpperCase()) {
    if (SIGNUP_CODE_ALPHABET.includes(ch)) out += ch;
    if (out.length === SIGNUP_CODE_LENGTH) break;
  }
  return out;
}

/** The field's text: the code with a hyphen after four characters (once there is a fifth). */
export function formatSignupCode(raw: string): string {
  const code = normaliseSignupCode(raw);
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Whether the field holds a whole code, which is what turns Verify on. */
export const isWholeSignupCode = (raw: string) => normaliseSignupCode(raw).length === SIGNUP_CODE_LENGTH;
