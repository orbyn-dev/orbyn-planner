import { takeSettingsTarget } from "../../app/settingsTarget";
import { ProtectionSettings } from "../auth/ProtectionSettings";
import { useState } from "react";
import { applyChoice, chooseTheme, readDarkTheme, readStoredChoice, setDarkTheme, type DarkTheme, type ThemeChoice } from "../../app/theme";
import { usePrefs } from "../../app/prefs";
import { Icon } from "../../components/Icon";
import { CalendarForms, CalendarList, UnsupportedRepeats } from "../calendar/CalendarList";
import { AccountSettings } from "../auth/AccountSettings";
import { NotificationsSettings } from "./NotificationsSettings";
import { DeleteAccountRow } from "../auth/DeleteAccount";
import { ExportSettings } from "../export/ExportSettings";
import { TagsSettings } from "./TagsSettings";
import { InstallHint } from "../../components/InstallHint";

const THEME_ROWS = [["system", "System"], ["light", "Light"], ["dark", "Dark"]] as const;
const DARK_ROWS = [["dark", "Dark"], ["dim", "Dim"]] as const;
const CATEGORIES = ["Account", "Planning", "Notifications", "Connected apps", "Calendars", "Tags", "Privacy"] as const;

export function SettingsPage() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(() => {
    // Taken once: reading it inside the find would consume it for the first category only.
    const wanted = takeSettingsTarget();
    return CATEGORIES.find((c) => c === wanted) ?? "Planning";
  });
  const [find, setFind] = useState("");
  const [choice, setChoice] = useState<ThemeChoice>(readStoredChoice);
  const [darkTheme, setDark] = useState<DarkTheme>(readDarkTheme);
  const { prefs, setPrefs } = usePrefs();
  const shown = CATEGORIES.filter((c) => c.toLowerCase().includes(find.trim().toLowerCase()));

  return (
    <div className="split">
      <div className="l">
        <label className="search">
          <Icon name="search" small />
          <input placeholder="Find a setting" aria-label="Find a setting" value={find} onChange={(e) => setFind(e.target.value)} />
        </label>
        {shown.map((c) => (
          <button key={c} type="button" className={c === category ? "nav on" : "nav"} aria-current={c === category ? "true" : undefined} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="r">
        <h1 className="sr-only">Settings</h1>
        <div className="ph">
          <h2>{category}</h2>
        </div>
        <div className="pad">
          {category === "Planning" ? (
            <>
              <div className="bh"><b>Your week</b><span></span></div>
              <div className="card" style={{ gap: 0, padding: "0 var(--sp-14)" }}>
                <div className="kv" style={{ height: "var(--sp-44)", borderBottom: "var(--bw) solid var(--line)" }}>
                  <span id="week-start-label">Week starts on</span>
                  <div role="radiogroup" aria-labelledby="week-start-label" className="pills">
                    {(["mon", "sun", "sat"] as const).map((d) => (
                      <button key={d} type="button" role="radio" aria-checked={prefs.weekStart === d} className="pill" onClick={() => setPrefs({ weekStart: d })}>
                        {d === "mon" ? "Monday" : d === "sun" ? "Sunday" : "Saturday"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="kv" style={{ height: "var(--sp-44)" }}>
                  <span id="week-days-label">Days in the week view</span>
                  <div role="radiogroup" aria-labelledby="week-days-label" className="pills">
                    {([5, 7] as const).map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={prefs.weekDays === n} className="pill" onClick={() => setPrefs({ weekDays: n })}>
                        {n} days
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bh"><b>Appearance</b><span></span></div>
              <div className="card" style={{ gap: 0, padding: "0 var(--sp-14)" }}>
                <div className="kv" style={{ height: "var(--sp-44)", borderBottom: "var(--bw) solid var(--line)" }}>
                  <span id="theme-label">Theme</span>
                  <div role="radiogroup" aria-labelledby="theme-label" className="pills">
                    {THEME_ROWS.map(([c, label]) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={c === "dark" ? choice === "dark" || choice === "dim" : choice === c}
                        className="pill"
                        onClick={() => {
                          // Dark uses the dark theme chosen below.
                          const next: ThemeChoice = c === "dark" ? darkTheme : c;
                          setChoice(next);
                          chooseTheme(next);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="kv" style={{ height: "var(--sp-44)" }}>
                  <span id="dark-theme-label">Dark theme</span>
                  <div role="radiogroup" aria-labelledby="dark-theme-label" className="pills">
                    {DARK_ROWS.map(([d, label]) => (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={darkTheme === d}
                        className="pill"
                        onClick={() => {
                          setDark(d);
                          setDarkTheme(d);
                          // Chosen Dark now follows it; System follows it when the system is dark.
                          if (choice === "dark" || choice === "dim") {
                            setChoice(d);
                            chooseTheme(d);
                          } else applyChoice(choice);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <InstallHint />
            </>
          ) : category === "Account" ? (
            <AccountSettings onOpenPrivacy={() => setCategory("Privacy")} />
          ) : category === "Notifications" ? (
            <NotificationsSettings />
          ) : category === "Calendars" ? (
            <>
              <div className="bh"><b>Your calendars</b><span></span></div>
              <div className="card" style={{ gap: 0, padding: "0 var(--sp-14)" }}>
                <CalendarList />
              </div>
              <CalendarForms />
              <UnsupportedRepeats />
              <span className="t3" style={{ fontSize: "var(--fs-12-5)" }}>
                Subscribed calendars are read from their link in this browser, once an hour while Orbyn Planner is open. Some servers don’t allow that yet.
              </span>
            </>
          ) : category === "Privacy" ? (
            <>
              <ProtectionSettings onReviewDevices={() => setCategory("Account")} />
              <ExportSettings>
                <DeleteAccountRow />
              </ExportSettings>
            </>
          ) : category === "Tags" ? (
            <TagsSettings />
          ) : (
            <p className="quiet">Nothing to set here yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
