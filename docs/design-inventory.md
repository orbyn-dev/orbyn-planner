# Design inventory: Planner against the designs

- **Designs commit:** `54e6694` (orbyn-designs `origin/main`), Planner Designs v49 and Account Designs v60; the second match pass read `artifacts/planner-designs.html` from it. Earlier rows were read from `718fa7b` and `a3d398e`.
- **Page versions:** Planner Designs v49 and Account Designs v60, as given by the coordinator. The HTML files carry no version marker (the version lives on the artifact server), so these are taken from the brief and not verified here.
- **Planner main checked:** first run on `50b5bc2a`; refreshed on `387a2d4`; match passes on main at `3caa45a` (first) and `0d76a40` (second, with #74 to #82 merged: task and control motion, the Today pitch, the calendar toolbar, Tasks chips, first run, task status). Not merged at the time: the Tasks board (#83), the Lists header and phone fixes.
- **Refresh method:** rows for work merged since the first run were updated from the code, the tests and each PR’s notes; they were not re-screenshotted, so none moves to *matched*. Frames built to v39 to v41 name the PR. Rows for work not yet merged (row popovers, the When line) are left as they were.
- **Method (match passes):** `node scripts/match.mjs <frame>... --theme all` from the match kit: planner on an in-memory seeded store, clock pinned to Sat 7 Nov 2026 08:30 UTC (the week and day frames at 11:40, where the design draws its red line), `en-GB`, reduced motion, one second wait for the sync label's hold; ours at 1160x700 (desktop) or 390x730 (phone) against the design frame cropped the same. Each frame was looked at as a three-theme sheet (Today, calendar, Tasks list, panels) or in light plus the text and pixel diff in the other themes (the rest); measured offsets come from the element positions of both pages. Owner and "Anyone" are gated (sharing is Planned); the In progress and Blocked lanes are not built until #83.
- **Screenshots** are not committed. Match-pass images are `<frame>-<theme>-side.png` (ours left, design right) with the two halves and a text diff in the author’s scratch folder; older rows keep their `cmp-<id>.png` names.
- **Status words.** *matched*: layout, copy, sizes and colours agree in all three themes and I looked at it. *partial*: built, with the listed differences. *not built*: no code for it (the cell says how that was established). *gated*: the frame’s own note says it is not shown today or is Planned. *in progress*: built on a branch that has not merged (none at the last refresh). *not checked yet*: not compared; the component is only a pointer from reading the code.
- **Left out of every “differs” cell** because they hold for all frames and need things this device-only run cannot provide: (G1) the design sidebar has a Booking item and a Notifications count, the build has neither (nav.ts:11; booking and sharing are not built); (G2) the sync pill reads “Synced · 3 devices” in the design and “On this device” in the local build, since real sync needs an account and engine; (G3) “Good morning, Sam” needs an account name, the build says “Good morning”; (G4) the design draws a window title bar, the web build has none.

## Counts

| Page / area | Frames | matched | partial | not built | gated | in progress | not checked yet |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Planner Designs (all)** | **155** | **0** | **89** | **28** | **9** | **0** | **29** |
| Planner · Getting started | 9 | 0 | 9 | 0 | 0 | 0 | 0 |
| Planner · Search | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Planner · Empty, loading and error states | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Planner · Today | 14 | 0 | 13 | 0 | 1 | 0 | 0 |
| Planner · Calendar | 26 | 0 | 17 | 3 | 0 | 0 | 6 |
| Planner · Tasks | 29 | 0 | 19 | 9 | 1 | 0 | 0 |
| Planner · Lists | 5 | 0 | 2 | 3 | 0 | 0 | 0 |
| Planner · Sharing | 5 | 0 | 0 | 5 | 0 | 0 | 0 |
| Planner · Completed and deleted | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| Planner · Projects | 4 | 0 | 3 | 0 | 0 | 0 | 1 |
| Planner · Booking | 8 | 0 | 0 | 8 | 0 | 0 | 0 |
| Planner · Notifications | 4 | 0 | 0 | 0 | 2 | 0 | 2 |
| Planner · Settings | 31 | 0 | 13 | 0 | 5 | 0 | 13 |
| Planner · Account and auth | 8 | 0 | 6 | 0 | 0 | 0 | 2 |
| Planner · Phone | 8 | 0 | 6 | 0 | 0 | 0 | 2 |
| **Account Designs (all)** | **128** | **0** | **14** | **0** | **13** | **0** | **101** |
| Account · Account site | 14 | 0 | 0 | 0 | 5 | 0 | 9 |
| Account · Delete account | 40 | 0 | 0 | 0 | 0 | 0 | 40 |
| Account · Protection | 24 | 0 | 14 | 0 | 8 | 0 | 2 |
| Account · Sign-up | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Account · Keys and devices | 10 | 0 | 0 | 0 | 0 | 0 | 10 |
| Account · Two-factor | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Account · Emails | 10 | 0 | 0 | 0 | 0 | 0 | 10 |
| Account · Witness | 6 | 0 | 0 | 0 | 0 | 0 | 6 |
| Account · Key service | 9 | 0 | 0 | 0 | 0 | 0 | 9 |
| Account · Start over | 6 | 0 | 0 | 0 | 0 | 0 | 6 |
| Account · Consent | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Account · Launcher | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| Account · Phone | 1 | 0 | 0 | 0 | 0 | 0 | 1 |

Deep pass (Today, calendar, tasks) was complete at the first run; the refresh above adds what merged after it. Everything else is marked *not checked yet* unless the code shows the feature is absent or the frame note says it is gated. Frames outside this repository (account site, email, witness, key service, launcher) are listed with the owner and not compared.

## Planner Designs (v47)

### Getting started

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `first-run` First run | `features/firstRun/FirstRun.tsx:107` | partial | `first-run-{light,dark,dim}-side.png` | the three tiles are centred text in the frame and left-aligned in ours (app.css:758), 66px high vs 62px; the title sits 20px higher in the frame (the block is centred vertically in ours: app.css:754) |
| `fr-week` First run · When your week starts | `features/firstRun/FirstRun.tsx:128` | partial | `fr-week-{light,dark,dim}-side.png` | the frame is a left-aligned 540px column with a three-segment progress bar above "Step 1 of 3", the actions on one row (Back left, Skip for now and Continue right); ours is a centred 520px column with no progress bar and the actions centred; "Days shown" is a left label with a joined segment in the frame, centred pills in ours; the frame's cards are unstyled white boxes in dark and Dim (a defect of the design page, to report to the Designer) |
| `fr-calendar` First run · Add a calendar | `features/firstRun/FirstRun.tsx:150` | partial | `fr-calendar-{light,dark,dim}-side.png` | layout and actions as `fr-week`; the Google/Outlook row has its "Planned" tag stacked in ours and inline in the frame; the frame's cards are unstyled white boxes in dark and Dim (a defect of the design page, to report to the Designer) |
| `fr-calendar-error` First run · Calendar error | `features/firstRun/FirstRun.tsx:150` | partial | `fr-calendar-error-{light,dark,dim}-side.png` | the message "Give the calendar a name." sits under the whole card in ours and under the name field in the frame; field outline red in both; layout as `fr-week` |
| `fr-calendar-feed-error` First run · Feed error | `features/firstRun/FirstRun.tsx:90` | partial | `fr-calendar-feed-error-{light,dark,dim}-side.png` | "That address didn’t work. Check it and try again." agrees in copy; placement and layout as `fr-calendar-error` |
| `fr-calendar-checking` First run · Checking the feed | `features/firstRun/FirstRun.tsx:174` | partial | `fr-calendar-checking-{light,dark,dim}-side.png` | "Checking…" with the spinner agrees in copy; layout as `fr-week` |
| `fr-list` First run · Make your first list | `features/firstRun/FirstRun.tsx:185` | partial | `fr-list-{light,dark,dim}-side.png` | the frame has five round colour dots (blue, green, purple, orange, grey), ours four square-ish swatches; actions on one row with Skip right-aligned in the frame, centred in ours; progress bar missing |
| `fr-list-empty` First run · Empty list name | `features/firstRun/FirstRun.tsx:185` | partial | `fr-list-empty-{light,dark,dim}-side.png` | as `fr-list`; the link "I’ll make lists later" replaces Skip for now as in the frame |
| `fr-phone` First run · Phone | `features/firstRun/FirstRun.tsx` | partial | `fr-phone-{light,dark,dim}-side.png` | ours shows the tab bar and centred text on a phone, the frame a full-height page with left-aligned text, a progress bar, a full-width Continue and Back and Skip below it; the frame's radio cards are half styled (design defect); compared for all three steps |

### Today

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `today` Today | `features/today/TodayPage.tsx:150` | partial | `today-{light,dark,dim}-side.png` | the Overdue block starts 2px and its row 4px higher than the design, because the design's 2px row gap applies to every row and ours is one gap per `<ul>` (TodayPage.tsx:348-360, app.css:106). Everything else, including the "Syncing" pill after its one-second hold, agrees in all three themes; 1px offsets of the heading and "Next 7 days" lines are crop |
| `sync-waiting` Offline, waiting to sync | `features/today/TodayPage.tsx:291, features/sync/SyncLine.tsx:29` | partial | `cmp-sync-waiting.png` | popover is narrower |
| `p-today-empty` Today · Nothing planned | `features/today/TodayPage.tsx:316` | partial | `p-today-empty-{light,dark,dim}-side.png` | the empty block's heading sits 2px higher and "Add a task" 5px higher than the design (the design gap between heading, line and button is 12px, ours 10: app.css:128-131) |
| `p-today-loading` Today · Loading | `features/today/TodayPage.tsx:266` | partial | `cmp-p-today-loading.png` | "New task" is disabled and dimmed (TodayPage.tsx:271), design keeps it active; skeleton rows are one full-width bar with no row dot, design uses varied widths and a dot; the 400 ms wait is built (TodayPage.tsx:66) |
| `p-today-error` Today · Error | `features/today/TodayPage.tsx:40 (TodayError, exported, never rendered)` | gated | – | frame note: shown only when the local store reports a read failure, which it does not yet; not screenshotted |
| `p-today-syncing` Today · Syncing | `features/sync/SyncLine.tsx:78-121` | partial | `p-today-syncing-{light,dark,dim}-side.png` | the "Syncing" pill and dot agree; same Overdue offset as `today` (TodayPage.tsx:348-360) |
| `p-today-sync-failed` Today · Couldn’t sync | `features/sync/SyncLine.tsx:90` | partial | `p-today-sync-failed-{light,dark,dim}-side.png` | pill and Retry agree; same Overdue offset as `today` (TodayPage.tsx:348-360) |
| `p-today-all-day` Today · All-day events | `features/today/TodayPage.tsx:87-109, :340` | partial | `p-today-all-day-{light,dark,dim}-side.png` | Sun 8 reads "1 task · 1 event", the design "Candles · tiling day 4" (TodayPage.tsx:251 area); the "All day" header sits 11px lower and "Timed" 6px (TodayPage.tsx:340-342); plus the Overdue offset of `today`; Coming up 12 and "day 3 of 4" agree |
| `p-today-long` Today · A long day | `features/today/TodayPage.tsx:150` | partial | `p-today-long-{light,dark,dim}-side.png` | a fixture count: ours 13 in Today and "9 due" where the frame has 14 and "4 due" (the frame's own numbers are not derivable from its rows); the list, dots, times and the 40px pitch agree; swim and call dot colours are the fixture's calendars |
| `p-today-goal-labels` Today · Progress goal labels | `features/today/TodayPage.tsx:29 (goalLabel), :212` | partial | – | "goal yesterday" can never show: Progress keeps only goals from today on (TodayPage.tsx:212). Today, tomorrow and weekday labels read as designed in the DOM; "goal 14 Nov" is by code only. No screenshots |
| `p-today-week-empty` Today · Empty days in the week | `features/today/TodayPage.tsx:251` | partial | `p-today-week-empty-{light,dark,dim}-side.png` | "Nothing planned" lines agree in text; the Overdue offset of `today`; the fixture's week differs from the frame's in Sun 8 (frame data) |
| `p-today-overnight` Today · Events across midnight | `features/today/TodayPage.tsx:87-109` | partial | `p-today-overnight-{light,dark,dim}-side.png` | "Until 06:00" / "Started yesterday 22:00" rows and the Overdue offset of `today`; compared by text and layout |
| `p-today-overnight-long` Today · Events across several days | `features/today/TodayPage.tsx:87-109` | partial | `p-today-overnight-long-{light,dark,dim}-side.png` | the all-day row reads "Conference: Lisbon · day 3 of 5" with "Work", the frame "Conference: Lisbon" with "Thu 5 Nov – Mon 9 Nov"; the frame lists 4 days in "Next 7 days" and no Progress block, ours 6 days and Progress; "Sun 8" reads "3 events" vs "Dentist 15:00"; frame counts (Overdue 1, Done 1, 8 today) come from rows the frame does not draw |
| `p-today-no-name` Today · No name | `features/today/TodayPage.tsx:150` | partial | `p-today-no-name-{light,dark,dim}-side.png` | same as `today`: the Overdue block starts 2px and its row 4px higher than the design, because the design's 2px row gap applies to every row and ours is one gap per `<ul>` (TodayPage.tsx:348-360, app.css:106) |

### Tasks

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `work-list` Tasks · List | `features/tasks/TasksPage.tsx:80` | partial | `work-list-{light,dark,dim}-side.png` | chips and group names now agree (#80); Owner column and "Anyone" are gated (sharing is Planned); "Today (planned or due)" counts the done row (4) where the frame counts open ones (3), and lists date-only tasks before timed ones (selectors.ts:25 sorts by `compareDue`), the frame puts the timed ones first and the done row last; Due reads "Mon"/"Thu"/"Fri" where the frame reads "Mon 9"/"Thu 12"/"Fri 13" (selectors.ts:79-85); the quick-add line sits at the bottom of the page, the frame right under the rows; rows are about 1.5px further apart |
| `work-board` Tasks · Board | `features/tasks/TasksPage.tsx:178` | partial | `cmp-work-board.png` | two lanes (To do, Done); design has four (To do, In progress, Blocked, Done) and a progress bar on cards; Task has no status field (types.ts:19) |
| `new-task` New task | `features/tasks/NewTaskDialog.tsx:15` | partial | `cmp-new-task.png` | fields Title, Due, List then the rows Repeat, Reminder, Priority (#56); Due is the one combined line with typing, a live preview and the calendar popover (p-due-task); still: a Project select the frame does not show; "Add task" card width not compared |
| `task-panel` Task panel | `features/tasks/TaskPanel.tsx:26` | partial | `task-panel-{light,dark,dim}-side.png` | the Status row (To do) is now there (#82) but sits below Project where the frame puts it right after Reminder; Tags and Project rows and the "Linked" thread block (not built) differ; the list behind the panel differs as in `p-row-due` |
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
| `p-board-drag` Board · Drag in progress | none found | not built | – | no drag code in features (grep: no draggable or drag handlers) |
| `task-notes` Task panel with linked notes | none found | not built | – | no link to Notes in TaskPanel |
| `task-notes-none` Notes not on this device | none found | not built | – | no link to Notes in TaskPanel |
| `p-view-options-list` Tasks · View options (list) | `features/tasks/ViewOptionsButton.tsx:54-63` | partial | `p-view-options-list-{light,dark,dim}-side.png` | now a 280px list with Selected tags and a segment (#80); the popover opens about 78px left of the frame's position (the frame aligns it to the right edge); "Show completed tasks" is on in ours and off in the frame (viewOptions.ts:22 defaults it on); the row spacing inside is 1px tighter |
| `p-view-options-board` Tasks · View options (board) | `features/tasks/ViewOptionsButton.tsx:54-63` | partial | `p-view-options-board-{light,dark,dim}-side.png` | same popover differences; the board has two lanes (To do, Done) where the frame has To do, In progress, Blocked and Done (needs the status field); cards show the due day as "Thu" vs "Thu 12"; the "Show Done lane" toggle is on in both |
| `p-row-due` Task panel · Edit Due | `features/tasks/RowPopovers.tsx` | partial | `p-row-due-{light,dark,dim}-side.png` | the popover agrees in structure; ours keeps the filter row and list columns beside the panel (the frame shows a plain list of three tasks and "6 open"), the panel adds Tags, Project and Notes rows and a Checklist the frame cuts off (TaskPanel.tsx:170, 215, 252); the open row is not highlighted in ours; counts differ (fixture has 15 open) |
| `p-row-list` Task panel · Edit List | `features/tasks/RowPopovers.tsx` | partial | `p-row-list-{light,dark,dim}-side.png` | as `p-row-due`; the list popover (search, Work Selected, ..., New list…) agrees in structure |
| `p-row-priority` Task panel · Edit Priority | `features/tasks/RowPopovers.tsx` | partial | `p-row-priority-{light,dark,dim}-side.png` | as `p-row-due`; the priority menu agrees and High is Selected as in the frame |
| `p-row-repeat` Task panel · Edit Repeat | `features/tasks/RowPopovers.tsx` | partial | `p-row-repeat-{light,dark,dim}-side.png` | as `p-row-due`; the repeat menu agrees in structure |
| `p-row-reminder` Task panel · Edit Reminder | `features/tasks/RowPopovers.tsx` | partial | `p-row-reminder-{light,dark,dim}-side.png` | as `p-row-due`; the reminder menu agrees in structure, "1 hour before" Selected |
| `task-panel-status-open` Task panel · Status | `features/tasks/RowPopovers.tsx` | partial | `task-panel-status-open-{light,dark,dim}-side.png` | the status menu (To do, In progress Selected, Blocked) agrees in structure; the frame's footnote about the Tasks board is not in ours; panel and list differences as `task-panel` |
| `task-panel-status-set` Task panel · Status set to Blocked | `features/tasks/TaskRow.tsx:65, 109` | partial | `task-panel-status-set-{light,dark,dim}-side.png` | "· Blocked" after the title in the list row agrees; panel and list differences as `task-panel` |

### Lists

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `lists` Lists | `features/lists/ListsPage.tsx:57` | partial | `cmp-lists.png` | header shows four colour swatches and "Completed and deleted"; design has "Share" and "Shared with Maya" (sharing not built) |
| `p-lists-empty` Lists · Empty list | `features/lists/ListsPage.tsx:57` | partial | `p-lists-empty-{light,dark,dim}-side.png` | the list header is crowded at 1160px: Rename, "Nothing here", the sync pill, "Completed and deleted", four colour dots and a squeezed Add a task button wrap onto several lines (ListsPage.tsx:44-60, 190-195); the frame has only the title, "Nothing here", Share and Add a task; the frame's list order and colours (Groceries, Work, Home, Errands) and counts are its own data; the quick-add field under the empty state is in both |
| `p-lists-loading` Lists · Loading | `features/lists/ListsPage.tsx:59` | not built | – | `ready` only disables "New list" (:122); no skeleton rows |
| `p-lists-error` Lists · Error | none found | not built | – | no list error state in ListsPage |
| `p-lists-offline` Lists · Offline | none found | not built | – | SyncLine is used on Today only (grep), so Lists shows no offline state |

### Completed and deleted

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `trash` Completed and deleted | `features/completed/CompletedPage.tsx:11` | partial | `cmp-trash.png` | dates read "5 Nov", design "Thu 5"; done titles are faded, design keeps full contrast |

### Projects

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `projects` Projects | `features/projects/ProjectsPage.tsx:14` | partial | `cmp-projects.png` | due reads "30 Jan 2027", design "Jan 30"; otherwise table, filters and meter match |
| `project-detail` Project | `features/projects/ProjectPage.tsx:258` | partial | `cmp-project-detail.png` | header has All projects / Edit / Mark done, design Share; sections carry reorder, rename and delete controls and an "Add a section" form; no "Shared with" panel; dates "Mon" vs "Mon 9"; due "30 Jan 2027" vs "30 Jan" |
| `project-board` Project · Board | `features/projects/ProjectPage.tsx:177` | partial | `cmp-project-board.png` | a "Move to" link under every card; no assignee on cards ("Mon 9 · Maya"); dates "Mon" vs "Mon 9"; header buttons as above |
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
| `p-cal-day-empty-phone` Calendar · Phone day view, empty day | `features/calendar/PhoneCalendar.tsx:98` | partial | `p-cal-day-empty-phone-{light,dark,dim}-side.png` | the sync pill reads "On this device" (SyncLine.tsx:83) where the frame has no pill on a phone; the Tue 3 dot (a day with events) is not drawn in the strip, ours only marks today (PhoneCalendar.tsx:164); the second frame (Fri 6) differs the same way |
| `calendar-week` Calendar · Week | `features/calendar/CalendarPage.tsx:47, features/calendar/TimeGrid.tsx:36` | partial | `calendar-week-{light,dark,dim}-side.png` | toolbar now agrees (#79); ours still shows an "Overlaps" row (TimeGrid.tsx:198) that v49 removed; "Due this week" in the frame includes today's tasks (Send the launch brief, Fix the sign-up email bug) and says "1 day late", ours lists only the overdue task as "Overdue 1d" (TimeGrid.tsx:199-209); the grid scrolls to near now (TimeGrid.tsx:67) and starts at 10:00 where the frame starts at 7:00; the day-name band is 8px shorter; times read "09:00" vs "9:00" |
| `calendar-day` Calendar · Day | `features/calendar/CalendarPage.tsx:47, features/calendar/TimeGrid.tsx:36` | partial | `calendar-day-{light,dark,dim}-side.png` | the frame has the range label "Sat 7 Nov" between the arrows, ours none (CalendarPage.tsx:104-112); "Tasks today" order is by title (Pick up, Reply, Send), the frame by time with 12:00 first (TimeGrid.tsx:212-216); All day also shows in the grid in ours; grid starts 10:00 vs 7:00 (TimeGrid.tsx:67) |
| `calendar-agenda` Calendar · Agenda | `features/calendar/AgendaView.tsx:39` | partial | `calendar-agenda-{light,dark,dim}-side.png` | the frame has the range label "Sat 7 – Fri 13 Nov" between the arrows; its rows are about 38px apart, ours 27px; the right-hand text is "Room 3" / "1h · Home" / "Every Tuesday" where ours adds the duration first ("Room 3 · 1h", "Home · 1h") and no recurrence label |
| `calendar-month` Calendar · Month | `features/calendar/MonthView.tsx` | partial | `calendar-month-{light,dark,dim}-side.png` | ours fills the last row with the next month's days (MonthGrid.tsx:35-38) where the frame stops at 30; the frame's "Work" chips on 3, 5 and 7 and its Swim colour come from frame data not in the fixture; toolbar and day numbers agree |
| `event-panel` Event panel | `features/calendar/EventPanel.tsx:16` | partial | `cmp-event-panel.png` | Calendar, Repeat and Reminder open row popovers (p-row-calendar); When opens the combined date-and-time popover (p-row-event-when); with the panel open the toolbar pills wrap onto several lines |
| `new-event` New event | `features/calendar/NewEventDialog.tsx:13` | partial | `cmp-new-event.png` | "Invite people" is a row (#56); When is the one combined line with typing, a live preview, a quiet "Couldn’t read that" and the calendar popover (p-when-event, -typing, -unreadable); still: calendar is a select without the colour swatch |
| `calendar-manage` Calendars | `features/calendar/CalendarsDialog.tsx:9, features/calendar/CalendarList.tsx:86` | partial | `cmp-calendar-manage.png` | rows carry four colour swatches, Rename and a Shown toggle; design rows are name and "Shown" text; "Family · shared" needs sharing (not built); a failed subscription row exists (CalendarList.tsx:72) |
| `p-event-invitees` Event panel · Invitees and replies | `features/calendar/EventPanel.tsx:16` | not checked yet | – | Event has `people` with responses (types.ts:112) |
| `p-event-recurring` Event panel · Edit a repeating event | `features/calendar/ScopeDialog.tsx:22` | not checked yet | – |  |
| `p-event-conflict` Event panel · Conflict | none found | not checked yet | – |  |
| `p-event-video` Event panel · Video link | none found | not built | – | no video-link field on CalendarEvent (types.ts:103) |
| `p-event-delete` Event panel · Delete | `features/calendar/EventPanel.tsx:16` | not checked yet | – |  |
| `p-cal-loading` Calendar · Loading | none found | not built | – | CalendarPage never reads `ready`; no loading state |
| `p-cal-sync-error` Calendar · Sync error, outside calendar | `features/calendar/CalendarList.tsx:72` | not checked yet | – | a subscription refresh error shows in the Calendars dialog only |
| `p-cal-all-day` Calendar · All-day and multi-day | `features/calendar/TimeGrid.tsx` | partial | `p-cal-all-day-{light,dark,dim}-side.png` | the "All day" row, spanning bar and Maya’s birthday agree in structure; ours has an Overlaps row and the "No tasks due." panel where the frame has none, and the grid scrolls to 10:00 |
| `p-cal-time-zone` Calendar · Time zones | `store/occurrences.ts:52` | not checked yet | – |  |
| `p-cal-busy-only` Calendar · Busy-only shared calendar | none found | not built | – | needs shared calendars (not built) |
| `p-cal-week-weekdays` Calendar · Week, weekdays only | `features/calendar/TimeGrid.tsx:36` | partial | `p-cal-week-weekdays-{light,dark,dim}-side.png` | five columns and Events 5 agree (v47); the Overlaps row and the grid scroll differences of `calendar-week` |
| `p-cal-week-nav` Calendar · Another week | `features/calendar/CalendarPage.tsx:104-125` | partial | `p-cal-week-nav-{light,dark,dim}-side.png` | the toolbar now fits on one row (#79); the frame's grid shows this week's events copied into week 46 (frame data), ours is the empty week 9 to 15 Nov; Events/Overlaps rows as `calendar-week` |
| `p-cal-calendars-popover` Calendar · Calendars popover | `features/calendar/CalendarPage.tsx:120` | partial | `p-cal-calendars-popover-{light,dark,dim}-side.png` | popover and its footer agree in structure; calendar names, colours and the Subscribed tag are the frame's own data (Birthdays, Holidays, Library events), not in the fixture |
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
| `notifications` Notifications | `features/notifications/NotificationsPage.tsx:14` | not checked yet | – |  |
| `p-notif-empty` Notifications · Empty | `features/notifications/NotificationsPage.tsx:14` | not checked yet | – |  |
| `p-notif-grouped` Notifications · Grouped | none found | gated | – | frame note: Planned, needs sharing or connected apps |
| `p-notif-snooze` Notifications · Snooze a reminder | none found | gated | – | frame note: Planned, needs sharing |

### Search

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `search` Search or add | `features/search/SearchDialog.tsx:26` | not checked yet | – | dialog exists; copy and layout not compared |
| `p-search-none` Search · No results | `features/search/SearchDialog.tsx:26` | not checked yet | – |  |

### Empty, loading and error states

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `empty-error` Empty, loading and error states | `components/EmptyState.tsx:4` | not checked yet | – |  |

### Settings

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `settings-account` Settings · Account and devices | `features/settings/SettingsPage.tsx:18, features/auth/AccountSettings.tsx:317` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh; Passkeys row is Planned |
| `add-device` Approve a new sign-in | `features/auth/PendingScreen.tsx:11` | not checked yet | – | the frame was not part of #46 and has not been compared |
| `settings` Settings · Planning | `features/settings/SettingsPage.tsx:18` | not checked yet | – | the frame was not part of #46 and has not been compared |
| `settings-notifications` Settings · Notifications | `features/settings/NotificationsSettings.tsx:21` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh: Reminders heading and status, quiet hours with an allow switch, Planned rows |
| `p-set-notif-reminders-off` Settings · Notifications · Reminders off | `features/settings/NotificationsSettings.tsx:21` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |
| `p-set-notif-reminders-asking` Settings · Notifications · Asking for permission | `features/settings/NotificationsSettings.tsx:21` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |
| `p-set-notif-reminders-blocked` Settings · Notifications · Blocked in the browser | `features/settings/NotificationsSettings.tsx:21` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |
| `p-set-notif-unsupported` Settings · Notifications · No notification support | `features/settings/NotificationsSettings.tsx:21` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |
| `connected-apps` Settings · Connected apps | none found | not checked yet | – | the frame was not part of #46 and has not been compared |
| `settings-calendars` Settings · Calendars | `features/calendar/CalendarList.tsx:86` | not checked yet | – | the frame was not part of #46 and has not been compared |
| `settings-privacy` Settings · Data protection | `features/auth/ProtectionSettings.tsx:164` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh: Data protection page with radio group semantics, no device name beside a signed change |
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
| `p-export-dialog` Settings · Privacy · Export your data | `features/export/ExportSettings.tsx:15` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh: JSON default, format descriptions, settings stay on this device |
| `p-export-busy` Settings · Privacy · Exporting | `features/export/ExportSettings.tsx:15` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |
| `p-export-done` Settings · Privacy · Exported | `features/export/ExportSettings.tsx:15` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |
| `p-export-failed` Settings · Privacy · Export failed | `features/export/ExportSettings.tsx:15` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |
| `p-set-privacy-verified-removed` Settings · Privacy · Verified, other device | `features/auth/ProtectionSettings.tsx:164` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |
| `p-set-privacy-verified-this-device` Settings · Privacy · Verified, signed on this device | `features/auth/ProtectionSettings.tsx:164` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |

### Account and auth

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `landing` Landing | `features/auth/AuthScreens.tsx:20` | not checked yet | – | grep matches 4 of 6 lines |
| `sign-up` Sign up | `features/auth/AuthScreens.tsx:197` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh: dimmed Planned passkey button, "Continue with a password", sign-up note keeps the email code |
| `verify` Verify your email | `features/auth/AuthScreens.tsx:46` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh: verify states |
| `p-verify-ready` Verify your email · Send a new code | `features/auth/AuthScreens.tsx:46` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |
| `p-verify-throttled` Verify your email · Too many codes | `features/auth/AuthScreens.tsx:46` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh |
| `sign-in` Sign in | `features/auth/AuthScreens.tsx:256` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh: Planned passkey button, "Continue with a password", "Forgot your password?" |
| `p-sign-in-local` Sign in · from inside the planner | `features/auth/AuthScreens.tsx:256` | not checked yet | – |  |
| `recovery` Recover your account | `features/auth/AuthScreens.tsx:398` | partial | – | built to the v36 designs in #46; not re-compared by screenshot in this refresh: final recovery text |

### Phone

| Frame | Component (web/src) | Status | Shots | Differs / note |
| --- | --- | --- | --- | --- |
| `phone` Today, a list and offline on a phone | `app/App.tsx:103, features/today/TodayPage.tsx:150` | partial | `phone-{light,dark,dim}-side.png` | the sync pill reads "On this device" (SyncLine.tsx:83) where the frame has no pill on a phone; the list starts 30px lower because of the pill and the title sits 2px lower; the tab bar icons sit 4px lower (App.tsx:103); the round SA menu button agrees (#71). Only the Today phone (first of three) was compared |
| `p-phone-task` Phone · Task as a sheet | `features/tasks/TaskPanel.tsx:26` | not checked yet | – |  |
| `p-phone-week` Phone · Calendar week | `features/calendar/PhoneCalendar.tsx:98` | partial | `p-phone-week-{light,dark,dim}-side.png` | the sync pill reads "On this device" (SyncLine.tsx:83) where the frame has no pill on a phone; "3 events · 1 task" vs the frame's "2 tasks" (frame lists one task); the tab bar sits 4px lower; the second frame (Tue 3) is also compared (`p-phone-week@1`) with the same pill difference |
| `p-phone-empty` Phone · Empty states | `features/today/TodayPage.tsx:316` | not checked yet | – |  |
| `p-phone-offline` Phone · Offline | `features/sync/SyncLine.tsx:29, features/calendar/PhoneCalendar.tsx` | partial | `p-phone-offline-{light,dark,dim}-side.png` | the offline Calendar frame has a banner "Offline · 2 changes waiting to sync" at the top, the title "Calendar", no day strip and a "Last synced 09:38" row; ours shows the month title, the strip and an "Offline" pill; only the Calendar frame (second of two) was compared |
| `p-phone-menu` Phone · Menu | `features/today/TodayPage.tsx` | partial | `p-phone-menu-{light,dark,dim}-side.png` | the sheet lists Notifications, Projects and Settings; the frame also has Booking (not built), the Notifications count 4, and the profile row "Sam Arden · Synced" (needs an account); the sheet is shorter and sits 70px lower |
| `p-phone-day-nav` Phone · Day navigation | `features/calendar/PhoneCalendar.tsx:149-164` | partial | `p-phone-day-nav-{light,dark,dim}-side.png` | the sync pill reads "On this device" (SyncLine.tsx:83) where the frame has no pill on a phone; the Tue 3 dot (a day with events) is not drawn in ours (PhoneCalendar.tsx:164); the strip, the Today button, the rows and the colours agree |
| `p-phone-month-picker` Phone · Month picker | `features/calendar/PhoneCalendar.tsx:63-85` | partial | `p-phone-month-picker-{light,dark,dim}-side.png` | the sheet starts 23px higher; the month title is bold and small where the frame's is regular and larger; chevrons are boxed where the frame's are plain; Today and Done sit about 4px lower; the sheet's top corners are rounder in the frame |

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
| `so-landing` The link’s landing page and its states | `features/auth/CancelDeletionPage.tsx:50` | not checked yet | – |  |
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
