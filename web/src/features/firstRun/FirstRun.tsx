import { useState } from "react";
import { usePrefs } from "../../app/prefs";
import { NotAvailable, Planned } from "../../components/Planned";
import { localeWeekStart, type WeekStart } from "../../lib/dates";
import { PERSONAL_CALENDAR_ID } from "../../store/LocalStore";
import { usePlanner, useStore } from "../../store/context";
import { LIST_COLOURS, type ListColour } from "../../store/types";
import { NEEDS_ENGINE } from "../../api/feeds";
import { feedAddress, fetchFeed, subscriptionsAvailable } from "../calendar/subscriptions";

const COLOUR_NAMES: Record<ListColour, string> = { c1: "Blue", c2: "Green", c3: "Purple", c4: "Orange" };
const WEEK_STARTS: readonly { id: WeekStart; label: string; note: string }[] = [
  { id: "mon", label: "Monday", note: "Week 1 begins on a Monday" },
  { id: "sun", label: "Sunday", note: "Week 1 begins on a Sunday" },
  { id: "sat", label: "Saturday", note: "Week 1 begins on a Saturday" },
];

function Colours({ value, onChange, label }: { value: ListColour; onChange: (c: ListColour) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="colours fr-colours">
      {LIST_COLOURS.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={COLOUR_NAMES[c]} className="colour-btn" onClick={() => onChange(c)}>
          <span className="sw" style={{ background: `var(--${c})` }} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

type Source = "create" | "subscribe";

/**
 * First run (Planner Designs first-run, fr-week, fr-calendar, fr-list): a welcome, then three short steps, all skippable: when the week
 * starts and which days show (the same settings as Settings › Planning), a first calendar, and a first list. "Skip for now" opens the
 * planner with the defaults and the welcome never comes back; "Start planning" ends first run and opens Today.
 */
export function FirstRun({ onDone }: { onDone: () => void }) {
  const store = useStore();
  const { calendars } = usePlanner();
  const { setPrefs } = usePrefs();
  /** 0 is the welcome. */
  const [step, setStep] = useState(0);

  // Step 1.
  const [suggested] = useState<WeekStart>(() => localeWeekStart());
  const [weekStart, setWeekStart] = useState<WeekStart>(suggested);
  const [weekDays, setWeekDays] = useState<5 | 7>(7);
  // Step 2.
  const [source, setSource] = useState<Source>("create");
  const [calendarName, setCalendarName] = useState("Personal");
  const [calendarColour, setCalendarColour] = useState<ListColour>("c2");
  const [address, setAddress] = useState("");
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // Step 3.
  const [listName, setListName] = useState("");
  const [listColour, setListColour] = useState<ListColour>("c1");

  const skip = () => {
    // The defaults: the locale's week start, all seven days, the Personal calendar and the Inbox that already exist.
    setPrefs({ weekStart: localeWeekStart(), weekDays: 7 });
    onDone();
  };

  /** Skip for now, from a step: the week the person already chose stays, and nothing more is made. */
  const skipOn = () => (step === 1 ? skip() : onDone());

  const applyWeek = () => setPrefs({ weekStart, weekDays });

  const continueCalendar = async () => {
    setCalendarError(null);
    if (source === "create") {
      const name = calendarName.trim();
      if (!name) return setCalendarError("Give the calendar a name.");
      // Personal already exists: the first calendar is that one, named and coloured, not a second.
      const personal = calendars.find((c) => c.id === PERSONAL_CALENDAR_ID) ?? calendars.find((c) => c.kind.type === "local");
      if (personal) store.updateCalendar(personal.id, { name, colour: calendarColour });
      else store.addCalendar(name, calendarColour);
      return setStep(3);
    }
    setChecking(true);
    try {
      const url = feedAddress(address);
      const events = await fetchFeed(url);
      const host = new URL(url).hostname.replace(/^www\./, "");
      const feed = store.addSubscription(host, calendarColour, url);
      store.replaceFeedEvents(feed.id, events);
      setStep(3);
    } catch {
      // A refused address, a feed that is not a calendar and a server that does not answer are one answer for the person.
      setCalendarError("That address didn’t work. Check it and try again.");
    } finally {
      setChecking(false);
    }
  };

  const finish = (withList: boolean) => {
    const name = listName.trim();
    if (withList && name) store.addList(name, listColour);
    onDone();
  };

  const subscribeOk = subscriptionsAvailable();
  const back = () => setStep(step - 1);

  if (step === 0) {
    return (
      <div className="first-run" role="region" aria-label="Welcome to Orbyn Planner">
        <h1 className="fr-title">Welcome to Orbyn Planner</h1>
        <p className="t3">Set up your week in a minute. You can change all of this later in Settings.</p>
        <ol className="fr-tiles">
          {["When your week starts", "Add a calendar", "Make your first list"].map((label, i) => (
            <li key={label} className="stat"><small>Step {i + 1}</small><b>{label}</b></li>
          ))}
        </ol>
        <div className="fr-actions fr-welcome-actions">
          <button type="button" className="ghost" onClick={skip}>Skip for now</button>
          <button type="button" className="btn" onClick={() => setStep(1)}>Start</button>
        </div>
      </div>
    );
  }

  return (
    <div className="first-run fr-steps" role="region" aria-label={`First run, step ${step} of 3`}>
      <div className="fr-step">
        <div className="fr-progress">
          <span className="fr-bars" aria-hidden="true">
            {[1, 2, 3].map((n) => <i key={n} data-on={n <= step} />)}
          </span>
          <span className="t3 small">Step {step} of 3</span>
        </div>
        {step === 1 && (
          <>
            <h1 className="fr-title fr-step-title">When does your week start?</h1>
            <p className="t3 fr-lede">This sets the first column of your calendar and the week in Today.</p>
            <div role="radiogroup" aria-label="Week starts on" className="fr-choices">
              {WEEK_STARTS.map((w) => (
                <button key={w.id} type="button" role="radio" aria-checked={weekStart === w.id} className="fr-choice fr-pick-card" onClick={() => setWeekStart(w.id)}>
                  <span className="fr-radio" aria-hidden="true" />
                  <span className="fr-text">
                    <b>{w.label}</b>
                    <small className={w.id === suggested ? undefined : "fr-more"}>{w.id === suggested ? "Suggested for your region" : w.note}</small>
                  </span>
                </button>
              ))}
            </div>
            <span id="fr-days-label" className="fr-label">Days shown</span>
            <div role="radiogroup" aria-labelledby="fr-days-label" className="seg">
              {([7, 5] as const).map((n) => (
                <button key={n} type="button" role="radio" aria-checked={weekDays === n} className="seg-btn" onClick={() => setWeekDays(n)}>
                  {n === 7 ? "All 7 days" : "Weekdays only"}
                </button>
              ))}
            </div>
            <p className="t3 small">You can change both later in Settings › Planning.</p>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="fr-title fr-step-title">Add a calendar</h1>
            <p className="t3 fr-lede">Start with one calendar. You can add more later.</p>
            <div role="radiogroup" aria-label="How to add it" className="fr-choices">
              <div className="fr-choice" data-selected={source === "create"}>
                <button type="button" role="radio" aria-checked={source === "create"} aria-labelledby="fr-create-l" aria-describedby="fr-create-h" className="fr-head" onClick={() => setSource("create")}>
                  <span className="fr-radio" aria-hidden="true" />
                  <span className="fr-text">
                    <b id="fr-create-l">Create a calendar</b>
                    <small id="fr-create-h" className="fr-more">A calendar of your own. You can add more later.</small>
                  </span>
                </button>
                {source === "create" && (
                  <>
                    <label htmlFor="fr-cal-name" className="sr-only">Calendar name</label>
                    <input id="fr-cal-name" className={calendarError ? "field err" : "field"} placeholder="Calendar name" value={calendarName} aria-invalid={calendarError !== null || undefined} onChange={(e) => setCalendarName(e.target.value)} />
                    {calendarError && <span className="fr-error" role="alert">{calendarError}</span>}
                    <Colours value={calendarColour} onChange={setCalendarColour} label="Calendar colour" />
                  </>
                )}
              </div>
              <div className="fr-choice" data-selected={source === "subscribe"}>
                <button type="button" role="radio" aria-checked={source === "subscribe"} aria-labelledby="fr-sub-l" aria-describedby="fr-sub-h" className="fr-head" disabled={!subscribeOk} onClick={() => setSource("subscribe")}>
                  <span className="fr-radio" aria-hidden="true" />
                  <span className="fr-text">
                    <b id="fr-sub-l">Subscribe to a calendar feed</b>
                    <small id="fr-sub-h" className="fr-more">Show events from an address, such as a holiday or team calendar.</small>
                  </span>
                </button>
                {!subscribeOk && <p className="t3" role="note">{NEEDS_ENGINE}.</p>}
                {source === "subscribe" && (
                  <>
                    <label htmlFor="fr-cal-url" className="sr-only">Feed address</label>
                    <input id="fr-cal-url" className={calendarError ? "field err" : "field"} type="url" placeholder="https://…" value={address} aria-invalid={calendarError !== null || undefined} onChange={(e) => setAddress(e.target.value)} />
                    {calendarError && <span className="fr-error" role="alert">{calendarError}</span>}
                    {checking && <span className="t3 fr-checking" role="status"><span className="spin" aria-hidden="true" /> Checking…</span>}
                  </>
                )}
              </div>
              <div className="fr-choice fr-planned" aria-disabled="true">
                <span className="fr-radio" aria-hidden="true" />
                <span className="fr-text">
                  <b>Connect Google or Outlook</b>
                  <small><span className="fr-more">Two-way sync with a calendar you already use. </span><Planned /> <NotAvailable /></small>
                </span>
              </div>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="fr-title fr-step-title">Make your first list</h1>
            <p className="t3 fr-lede">Lists keep tasks together, like Work or Errands. Your Inbox already exists.</p>
            <label htmlFor="fr-list-name" className="fr-label">List name</label>
            <input id="fr-list-name" className="field" placeholder="Work, Home, Errands" value={listName} onChange={(e) => setListName(e.target.value)} />
            <span className="fr-label" id="fr-list-colour">Colour</span>
            <Colours value={listColour} onChange={setListColour} label="Colour" />
          </>
        )}
        <div className="fr-actions">
          <button type="button" className="ghost fr-back" onClick={back}>Back</button>
          {step === 3 && listName.trim() === "" ? (
            <button type="button" className="link-btn quiet-link fr-skip" onClick={() => finish(false)}>I’ll make lists later</button>
          ) : (
            <button type="button" className="link-btn quiet-link fr-skip" onClick={skipOn}>Skip for now</button>
          )}
          {step === 1 && <button type="button" className="btn fr-go" onClick={() => { applyWeek(); setStep(2); }}>Continue</button>}
          {step === 2 && <button type="button" className="btn fr-go" disabled={checking} onClick={() => void continueCalendar()}>Continue</button>}
          {step === 3 && <button type="button" className="btn fr-go" onClick={() => finish(true)}>Start planning</button>}
        </div>
      </div>
    </div>
  );
}
