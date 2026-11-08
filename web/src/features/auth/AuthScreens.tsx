import { formatSignupCode, normaliseSignupCode, SIGNUP_CODE_LENGTH } from "../../lib/signupCode";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { NotAvailable, PasskeyButton, Planned } from "../../components/Planned";
import { ApiFailure } from "../../api/auth";
import { SignInUnavailable } from "../../api/authCrypto";
import { BusyButton } from "../../components/BusyButton";
import { appsAvailable, downloadUrl } from "../../api/site";
import { Icon } from "../../components/Icon";
import { deleteIntent } from "../../auth/deletionNotice";
import { KeysForAnotherAccount, SecondFactorNeeded, signIn, signUp, type PendingSignUp } from "../../auth/flows";
import { cryptoLoad } from "../../api/realCrypto";
import { CryptoProblem, MODULE_LOAD_FAILED } from "./CryptoProblem";
import { useAuth, type AuthScreen } from "../../auth/AuthProvider";
import { INVITE_REFUSED, InviteStep, StepBar } from "./InviteStep";
import { StartOver } from "./StartOver";

/** A readable line for whatever went wrong. */
export function describeError(error: unknown): string {
  if (error instanceof SignInUnavailable) return cryptoLoad.get() === "failed" ? `${MODULE_LOAD_FAILED}.` : error.message + ".";
  if (error instanceof ApiFailure) return error.message;
  return "Something went wrong. Try again.";
}

function Landing({ go }: { go: (s: AuthScreen) => void }) {
  const auth = useAuth()!;
  return (
    <div className="public">
      <span className="t3">Orbyn Planner</span>
      <h1>Your tasks and calendar,<br />in one calm place</h1>
      <p>
        Plan your day, keep lists, and share them with the people you live and work with. Simple enough for anyone, from a shopping list to a product launch.
      </p>
      <div className="public-actions">
        <button type="button" className="btn" onClick={() => go("signup")}>Get started</button>
        <button type="button" className="ghost" onClick={() => go("signin")}>Sign in</button>
      </div>
      <button type="button" className="link-btn quiet-link" onClick={auth.useWithoutAccount}>Use without an account</button>
      <span className="t3 small">Everything then stays on this device. You can sign in later.</span>
    </div>
  );
}

/** A new code can be asked for this long after the last one was sent. */
const RESEND_AFTER_MS = 60_000;
/** The engine allows three new codes an hour; the page counts them, since it answers the same whether or not one was sent. */
const RESENDS_PER_HOUR = 3;
const HOUR_MS = 3_600_000;

