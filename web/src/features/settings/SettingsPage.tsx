import { takeSettingsTarget } from "../../state/settingsTarget";
import { ProtectionSettings } from "../account";
import { useState } from "react";
import { applyChoice, chooseTheme, readDarkTheme, readStoredChoice, setDarkTheme, type DarkTheme, type ThemeChoice } from "../../ui/theme";
import { usePrefs } from "../../state/prefs";
import { InstallHint } from "../../ui/product/InstallHint";
import { Icon } from "../../ui/primitives/Icon";
import { CalendarForms, CalendarList, UnsupportedRepeats } from "../calendar";
import { AccountSettings } from "../account";
import { NotificationsSettings } from "../notifications";
import { DeleteAccountRow } from "../account";
import { ExportSettings } from "../export";
import { TagsSettings } from "../tasks";
import { InstallHint } from "../../ui/product/InstallHint";
import { useContentFlags } from "../../lib/contentWidth";
import { OptionMenu, type MenuOption } from "../../ui/primitives/OptionMenu";
import { PopoverRow } from "../../ui/primitives/PopoverRow";
import type { WeekStart } from "../../core/planner/dates";

const THEME_ROWS = [["system", "System"], ["light", "Light"], ["dark", "Dark"]] as const;
const DARK_ROWS = [["dark", "Dark"], ["dim", "Dim"]] as const;
const WEEK_START_ROWS = [["mon", "Monday"], ["sun", "Sunday"], ["sat", "Saturday"]] as const;
const WEEK_START_OPTIONS: readonly MenuOption<WeekStart>[] = WEEK_START_ROWS.map(([value, label]) => ({ value, label }));
const WEEK_DAYS_OPTIONS: readonly MenuOption<5 | 7>[] = [{ value: 5, label: "5 days" }, { value: 7, label: "7 days" }];
const THEME_OPTIONS: readonly MenuOption<ThemeChoice>[] = THEME_ROWS.map(([value, label]) => ({ value, label }));
const DARK_OPTIONS: readonly MenuOption<DarkTheme>[] = DARK_ROWS.map(([value, label]) => ({ value, label }));
/** The Theme row says Dark for either dark theme; the Dark theme row says which one (Planner Designs settings). */
const themeValue = (choice: ThemeChoice) => (choice === "dark" || choice === "dim" ? "Dark" : choice === "light" ? "Light" : "System");
const CATEGORIES = ["Account", "Planning", "Notifications", "Connected apps", "Calendars", "Tags", "Privacy"] as const;
/** A settings row is the design's 44px row with a divider under it (Planner Designs settings). */
const SETTING_ROW = { height: "var(--sp-44)", borderBottom: "var(--bw) solid var(--line)" } as const;

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
  // Under 560 px the category column becomes one "Category" row above the page, and the row opens the list (Planner Designs v69 p-narrow-settings-480).
  const { tight } = useContentFlags();
  const [listOpen, setListOpen] = useState(false);

  if (tight && listOpen) {
    return (
      <div className="split">
        <div className="r">
          <h1 className="sr-only">Settings</h1>
          <div className="ph">
            <h2>Settings</h2>
          </div>
          <div className="pad">
            <label className="search">
              <Icon name="search" small />
              <input placeholder="Find a setting" aria-label="Find a setting" value={find} onChange={(e) => setFind(e.target.value)} />
            </label>
            <div className="catlist">
              {shown.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={c === category ? "nav on" : "nav"}
                  aria-current={c === category ? "true" : undefined}
                  onClick={() => {
                    setCategory(c);
                    setFind("");
                    setListOpen(false);
                  }}
                >
                  <span>{c}</span>
                  <Icon name="right" small />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="split">
      {!tight && <div className="l">
        <label className="search">
          <Icon name="search" small />
          <input placeholder="Find a setting" aria-label="Find a setting" value={find} onChange={(e) => setFind(e.target.value)} />
        </label>
        {shown.map((c) => (
          <button key={c} type="button" className={c === category ? "nav on" : "nav"} aria-current={c === category ? "true" : undefined} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>}
      <div className="r">
        <h1 className="sr-only">Settings</h1>
        <div className="ph">
          <h2>{category}</h2>
        </div>
        <div className="pad">
          {tight && (
            <button type="button" className="field catrow" aria-haspopup="true" onClick={() => setListOpen(true)}>
              <span className="t3">Category</span>
              <span>
                {category} <Icon name="right" small />
              </span>
            </button>
          )}
          {category === "Planning" ? (
            <>
              <div className="bh"><b>Your week</b><span></span></div>
              <div className="card" style={{ gap: 0, padding: "0 var(--sp-14)" }}>
                <PopoverRow
                  label="Week starts on"
                  value={WEEK_START_ROWS.find(([d]) => d === prefs.weekStart)![1]}
                  rowStyle={SETTING_ROW}
                  note={false}
                >
                  {({ close }) => (
                    <OptionMenu label="Week starts on" options={WEEK_START_OPTIONS} selected={prefs.weekStart} onPick={(d) => { setPrefs({ weekStart: d }); close(); }} />
                  )}
                </PopoverRow>
                <PopoverRow
                  label="Days in the week view"
                  value={`${prefs.weekDays} days`}
                  rowStyle={{ ...SETTING_ROW, borderBottom: undefined }}
                  note={false}
                >
                  {({ close }) => (
                    <OptionMenu label="Days in the week view" options={WEEK_DAYS_OPTIONS} selected={prefs.weekDays} onPick={(n) => { setPrefs({ weekDays: n }); close(); }} />
                  )}
                </PopoverRow>
              </div>
              <div className="bh"><b>Appearance</b><span></span></div>
              <div className="card" style={{ gap: 0, padding: "0 var(--sp-14)" }}>
                <PopoverRow label="Theme" value={themeValue(choice)} rowStyle={SETTING_ROW} note={false}>
                  {({ close }) => (
                    <OptionMenu
                      label="Theme"
                      options={THEME_OPTIONS}
                      selected={choice === "dim" ? "dark" : choice}
                      onPick={(c) => {
                        // Dark uses the dark theme chosen below.
                        const next: ThemeChoice = c === "dark" ? darkTheme : c;
                        setChoice(next);
                        chooseTheme(next);
                        close();
                      }}
                    />
                  )}
                </PopoverRow>
                {/* The frame names both dark themes rather than the chosen one (Planner Designs settings); the menu marks the choice. */}
                <PopoverRow label="Dark theme" value="Dark · Dim" rowStyle={{ ...SETTING_ROW, borderBottom: undefined }} note={false}>
                  {({ close }) => (
                    <OptionMenu
                      label="Dark theme"
                      options={DARK_OPTIONS}
                      selected={darkTheme}
                      onPick={(d) => {
                        setDark(d);
                        setDarkTheme(d);
                        // Chosen Dark now follows it; System follows it when the system is dark.
                        if (choice === "dark" || choice === "dim") {
                          setChoice(d);
                          chooseTheme(d);
                        } else applyChoice(choice);
                        close();
                      }}
                    />
                  )}
                </PopoverRow>
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
