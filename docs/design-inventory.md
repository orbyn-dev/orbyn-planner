# Design inventory: Planner against the designs

- **Designs commit:** `59546b4` (orbyn-designs `origin/main`), Planner Designs and Account Designs of 2026-11-09; the fifth match pass (Search, Notifications, Settings, event panels, sign-in screens) read both pages from it. Earlier rows were read from older commits.
- **Sixth match pass (sign-up, verify, sign-in, start over):** planner main at `c6f9dfa` plus the kit commit on `docs/match-pass-6`, Planner Designs v57 and Account Designs v62 to v64 as given by the coordinator (not verified here; the design HTML read from `origin/main` carries no version). Rows below for these screens cite that pass. The kit now crops the sign-in frames (they were slivers before) and draws the start-over page.
- **Page versions:** Planner Designs v50 and Account Designs v60, as given by the coordinator. The HTML files carry no version marker (the version lives on the artifact server), so these are taken from the brief and not verified here.
- **Planner main checked:** first run on `50b5bc2a`; match passes on main at `3caa45a`, `0d76a40`, `de0fdae` and (fourth: Today, calendar, Tasks list, View options and the task panel) `d3ab552`, with #91 to #96 merged. #94 had not merged.
- **Refresh method:** rows for work merged since the first run were updated from the code, the tests and each PR’s notes; they were not re-screenshotted, so none moves to *matched*. Frames built to v39 to v41 name the PR. Rows for work not yet merged (row popovers, the When line) are left as they were.
- **Method (match passes):** `node scripts/match.mjs <frame>... --theme all` from the match kit: planner on an in-memory seeded store, clock pinned to Sat 7 Nov 2026 08:30 UTC (the week and day frames at 11:40, where the design draws its red line), `en-GB`, reduced motion, one second wait for the sync label's hold; ours at 1160x700 (desktop) or 390x730 (phone) against the design frame cropped the same. Each frame was looked at as a three-theme sheet (Today, calendar, Tasks list, panels) or in light plus the text and pixel diff in the other themes (the rest); measured offsets come from the element positions of both pages. Owner and "Anyone" are gated (sharing is Planned); the In progress and Blocked lanes are not built until #83.
- **Screenshots** are not committed. Match-pass images are `<frame>-<theme>-side.png` (ours left, design right) with the two halves and a text diff in the author’s scratch folder; older rows keep their `cmp-<id>.png` names.
- **Status words.** *matched*: layout, copy, sizes and colours agree in all three themes and I looked at it. *partial*: built, with the listed differences. *not built*: no code for it (the cell says how that was established). *gated*: the frame’s own note says it is not shown today or is Planned. *in progress*: built on a branch that has not merged (none at the last refresh). *not checked yet*: not compared; the component is only a pointer from reading the code.
- **Left out of every “differs” cell** because they hold for all frames and need things this device-only run cannot provide: (G1) the design sidebar has a Booking item and a Notifications count, the build has neither (nav.ts:11; booking and sharing are not built); (G2) the sync pill reads “Synced · 3 devices” in the design and “On this device” in the local build, since real sync needs an account and engine; (G3) “Good morning, Sam” needs an account name, the build says “Good morning”; (G4) the design draws a window title bar, the web build has none.

## Counts

| Page / area | Frames | matched | partial | not built | gated | in progress | not checked yet |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Planner Designs (all)** | **171** | **6** | **106** | **26** | **12** | **0** | **21** |
| Planner · Getting started | 9 | 1 | 8 | 0 | 0 | 0 | 0 |
| Planner · Search | 2 | 0 | 2 | 0 | 0 | 0 | 0 |
| Planner · Empty, loading and error states | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Planner · Today | 14 | 5 | 8 | 0 | 1 | 0 | 0 |
| Planner · Calendar | 26 | 0 | 19 | 2 | 3 | 0 | 2 |
| Planner · Tasks | 30 | 0 | 21 | 8 | 1 | 0 | 0 |
| Planner · Lists | 6 | 0 | 4 | 2 | 0 | 0 | 0 |
| Planner · Sharing | 5 | 0 | 0 | 5 | 0 | 0 | 0 |
| Planner · Completed and deleted | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| Planner · Projects | 5 | 0 | 4 | 0 | 0 | 0 | 1 |
| Planner · Booking | 8 | 0 | 0 | 8 | 0 | 0 | 0 |
| Planner · Notifications | 4 | 0 | 2 | 0 | 2 | 0 | 0 |
| Planner · Settings | 31 | 0 | 15 | 1 | 5 | 0 | 10 |
| Planner · Account and auth | 21 | 0 | 16 | 0 | 0 | 0 | 5 |
| Planner · Phone | 8 | 0 | 6 | 0 | 0 | 0 | 2 |
| **Account Designs (all)** | **131** | **0** | **18** | **0** | **13** | **0** | **100** |
| Account · Account site | 14 | 0 | 0 | 0 | 5 | 0 | 9 |
| Account · Delete account | 40 | 0 | 0 | 0 | 0 | 0 | 40 |
| Account · Protection | 24 | 0 | 14 | 0 | 8 | 0 | 2 |
| Account · Sign-up | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Account · Keys and devices | 10 | 0 | 0 | 0 | 0 | 0 | 10 |
| Account · Two-factor | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Account · Emails | 10 | 0 | 0 | 0 | 0 | 0 | 10 |
| Account · Witness | 6 | 0 | 0 | 0 | 0 | 0 | 6 |
| Account · Key service | 9 | 0 | 0 | 0 | 0 | 0 | 9 |
| Account · Start over | 9 | 0 | 4 | 0 | 0 | 0 | 5 |
| Account · Consent | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Account · Launcher | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| Account · Phone | 1 | 0 | 0 | 0 | 0 | 0 | 1 |

Deep pass (Today, calendar, tasks) was complete at the first run; the refresh above adds what merged after it. Everything else is marked *not checked yet* unless the code shows the feature is absent or the frame note says it is gated. Frames outside this repository (account site, email, witness, key service, launcher) are listed with the owner and not compared.

## Planner Designs (v47)

### Getting started

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `first-run` First run | `features/firstRun/FirstRun.tsx:107` | matched | `first-run-{light,dark,dim}-side.png` (+ -1440) | agrees in light, dark and Dim at 1160 and 1440 px: title, intro, three tiles and both buttons within 1px; the sidebar badge and Booking are the excluded differences (a first run has no tasks) |
| `fr-week` First run · When your week starts | `features/firstRun/FirstRun.tsx:128` | matched | `fr-week-{light,dark,dim}-side.png` (+ -1440) | within 2px on the desktop frame after the spacing fix (step line 12px, labels 13px, option cards 1px taller, "Skip for now" 14px from the button, `app.css` first-run block); layout offsets measured with the kit |
| `fr-calendar` First run · Add a calendar | `features/firstRun/FirstRun.tsx:150` | partial | `fr-calendar-{light,dark,dim}-side.png` (+ -1440) | as `fr-week` (within 2px); the Planned note box on the subscribe card is 2px off |
| `fr-calendar-error` First run · Calendar error | `features/firstRun/FirstRun.tsx:150` | partial | `fr-calendar-error-{light,dark,dim}-side.png` (+ -1440) | as `fr-week`; the message and the red outline agree in copy and colour; its position is 3px off with the block |
| `fr-calendar-feed-error` First run · Feed error | `features/firstRun/FirstRun.tsx:90` | partial | `fr-calendar-feed-error-{light,dark,dim}-side.png` (+ -1440) | as `fr-week`; "That address didn’t work. Check it and try again." agrees |
| `fr-calendar-checking` First run · Checking the feed | `features/firstRun/FirstRun.tsx:174` | partial | `fr-calendar-checking-{light,dark,dim}-side.png` (+ -1440) | as `fr-week`; "Checking…" and its spinner agree |
| `fr-list` First run · Make your first list | `features/firstRun/FirstRun.tsx:185` | partial | `fr-list-{light,dark,dim}-side.png` (+ -1440) | as `fr-week` (within 2px) |
| `fr-list-empty` First run · Empty list name | `features/firstRun/FirstRun.tsx:185` | partial | `fr-list-empty-{light,dark,dim}-side.png` (+ -1440) | as `fr-list`; the "I’ll make lists later" link agrees |
| `fr-phone` First run · Phone | `features/firstRun/FirstRun.tsx` | partial | `fr-phone-{light,dark,dim}-side.png` (+ -1440) | sizes agree after the phone fix (labels and names 14px, hints 12px); offsets within 2px |

