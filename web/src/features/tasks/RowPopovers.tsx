import { useState } from "react";
import { Modal } from "../../ui/primitives/Modal";
import { MonthGrid } from "../../ui/product/MonthGrid";
import { OptionMenu, type MenuOption } from "../../ui/primitives/OptionMenu";
import { PopoverRow } from "../../ui/primitives/PopoverRow";
import { addDays, dateKey, dateOf, formatDue, parseDue, type WeekStart } from "../../core/planner/dates";
import { readTime } from "../../core/planner/whenParser";
import { ruleLabel } from "../../core/planner/occurrences";
import { dayOf, type Repeat } from "../../core/planner/repeat";
import { STATUSES, STATUS_LABELS, statusOf, type Status } from "../../core/planner/taskStatus";
import { LIST_COLOURS, PRIORITIES, type Priority, type Task, type TaskList } from "../../core/planner/types";
import { RepeatPicker, kindOf, ruleFor, type RepeatKind } from "./RepeatPicker";
import { REMINDER_MENU, reminderLabel } from "./reminder";

function DueBody({ due, today, weekStart, onChange, close }: { due: string | null; today: string; weekStart: WeekStart; onChange: (day: string, time: string) => void; close: () => void }) {
  const day = due ? due.slice(0, 10) : "";
  const time = due && parseDue(due).hasTime ? due.slice(11, 16) : "";
  const [bad, setBad] = useState(false);
  const commit = (text: string) => {
    if (text.trim() === "") return setBad(false);
    const t = readTime(text);
    setBad(t === null);
    if (t !== null && t !== time) onChange(day || today, t);
  };
  const quick = (label: string, to: string) => (
    <button key={label} type="button" className="pill" onClick={() => { onChange(to, time); close(); }}>{label}</button>
  );
  const base = dateOf(today);
  return (
    <>
      <MonthGrid value={day} today={today} weekStart={weekStart} label="Due day" autoFocus onPick={(d) => onChange(d, time)} />
      <div className="rp-time">
        <input
          key={time}
          className="inp narrow"
          aria-label="Due time"
          aria-invalid={bad || undefined}
          placeholder="HH:mm"
          inputMode="numeric"
          defaultValue={time}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit(e.currentTarget.value))}
        />
        <button type="button" className="ghost" disabled={time === ""} onClick={() => onChange(day, "")}>No time</button>
      </div>
      <div className="rp-quick">
        {quick("Today", today)}
        {quick("Tomorrow", dateKey(addDays(base, 1)))}
        {quick("Next week", dateKey(addDays(base, 7)))}
        <button type="button" className="pill" onClick={() => { onChange("", ""); close(); }}>No date</button>
      </div>
    </>
  );
}

/** The Due row: a month, a 24-hour time with No time, and four shortcuts (p-row-due). `onChange` gets the day and time; an empty day removes the date. */
export function DueRow({ due, now, weekStart, style, onChange }: { due: string | null; now: Date; weekStart: WeekStart; style?: React.CSSProperties; onChange: (day: string, time: string) => void }) {
  return (
    <PopoverRow label="Due" value={due ? formatDue(due, now) : "No date"} style={style} wide>
      {({ close }) => <DueBody due={due} today={dateKey(now)} weekStart={weekStart} onChange={onChange} close={close} />}
    </PopoverRow>
  );
}

const PRIORITY_OPTIONS: readonly MenuOption<Priority>[] = PRIORITIES.map((p) => ({ value: p, label: p === "none" ? "None" : p[0]!.toUpperCase() + p.slice(1) }));

/** Priority is a word on this page, so the menu uses words too (p-row-priority). */
export function PriorityRow({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <PopoverRow label="Priority" value={PRIORITY_OPTIONS.find((o) => o.value === value)!.label}>
      {({ close }) => <OptionMenu label="Priority" options={PRIORITY_OPTIONS} selected={value} onPick={(p) => { onChange(p); close(); }} />}
    </PopoverRow>
  );
}

/** A searchable list of the lists with their colours, then No list (the Inbox) and New list… (p-row-list). */
export function ListRow({ lists, value, onChange, onCreate }: { lists: readonly TaskList[]; value: string; onChange: (id: string) => void; onCreate: (name: string, colour: string) => string }) {
  const current = lists.find((l) => l.id === value);
  const inbox = lists.find((l) => l.isInbox);
  return (
    <PopoverRow label="List" value={!current || current.isInbox ? "No list" : current.name}>
      {({ close }) => <ListBody lists={lists} value={value} inbox={inbox?.id} onChange={(id) => { onChange(id); close(); }} onCreate={onCreate} />}
    </PopoverRow>
  );
}