/** The code step of a sign-up: no account and no session exist until the code from the email is right. */
function CheckEmail({ pending, onBack, onDone, onInviteRejected, onSignIn }: { pending: PendingSignUp; onBack: () => void; onDone: () => void; onInviteRejected: () => void; onSignIn: () => void }) {
  const auth = useAuth()!;
  const clock = auth.services.now;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState(clock());
  const [resends, setResends] = useState<number[]>([]);
  const [, tick] = useState(0);
  const [engineLimited, setEngineLimited] = useState(false);
  /** The invite was spent by another sign-up in the meantime: no account can be made, and the person goes back to step 1. */
  const [inviteRejected, setInviteRejected] = useState(false);
  /** The account was made but this browser can hold its keys neither in storage nor in memory: it is empty, and Start over can delete it. */
  const [keysLost, setKeysLost] = useState(false);

  // Leaving this screen lets the sign-up go: its keys were only ever in memory. React's development check unmounts and mounts a
  // screen at once to test this very cleanup, so the sign-up is let go only if no mount follows straight after.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => {
        if (!mounted.current) pending.cancel();
      }, 0);
    };
  }, [pending]);
  // The countdown on "Send a new code".
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const recent = resends.filter((t) => clock() - t < HOUR_MS);
  const wait = Math.max(0, Math.ceil((lastSent + RESEND_AFTER_MS - clock()) / 1000));
  const limited = engineLimited || recent.length >= RESENDS_PER_HOUR;
  const entered = normaliseSignupCode(code);
  const ready = entered.length === SIGNUP_CODE_LENGTH;
  const [focused, setFocused] = useState(true);
  const [wrong, setWrong] = useState(false);

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setWrong(false);
    try {
      await pending.verify(entered);
      onDone();
    } catch (e) {
      if (e instanceof ApiFailure && e.code === "keys_not_saved") {
        pending.cancel(); // the account exists and is empty, and nothing here can use its keys: let them go
        setKeysLost(true);
      } else if (e instanceof ApiFailure && e.code === "invite_invalid") {
        setInviteRejected(true);
      } else if (e instanceof ApiFailure && e.code === "invalid_email_code") {
        // A wrong, an expired and a made-up code are one answer; "Send a new code" is always there.
        setWrong(true);
        setError("That code isn’t right. Use the code in the newest email.");
      } else {
        setError(describeError(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setWrong(false);
    try {
      await pending.resend();
      setResends([...recent, clock()]);
      setLastSent(clock());
      setCode("");
    } catch (e) {
      // The engine answers a resend it will not do with its own "too many attempts"; the page shows the same state it shows after three.
      if (e instanceof ApiFailure && e.code === "too_many_attempts") setEngineLimited(true);
      else setError(describeError(e));
    }
  };

  const seconds = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, "0")}`;
  if (keysLost) return <StartOver email={pending.email} onBackToSignIn={onSignIn} />;
  return (
    <form className="authcard" onSubmit={(e) => void verify(e)} aria-label="Check your inbox" noValidate>
      <StepBar step={3} label="Check your email" />
      <h1 className="auth-title">Check your inbox</h1>
      {inviteRejected && (
        <div className="banner" role="alert">
          {INVITE_REFUSED}
          <span className="end"><button type="button" className="ghost" onClick={onInviteRejected}>Back to the form</button></span>
        </div>
      )}
      <p className="t3">Enter the 8-character code we emailed to {pending.email}. It works for 30 minutes.</p>
      {/* One field, grouped like K7QM-R4TW: paste with or without the hyphen or spaces, capitals, case ignored (Account Designs pv-signup-code). */}
      <div className={`cfield${wrong ? " err" : focused ? " on" : ""}`} role="group" aria-label="8-character code">
        <input
          id="su-code"
          aria-label="Code"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="one-time-code"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ABCD-EFGH"
          value={formatSignupCode(code)}
          onChange={(e) => {
            setCode(formatSignupCode(e.target.value));
            setWrong(false);
            setError(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus
        />
      </div>
      {error && <span className="err" role="alert">{error}</span>}
      {limited && (
        <div className="banner warn" role="status">
          <Icon name="alert" small />
          You’ve asked for several codes. Try again later, or check your spam folder.
        </div>
      )}
      <BusyButton type="submit" className="btn lg" busy={busy} disabled={!ready} idle="Verify" working="Checking…" />
      {/* Throttled: the banner above says so and the resend line is muted, with nothing to press. Otherwise a countdown, then the link. */}
      {limited ? (
        <span className="t3 small">Send a new code · not available right now</span>
      ) : wait > 0 ? (
        <span className="t3 small">Send a new code in {seconds}</span>
      ) : (
        <button type="button" className="link-btn small" onClick={() => void resend()}>Send a new code</button>
      )}
      <span className="t3 small">
        Wrong address? <button type="button" className="link-btn link" onClick={onBack}>Change email</button>
      </span>
    </form>
  );
}

/** Sign-up on a browser that can neither store the keys nor hold them in memory (WebAssembly or WebCrypto off, say). Nothing was created. */
export function NoMemory() {
  return (
    <div className="authcard keys-card" role="alert" aria-label="This browser can’t create an Orbyn account">
      <span className="pv-red"><Icon name="alert" size={22} /></span>
      <h1 className="keys-title">This browser can’t create an Orbyn account</h1>
      <span className="t2">Orbyn has to keep your encryption keys, and this browser won’t store them or hold them in memory. Nothing was created.</span>
      <span className="t3 pv-text">This often means WebAssembly is turned off or blocked. Try another browser, or turn off any setting that blocks it.</span>
      <div className="pv-stack">
        <a className="btn lg" href={downloadUrl()} target="_blank" rel="noopener noreferrer">
          {appsAvailable() && <Icon name="down" small />}
          {appsAvailable() ? "Install the Orbyn app" : "See the Orbyn apps"}
        </a>
        {!appsAvailable() && <span className="t3 small pv-helper">The apps aren’t out yet. This page lists what’s being built.</span>}
        <button
          type="button"
          className="ghost lg"
          onClick={() => {
            void navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
          }}
        >
          <Icon name="copy" small />
          Copy this page’s address
        </button>
      </div>
      <span className="t3 small">Your email wasn’t verified or saved, so you can start again in another browser.</span>
    </div>
  );
}

function SignUp({ go }: { go: (s: AuthScreen) => void }) {
  const auth = useAuth()!;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set once the engine has sent a code: the sign-up waits for it. */
  const [pending, setPending] = useState<PendingSignUp | null>(null);
  /** This browser can't hold the keys at all, so nothing was created. */
  const [noMemory, setNoMemory] = useState(false);
  /** The accepted invite code (step 1); null until there is one. */
  const [invite, setInvite] = useState<string | null>(null);
  /** The engine refused the invite after step 1: the person stays here, with a way back to the code step. */
  const [rejected, setRejected] = useState(false);
  const backToCode = () => {
    pending?.cancel();
    setPending(null);
    setPassword(""); // the password was typed for an invite that is gone; it is not kept in the page
    setRejected(false);
    setInvite(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setPending(await signUp(auth.services, { name, email, password, invite: invite ?? undefined }));
      setPassword(""); // the sign-up is waiting for its code: the password is not needed again, and is not kept in the page
    } catch (e) {
      if (e instanceof ApiFailure && e.code === "no_memory") setNoMemory(true);
      else if (e instanceof ApiFailure && e.code === "invite_invalid") setRejected(true);
      else setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  if (noMemory) return <NoMemory />;
  if (invite === null) return <InviteStep onAccepted={setInvite} go={go} />;
  return (
    <>
    {pending && <CheckEmail pending={pending} onBack={() => setPending(null)} onDone={auth.closeAuth} onInviteRejected={backToCode} onSignIn={() => go("signin")} />}
    {/* Kept while the code is awaited, so "Change email" finds the name and email as they were; the password is cleared as soon as it is sent. */}
    <form className="authcard" onSubmit={submit} aria-label="Create your account" noValidate hidden={pending !== null}>
      <StepBar step={2} label="Email and password" />
      <span className="st ok"><i className="sd" />Invite accepted</span>
      <h1 className="auth-title">Create your account</h1>
      {rejected && (
        <div className="banner" role="alert">
          {INVITE_REFUSED}
          <span className="end"><button type="button" className="ghost" onClick={backToCode}>Back to the form</button></span>
        </div>
      )}
      <div className="form" style={{ width: "auto" }}>
        <label htmlFor="su-name">Name (optional)</label>
        <input id="su-name" className="field" autoComplete="name" placeholder="What should we call you?" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="su-email">Email</label>
        <input id="su-email" className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="su-password">Password</label>
        <input id="su-password" className="field" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <p className="t3 small">Your password never leaves this device. Orbyn checks it without ever seeing it. We email a code to confirm your address.</p>
      <CryptoProblem />
      {error && <p className="err" role="alert">{error}</p>}
      <PasskeyButton label="Continue with a passkey" />
      <button type="submit" className="btn" disabled={busy || !email.trim() || password.length < 8}>
        {busy ? "Creating your account…" : "Continue with a password"}
      </button>
      <span className="t3 small">
        Already have an account? <button type="button" className="link-btn" onClick={() => go("signin")}>Sign in</button>
      </span>
      <button type="button" className="link-btn quiet-link" onClick={auth.overlay ? auth.closeAuth : auth.useWithoutAccount}>
        {auth.overlay ? "Back to the planner" : "Use without an account"}
      </button>
    </form>
    </>
  );
}

function SignIn({ go }: { go: (s: AuthScreen) => void }) {
  const auth = useAuth()!;
  // "Sign in again" (a fresh sign-in is needed while still signed in) starts with this account's email, so only the password is left.
  const [email, setEmail] = useState(auth.session?.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** This browser holds another account's keys: nothing has been sent, and the person decides. */
  const [foreign, setForeign] = useState<KeysForAnotherAccount | null>(null);
  /** The password was right and the account has two-factor on: the sign-in waits for a code. */
  const [second, setSecond] = useState<SecondFactorNeeded | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [factor, setFactor] = useState("");

  /** The sign-in worked: leave the sign-in screens (and, if the person came from the delete dialog, it opens again). */
  const signedIn = () => {
    deleteIntent.signedIn();
    auth.closeAuth();
  };

  // Leaving this screen with a sign-in still waiting for its code lets its keys go (releasing twice is harmless).
  useEffect(() => () => second?.cancel(), [second]);

  const stopSecond = () => {
    second?.cancel();
    setSecond(null);
    setFactor("");
    setRecovery(false);
  };

  const finishSecond = async (event: FormEvent) => {
    event.preventDefault();
    if (!second) return;
    setBusy(true);
    setError(null);
    try {
      await second.complete(recovery ? { recoveryCode: factor.trim() } : { code: factor.replace(/\D/g, "") });
      signedIn();
    } catch (e) {
      // A wrong code leaves the sign-in open to try again; anything else has ended it, so the password step comes back.
      if (e instanceof ApiFailure && e.code === "second_factor_failed") setError(describeError(e));
      else {
        setSecond(null);
        setFactor("");
        setRecovery(false);
        setError(e instanceof ApiFailure && e.code === "login_failed" ? "That sign-in ended. Enter your password to start again." : describeError(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const attempt = async (replaceKeys: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await signIn(auth.services, { email, password, replaceKeys });
      signedIn();
    } catch (e) {
      if (e instanceof KeysForAnotherAccount) setForeign(e);
      else if (e instanceof SecondFactorNeeded) setSecond(e);
      else setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void attempt(false);
  };

  if (second) {
    const ready = recovery ? factor.trim().length >= 5 : factor.replace(/\D/g, "").length === 6;
    return (
      <form className="authcard" onSubmit={(e) => void finishSecond(e)} aria-label="Two-factor code" noValidate>
        <h1 className="auth-title">Enter your code</h1>
        <p className="t3">{recovery ? "Enter one of your recovery codes. Each works once." : "Enter the six-digit code from your authenticator app."}</p>
        <div className="form" style={{ width: "auto" }}>
          <label htmlFor="si-factor">{recovery ? "Recovery code" : "Code"}</label>
          <input
            id="si-factor"
            key={recovery ? "recovery" : "code"}
            className="field"
            inputMode={recovery ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            placeholder={recovery ? "XXXXX-XXXXX" : "123456"}
            value={factor}
            onChange={(e) => setFactor(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" className="btn" disabled={busy || !ready}>{busy ? "Checking…" : "Continue"}</button>
        <span className="t3 small">
          <button type="button" className="link-btn" onClick={() => { setRecovery(!recovery); setFactor(""); setError(null); }}>
            {recovery ? "Use a code from the app" : "Use a recovery code"}
          </button>{" "}
          · <button type="button" className="link-btn" onClick={stopSecond}>Cancel</button>
        </span>
      </form>
    );
  }

  if (foreign) {
    return (
      <div className="authcard" role="alertdialog" aria-modal="true" aria-label="Sign in to a different account" aria-describedby="foreign-keys">
        <h1 className="auth-title">Sign in to a different account?</h1>
        <p id="foreign-keys" className="t3">{foreign.message}</p>
        <div className="dialog-actions">
          <button type="button" className="ghost" data-autofocus onClick={() => setForeign(null)}>Cancel</button>
          <button type="button" className="btn" disabled={busy} onClick={() => { setForeign(null); void attempt(true); }}>Sign in anyway</button>
        </div>
      </div>
    );
  }

  return (
    <form className="authcard" onSubmit={submit} aria-label="Sign in" noValidate>
      <h1 className="auth-title">Sign in</h1>
      <div className="form" style={{ width: "auto" }}>
        <label htmlFor="si-email">Email</label>
        <input id="si-email" className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="si-password">Password</label>
        <input id="si-password" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <CryptoProblem />
      {error && <p className="err" role="alert">{error}</p>}
      <button type="submit" className="btn" disabled={busy || !email.trim() || !password}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <PasskeyButton label="Sign in with a passkey" />
      <span className="t3 small">
        New here? <button type="button" className="link-btn" onClick={() => go("signup")}>Create an account</button> ·{" "}
        <button type="button" className="link-btn" onClick={() => go("cant")}>Forgot your password?</button>
      </span>
      <button type="button" className="link-btn quiet-link" onClick={auth.overlay ? auth.closeAuth : auth.useWithoutAccount}>
        {auth.overlay ? "Back to the planner" : "Use without an account"}
      </button>
    </form>
  );
}

function CantSignIn({ go }: { go: (s: AuthScreen) => void }) {
  const options: { icon: "key" | "check" | "bell" | "shield"; label: string; planned: boolean; note?: string }[] = [
    { icon: "key", label: "Use a passkey", planned: true },
    { icon: "check", label: "Approve from a trusted device", planned: false, note: "Sign in with your password here first, then approve this device from one you already trust." },
    { icon: "bell", label: "Recover with your email and phone", planned: true },
    { icon: "shield", label: "Use a recovery key or contact", planned: true },
  ];
  return (
    <div className="authcard" role="group" aria-label="Can’t sign in?" style={{ width: "var(--sp-420)" }}>
      <button type="button" className="ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => go("signin")}><Icon name="left" small />Back to sign in</button>
      <h1 className="auth-title">Can’t sign in?</h1>
      <span className="t3" style={{ fontSize: "var(--fs-12-5)" }}>You need your password to sign in today. Recovering without it is Planned.</span>
      <ul className="auth-options">
        {options.map((o) => (
          <li key={o.label} className="nav" style={{ minHeight: "var(--sp-44)", height: "auto", background: "var(--raise)" }}>
            <Icon name={o.icon} small />
            <span>
              {o.label}
              {o.planned && (
                <>
                  {" "}
                  <Planned /> <NotAvailable />
                </>
              )}
              {o.note && (
                <>
                  <br />
                  <span className="t3 small">{o.note}</span>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      <span className="t3" style={{ fontSize: "var(--fs-12-5)" }}>
        Account recovery with your email and phone, recovery keys and recovery contacts are Planned. Until then, signing in needs your password.
      </span>
    </div>
  );
}

/** The public pages: landing, sign up, sign in and "Can’t sign in?". Shown full page when signed out, or over the planner. */
export function AuthScreens({ start }: { start: AuthScreen }) {
  const [screen, setScreen] = useState<AuthScreen>(start);
  return (
    <main className="public-page" id="content" tabIndex={-1}>
      {screen === "landing" ? <Landing go={setScreen} /> : screen === "signup" ? <SignUp go={setScreen} /> : screen === "signin" ? <SignIn go={setScreen} /> : <CantSignIn go={setScreen} />}
    </main>
  );
}
