import { useEffect, useRef, useState } from "react";
import { engineUrl } from "../../lib/engine";
import type { DeleteUnusedConfirmed } from "../../generated/DeleteUnusedConfirmed";
import { Icon } from "../../ui/primitives/Icon";

/** The address of this page: the link in the "Delete your unused Orbyn account" email opens it, with the token in the fragment. */
export const DELETE_UNUSED_PATH = "/delete-unused";

const SUPPORT = "hello@orbyn.dev";

/**
 * The landing page of the Start over link (Account Designs so-landing, so-done-released, so-done-not-released). Like the cancel-deletion
 * page it is isolated on purpose: no sign-in, no planner data, nothing from the accounts, stores or sync layers, and it renders before the app.
 * Opening the link changes nothing, because mail scanners open links: the account is deleted only when Delete this account is pressed,
 * and the engine checks again then that it is still empty. Which done screen shows comes from `invite_released` in the engine's answer.
 */

let taken: string | null = null;
/** The token from the fragment, taken off the address at once so it stays out of history and of anything that reads the URL. */
function takeToken(): string {
  if (taken !== null) return taken;
  taken = window.location.hash.replace(/^#/, "").trim();
  if (window.location.hash || window.location.search) window.history.replaceState(null, "", window.location.pathname);
  return taken;
}

/** For tests: forget the token read from the address, as a new page load does. */
export function forgetDeleteUnusedTokenForTests(): void {
  taken = null;
}

type Result = "ready" | "busy" | "released" | "not-released" | "expired" | "not-empty" | "limited" | "error";

async function confirm(token: string): Promise<Exclude<Result, "ready" | "busy">> {
  try {
    const response = await fetch(`${engineUrl()}/v1/accounts/delete-unused/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      referrerPolicy: "no-referrer",
      credentials: "omit",
      body: JSON.stringify({ token }),
    });
    if (response.ok) {
      const answer = (await response.json().catch(() => ({}))) as Partial<DeleteUnusedConfirmed>;
      return answer.invite_released === true ? "released" : "not-released";
    }
    // A wrong, used, voided or expired token is one answer; the account is not said to exist.
    if (response.status === 400) return "expired";
    if (response.status === 409) return "not-empty";
    // A flood from one network: plain words, with nothing to press. "Orbyn didn’t answer" is for a network or server failure.
    if (response.status === 429) return "limited";
    return "error";
  } catch {
    return "error";
  }
}

export function DeleteUnusedPage() {
  const token = useRef<string | null>(null);
  const [result, setResult] = useState<Result>(() => (takeToken() ? "ready" : "expired"));
  useEffect(() => {
    token.current ??= takeToken();
  }, []);
  const pressed = useRef(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // The token never goes in a Referer header, whatever the page links to.
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const press = async () => {
    if (pressed.current || !token.current) return;
    pressed.current = true;
    setResult("busy");
    const next = await confirm(token.current);
    if (next === "error") pressed.current = false; // Try again presses the button again
    else {
      token.current = null;
      taken = "";
    }
    setResult(next);
  };

  const done = (title: string, text: string) => (
    <div className="authcard keys-card start-over" role="status" aria-label={title}>
      <span className="pv-ok"><Icon name="ok" size={22} /></span>
      <h1 className="keys-title">{title}</h1>
      <span className="t2">{text}</span>
      <div className="pv-stack"><a className="btn" href="/sign-up">Sign up again</a></div>
    </div>
  );

  return (
    <main className="public-page" id="content" tabIndex={-1}>
      {result === "busy" ? (
        <div className="authcard keys-card start-over" role="status" aria-label="Checking your link">
          <span className="spin blue" aria-hidden="true" />
          <h1 className="keys-title">Checking your link</h1>
          <span className="t2">This takes a moment.</span>
        </div>
      ) : result === "released" ? (
        done("Account deleted", "Your invite code works again. You can use it to sign up once more. It keeps its original expiry.")
      ) : result === "not-released" ? (
        done("Account deleted", "The account was deleted. No invite code was released.")
      ) : result === "expired" ? (
        <div className="authcard keys-card start-over" role="status" aria-label="This link doesn’t work any more">
          <Icon name="info" size={22} />
          <h1 className="keys-title">This link doesn’t work any more</h1>
          <span className="t2">It may have been used already, or it may have expired after 24 hours. Go back to sign-up and choose Start over to get a new one.</span>
          <div className="pv-stack"><a className="btn" href="/sign-up">Back to sign-up</a></div>
        </div>
      ) : result === "not-empty" ? (
        <div className="authcard keys-card start-over" role="status" aria-label="This account can’t be deleted this way">
          <Icon name="info" size={22} />
          <h1 className="keys-title">This account can’t be deleted this way</h1>
          <span className="t2">Something has been stored in it, or a device now holds its keys. Nothing was deleted. To delete it, sign in and use Settings › Account › Delete account, or email {SUPPORT}.</span>
          <div className="pv-stack">
            <a className="btn" href="/sign-in">Sign in</a>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(SUPPORT).then(() => setCopied(true), () => undefined);
              }}
            >
              <Icon name="copy" small />
              {copied ? "Copied" : "Copy address"}
            </button>
          </div>
        </div>
      ) : result === "limited" ? (
        <div className="authcard keys-card start-over" role="status" aria-label="Too many tries">
          <Icon name="clock" size={22} />
          <h1 className="keys-title">Too many tries</h1>
          <span className="t2">Wait a while, then try again.</span>
        </div>
      ) : result === "error" ? (
        <div className="authcard keys-card start-over" role="alert" aria-label="Couldn’t delete the account">
          <span className="pv-red"><Icon name="alert" size={22} /></span>
          <h1 className="keys-title">Couldn’t delete the account</h1>
          <span className="t2">Orbyn didn’t answer, so nothing changed. The account still exists.</span>
          <div className="pv-stack"><button type="button" className="btn" onClick={() => void press()}>Try again</button></div>
        </div>
      ) : (
        <div className="authcard keys-card start-over" role="group" aria-label="Delete this empty account?">
          <Icon name="info" size={22} />
          <h1 className="keys-title">Delete this empty account?</h1>
          <span className="t2">This account has nothing stored in it. Deleting it lets you sign up again. Only an empty account can be deleted this way. If you signed up with an invite code, deleting this account may release the code so you can use it again.</span>
          <div className="pv-stack">
            <a className="ghost" href="/">Cancel</a>
            <button type="button" className="danger" onClick={() => void press()}>Delete this account</button>
          </div>
        </div>
      )}
    </main>
  );
}
