import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../../ui/primitives/Icon";
import { Link, useRouter } from "../../state/router";
import { useAuth } from "../../state/account";
import { ProtectionOverview } from "./ProtectionOverview";

/** The account site is this app on the account host: these paths show its own shell instead of the planner's (Account Designs v72). */
export const ACCOUNT_SITE_ROOT = "/protection";
export const TWO_FACTOR_PATH = "/protection/two-factor";

export const isAccountSitePath = (path: string): boolean => path === ACCOUNT_SITE_ROOT || path.startsWith(`${ACCOUNT_SITE_ROOT}/`);

/** The account site's page for a path. Paths this build has no page for (everything Planned) show the Protection overview. */
function page(path: string): ReactNode {
  void path;
  return <ProtectionOverview />;
}

/**
 * The account site's shell (Account Designs v72 ar-2fa-off): who is signed in, the pages that are built, and Sign out. Pages that are
 * Planned in the designs (Overview, Recovery, Connected apps, Plan and billing, Activity) are not listed until they exist.
 */
export function AccountSite() {
  const auth = useAuth();
  const { path } = useRouter();
  const email = auth?.session?.email ?? "";
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const before = document.title;
    document.title = "Protection · Orbyn account";
    return () => {
      document.title = before;
    };
  }, []);

  return (
    <div className="app account-site" style={{ ["--side-w" as string]: "var(--sp-224)" }}>
      <aside className="side" aria-label="Account">
        <div className="acct-id">
          <span className="avatar" aria-hidden="true">{email.charAt(0).toUpperCase()}</span>
          <div>
            <b>{email}</b>
            <small className="t3">Orbyn account</small>
          </div>
        </div>
        <nav aria-label="Account pages" className="primary">
          <Link to={ACCOUNT_SITE_ROOT} className="nav">
            <Icon name="shield" />
            <span className="lbl">Protection</span>
          </Link>
          <button
            type="button"
            className="nav bottom"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              void auth?.signOut({ keepDevice: true });
            }}
          >
            <Icon name="x" />
            <span className="lbl">Sign out</span>
          </button>
        </nav>
      </aside>
      <main id="content" tabIndex={-1} className="sheet">
        <div className="sheet-main">{page(path)}</div>
      </main>
    </div>
  );
}
