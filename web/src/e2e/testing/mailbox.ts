import type { StoredSession } from "../../data/account/keyStore";
import { signUp } from "../../state/services/flows";
import type { AuthServices } from "../../state/services/auth";

/** Where the test mailbox's API is (Mailpit, which the engine's worker sends to); set with ORBYN_E2E_MAIL, such as http://127.0.0.1:8025. */
export const mailUrl = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.ORBYN_E2E_MAIL;

/** The newest eight-character sign-up code mailed to `address` (the mail shows it grouped, K7QM-R4TW; this returns it as the engine takes it, K7QMR4TW), waiting for it to arrive. Only the codes it hasn't seen (`not`) count. */
export async function codeSentTo(address: string, not: string[] = [], ms = 30_000): Promise<string> {
  if (!mailUrl) throw new Error("set ORBYN_E2E_MAIL to the test mailbox's API");
  const end = Date.now() + ms;
  for (;;) {
    const found = await fetch(`${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`)
      .then((r) => r.json() as Promise<{ messages?: { ID: string }[] }>)
      .catch(() => ({ messages: [] as { ID: string }[] }));
    for (const m of found.messages ?? []) {
      const full = (await fetch(`${mailUrl}/api/v1/message/${m.ID}`).then((r) => r.json())) as { Text?: string };
      const grouped = /\b([2-9A-HJKMNP-TV-Z]{4})-([2-9A-HJKMNP-TV-Z]{4})\b/.exec(full.Text ?? "");
      const code = grouped ? `${grouped[1]}${grouped[2]}` : undefined;
      if (code && !not.includes(code)) return code;
    }
    if (Date.now() > end) throw new Error(`no code arrived for ${address}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * The cancel token in the newest account-deletion email sent to `address` that isn't one of `not`: the link's fragment
 * (`…/cancel-deletion#<token>`), or the token alone when the engine has no app URL.
 */
export async function cancelTokenSentTo(address: string, not: string[] = [], ms = 30_000): Promise<string> {
  if (!mailUrl) throw new Error("set ORBYN_E2E_MAIL to the test mailbox's API");
  const end = Date.now() + ms;
  for (;;) {
    const found = await fetch(`${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:${address} subject:"will be deleted"`)}`)
      .then((r) => r.json() as Promise<{ messages?: { ID: string }[] }>)
      .catch(() => ({ messages: [] as { ID: string }[] }));
    for (const m of found.messages ?? []) {
      const full = (await fetch(`${mailUrl}/api/v1/message/${m.ID}`).then((r) => r.json())) as { Text?: string };
      const token = /cancel-deletion#([A-Za-z0-9_-]{43})/.exec(full.Text ?? "")?.[1];
      if (token && !not.includes(token)) return token;
    }
    if (Date.now() > end) throw new Error(`no cancel link arrived for ${address}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

/** Signs up and verifies with the code from the test mailbox: the whole sign-up. */
export async function signUpVerified(services: AuthServices, input: { name: string; email: string; password: string }): Promise<StoredSession> {
  const pending = await signUp(services, input);
  return pending.verify(await codeSentTo(input.email));
}
