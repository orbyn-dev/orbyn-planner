import { useEffect, useState } from "react";
import { Icon } from "../../ui/primitives/Icon";
import { PageHeader } from "../../ui/primitives/EmptyState";
import { Link } from "../../state/router";
import { useAuth } from "../../state/account";

const TWO_FACTOR_PATH = "/protection/two-factor";

/**
 * Protection on the account site (Account Designs v72 protection and ar-2fa-off): Data protection, which is Standard (Advanced is Planned and left
 * out), and Two-factor sign-in with its state from the engine and a link to the flow at `/protection/two-factor`.
 */
export function ProtectionOverview() {
  const auth = useAuth()!;
  /** `null` until the engine says; `"error"` if it could not. */
  const [twoFactor, setTwoFactor] = useState<boolean | null | "error">(null);

  useEffect(() => {
    let live = true;
    void auth.services.api.currentDevice().then(
      (d) => live && setTwoFactor(d.totp_enabled),
      () => live && setTwoFactor("error"),
    );
    return () => {
      live = false;
    };
  }, [auth.services]);

  return (
    <>
      <PageHeader title="Protection" sub="Applies to every Orbyn app" />
      <div className="pad" style={{ maxWidth: "var(--sp-760)" }}>
        <div className="bh"><b>Data protection</b><span></span></div>
        <div className="srow">
          <div className="lab2">
            <b>Standard protection</b>
            <small>Your data is encrypted on your devices before it’s uploaded. Right now only your trusted devices hold your keys.</small>
          </div>
          <span className="st ok"><Icon name="ok" small /> On</span>
        </div>
        <div className="bh"><b>Two-factor sign-in</b><span></span></div>
        <div className="srow">
          <div className="lab2">
            <b>Two-factor sign-in</b>
            <small>
              {twoFactor === true
                ? "On · authenticator app"
                : twoFactor === false
                  ? "Off · ask for a code from an authenticator app when you sign in on a new device"
                  : twoFactor === "error"
                    ? "Couldn’t check whether two-factor is on. Try again in a moment."
                    : "Checking…"}
            </small>
          </div>
          {typeof twoFactor === "boolean" && (
            <Link to={TWO_FACTOR_PATH} className={twoFactor ? "ghost sm" : "btn sm"}>{twoFactor ? "Manage" : "Set up"}</Link>
          )}
        </div>
      </div>
    </>
  );
}
