import { useEffect, useState } from "react";
import { ApiFailure } from "../../api/auth";
import { useAuth } from "../../auth/AuthProvider";
import { BusyButton } from "../../components/BusyButton";
import { Icon } from "../../components/Icon";
import { describeError } from "./AuthScreens";

const SUPPORT = "hello@orbyn.dev";
/** A new link can be asked for this long after the last one. */
const RESEND_AFTER_MS = 60_000;
/** The engine quietly stops mailing after ten requests an hour for one address; the page stops itself at three, well before that. */
const LINKS_PER_HOUR = 3;
const HOUR_MS = 3_600_000;

/**
 * The sign-up made the account but this browser could neither store its keys nor hold them in memory, so the account is empty and
 * cannot be used here (Account Designs so-card, so-check, so-phone). Start over asks the engine to mail a link that deletes an empty
 * account. The engine answers 202 whatever the account is, so what the screen says is the same whether or not anything was sent.
 */
export function StartOver({ email, onBackToSignIn }: { email: string; onBackToSignIn: () => void }) {
  const auth = useAuth()!;
  const clock = auth.services.now;
  /** When each link was asked for; empty before the first. */
  const [asked, setAsked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limited, setLimited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    if (asked.length === 0) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [asked.length]);

  const recent = asked.filter((t) => clock() - t < HOUR_MS);
  const wait = recent.length === 0 ? 0 : Math.max(0, Math.ceil((recent[recent.length - 1]! + RESEND_AFTER_MS - clock()) / 1000));
  const stopped = limited || recent.length >= LINKS_PER_HOUR;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await auth.services.api.deleteUnusedRequest({ email });
      setAsked([...recent, clock()]);
    } catch (e) {
      // The engine's own 429 is a flood from one network: the same state as asking too often.
      if (e instanceof ApiFailure && e.code === "too_many_attempts") {
        setLimited(true);
        setAsked([...recent, clock()]); // the screen reads the same as after a send, with the amber line
      }
      else setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  if (asked.length === 0) {
    return (
      <div className="authcard keys-card" role="alert" aria-label="Your account was created, but this browser can’t keep its keys">
        <span className="pv-red"><Icon name="alert" size={22} /></span>
        <h1 className="keys-title">Your account was created, but this browser can’t keep its keys</h1>
        <span className="t2">{email} now has an Orbyn account, but its keys couldn’t be held in this browser, so you can’t use it here.</span>
        <span className="t3 pv-text">Nothing is stored in the account yet, so nothing is lost. You can delete this empty account and sign up again.</span>
        {error && <span className="err" role="alert">{error}</span>}
        <div className="pv-stack">
          <BusyButton className="btn lg" busy={busy} idle="Start over" working="Sending…" onClick={() => void send()} />
          <span className="t3 small pv-helper">If this account can be deleted this way, we’ll email {email} a link. It only works because the account is empty.</span>
        </div>
        <span className="t3 small">
          Something else wrong? Email <a className="link" href={`mailto:${SUPPORT}`}>{SUPPORT}</a>{" "}
          <button
            type="button"
            className="link-btn small"
            onClick={() => {
              void navigator.clipboard?.writeText(SUPPORT).then(() => setCopied(true), () => undefined);
            }}
          >
            <Icon name="copy" small />
            {copied ? "Copied" : "Copy address"}
          </button>
        </span>
      </div>
    );
  }

  const seconds = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, "0")}`;
  return (
    <div className="authcard" role="group" aria-label="Check your email">
      <h1 className="auth-title">Check your email</h1>
      <p className="t3">If this account can be deleted this way, we’ve sent a link to {email}. It works once and expires in 24 hours.</p>
      {stopped && (
        <div className="banner warn" role="status">
          <Icon name="alert" small />
          You’ve asked for several links. Try again later, or check your spam folder.
        </div>
      )}
      {error && <span className="err" role="alert">{error}</span>}
      {stopped ? (
        <span className="t3 small">Send a new link · not available right now</span>
      ) : wait > 0 ? (
        <span className="t3 small">Send a new link in {seconds}</span>
      ) : (
        <button type="button" className="link-btn small" disabled={busy} onClick={() => void send()}>Send a new link</button>
      )}
      <span className="t3 small">
        <button type="button" className="link-btn quiet-link" onClick={onBackToSignIn}>Back to sign in</button>
      </span>
    </div>
  );
}