function ListBody({ lists, value, inbox, onChange, onCreate }: { lists: readonly TaskList[]; value: string; inbox: string | undefined; onChange: (id: string) => void; onCreate: (name: string, colour: string) => string }) {
  const [find, setFind] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  if (creating) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() === "") return;
          onChange(onCreate(name.trim(), LIST_COLOURS[lists.length % LIST_COLOURS.length]!));
        }}
      >
        <input className="field" aria-label="New list name" placeholder="List name" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
      </form>
    );
  }
  const shown: MenuOption<string>[] = lists
    .filter((l) => !l.isInbox && l.name.toLowerCase().includes(find.trim().toLowerCase()))
    .map((l) => ({ value: l.id, label: l.name, dot: l.colour }));
  const options: MenuOption<string>[] = [...shown];
  if (inbox && find.trim() === "") options.push({ value: inbox, label: "No list" });
  options.push({ value: "\0new", label: "New list…" });
  return (
    <>
      <input
        className="field"
        aria-label="Search lists"
        placeholder="Search lists"
        value={find}
        autoFocus
        onChange={(e) => setFind(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown") return;
          e.preventDefault();
          e.currentTarget.parentElement?.querySelector<HTMLButtonElement>("[role=menuitemradio]")?.focus();
        }}
      />
      <OptionMenu label="Lists" options={options} selected={value} focusOnMount={false} onPick={(id) => (id === "\0new" ? setCreating(true) : onChange(id))} />
    </>
  );
}

const REPEAT_OPTIONS: readonly MenuOption<RepeatKind>[] = [
  { value: "never", label: "Never" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Every weekday" },
  { value: "weekly-on", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "yearly", label: "Every year" },
  { value: "custom", label: "Custom…" },
];

/** What a rule says in the row: "Never", "Every day", "Every weekday", "Every week", or the rule in words. */
export function repeatSummary(rule: Repeat | null, start: string): string {
  if (!rule) return "Never";
  const kind = kindOf(rule);
  if (kind === "weekdays") return "Every weekday";
  if (kind === "weekly-on" && rule.weekdays.length === 1 && rule.weekdays[0] === dayOf(start)) return "Every week";
  return ruleLabel(rule);
}

/** The common choices; Custom… opens the recurrence dialog (p-row-repeat). */
export function RepeatRow({ rule, start, disabled, onChange }: { rule: Repeat | null; start: string; disabled?: boolean; onChange: (rule: Repeat | null) => void }) {
  const [dialog, setDialog] = useState(false);
  const kind = kindOf(rule);
  const selected: RepeatKind = kind === "weekly-on" && !(rule!.weekdays.length === 1 && rule!.weekdays[0] === dayOf(start)) ? "custom" : kind;
  return (
    <>
      <PopoverRow label="Repeat" value={repeatSummary(rule, start)} disabled={disabled}>
        {({ close }) => (
          <OptionMenu
            label="Repeat"
            options={REPEAT_OPTIONS}
            selected={selected}
            onPick={(k) => {
              if (k === "custom") {
                setDialog(true);
                return;
              }
              onChange(ruleFor(k, start, rule));
              close();
            }}
          />
        )}
      </PopoverRow>
      {dialog && (
        <Modal label="Repeat" onClose={() => setDialog(false)}>
          <RepeatPicker value={rule} start={start} initialKind="custom" onChange={onChange} />
          <div className="dialog-actions">
            <button type="button" className="btn" data-autofocus onClick={() => setDialog(false)}>Done</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** The reminder times; Custom… lets you type a time before (p-row-reminder). */
export function ReminderRow({ value, disabled, onChange }: { value: number | null; disabled?: boolean; onChange: (minutes: number | null) => void }) {
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState("45");
  const [unit, setUnit] = useState<"1" | "60" | "1440">("1");
  const options: MenuOption<number | null | "custom">[] = [...REMINDER_MENU, { value: "custom", label: "Custom…" }];
  return (
    <PopoverRow label="Reminder" value={reminderLabel(value)} disabled={disabled}>
      {({ close }) =>
        custom ? (
          <form
            className="rp-time"
            onSubmit={(e) => {
              e.preventDefault();
              const minutes = Math.floor(Number(amount)) * Number(unit);
              if (!(minutes >= 1) || minutes > 40_320) return;
              onChange(minutes);
              close();
            }}
          >
            <input className="inp narrow" type="number" min={1} aria-label="Time before" value={amount} autoFocus onChange={(e) => setAmount(e.target.value)} />
            <select className="inp" aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as "1" | "60" | "1440")}>
              <option value="1">minutes</option>
              <option value="60">hours</option>
              <option value="1440">days</option>
            </select>
            <button type="submit" className="btn">Set</button>
          </form>
        ) : (
          <OptionMenu
            label="Reminder"
            options={options}
            selected={REMINDER_MENU.some((r) => r.value === value) ? value : undefined}
            onPick={(v) => {
              if (v === "custom") return setCustom(true);
              onChange(v);
              close();
            }}
          />
        )
      }
    </PopoverRow>
  );
}



const STATUS_OPTIONS: readonly MenuOption<Status>[] = STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));

/** Where an open task stands: To do, In progress or Blocked (Planner Designs task-panel-status-open). Done stays the checkbox. */
export function StatusRow({ task, onChange }: { task: Pick<Task, "status">; onChange: (status: Status) => void }) {
  const status = statusOf(task);
  return (
    <PopoverRow label="Status" value={STATUS_LABELS[status]}>
      {({ close }) => <OptionMenu label="Status" options={STATUS_OPTIONS} selected={status} onPick={(s) => { onChange(s); close(); }} />}
    </PopoverRow>
  );
}