### Today

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `today` Today | `features/today/TodayPage.tsx:150` | matched | `today-{light,dark,dim}-side.png` (+ -1440) | agrees in light, dark and Dim at 1160 and 1440 px after #91: rows, the Overdue block, the pill "Synced · 3 devices", the greeting with the name and every count; Booking and the Notifications count in the sidebar are the excluded differences |
| `sync-waiting` Offline, waiting to sync | `features/today/TodayPage.tsx:291, features/sync/SyncLine.tsx:29` | partial | `cmp-sync-waiting.png` | popover is narrower |
| `p-today-empty` Today · Nothing planned | `features/today/TodayPage.tsx:316` | matched | `p-today-empty-{light,dark,dim}-side.png` (+ -1440) | agrees in all three themes at both widths: heading, line, button and week list within 1px |
| `p-today-loading` Today · Loading | `features/today/TodayPage.tsx:266` | partial | `cmp-p-today-loading.png` | "New task" is disabled and dimmed (TodayPage.tsx:271), design keeps it active; skeleton rows are one full-width bar with no row dot, design uses varied widths and a dot; the 400 ms wait is built (TodayPage.tsx:66) |
| `p-today-error` Today · Error | `features/today/TodayPage.tsx:40 (TodayError, exported, never rendered)` | gated | – | frame note: shown only when the local store reports a read failure, which it does not yet; not screenshotted |
| `p-today-syncing` Today · Syncing | `features/sync/SyncLine.tsx:78-121` | matched | `p-today-syncing-{light,dark,dim}-side.png` (+ -1440) | the "Syncing" pill and dot agree in all three themes; rendered without the pretend account (the kit cannot make the account's sync hang), so the greeting has no name (excluded G3) |
| `p-today-sync-failed` Today · Couldn’t sync | `features/sync/SyncLine.tsx:90` | matched | `p-today-sync-failed-{light,dark,dim}-side.png` (+ -1440) | "Couldn’t sync" and Retry agree in all three themes; rendered without the pretend account (the kit cannot make the account's sync fail), so the greeting has no name (excluded G3) |
| `p-today-all-day` Today · All-day events | `features/today/TodayPage.tsx:87-109, :340` | partial | `p-today-all-day-{light,dark,dim}-side.png` (+ -1440) | #101 (read from its description, not re-rendered since) makes Sun 8 read "Home renovation: tiling" with a muted "· day 4 of 4" and the Today row a title with a muted "· day 3 of 4", as the frame; everything else agreed in the last render; expected to move to matched at the next render |
| `p-today-long` Today · A long day | `features/today/TodayPage.tsx:150` | partial | `p-today-long-{light,dark,dim}-side.png` (+ -1440) | the frame's counts (14 today, 4 due) are not derivable from its rows (frame data); the fixture's call and swim dots take the fixture's calendars; list, times and spacing agree |
| `p-today-goal-labels` Today · Progress goal labels | `features/today/TodayPage.tsx:29 (goalLabel), :212` | partial | – | "goal yesterday" can never show: Progress keeps only goals from today on (TodayPage.tsx:212). Today, tomorrow and weekday labels read as designed in the DOM; "goal 14 Nov" is by code only. No screenshots |
| `p-today-week-empty` Today · Empty days in the week | `features/today/TodayPage.tsx:251` | partial | `p-today-week-empty-{light,dark,dim}-side.png` (+ -1440) | layout agrees; the frame says "5 events", Today 8 and Sun 8 "Birthday candles" with only three events drawn (frame data); the fixture shows 3 events and "1 task · 1 event" on Sun 8 |
| `p-today-overnight` Today · Events across midnight | `features/today/TodayPage.tsx:87-109` | partial | `p-today-overnight-{light,dark,dim}-side.png` (+ -1440) | layout and "Until 06:00" / "Started yesterday 22:00" rows agree; the frame's Today 8 and Coming up 11 are not derivable from its rows (frame data; ours 7 and 12) |
| `p-today-overnight-long` Today · Events across several days | `features/today/TodayPage.tsx:87-109` | partial | `p-today-overnight-long-{light,dark,dim}-side.png` (+ -1440) | the all-day row reads "Conference: Lisbon · day 3 of 5" with "Work" where the frame reads "Conference: Lisbon" with "Thu 5 Nov – Mon 9 Nov"; the frame lists 4 days in "Next 7 days" and no Progress block; counts come from rows the frame does not draw |
| `p-today-no-name` Today · No name | `features/today/TodayPage.tsx:150` | matched | `p-today-no-name-{light,dark,dim}-side.png` (+ -1440) | agrees in all three themes at both widths, including "Good morning" and the "On this device" pill |

### Tasks

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `work-list` Tasks · List | `features/tasks/TasksPage.tsx:80` | partial | `work-list-{light,dark,dim}-side.png` (+ -1440) | Owner and "Anyone" are gated. #94 (read from its description, not re-rendered since) puts timed tasks before date-only ones, reads "Mon 9" and "Thu 12 15:00", counts open tasks only (Today 3 of 4 rows) and puts the quick-add line under the rows; the frame's "Blocked" mark needs the fixture's status. Re-render after the next Worker 1 PRs to move it to matched or list what is left |
| `work-board` Tasks · Board | `features/tasks/TasksPage.tsx:200-250` | partial | `work-board-{light,dark,dim}-side.png` (+ -1440) | four lanes by status agree (#83); the "Move to" link is gone (a … menu on hover and focus, as the frame); due text reads "Thu 12" as the frame; lanes are equal height and hug the tallest column as the frame (rendered ours-only in the kit as `work-board`); a card with a checklist draws its progress bar (steps done of all steps); a long title no longer wraps early (the … button overlays the corner only while it shows); rendered in light, dark and Dim: the same offsets (within 3px) in all three; "Today 12:00" is plain: amber is overdue or due within 60 minutes, confirmed by the Designer; still different: the Done lane count (frame data), the Maya name on the Blocked card is gated (sharing) |
| `new-task` New task | `features/tasks/NewTaskDialog.tsx:15` | partial | `cmp-new-task.png` | fields Title, Due, List then the rows Repeat, Reminder, Priority (#56); Due is the one combined line with typing, a live preview and the calendar popover (p-due-task); still: a Project select the frame does not show; "Add task" card width not compared |
| `task-panel` Task panel | `features/tasks/TaskPanel.tsx:26` | partial | `task-panel-{light,dark,dim}-side.png` (+ -1440) | the Status row follows Reminder as in the frame (#96); ours lists Priority before Tags (the frame: Tags, then Priority) and adds a Project row; the "Linked" block is not built; the list behind the panel keeps the filter row and columns the frame hides |
| `p-task-loading` Task panel · Loading | none found | not built | – | TaskPanel renders from the store at once; no loading state (grep: no skeleton in features/tasks) |
| `p-task-error` Task panel · Error | `features/tasks/TaskPanel.tsx:101` | not built | – | only a save error ("Couldn’t save that change."); no "can’t be opened" state with Retry |
| `p-task-subtasks` Task panel · Subtasks | `features/tasks/TaskPanel.tsx (checklist)` | partial | – | checklist steps have title and done only (types.ts:11), no date or person; not looked at |
| `p-task-attachments` Task panel · Attachments | none found | not built | – | grep for "attach" finds nothing |
| `p-task-recurring` Task panel · Repeat | `features/tasks/RepeatPicker.tsx:92` | partial | `cmp-p-task-recurring.png` | Repeat is a select of presets; design opens an inline editor (Daily / Weekly / Monthly / Yearly, weekday dots, Every N, Ends, a "Next: …" line, Never repeat / Done) |
| `p-task-reminder` Task panel · Reminder picker | `features/tasks/RowPopovers.tsx` | partial | – | the Reminder row popover (p-row-reminder) has None, At time, 5/15/30 minutes, 1 hour, 1 day and Custom…; built to v41, not re-compared by screenshot |
| `p-task-comments` Task panel · Comments and activity | none found | not built | – | grep for "comment" finds nothing |
| `p-task-assignee` Task panel · Assignee picker | none found | not built | – | Task has no assignee field (types.ts:19) |
| `p-task-date` Task panel · Date picker | `features/tasks/RowPopovers.tsx` | partial | – | the Due row popover (p-row-due): month, 24-hour time with No time, four shortcuts; the old frame draws Nov 1 on a Friday, the build follows the real calendar; built to v41, not re-compared by screenshot |
| `p-task-move` Task panel · Move to a list | `features/tasks/RowPopovers.tsx` | partial | – | the List row popover (p-row-list): searchable, colour dots, No list, New list…; built to v41, not re-compared by screenshot |
| `p-task-delete` Task panel · Deleted, with undo | `features/tasks/TaskPanel.tsx:132, components/Toast.tsx:62` | partial | `cmp-p-task-delete.png` | toast is a centred dark pill "Task deleted · Undo"; design: bottom-right card with the task name and "Kept for 30 days"; panel closes to nothing, design shows "No task selected" |
| `p-lists-no-results` Tasks · Filtered with no results | `features/tasks/TasksPage.tsx:171` | gated | `p-lists-no-results-{light,dark,dim}-side.png` | needs the Owner filter (sharing is Planned); with Priority High alone ours shows the 2 matching tasks; the frame's removable chips ("Priority: High ✕") and "Remove Owner" / "Clear filters" are not built for the filters that exist |
| `p-lists-bulk` Tasks · Bulk select | none found | not built | – | grep for "bulk" finds nothing |
| `p-board-drag` Board · Drag in progress | `features/tasks/TasksPage.tsx:235` | partial | `p-board-drag-{light,dark,dim}-side.png` (+ -1440) | the target lane outline (`app.css:827`) agrees as an outline; the frame also draws a "Drop to move to Blocked" placeholder card and the "Dragging … from In progress" note, not built; the "Move to" link under every card is gone since #100 (a … menu on hover and focus, as the frame; not re-rendered since); due text reads "Thu" where the frame reads "Thu 12" and "Today 12:00" is not amber (selectors.ts:79-85); a card with a checklist has no progress bar (the frame draws one under "Launch brief"); the lanes stretch to the bottom of the page, the frame's hug their cards |
| `p-board-from-done` Board · Moved out of Done | `features/tasks/TasksPage.tsx:235` | partial | `p-board-from-done-{light,dark,dim}-side.png` (+ -1440) | the card moves to In progress with Undo as in the frame; the footnote "Moved out of Done: the card is no longer done…" is not shown in ours; the "Move to" link under every card is gone since #100 (a … menu on hover and focus, as the frame; not re-rendered since); due text reads "Thu" where the frame reads "Thu 12" (selectors.ts:79-85); a card with a checklist has no progress bar; the lanes stretch to the bottom of the page, the frame's hug their cards |
| `task-notes` Task panel with linked notes | none found | not built | – | no link to Notes in TaskPanel |
| `task-notes-none` Notes not on this device | none found | not built | – | no link to Notes in TaskPanel |
| `p-view-options-list` Tasks · View options (list) | `features/tasks/ViewOptionsButton.tsx:54-63` | partial | `p-view-options-list-{light,dark,dim}-side.png` (+ -1440) | the popover is the frame's 280px list in the right place within 5px (#95); "Show completed tasks" is on in ours and off in the frame (`viewOptions.ts:23` still defaults it on); nothing in #94 to #103 changes it |
| `p-view-options-board` Tasks · View options (board) | `features/tasks/ViewOptionsButton.tsx:54-63` | partial | `p-view-options-board-{light,dark,dim}-side.png` | same popover differences; the board has two lanes (To do, Done) where the frame has To do, In progress, Blocked and Done (needs the status field); cards show the due day as "Thu" vs "Thu 12"; the "Show Done lane" toggle is on in both |
| `p-row-due` Task panel · Edit Due | `features/tasks/RowPopovers.tsx` | partial | `p-row-due-{light,dark,dim}-side.png` (+ -1440) | popover agrees in structure; panel and list differences as `task-panel` |
| `p-row-list` Task panel · Edit List | `features/tasks/RowPopovers.tsx` | partial | `p-row-list-{light,dark,dim}-side.png` (+ -1440) | as `p-row-due` |
| `p-row-priority` Task panel · Edit Priority | `features/tasks/RowPopovers.tsx` | partial | `p-row-priority-{light,dark,dim}-side.png` (+ -1440) | as `p-row-due`; High is Selected as in the frame |
| `p-row-repeat` Task panel · Edit Repeat | `features/tasks/RowPopovers.tsx` | partial | `p-row-repeat-{light,dark,dim}-side.png` (+ -1440) | as `p-row-due` |
| `p-row-reminder` Task panel · Edit Reminder | `features/tasks/RowPopovers.tsx` | partial | `p-row-reminder-{light,dark,dim}-side.png` (+ -1440) | as `p-row-due`; "1 hour before" Selected |
| `task-panel-status-open` Task panel · Status | `features/tasks/RowPopovers.tsx` | partial | `task-panel-status-open-{light,dark,dim}-side.png` (+ -1440) | the status menu (To do, In progress Selected, Blocked) agrees; the frame's footnote "Changing the status moves the card on the Tasks board…" is missing; panel row order and list as `task-panel` |
| `task-panel-status-set` Task panel · Status set to Blocked | `features/tasks/TaskRow.tsx:65, 109` | partial | `task-panel-status-set-{light,dark,dim}-side.png` (+ -1440) | "· Blocked" after the title in the list row agrees; panel and list differences as `task-panel` |

### Lists

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `lists` Lists | `features/lists/ListsPage.tsx:57` | partial | `lists-{light,dark,dim}-side.png` (+ -1440) | the header is now the title with its dot, "3 open", the … menu and Add a task, as the frame; list rows are 38 px apart as the frame's (`app.css` `.tr.list`); "Birthday candles" reads "Sun 8" as the frame (a Lists row names tomorrow by its day via `tomorrowByDay`; Today, Tasks, the panel and the board keep “Tomorrow”: no v60 frame shows a date for tomorrow there, lib/dates.ts); frames `lists` and `p-lists-offline` are in the kit (`lists-groceries`); the left list shows "Errands" twice and counts 0 for the others because the fixture's lists have no tasks (fixture); the open count is 3 vs 6 (frame data) |
| `p-lists-empty` Lists · Empty list | `features/lists/ListsPage.tsx:57` | partial | `p-lists-empty-{light,dark,dim}-side.png` (+ -1440) | header agrees in structure; "0 open" sits 11px left of the frame's "Nothing here"; the frame's list counts are its own data |
| `p-list-menu` Lists · List menu | `features/lists/ListsPage.tsx:60-70` | partial | `p-list-menu-{light,dark,dim}-side.png` (+ -1440) | menu items Rename, Colour, Completed and deleted, Delete list agree; the labels sit 113px left of the frame's and are 4px taller (the frame's menu is narrower) |
| `p-lists-loading` Lists · Loading | `features/lists/ListsPage.tsx:59` | not built | – | `ready` only disables "New list" (:122); no skeleton rows |
| `p-lists-error` Lists · Error | none found | not built | – | no list error state in ListsPage |
| `p-lists-offline` Lists · Offline | `features/lists/ListsPage.tsx` | partial | `p-lists-offline-{light,dark,dim}-side.png` (+ -1440) | "Not synced yet" tags and the banner above the rows (cloud-off icon, “You’re offline. Everything here is saved…”) are drawn; the closing line about sharing is not drawn on purpose: sharing is Planned in the beta |

### Completed and deleted

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `trash` Completed and deleted | `features/completed/CompletedPage.tsx:11` | partial | `cmp-trash.png` | dates read "5 Nov", design "Thu 5"; done titles are faded, design keeps full contrast |

### Projects

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `projects` Projects | `features/projects/ProjectsPage.tsx:14` | partial | `cmp-projects.png` | due reads "30 Jan 2027", design "Jan 30"; otherwise table, filters and meter match |
| `project-detail` Project | `features/projects/ProjectPage.tsx:258` | partial | `cmp-project-detail.png` | header has All projects / Edit / Mark done, design Share; sections carry reorder, rename and delete controls and an "Add a section" form; no "Shared with" panel; dates "Mon" vs "Mon 9"; due "30 Jan 2027" vs "30 Jan" |
| `project-board` Project · Board | `features/projects/ProjectPage.tsx:178-206` | partial | `project-board-{light,dark,dim}-side.png` (+ -1440) | the header has All projects, Edit and Mark done and "Due 30 Jan 2027 · 20%" where the frame has only Add task and "Due 30 Jan" (ProjectPage.tsx:272-290); Done lane counts only done tasks of the board (1, the frame 4: frame data); the Kitchen count is 2 vs 3 (the frame counts a done card); "Move to" links and due text as `work-board` |
| `project-board-no-sections` Project · Board, no sections | `features/projects/ProjectPage.tsx:178-206` | partial | `project-board-no-sections-{light,dark,dim}-side.png` (+ -1440) | one "Tasks" lane as the frame; "· Blocked" after the title agrees; header (All projects, Edit, Mark done, "Due 30 Jan 2027 · 20%" vs Add task and "Due 30 Jan", ProjectPage.tsx:272-290) and card differences as `project-board` |
| `p-project-archived` Project · Archived | `features/projects/ProjectsPage.tsx:14` | not checked yet | – |  |

### Sharing

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `share` Share a list or project | none found | not built | – | no sharing UI; grep finds no invite or permission code |
| `p-share-pending` Share · Invite pending | none found | not built | – | no sharing UI |
| `p-share-permission` Share · Change permission | none found | not built | – | no sharing UI |
| `p-share-remove` Share · Remove a person | none found | not built | – | no sharing UI |
| `p-share-advanced` Share · Link sharing off | none found | not built | – | no sharing UI |

### Calendar

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `p-cal-day-empty-phone` Calendar · Phone day view, empty day | `features/calendar/PhoneCalendar.tsx:98` | partial | `p-cal-day-empty-phone-{light,dark,dim}-side.png` (+ -1440) | the sync pill "On this device" still shows under the title (TodayPage.tsx:296, PhoneCalendar.tsx:160) where the frame has none, which pushes everything 30px down; no dot under Tue 3; the "Today" button 2px left and 4px lower |
| `calendar-week` Calendar · Week | `features/calendar/CalendarPage.tsx:47, features/calendar/TimeGrid.tsx:36` | partial | `calendar-week-{light,dark,dim}-side.png` (+ -1440) | the side column now agrees (Events 6, "Due this week" with today's tasks, "1 day late"); the grid scrolls to near now and starts at 10:00 where the frame starts at 7:00 (TimeGrid.tsx:67); the day-name band is 6px shorter and the grid starts 6px higher; the sidebar badge reads "3 due" because the week fixture lacks the frame's fourth due task |
| `calendar-day` Calendar · Day | `features/calendar/CalendarPage.tsx:47, features/calendar/TimeGrid.tsx:36` | partial | `calendar-day-{light,dark,dim}-side.png` (+ -1440) | toolbar range label "Sat 7 Nov" and the task order (12:00 first, done last) now agree; the grid starts at 10:00 where the frame starts at 7:00 (TimeGrid.tsx:67); "All day" also shows as a row in the grid (the frame only in the panel); event lines read "13:00 to 14:00" where the frame reads "13:00" for a one-hour event |
| `calendar-agenda` Calendar · Agenda | `features/calendar/AgendaView.tsx:39` | partial | `calendar-agenda-{light,dark,dim}-side.png` (+ -1440) | range label and toolbar agree after #93; #98 (read from its description, not re-rendered since) removes "Room 3 · 1h": an event row says its place, or its length, never both; rows were about 1px shorter than the frame's, 3px by the third day; to re-check after the next Worker 1 PRs |
| `calendar-month` Calendar · Month | `features/calendar/MonthView.tsx` | partial | `calendar-month-{light,dark,dim}-side.png` (+ -1440) | layout, counts, chips and colours agree in all three themes after #93; "Call with the builder" shows a 2px sliver of its calendar colour before the text where the frame shows no dot (the dot is squeezed by the long title in MonthView.tsx) |
| `event-panel` Event panel | `features/calendar/EventPanel.tsx:16` | partial | `event-panel-{light,dark,dim}-side.png` (+ -1440) | ours has People as an empty "Add by email" input and no people list, no "Maya Chen · Going" or "alex@example.com · No reply" rows (sharing is Planned); the panel rows When, Calendar, Where, Repeat, Reminder agree in copy, the panel title is an input in ours (EventPanel.tsx); the Agenda behind it differs in row spacing |
| `new-event` New event | `features/calendar/NewEventDialog.tsx:13` | partial | `new-event-{light,dark,dim}-side.png` (+ -1440) | the dialog opens over the week calendar, the frame draws it alone with the title, When, Calendar, Repeat, Reminder and Invite people; ours says "3 due" where the frame says 4 due (fixture); not compared further |
| `calendar-manage` Calendars | `features/calendar/CalendarsDialog.tsx:9, features/calendar/CalendarList.tsx:86` | partial | `cmp-calendar-manage.png` | rows carry four colour swatches, Rename and a Shown toggle; design rows are name and "Shown" text; "Family · shared" needs sharing (not built); a failed subscription row exists (CalendarList.tsx:72) |
| `p-event-invitees` Event panel · Invitees and replies | `features/calendar/EventPanel.tsx:16` | gated | `p-event-invitees-{light,dark,dim}-side.png` (+ -1440) | invitee replies are Planned (sharing); the rest of the panel as `event-panel` |
| `p-event-recurring` Event panel · Edit a repeating event | `features/calendar/EventScopeDialog.tsx` | built to v61 | – | "Change a repeating event" with three radio rows (Only this event, This and following events, All events in the series with its repeat and start), Cancel and Save, no guest line; not compared pixel by pixel (the kit frame does not open the dialog: its Book club does not repeat) |
| `p-event-conflict` Event panel · Conflict | none found | gated | `p-event-conflict-{light,dark,dim}-side.png` (+ -1440) | the overlap warning, "Maya is going to both" and the Move to 14:30 action are Planned |
| `p-event-video` Event panel · Video link | none found | gated | `p-event-video-{light,dark,dim}-side.png` (+ -1440) | the video link is Planned (not built) |
| `p-event-delete` Event panel · Delete | `features/calendar/EventScopeDialog.tsx` | built to v61 | – | "Delete “Book club”?" with three radio rows, the "kept for 30 days" note, Cancel and a red "Delete event"; no guest line; not compared pixel by pixel as above |
| `p-cal-loading` Calendar · Loading | none found | not built | – | CalendarPage never reads `ready`; no loading state |
| `p-cal-sync-error` Calendar · Sync error, outside calendar | `features/calendar/CalendarList.tsx:72` | not checked yet | – | a subscription refresh error shows in the Calendars dialog only |
| `p-cal-all-day` Calendar · All-day and multi-day | `features/calendar/TimeGrid.tsx` | partial | `p-cal-all-day-{light,dark,dim}-side.png` (+ -1440) | the "All day" row and the spanning bar agree in structure; the frame has its explanatory line under the title (not built) and a wider Sat column, so "Maya’s birthday" is cut off in ours; the grid scrolls to 10:00 where the frame shows 7:00; the panel says "No tasks due." where the frame lists none |
| `p-cal-time-zone` Calendar · Time zones | `store/occurrences.ts:52` | not checked yet | – |  |
| `p-cal-busy-only` Calendar · Busy-only shared calendar | none found | not built | – | needs shared calendars (not built) |
| `p-cal-week-weekdays` Calendar · Week, weekdays only | `features/calendar/TimeGrid.tsx:36` | partial | `p-cal-week-weekdays-{light,dark,dim}-side.png` (+ -1440) | five columns, Events 5 and the grid from 7:00 agree; "Due this week" lists only the overdue task, the frame also lists the two tasks due today (Send the launch brief, Fix the sign-up email bug); the day-name band is 6px shorter |
| `p-cal-week-nav` Calendar · Another week | `features/calendar/CalendarPage.tsx:104-125` | partial | `p-cal-week-nav-{light,dark,dim}-side.png` (+ -1440) | toolbar with Today fits on one row (#92); the frame's grid shows this week's events copied into week 46 (frame data), ours is the empty week; the side column's "Events 6" and its due list are the frame's own data |
| `p-cal-calendars-popover` Calendar · Calendars popover | `features/calendar/CalendarPage.tsx:120` | partial | `p-cal-calendars-popover-{light,dark,dim}-side.png` (+ -1440) | popover and footer agree in structure and size; the names, colours and the Subscribed tag are the frame's own data (Birthdays, Holidays, Library events), not in the fixture; rows are 0.5px further apart |
| `p-row-event-when` Event panel · Edit When | `features/calendar/EventPanel.tsx:120` | partial | `p-row-event-when-{light,dark,dim}-side.png` | the popover agrees in structure; the Agenda behind it differs as in `calendar-agenda` (row pitch, right-hand text) |
| `p-row-calendar` Event panel · Edit Calendar | `features/calendar/EventPanel.tsx` | partial | `p-row-calendar-{light,dark,dim}-side.png` | as `p-row-event-when`; the calendar list is the fixture's calendars |
| `p-when-event` New event · When, open | `features/calendar/NewEventDialog.tsx:58` | partial | `p-when-event-{light,dark,dim}-side.png` | the dialog opens over the calendar, the frame draws it alone; the month popover has boxed chevrons where the frame's are plain, and ours selects today (7) where the frame has 12 |
| `p-when-event-typing` New event · When, typing | `components/WhenField.tsx:120` | partial | `p-when-event-typing-{light,dark,dim}-side.png` | the read-back line has no calendar icon in ours; the Calendar field is a select, the frame draws a coloured dot before "Personal"; Reminder reads "None", the frame "1 hour before" (fixture default) |
| `p-when-unreadable` New event · When, not understood | `components/WhenField.tsx:120` | partial | `p-when-unreadable-{light,dark,dim}-side.png` | as `p-when-event-typing`; the message "Couldn’t read that" and its hint agree in copy |

### Booking

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `booking` Booking pages | none found | not built | – | no booking code; grep for "booking" finds nothing |
| `booking-new` New booking page | none found | not built | – | no booking code; grep for "booking" finds nothing |
| `booking-public` Public booking page | none found | not built | – | no booking code; grep for "booking" finds nothing |
| `booking-form` Request a time | none found | not built | – | no booking code; grep for "booking" finds nothing |
| `booking-sent` Request sent | none found | not built | – | no booking code; grep for "booking" finds nothing |
| `booking-none` No times and a taken slot | none found | not built | – | no booking code; grep for "booking" finds nothing |
| `booking-accepted` Accepted into the calendar | none found | not built | – | no booking code; grep for "booking" finds nothing |
| `booking-phone` Booking on a phone | none found | not built | – | no booking code; grep for "booking" finds nothing |

### Notifications

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `notifications` Notifications | `features/notifications/NotificationsPage.tsx:14` | partial | `notifications-{light,dark,dim}-side.png` (+ -1440) | ours shows the empty state: the fixture has no fired reminder, and the frame's rows (shared-list changes, "Orbyn Engineering added…", "Jordan accepted…") are Planned; the header "4 unread" and "Mark all as read" and the reminder rows with "Open task" could not be compared (NotificationsPage.tsx) |
| `p-notif-empty` Notifications · Empty | `features/notifications/NotificationsPage.tsx:14` | partial | `p-notif-empty-{light,dark,dim}-side.png` (+ -1440) | copy agrees; the frame centres the empty state horizontally and near the top (heading 150px from the top), ours left-aligns it 295px down (NotificationsPage.tsx:23, the shared `.empty`) |
| `p-notif-grouped` Notifications · Grouped | none found | gated | `p-notif-grouped-{light,dark,dim}-side.png` (+ -1440) | grouped changes by Maya, Orbyn Engineering and Priya are Planned (sharing); the frame's "4 unread" header and Mark all as read are not compared (fixture has no reminders) |
| `p-notif-snooze` Notifications · Snooze a reminder | none found | gated | `p-notif-snooze-{light,dark,dim}-side.png` (+ -1440) | snoozing needs the reminder rows and the shared-list changes, which are Planned; not compared |

### Search

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `search` Search or add | `features/search/SearchDialog.tsx:26` | partial | `search-{light,dark,dim}-side.png` (+ -1440) | the dialog's width, input and "Enter to add" agree; the frame searches the words left after the date ("Dentist") and lists Tasks, Calendar and Lists matches, ours searches the whole text ("dentist friday 3pm") and finds nothing (SearchDialog.tsx:49-60, :193); the add rows show the typed lower-case title ("dentist") where the frame writes "Dentist"; the frame draws the dialog on a blank page, ours over the dimmed planner; ours adds a "Keep as typed" checkbox the frame lacks (SearchDialog.tsx:200) |
| `p-search-none` Search · No results | `features/search/SearchDialog.tsx:26` | partial | `p-search-none-{light,dark,dim}-side.png` (+ -1440) | as `search`: the "No results" copy and the two add rows agree; background and the extra checkbox differ |

### Empty, loading and error states

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `empty-error` Empty, loading and error states | `components/EmptyState.tsx:4` | not checked yet | – |  |

### Settings

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `settings-account` Settings · Account and devices | `features/settings/SettingsPage.tsx:18, features/auth/AccountSettings.tsx:317` | partial | `settings-account-{light,dark,dim}-side.png` (+ -1440) | ours has a "Data protection · Standard · Change" row as the frame (Change opens Privacy); no Password row (change password is after the beta); ours keeps a "Two-factor Off · Turn on…" row (built), a Sync card with "Sync now" and Sign out, Refresh and Add a device buttons; the frame has rows Password (Change) and Data protection (Standard · Change) and only "Add a device"; device rows read "A · this device / Added 7 Nov, 10:00" with a boxed Remove where the frame reads "MacBook Air · this device / Synced now" and a red inline "· Remove" (AccountSettings.tsx:250-290); the name is the kit's (Sam Arden vs Sam Rivera, fixture); a "Tags" category in the settings list that the frame does not have (SettingsPage.tsx:16) |
| `add-device` Approve a new sign-in | `features/auth/PendingScreen.tsx:11` | not checked yet | – | the frame was not part of #46 and has not been compared |
| `settings` Settings · Planning | `features/settings/SettingsPage.tsx:18` | partial | `settings-{light,dark,dim}-side.png` (+ -1440) | v62: the beta Planning has Week starts on, Days in the week view (5 or 7), Theme (System, Light, Dark) and Dark theme (Dark, Dim), as segmented controls in the frame's rows; Working days, Day starts and the Defaults group are Planned in the frame and left out of the app on purpose; the Tags category stays (p-set-tags) |
| `settings-notifications` Settings · Notifications | `features/settings/NotificationsSettings.tsx:21` | partial | `settings-notifications-{light,dark,dim}-side.png` (+ -1440) | copy, the "Allowed in this browser" pill, the Planned rows and the toggles agree; the quiet-hours times are plain 64 × 28 px boxes with no picker icon, as the frame; a "Tags" category in the settings list that the frame does not have (SettingsPage.tsx:16) |
| `p-set-notif-reminders-off` Settings · Notifications · Reminders off | `features/settings/NotificationsSettings.tsx:21` | partial | `p-set-notif-reminders-off-{light,dark,dim}-side.png` (+ -1440) | agrees (quiet-hours fields now plain boxes) apart from a "Tags" category in the settings list that the frame does not have (SettingsPage.tsx:16) |
| `p-set-notif-reminders-asking` Settings · Notifications · Asking for permission | `features/settings/NotificationsSettings.tsx:21` | partial | `p-set-notif-reminders-asking-{light,dark,dim}-side.png` (+ -1440) | "Allow notifications when your browser asks." and "Waiting for your browser" show while the browser asks (the kit frame now clicks the switch); a "Tags" category in the settings list that the frame does not have (SettingsPage.tsx:16) |
| `p-set-notif-reminders-blocked` Settings · Notifications · Blocked in the browser | `features/settings/NotificationsSettings.tsx:21` | partial | `p-set-notif-reminders-blocked-{light,dark,dim}-side.png` (+ -1440) | agrees (quiet-hours fields now plain boxes) apart from a "Tags" category in the settings list that the frame does not have (SettingsPage.tsx:16) |
| `p-set-notif-unsupported` Settings · Notifications · No notification support | `features/settings/NotificationsSettings.tsx:21` | partial | `p-set-notif-unsupported-{light,dark,dim}-side.png` (+ -1440) | agrees (quiet-hours fields now plain boxes) apart from a "Tags" category in the settings list that the frame does not have (SettingsPage.tsx:16) |
| `connected-apps` Settings · Connected apps | none found | not built | `connected-apps-{light,dark,dim}-side.png` (+ -1440) | ours reads "Nothing to set here yet." (SettingsPage.tsx:124); the frame lists Orbyn Engineering's grants (lists it can use, busy times, threads, change and delete tasks) with See activity and Disconnect, and an "Other apps" note; a "Tags" category in the settings list that the frame does not have (SettingsPage.tsx:16) |
| `settings-calendars` Settings · Calendars | `features/calendar/CalendarList.tsx:86` | partial | `settings-calendars-{light,dark,dim}-side.png` (+ -1440) | ours lists the planner's calendars with colour pickers, Rename and Shown, and Subscribe and New calendar buttons; the frame lists Subscribed calendars with a refresh state ("Couldn’t refresh · Retry", "Refreshed 1h ago"), a "Use in other calendar apps" card (CalDAV address, App password: Planned) and the Standard protection note (CalendarList.tsx, SettingsPage.tsx); a "Tags" category in the settings list that the frame does not have (SettingsPage.tsx:16) |
| `settings-privacy` Settings · Data protection | `features/auth/ProtectionSettings.tsx:164` | partial | `settings-privacy-{light,dark,dim}-side.png` (+ -1440) | the kit's account has no protection level, so ours shows "Choose your protection level · Not set" where the frame shows "Standard protection · Verified" with a radio card; the Advanced card and "Your data" rows agree in copy; rows are boxed differently (the frame uses radio cards, ours a bordered row); a "Tags" category in the settings list that the frame does not have (SettingsPage.tsx:16) |
| `advanced-on` Turn on Advanced protection | `features/auth/ProtectionSettings.tsx:164` | gated | – | frame note: Advanced is Planned |
| `web-approve` Approve the web for an hour | none found | not checked yet | – | the frame was not part of #46 and has not been compared |
| `p-set-account-loading` Settings · Account · Loading | `features/settings/SettingsPage.tsx:18` | not checked yet | – | the frame was not part of #46 and has not been compared |
| `p-set-account-error` Settings · Account · Save error | `features/settings/SettingsPage.tsx:18` | not checked yet | – | the frame was not part of #46 and has not been compared |
| `p-set-planning-loading` Settings · Planning · Loading | `features/settings/SettingsPage.tsx:18` | not checked yet | – | the frame was not part of #46 and has not been compared |
| `p-set-planning-error` Settings · Planning · Save error | `features/settings/SettingsPage.tsx:18` | not checked yet | – | the frame was not part of #46 and has not been compared |
| `p-set-notifications-loading` Settings · Notifications · Loading | `features/settings/NotificationsSettings.tsx:21` | gated | – | frame note: not shown today (preferences are local); settings-copy also touches this file |
| `p-set-notifications-error` Settings · Notifications · Save error | `features/settings/NotificationsSettings.tsx:21` | gated | – | frame note: not shown today (preferences are local); settings-copy also touches this file |
| `p-set-connected-apps-loading` Settings · Connected apps · Loading | none found | not checked yet | – | the frame was not part of #46 and has not been compared |
| `p-set-connected-apps-error` Settings · Connected apps · Save error | none found | not checked yet | – | the frame was not part of #46 and has not been compared |
| `p-set-calendars-loading` Settings · Calendars · Loading | `features/calendar/CalendarList.tsx:86` | not checked yet | – | the frame was not part of #46 and has not been compared |
| `p-set-calendars-error` Settings · Calendars · Save error | `features/calendar/CalendarList.tsx:86` | not checked yet | – | the frame was not part of #46 and has not been compared |
| `p-set-privacy-loading` Settings · Privacy · Loading | `features/auth/ProtectionSettings.tsx:164` | gated | – | frame note: not shown today (preferences are local); settings-copy also touches this file |
| `p-set-privacy-error` Settings · Privacy · Save error | `features/auth/ProtectionSettings.tsx:164` | gated | – | frame note: not shown today (preferences are local); settings-copy also touches this file |
| `p-export-dialog` Settings · Privacy · Export your data | `features/export/ExportSettings.tsx:15` | partial | `p-export-dialog-{light,dark,dim}-side.png` (+ -1440) | the dialog opens; compared by text only: the Export dialog's fields and buttons are in both; layout over the Privacy page not looked at closely |
| `p-export-busy` Settings · Privacy · Exporting | `features/export/ExportSettings.tsx:15` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |
| `p-export-done` Settings · Privacy · Exported | `features/export/ExportSettings.tsx:15` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |
| `p-export-failed` Settings · Privacy · Export failed | `features/export/ExportSettings.tsx:15` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |
| `p-set-privacy-verified-removed` Settings · Privacy · Verified, other device | `features/auth/ProtectionSettings.tsx:164` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |
| `p-set-privacy-verified-this-device` Settings · Privacy · Verified, signed on this device | `features/auth/ProtectionSettings.tsx:164` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |

### Account and auth

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `landing` Landing | `features/auth/AuthScreens.tsx:24-38` | partial | `landing-{light,dark,dim}-side.png` (+ -1440) | copy differs: the frame has “See how it works” and “Get started”; ours has “Get started”, “Sign in”, “Use without an account” and the line “Everything then stays on this device. You can sign in later.” (AuthScreens.tsx:32-38); the cropped frame now shows the same card position in all three themes |
| `sign-up` Sign up | `features/auth/AuthScreens.tsx:265` | partial | `sign-up-{light,dark,dim}-side.png` (+ -1440) | step 2 (Invite accepted chip, Name, Email, Password, note, passkey, Continue) agrees in copy and order; ours adds “Already have an account? Sign in” and “Use without an account” under the button (AuthScreens.tsx:290-295), the frame ends at the button; the passkey row wraps “Not available yet.” onto a second line under the button text (`Planned.tsx:19`, `app.css:623` flex-wrap) where the frame keeps one line |
| `p-signup-invite-default` Sign up · Invite code (step 1 of 4) | `features/auth/InviteStep.tsx:69` | partial | `p-signup-invite-default-{light,dark,dim}-side.png` (+ -1440) | copy and card structure agree (Step 1 of 4, invite-only, XXXX-XXXX-XXXX-XXXX); the focus ring is kit state |
| `p-signup-invite-filled` Sign up · Invite code, filled | `features/auth/InviteStep.tsx:69` | partial | `p-signup-invite-filled-{light,dark,dim}-side.png` (+ -1440) | as `p-signup-invite-default`; the frame’s code is a sample, ours is fixture data |
| `p-signup-invite-checking` Sign up · Invite code, checking | `features/auth/InviteStep.tsx:60` | partial | `p-signup-invite-checking-{light,dark,dim}-side.png` (+ -1440) | as `p-signup-invite-default`; “Checking…” agrees |
| `p-signup-invite-error` Sign up · Invite code, refused | `features/auth/InviteStep.tsx:84` | partial | `p-signup-invite-error-{light,dark,dim}-side.png` (+ -1440) | copy agrees; the refused field’s border colour differs from the frame’s (InviteStep.tsx:69, `app.css:925`) |
| `p-signup-invite-limited` Sign up · Invite code, too many tries | `features/auth/InviteStep.tsx:63` | partial | `p-signup-invite-limited-{light,dark,dim}-side.png` (+ -1440) | copy agrees; the banner is grey with no icon (InviteStep.tsx:63) where the frame draws amber with the alert icon (`app.css:510-511`) |
| `p-signup-invite-network` Sign up · Invite code, network error | `features/auth/InviteStep.tsx:64` | partial | `p-signup-invite-network-{light,dark,dim}-side.png` (+ -1440) | as `p-signup-invite-limited` (InviteStep.tsx:64) |
| `p-signup-invite-email` Sign up · Email and password (invite accepted) | `features/auth/AuthScreens.tsx:265` | partial | `p-signup-invite-email-{light,dark,dim}-side.png` (+ -1440) | as `sign-up` |
| `p-signup-invite-phone` Sign up · Invite code on a phone | `features/auth/InviteStep.tsx` | not checked yet | – | no phone frame in the kit yet |
| `p-signup-invite-rejected-later` Sign up · Invite refused at the email step | `features/auth/AuthScreens.tsx:139` | partial | `p-signup-invite-rejected-later-{light,dark,dim}-side.png` (+ -1440) | the banner is grey with no icon (`AuthScreens.tsx:139`, class `banner` without `warn`) where the frame draws it amber with the alert icon (`app.css:510-511`); the code text is left-aligned (`app.css:926` has no text-align) where the frame centres it; the code in ours is fixture data and Verify is enabled with it |
| `p-signup-check-start` Sign up · Check your email, start | `features/auth/AuthScreens.tsx:135` | not checked yet | – | no kit frame yet; same screen as `verify` |
| `p-signup-check-resend` Sign up · Check your email, resend | `features/auth/AuthScreens.tsx:175` | not checked yet | – | no kit frame yet |
| `p-signup-check-failed` Sign up · Check your email, failed | `features/auth/AuthScreens.tsx:346` | not checked yet | – | no kit frame yet |
| `p-signup-check-too-many` Sign up · Check your email, too many | `features/auth/AuthScreens.tsx:169` | not checked yet | – | no kit frame yet; `p-verify-throttled` is the same state |
| `verify` Verify your email | `features/auth/AuthScreens.tsx:135` | partial | `verify-{light,dark,dim}-side.png` (+ -1440) | copy, step bar, “Send a new code in 1:00” and “Wrong address? Change email” agree; the code text is left-aligned (`app.css:926` has no text-align) where the frame centres it; the empty, typing, wrong and resend states are not separate frames (only `verify`, `p-verify-ready` and `p-verify-throttled` exist), typing and wrong are not rendered |
| `p-verify-ready` Verify your email · Send a new code | `features/auth/AuthScreens.tsx:175` | partial | `p-verify-ready-{light,dark,dim}-side.png` (+ -1440) | “Send a new code” link agrees; the code text is left-aligned (`app.css:926` has no text-align) where the frame centres it |
| `p-verify-throttled` Verify your email · Too many codes | `features/auth/AuthScreens.tsx:169` | partial | `p-verify-throttled-{light,dark,dim}-side.png` (+ -1440) | amber banner, copy and muted resend line agree; the code text is left-aligned (`app.css:926` has no text-align) where the frame centres it |
| `sign-in` Sign in | `features/auth/AuthScreens.tsx:420` | partial | `sign-in-{light,dark,dim}-side.png` (+ -1440) | copy and order agree (Email, Password, Sign in, passkey, links, Use without an account); the passkey row wraps “Not available yet.” onto a second line under the button text (`Planned.tsx:19`, `app.css:623` flex-wrap) where the frame keeps one line; the password field has the focus ring (the kit focuses it) |
| `p-sign-in-local` Sign in · from inside the planner | `features/auth/AuthScreens.tsx:420` | partial | `p-sign-in-local-{light,dark,dim}-side.png` (+ -1440) | as `sign-in` with “Back to the planner” in place of “Use without an account” (agrees); the passkey row wraps “Not available yet.” onto a second line under the button text (`Planned.tsx:19`, `app.css:623` flex-wrap) where the frame keeps one line |
| `recovery` Recover your account | `features/auth/AuthScreens.tsx:453` | partial | `recovery-{light,dark,dim}-side.png` (+ -1440) | copy and the four options agree; intentional difference pending the Designer: at 420 px the label, pill and “Not available yet.” do not fit one line, so ours drops the whole note under the label, while the frame squeezes it into a narrow right column (looks accidental; recovery is Planned in the beta) (AuthScreens.tsx:458-471, `app.css:626`) |

### Phone

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `phone` Today, a list and offline on a phone | `features/today/TodayPage.tsx:296` | partial | `phone-{light,dark,dim}-side.png` (+ -1440) | the sync pill "On this device" still shows under the title (TodayPage.tsx:296, PhoneCalendar.tsx:160) where the frame has none, which pushes everything 30px down; with it the rows are 46px lower than the frame's; the round SA button, tab bar and rows agree in structure (#85) |
| `p-phone-task` Phone · Task as a sheet | `features/tasks/TaskPanel.tsx:26` | not checked yet | – |  |
| `p-phone-week` Phone · Calendar week | `features/calendar/PhoneCalendar.tsx:98` | partial | `p-phone-week-{light,dark,dim}-side.png` (+ -1440) | the sync pill "On this device" still shows under the title (TodayPage.tsx:296, PhoneCalendar.tsx:160) where the frame has none, which pushes everything 30px down; the strip has no dots under days with events, the frame marks Fri and Mon (PhoneCalendar.tsx:164); "3 events · 1 task" vs "2 tasks" (the frame lists one task) |
| `p-phone-empty` Phone · Empty states | `features/today/TodayPage.tsx:316` | not checked yet | – |  |
| `p-phone-offline` Phone · Offline | `features/sync/SyncLine.tsx:29, features/calendar/PhoneCalendar.tsx` | partial | `p-phone-offline-{light,dark,dim}-side.png` (+ -1440) | the frame has the banner "Offline · 2 changes waiting to sync", the title "Calendar", no strip and "Last synced 09:38"; ours shows the month title, the strip and an "Offline" pill (offsets 12px and more down the page) |
| `p-phone-menu` Phone · Menu | `features/today/TodayPage.tsx` | partial | `p-phone-menu-{light,dark,dim}-side.png` (+ -1440) | the sync pill "On this device" still shows under the title (TodayPage.tsx:296, PhoneCalendar.tsx:160) where the frame has none, which pushes everything 30px down; the sheet has Notifications, Projects and Settings, the frame also Booking, the Notifications count and the profile row "Sam Arden · Synced" (needs an account) |
| `p-phone-day-nav` Phone · Day navigation | `features/calendar/PhoneCalendar.tsx:149-164` | partial | `p-phone-day-nav-{light,dark,dim}-side.png` (+ -1440) | the sync pill "On this device" still shows under the title (TodayPage.tsx:296, PhoneCalendar.tsx:160) where the frame has none, which pushes everything 30px down; no dot under Tue 3 (a day with events); the "Today" button sits 2px left and 4px lower than the frame's |
| `p-phone-month-picker` Phone · Month picker | `features/calendar/PhoneCalendar.tsx:63-85` | partial | `p-phone-month-picker-{light,dark,dim}-side.png` (+ -1440) | the sheet starts higher than the frame's, the month title is bold and smaller, the chevrons are boxed, Today and Done sit 4px lower; the sync pill "On this device" still shows under the title (TodayPage.tsx:296, PhoneCalendar.tsx:160) where the frame has none, which pushes everything 30px down behind it |

## Account Designs (v60)

### Account site

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `overview` Overview | not in this repo (the account site) | gated | – | frame note: Planned, data-gated |
| `devices` Devices | not in this repo (the account site) | not checked yet | – | other repo |
| `remove-device` Remove a device | not in this repo (the account site) | gated | – | frame note: Planned, data-gated |
| `approve-sign-in` Approve a new sign-in | not in this repo (the account site) | not checked yet | – | other repo |
| `protection` Data protection | not in this repo (the account site) | not checked yet | – | other repo |
| `advanced-flow` Turn on Advanced protection | not in this repo (the account site) | gated | – | frame note: Planned, data-gated |
| `recovery` Recovery | not in this repo (the account site) | gated | – | frame note: Planned, data-gated |
| `recover` Recover with a key | not in this repo (the account site) | gated | – | frame note: Planned, data-gated |
| `connected` Connected apps and grants | not in this repo (the account site) | not checked yet | – | other repo |
| `grant` A grant in detail | not in this repo (the account site) | not checked yet | – | other repo |
| `billing` Plan and billing | not in this repo (the account site) | not checked yet | – | other repo |
| `payment-failed` Payment failed | not in this repo (the account site) | not checked yet | – | other repo |
| `family` Family | not in this repo (the account site) | not checked yet | – | other repo |
| `account-states` Empty, loading and offline | not in this repo (the account site) | not checked yet | – | other repo |

### Delete account

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `del-entry` Delete account in Settings | `features/auth/DeleteAccount.tsx:227, features/auth/AccountSettings.tsx:317` | not checked yet | – |  |
| `del-entry-planner` Delete account in Planner settings | `features/auth/DeleteAccount.tsx:227, features/auth/AccountSettings.tsx:317` | not checked yet | – |  |
| `del-dialog` Confirm deletion | `features/auth/DeleteAccount.tsx:41` | not checked yet | – |  |
| `del-dialog-ready` Confirm deletion, code entered | `features/auth/DeleteAccount.tsx:41` | not checked yet | – |  |
| `del-dialog-recovery` Confirm with a recovery code | `features/auth/DeleteAccount.tsx:41` | not checked yet | – |  |
| `del-dialog-stale` Sign-in too old | `features/auth/DeleteAccount.tsx:41` | not checked yet | – |  |
| `del-dialog-untrusted` Not a trusted device | `features/auth/DeleteAccount.tsx:41` | not checked yet | – |  |
| `del-scheduled` Deletion scheduled | `features/auth/DeletionBanner.tsx:78` | not checked yet | – |  |
| `del-banner` Banner during the 7 days | `features/auth/DeletionBanner.tsx:78` | not checked yet | – |  |
| `del-banner-tomorrow` Banner the day before | `features/auth/DeletionBanner.tsx:78` | not checked yet | – |  |
| `del-banner-today` Banner on the last day | `features/auth/DeletionBanner.tsx:78` | not checked yet | – |  |
| `del-row-grace` Settings during the 7 days | `features/auth/DeleteAccount.tsx:227, features/auth/AccountSettings.tsx:317` | not checked yet | – |  |
| `del-frozen` Paused actions: protection | `features/auth/ProtectionSettings.tsx:164` | not checked yet | – |  |
| `del-frozen-devices` Paused actions: devices | `features/auth/DeleteAccount.tsx:227, features/auth/AccountSettings.tsx:317` | not checked yet | – |  |
| `del-cancelled` Deletion cancelled in the app | `features/auth/DeletionBanner.tsx:78` | not checked yet | – |  |
| `del-mail` Cancel from the email link | `features/auth/CancelDeletionPage.tsx:50` | not checked yet | – |  |
| `del-choose` The account was deleted: export or remove (Mac app) | desktop app (desktop/), not web/src | not checked yet | – |  |
| `del-exported` After exporting (Mac app) | desktop app (desktop/), not web/src | not checked yet | – |  |
| `del-dialog-wrong` Wrong two-factor code | `features/auth/DeleteAccount.tsx:41` | not checked yet | – |  |
| `del-dialog-recovery-wrong` Wrong recovery code | `features/auth/DeleteAccount.tsx:41` | not checked yet | – |  |
| `del-dialog-busy` Deleting… | `features/auth/DeleteAccount.tsx:41` | not checked yet | – |  |
| `del-dialog-check-failed` Couldn’t check two-factor | `features/auth/DeleteAccount.tsx:41` | not checked yet | – |  |
| `del-cancel-busy` Cancelling… (banner and settings row) | `features/auth/DeleteAccount.tsx:227, features/auth/AccountSettings.tsx:317` | not checked yet | – |  |
| `del-cancel-error` Couldn’t cancel deletion (banner and settings row) | `features/auth/DeleteAccount.tsx:227, features/auth/AccountSettings.tsx:317` | not checked yet | – |  |
| `del-removing` Removing this device’s copy (Mac app, after Remove it now) | desktop app (desktop/), not web/src | not checked yet | – |  |
| `del-final` Opening an app after deletion (Mac app) | desktop app (desktop/), not web/src | not checked yet | – |  |
| `del-choose-web` The account was deleted: export or remove (web) | `features/auth/DeletedAccount.tsx:41` | not checked yet | – |  |
| `del-exported-web` After exporting (web) | `features/auth/DeletedAccount.tsx:41` | not checked yet | – |  |
| `del-export-failed` Export failed (web) | `features/auth/DeletedAccount.tsx:41` | not checked yet | – |  |
| `del-remove-failed` Remove failed (web) | `features/auth/DeletedAccount.tsx:41` | not checked yet | – |  |
| `del-exporting-web` Exporting… (web) | `features/auth/DeletedAccount.tsx:41` | not checked yet | – |  |
| `del-removing-busy-web` Removing… on the button (web) | `features/auth/DeletedAccount.tsx:41` | not checked yet | – |  |
| `del-exporting` Exporting… (Mac app) | desktop app (desktop/), not web/src | not checked yet | – |  |
| `del-removing-busy` Removing… on the button (Mac app) | desktop app (desktop/), not web/src | not checked yet | – |  |
| `del-checking-web` Checking your account… (web) | `features/auth/DeletedAccount.tsx:41` | not checked yet | – |  |
| `del-removing-web` Removing this browser’s copy (web) | `features/auth/DeletedAccount.tsx:41` | not checked yet | – |  |
| `del-final-web` Opening the web app after deletion | `features/auth/DeletedAccount.tsx:41` | not checked yet | – |  |
| `del-final-nothing` Nothing to remove (web) | `features/auth/DeletedAccount.tsx:41` | not checked yet | – |  |
| `del-removal-phone` The deleted-account flow on a phone | `features/auth/DeletedAccount.tsx:41` | not checked yet | – |  |
| `del-phone` Delete account on a phone | `features/auth/DeleteAccount.tsx:41` | not checked yet | – |  |

### Protection

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `pv-standard-planned` Standard protection, Planned (today) | `features/auth/ProtectionSettings.tsx:164` | partial | – | Account Designs v53 copy and states built in #46; not re-compared by screenshot |
| `pv-standard-offer` Turn on Standard protection? (After slice 8; not built) | none found | gated | – | title says "After slice 8; not built" |
| `pv-standard-offer-planner` Standard offer in Planner Settings (After slice 8; not built) | none found | gated | – | title says "After slice 8; not built" |
| `pv-standard-offer-untrusted` Standard offer on a device that isn’t trusted (After slice 8; not built) | none found | gated | – | title says "After slice 8; not built" |
| `pv-standard-offer-busy` Turning on Standard… (After slice 8; not built) | none found | gated | – | title says "After slice 8; not built" |
| `pv-standard-offer-done` Standard protection is on (After slice 8; not built) | none found | gated | – | title says "After slice 8; not built" |
| `pv-standard-offer-failed` Couldn’t turn on Standard (After slice 8; not built) | none found | gated | – | title says "After slice 8; not built" |
| `pv-advanced-confirm` Turn on Advanced protection? Switching from Standard | none found | gated | – | frame note: Advanced and recovery are Planned |
| `pv-advanced-confirm-new` Turn on Advanced protection? Account never had a server copy | none found | gated | – | frame note: Advanced and recovery are Planned |
| `pv-card` Protection card, every state | `features/auth/ProtectionSettings.tsx:164` | partial | – | Account Designs v53 copy and states built in #46; not re-compared by screenshot |
| `pv-card-loading` Protection card, checking | `features/auth/ProtectionSettings.tsx:71, :124, :164` | partial | – | Account Designs v53 copy and states built in #46; not re-compared by screenshot |
| `pv-card-error` Protection card, couldn’t check | `features/auth/ProtectionSettings.tsx:71, :124, :164` | partial | – | Account Designs v53 copy and states built in #46; not re-compared by screenshot |
| `pv-verified` Protection, verified | `features/auth/ProtectionSettings.tsx:164` | partial | – | Account Designs v53 copy and states built in #46; not re-compared by screenshot |
| `pv-rollback` Protection, can’t confirm | `features/auth/ProtectionSettings.tsx:71, :124, :164` | partial | – | Account Designs v53 copy and states built in #46; not re-compared by screenshot |
| `pv-details` Protection details | `features/auth/ProtectionSettings.tsx:71, :124, :164` | partial | – | Account Designs v53 copy and states built in #46; not re-compared by screenshot |
| `pv-details-unlisted` Protection details: signer not listed | `features/auth/ProtectionSettings.tsx:71, :124, :164` | partial | – | Account Designs v53 copy and states built in #46; not re-compared by screenshot |
| `pv-notif-row` Protection change in an app’s notifications | `features/notifications/NotificationsPage.tsx:14` | not checked yet | – |  |
| `pv-confirm` Confirm your protection level | `features/auth/ProtectionSettings.tsx:71, :124, :164` | partial | – | Account Designs v53 copy and states built in #46; not re-compared by screenshot |
| `pv-confirm-unset` Confirm: no level set yet | `features/auth/ProtectionSettings.tsx:71, :124, :164` | partial | – | Account Designs v53 copy and states built in #46; not re-compared by screenshot |
| `pv-confirm-failed` Confirm couldn’t finish | `features/auth/ProtectionSettings.tsx:71, :124, :164` | partial | – | Account Designs v53 copy and states built in #46; not re-compared by screenshot |
| `pv-busy` Busy buttons | `features/auth/ProtectionSettings.tsx:71, :124, :164` | partial | – | Account Designs v53 copy and states built in #46; not re-compared by screenshot |
| `pv-confirm-conflict` Changed on another device first | `features/auth/ProtectionSettings.tsx:71, :124, :164` | partial | – | Account Designs v53 copy and states built in #46; not re-compared by screenshot |
| `pv-notice` Protection was changed on another device | `features/auth/ProtectionSettings.tsx:71, :124, :164` | partial | – | Account Designs v53 copy and states built in #46; not re-compared by screenshot |
| `pv-phone` Protection and sign-up on a phone | `features/auth/ProtectionSettings.tsx:164` | not checked yet | – |  |

### Sign-up

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `pv-signup-code` Check your email: 6-digit code | `features/auth/AuthScreens.tsx:46` | not checked yet | – |  |
| `pv-no-memory` Sign-up: this browser can’t hold the account | `features/auth/AuthScreens.tsx:168` | not checked yet | – |  |

### Keys and devices

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `pv-keys-fail` Account created, keys not saved | `features/auth/KeysNotSaved.tsx:206` | not checked yet | – |  |
| `pv-approve-choose` Approve another device: which device is it? | `features/auth/KeysNotSaved.tsx:13, :109` | not checked yet | – |  |
| `pv-keys-fail-again` Keys still not saved | `features/auth/KeysNotSaved.tsx:206` | not checked yet | – |  |
| `pv-approve-dialog` Approve another device | `features/auth/KeysNotSaved.tsx:13, :109` | not checked yet | – |  |
| `pv-approve-after` Approve another device: after They match | `features/auth/KeysNotSaved.tsx:13, :109` | not checked yet | – |  |
| `pv-approve-timeout` Approve another device: no answer | `features/auth/KeysNotSaved.tsx:13, :109` | not checked yet | – |  |
| `pv-approve-cancelled` Approve another device: the other device cancelled | `features/auth/KeysNotSaved.tsx:13, :109` | not checked yet | – |  |
| `pv-approve-mismatch` Approve another device: the digits didn’t match | `features/auth/KeysNotSaved.tsx:13, :109` | not checked yet | – |  |
| `pv-approve-failed` Approve another device: it failed | `features/auth/KeysNotSaved.tsx:13, :109` | not checked yet | – |  |
| `pv-keys-moved` Keys moved to another device | `features/auth/KeysNotSaved.tsx:206` | not checked yet | – |  |

### Two-factor

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `pv-codes-copied` Recovery codes copied | `features/auth/TwoFactor.tsx:176` | not checked yet | – |  |

### Emails

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `em-rules` How Orbyn email works | engine / email service (other repo) | not checked yet | – | other repo |
| `em-code` Verification code | engine / email service (other repo) | not checked yet | – | other repo |
| `em-exists` Sign-up with an email that already has an account | engine / email service (other repo) | not checked yet | – | other repo |
| `em-delete` Account will be deleted | engine / email service (other repo) | not checked yet | – | other repo |
| `em-delete-local` Account will be deleted, no account site | engine / email service (other repo) | not checked yet | – | other repo |
| `em-exists-local` Sign-up with an existing email, no account site | engine / email service (other repo) | not checked yet | – | other repo |
| `em-ops` Operator start-up errors | engine / email service (other repo) | not checked yet | – | other repo |
| `em-ops-smtp` Certificate library, SMTP address and log lines | engine / email service (other repo) | not checked yet | – | other repo |
| `em-ops-config` SMTP address, TLS and companion settings | engine / email service (other repo) | not checked yet | – | other repo |
| `em-ops-more` More certificate-file checks | engine / email service (other repo) | not checked yet | – | other repo |

### Witness

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `wit-start` First start and bootstrap flags | witness CLI (other repo) | not checked yet | – | other repo |
| `wit-replay` Replay and saved-state errors | witness CLI (other repo) | not checked yet | – | other repo |
| `wit-config` Keys and options | witness CLI (other repo) | not checked yet | – | other repo |
| `wit-run` State, address and log lines | witness CLI (other repo) | not checked yet | – | other repo |
| `wit-help` Help text | witness CLI (other repo) | not checked yet | – | other repo |
| `wit-keygen` keygen help | witness CLI (other repo) | not checked yet | – | other repo |

### Key service

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `ks-help` Help text: commands | key-service CLI (other repo) | not checked yet | – | other repo |
| `ks-help-settings` Help text: settings | key-service CLI (other repo) | not checked yet | – | other repo |
| `ks-init` init | key-service CLI (other repo) | not checked yet | – | other repo |
| `ks-init-log-key` init-log-key | key-service CLI (other repo) | not checked yet | – | other repo |
| `ks-config-errors` Missing settings and bad commands | key-service CLI (other repo) | not checked yet | – | other repo |
| `ks-migrate` migrate errors | key-service CLI (other repo) | not checked yet | – | other repo |
| `ks-serve` serve start-up errors | key-service CLI (other repo) | not checked yet | – | other repo |
| `ks-reload` Reload on SIGHUP | key-service CLI (other repo) | not checked yet | – | other repo |
| `ks-publisher` Head publisher start-up errors | key-service CLI (other repo) | not checked yet | – | other repo |

### Start over

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `so-card` Account created, browser can’t keep its keys | `features/auth/AuthScreens.tsx:168` | not checked yet | – |  |
| `so-check` Check your email | `features/auth/AuthScreens.tsx:46` | not checked yet | – |  |
| `so-email` The email | email / other repo | not checked yet | – |  |
| `so-email-local` The email without an account site | email / other repo | not checked yet | – |  |
| `so-landing` The link’s landing page and its states | `features/auth/DeleteUnusedPage.tsx:150` | partial | `so-landing-{light,dark,dim}-side.png` (+ -1440) | the frame’s page draws every state on one board (ready, loading, deleted, expired, not empty); ours renders one at a time, so the ready state was compared: copy agrees; the card is 440px wide (`app.css:549`) where the frame’s is about 400px; Cancel and Delete this account are stacked full-width buttons in ours (DeleteUnusedPage.tsx:155-156, `app.css:551-552, 581`) and one compact row in the frame |
| `so-landing-limited` The link’s landing page · Too many tries | `features/auth/DeleteUnusedPage.tsx:137` | partial | `so-landing-limited-{light,dark,dim}-side.png` (+ -1440) | icon, title and copy agree in all three themes; the card is 440px wide (`app.css:549`) where the frame’s is about 400px |
| `so-done-released` Account deleted, invite code released | `features/auth/DeleteUnusedPage.tsx:90` | partial | `so-done-released-{light,dark,dim}-side.png` (+ -1440) | copy agrees; ours draws a plain green tick (`pv-ok`, DeleteUnusedPage.tsx:91, `app.css:564`) where the frame has a circled tick in the text colour; “Sign up again” is a full-width button in ours (`app.css:551-552, 581`) and compact in the frame; the card is 440px wide (`app.css:549`) where the frame’s is about 400px |
| `so-done-not-released` Account deleted, no invite code released | `features/auth/DeleteUnusedPage.tsx:90` | partial | `so-done-not-released-{light,dark,dim}-side.png` (+ -1440) | as `so-done-released` |
| `so-phone` Start over on a phone | email / other repo | not checked yet | – |  |

### Consent

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `consent` Consent screen | not in this repo (the account site) | not checked yet | – | other repo |
| `consent-edge` Unknown app and Advanced protection | not in this repo (the account site) | not checked yet | – | other repo |

### Launcher

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `launcher` Launcher in the menu bar | desktop launcher (other repo) | not checked yet | – | other repo |
| `launcher-first` First run and update failed | desktop launcher (other repo) | not checked yet | – | other repo |
| `launcher-sign-in` Sign in once | desktop launcher (other repo) | not checked yet | – | other repo |

### Phone

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `phone` Account, approval and consent on a phone | `features/settings/SettingsPage.tsx:18` | not checked yet | – |  |

## Not checked

- Every frame marked *not checked yet*: no render or text comparison was made. Pointers in the component column come from reading the code and a copy match count, not from looking at the screen.
- Sample data was written to approximate the design frames, not copied from them, so counts and a few dates differ for that reason. Differences listed above are the ones that come from the build, not the sample data; where the design’s own sample data disagrees with itself (p-today-all-day, p-today-long, p-today-overnight-long) the cell says so.
- Not exercised, because they need an account and an engine: the “Synced” pill, the account name in the greeting, a notification count, and anything behind sign-in. Hover, focus, keyboard and drag states, and the real (not reduced) motion, were not exercised.
- `p-today-error`, `p-task-loading` and similar states that the build cannot reach were checked in code only.
- `p-today-goal-labels`, `p-task-date`, `p-task-move`, `p-task-subtasks` and `p-lists-empty` were not rendered (or the capture failed); their cells are from the code or from other captures, as stated in each cell.
- Whether the Planner and Account versions are v36 and v53: taken from the brief.

## Motion Designs (Planner and Account rows)

Only demos whose app title is Orbyn Planner or Orbyn Account are listed (21 of 85 demos). Generic demos (button, toggle, menu, modal, toast, sheet and others) are not listed. Durations and easings were read against `web/src/styles/tokens.css` and `tokens.ts`, not filmed. Tokens match the designs: fast 150, base 200, slow 300, page 240, exits 105 / 140 / 210 / 170, wait 400, `cubic-bezier(.2,.8,.2,1)` and `cubic-bezier(.4,0,.2,1)` (`tokens.css:119-127`, `tokens.ts:6-24`, kept equal by `tokens.test.ts`).

| Row | What moves | Spec (duration · easing) | Code | Status |
| --- | --- | --- | --- | --- |
| `checkbox` Planner · New task | box fill and border; tick opacity and scale .4 to 1 | fast 150ms · out | `features/tasks/TaskRow.tsx:23` (Check) has no transition; only nav colour animates (`styles/app.css:49`) | not built |
| `segmented` Planner · Views | thumb slides; label colour | base 200ms, fast 150ms · out | View pills are plain radio buttons without a thumb (`TasksPage.tsx:111`, `CalendarPage.tsx:77`) | not built |
| `tabs` Account · Security | underline slides; pane fades and moves 6px | base 200ms, fast 150ms · out, exit io; pane 60ms after underline | no Security tabs in this repo; Project tabs (`ProjectPage.tsx:258`) switch instantly | not built |
| `inputerr` Account · Sign in | border colour; message fades and moves -4px to 0 | fast 150ms, base 200ms · out, exit io | error text appears with no transition (`AuthScreens.tsx:256`) | not built |
| `select` Planner · Repeat | menu fades, moves -4px, scale .98; chevron turns 180deg | base 200ms, fast 150ms · out, exit io | native `<select>` (`RepeatPicker.tsx:92`) | not built |
| `banner` Account · Security | banner fades and moves -8px in a reserved slot | base 200ms, exit 140ms · out, exit io | `features/auth/DeletionBanner.tsx:78` has no transition | not built |
| `skeleton` Planner · Today | skeleton opacity; content opacity | fast 150ms, base 200ms, exit 105ms, wait 400ms · out, exit io | 400 ms wait built (`TodayPage.tsx:66`, `motionMs("wait")`); no fade of skeleton or content (no opacity transition) | differs |
| `syncline` Planner · Sync | label cross-fade; state shows at least 1s | fast 150ms, exit 105ms · out, exit io | `features/sync/SyncLine.tsx:66` swaps labels at once; no 1s minimum | not built |
| `checkoff` Planner · Today | tick, strike scaleX, row fade, row moves to Done after 1.5s with Undo | fast 150, base 200, slow 300ms · out | no tick or strike motion; a finished task stays in place until tomorrow (`tasks/selectors.ts:17`); Undo only for repeating tasks (`useComplete.ts:13`) | not built |
| `additem` Planner · Today | new row fades and moves -6px; rows below shift one slot | base 200ms · out | `TasksPage.tsx:17` (QuickAddField) adds the row with no motion | not built |
| `delete` Planner · Today | row fades; siblings move up one slot | base 200ms, exit 140ms · out, exit io | `TaskPanel.tsx:132` deletes with a toast; no collapse motion | not built |
| `reorder` Planner · Today | lifted row scale 1.02 and shadow; neighbours shift | fast 150ms, base 200ms · out | no drag reorder in the code (no drag handlers) | not built |
| `board` Planner · Board | card travels between lanes; lift scale 1.03 | slow 300ms, fast 150, base 200ms · out | `TasksPage.tsx:178`, `ProjectPage.tsx:177` move cards by a "Move to" link, no drag or travel | not built |
| `calcreate` Planner · Week | event block scaleY from top edge on create and resize | fast 150ms · out | `calendar/TimeGrid.tsx:36` has no drag-create or resize | not built |
| `calview` Planner · Calendar | thumb slides; view fades and moves 6px | base 200ms, page 240ms, exit 170ms · out, exit io | `CalendarPage.tsx:47` switches view at once | not built |
| `booking` Planner · Book a time | slot colour and press scale .97; summary fades and moves 8px | fast 150ms, base 200ms, wait 400ms · out | no booking screens | not built |
| `signin` Account · Sign-in request | button spinner after 400ms; card content cross-fade | fast 150ms, wait 400ms · out, exit io | spinner after 400 ms is built (`components/BusyButton.tsx:13`, spinner `app.css:89`); no card cross-fade | differs |
| `consent` Account · Connect an app | toggle knob slides; spinner after 400ms; card cross-fade | fast 150ms, wait 400ms · out, exit io | no consent screen here (the account site); `BusyButton` supplies only the 400 ms spinner | not built |
| `collapse` Planner · Narrow window | drawer slides from -100%; scrim fades | slow 300ms, exit 210ms · out, exit io | under 768px the sidebar becomes a tab bar plus a "More" sheet (`app/App.tsx:88`, `app.css:151-159`), no drawer at 900px and no slide | differs |
| `reduced` (row 1) Planner · Today | opacity only, 150ms | base 200ms, exit 140ms normally; 150ms under reduced motion | `styles/tokens.css:130-135` forces colour and opacity transitions at `--m-fast`; spinner stands still (`app.css:92`) | matched (code read, not filmed) |
| `reduced` (row 2) Planner · Today | opacity only, 150ms | same as row 1 | same as row 1 | matched (code read, not filmed) |
