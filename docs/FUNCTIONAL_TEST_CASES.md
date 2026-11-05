# Functional Test Cases — Student Pro-active Debt Management Tracker

65 functional test cases covering the application's authentication/access model, the business rules
defined in `Student-Debt-Tracker-Business-Case.docx` (risk scoring §3.3, decision engine §3.4, instalment
sizing §3.5, autonomy levels §3.6, functional modules §3.7, data model §3.8, integration points §3.9,
measures of success §7, and risk mitigations §6), and standard non-functional checks (security, data
integrity, performance, cross-browser) that are good practice for a system of this kind even though they
aren't spelled out in the business case.

Each test case follows the same format:

```
As a [persona]
I want [capability]
So that [benefit]

- Given [pre-condition]
- When [action]
- Then [observable outcome]
```

## How this document is organised

The 65 cases are split into **three independent sections** so three people can execute them in parallel
without blocking on each other's work. Independence means: a tester on Section 2 doesn't need Section 1 or
3 to be finished first, and vice versa. Each section notes its environment prerequisites.

| Section | Theme | Test cases | Count |
|---|---|---|---|
| [1](#section-1--access-navigation--core-workspaces) | Access, Navigation & Core Workspaces | FTC-01–07, 12–14, 37–38, 41–43, 56–59, 62–63, 65 | 22 |
| [2](#section-2--risk-scoring--decision-engine) | Risk Scoring & Decision Engine (business rules) | FTC-16–34, 50–51, 60 | 22 |
| [3](#section-3--case-workflow-engagement--operations) | Case Workflow, Engagement, Write-back & Operations | FTC-08–11, 15, 35–36, 39–40, 44–49, 52–55, 61, 64 | 21 |

Every test case has a **Tester / Date / Result / Notes** row at the end for execution tracking — fill
these in as you run them (Result: Pass / Fail / Blocked).

**Demo credentials:** all seeded users sign in with password `Debt@2026!` (per `README.md`). See the login
screen's "Demo accounts" list for usernames and roles (officers on Teams A/B/C, a debt manager, a system
administrator).

---

## Section 1 — Access, Navigation & Core Workspaces

**Assigned to:** _______________________
**Prerequisites:** Backend (`./mvnw spring-boot:run`) and frontend (`npm start`) running against a freshly
seeded database (`docker compose up -d` then let Liquibase run). No dependency on Section 2 or 3 state.

### FTC-01 — Officer login with valid credentials
As a student debt officer
I want to sign in with my username and password
So that I can access my caseload securely

- Given I am on the login page and not authenticated
- When I enter valid credentials (or select a seeded demo account) and click "Sign in"
- Then I am redirected to the Home dashboard and see my name and role in the header

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-02 — Login rejected with invalid credentials
As a student debt officer
I want to be blocked from signing in with wrong credentials
So that unauthorized users cannot access debtor data

- Given I am on the login page
- When I enter an incorrect username or password and click "Sign in"
- Then I remain on the login page and see an authentication error message

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-03 — Session restored on page reload
As a signed-in officer
I want my session to persist across a page refresh
So that I don't have to log in again every time I reload

- Given I am signed in and my token is stored in the browser
- When I refresh the page or revisit the app
- Then `GET /api/auth/me` restores my session and I land on my last page without being asked to log in again

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-04 — Expired/invalid session redirects to login
As a signed-in officer
I want to be sent back to login if my session is no longer valid
So that I never work with a stale or unauthorized session

- Given my stored token is expired or invalid
- When the app calls `GET /api/auth/me` on startup
- Then I receive a 401 and am redirected to `/login`

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-05 — Sign out clears the session
As a signed-in officer
I want to sign out
So that my session ends and no one else can continue using it on this device

- Given I am signed in and viewing any workspace
- When I click "Sign out" in the header
- Then my session is cleared, I am redirected to `/login`, and navigating back does not restore access

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-06 — Unauthenticated access is blocked by the route guard
As the system
I want to block direct navigation to protected routes without a session
So that debtor data is never exposed to anonymous users

- Given I am not authenticated
- When I navigate directly to a protected URL (e.g. `/home`, `/tracker`, `/cases`)
- Then I am redirected to `/login` with a `returnUrl` back to the page I requested

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-07 — Home dashboard shows portfolio-scoped summary
As a student debt officer
I want the dashboard to reflect only my own caseload by default
So that I see figures relevant to my work, not the whole institution

- Given I am signed in as an officer with "My caseload" selected
- When the Home dashboard loads
- Then the summary tiles (registered students, total debt, at-risk, average balance) reflect only debtors assigned to me

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-12 — Age Analysis shows ageing buckets by funding source
As a student debt officer
I want to see how outstanding debt is distributed across ageing buckets and funding sources
So that I can prioritise the oldest and highest-risk arrears first

- Given there are debtors with balances in the current, 30/60/90/120+ day buckets
- When I open the Age Analysis tab
- Then I see totals per funding source per bucket, and a per-student table sorted by oldest arrear first

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-13 — Export CSV of the current filtered view
As a student debt officer
I want to export the data I'm currently viewing to CSV
So that I can share or analyse it outside the application

- Given I have applied a financial year and/or funding source filter
- When I click "Export CSV"
- Then a CSV file downloads containing only the rows matching my current filters

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-14 — Officer cannot access the Write-back failures admin screen
As the system
I want to restrict the Write-back failures screen to managers and admins
So that only authorized roles can see and act on integration failures

- Given I am signed in as a standard officer (not a manager or admin)
- When I view the navigation tabs or attempt to navigate to `/writebacks` directly
- Then the "Write-back failures" tab is not shown, and direct navigation is blocked or redirected

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-37 — Officer sees only their own portfolio by default
As a student debt officer
I want to see only debtors assigned to me, not the full college book
So that access is role-appropriate and POPIA-aligned

- Given I am signed in as a standard officer with "My caseload" selected
- When I view any workspace (Home, Tracker, Case list, Age Analysis)
- Then I only see debtors assigned to me, and totals/KPIs reflect only my portfolio

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-38 — Every case access is written to the audit log
As a compliance officer
I want every time a case is opened to be logged
So that there is a full audit trail of who viewed which student's financial data and when

- Given I open a specific student's case detail view
- When the page loads
- Then an "Access log" entry is created on that case recording my name, role, and timestamp

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-41 — Home KPIs match the selected financial year and funding filter
As a student debt officer
I want the Home summary tiles to recalculate when I change the financial year or funding source
So that the figures I see always match the scope I've selected

- Given I am on the Home dashboard with 2026 and "All funding types" selected
- When I change the financial year to 2024 or the funding source to "Government (NSFAS)"
- Then the five KPI tiles (registered students, total debt, credits owed, 90+ at-risk, average balance) and the charts update to reflect only that year/funding combination

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-42 — "All years" option aggregates the whole book
As a student debt officer
I want an "All years" option on the financial year filter
So that I can see the complete historical debt picture, not just one year

- Given I am on any workspace with the financial-year filter
- When I select "All years"
- Then the KPIs and charts aggregate across every financial year in the book (2022–2026), not just the current year

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-43 — "Picked up today" call-to-action navigates to the Tracker
As a student debt officer
I want a direct link from Home into today's flagged cases
So that I can act on them without hunting for the right tab

- Given the nightly job has picked up one or more new cases
- When I click the "picked up today" call-to-action on Home
- Then I am taken directly to the Debt Management Tracker, scoped to today's newly flagged cases

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-56 — Expired JWT forces re-authentication, not silent failure
As a signed-in officer
I want an expired session token to clearly prompt me to log in again
So that I never see broken or partial data because of a silently failed API call

- Given my JWT has expired while I'm actively using the app
- When I perform an action that calls the API
- Then I receive a 401, am redirected to `/login`, and any in-progress unsaved action is not silently lost without warning

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-57 — A manipulated portfolio-scope parameter cannot bypass server-side access control
As a compliance officer
I want portfolio scope enforced on the server, not just hidden in the UI
So that a technically savvy officer can't view another team's or the full portfolio by editing a request

- Given I am signed in as a standard officer scoped to "My caseload"
- When I (or a tool) directly call `GET /api/debtors?portfolio=all` bypassing the UI
- Then the server rejects or ignores the elevated scope and returns only my own portfolio, based on my authenticated role — not the requested parameter

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-58 — Changing the autonomy level is restricted to manager/admin roles
As the system
I want only managers and admins to change the agent's autonomy level
So that a standard officer can't unilaterally raise automation for the whole portfolio

- Given I am signed in as a standard officer
- When I attempt to change the autonomy-level selector (via UI or direct API call)
- Then the UI control is disabled/hidden for my role, and a direct API call is rejected with a 403

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-59 — SQL/script injection in filter or search fields is neutralised
As the system
I want filter and search inputs sanitised against injection
So that a malicious input can never execute against the database or render as script in the browser

- Given I enter a string containing SQL metacharacters or an HTML/script payload into a student search or filter field
- When I submit the search
- Then the input is treated as literal text (parameterised query), no script executes, and no unintended data is returned or altered

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-62 — CSV export produces correctly formatted currency and dates
As a student debt officer
I want exported CSV values formatted consistently
So that the file opens correctly in Excel without corrupted Rand amounts or date formats

- Given I export the current filtered view to CSV
- When I open the file in a spreadsheet application
- Then currency values appear as plain numbers (not corrupted by locale/thousands-separator issues) and dates are in an unambiguous, consistent format

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-63 — Officer reassignment moves a case without losing its history
As a debt manager
I want to reassign a case from one officer to another
So that coverage gaps (leave, turnover) don't leave cases unworked, without losing the audit trail

- Given a case is assigned to Officer A
- When a manager reassigns it to Officer B
- Then the case appears in Officer B's caseload, disappears from Officer A's, and the full prior activity log (including Officer A's actions) remains visible on the case

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-65 — The app behaves consistently across the supported browsers
As a student debt officer
I want the application to work the same way regardless of which supported browser I use
So that my experience isn't degraded by browser choice

- Given the organisation's supported browser list (to be confirmed per issue #20, platform/browser alignment)
- When I perform the same core workflow (login → view tracker → approve a case) in each supported browser
- Then layout, functionality, and data are consistent across all of them, with no broken controls or silent failures

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

---

## Section 2 — Risk Scoring & Decision Engine

**Assigned to:** _______________________
**Prerequisites:** Backend running against the seeded test-scenario database
(`012-seed-test-scenarios.xml` — see `docs/TEST_SCENARIOS.md` for the exact seeded cases per rule). Most of
these can be verified directly via the API (`GET /api/debtors/{caseKey}`) without needing the UI, so this
section can run independently of Sections 1 and 3. References business case §3.3–§3.6.

### FTC-16 — Zero-balance student always scores 0
As the Risk Sentinel agent
I want a student with no outstanding balance to always score 0
So that students in good standing are never surfaced as risk cases

- Given a student has no outstanding balance on any funding source
- When the nightly scoring job runs
- Then their risk score is 0 and they are not picked up, regardless of past missed instalments or funding status

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-17 — Risk score is capped at 99
As the Risk Sentinel agent
I want a student's combined risk signals to never exceed the defined score range
So that scores remain comparable across the whole book

- Given a student's combined signal weights (ageing, missed instalments, funding status, prior default) sum to more than 99
- When the nightly scoring job runs
- Then the displayed risk score is capped at 99, not the raw summed value

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-18 — Risk band boundaries are applied correctly
As a student debt officer
I want each student's score mapped to the correct risk band
So that I can triage by severity at a glance

- Given students scored at 44, 45, 69, and 70
- When I view the Debt Management Tracker or Case list
- Then scores below 45 show "Watch", 45–69 show "Elevated", and 70+ show "High"

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-19 — 120+ day ageing contributes a balance-proportional weight
As the Risk Sentinel agent
I want the 120+ day signal to scale with outstanding balance, up to a cap
So that larger long-overdue balances score higher without one signal dominating the score

- Given a student has an amount in the 120+ day bucket
- When their score is computed
- Then they receive +18 plus min(12, balance ÷ 4,000) for that signal, and the balance-based add-on never exceeds 12

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-20 — Missed instalments are capped at +22
As the Risk Sentinel agent
I want the missed-instalment contribution to be capped
So that a long string of missed instalments doesn't dominate the score

- Given a student has missed 5 or more instalments (5 × 7 = 35, which exceeds the cap)
- When their score is computed
- Then the missed-instalment contribution is capped at +22, not the uncapped value

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-21 — "Picked up" rule requires balance plus a qualifying signal
As the Risk Sentinel agent
I want to only flag students who have both a balance and a genuine risk signal
So that students with a balance but no arrears, missed instalments, or funding risk aren't needlessly surfaced

- Given a student has an outstanding balance but no missed instalments, no amount in any arrears bucket, and a funding-status weight below 8 (e.g. Self-funded, Bursary confirmed)
- When the nightly scoring job runs
- Then the student is NOT picked up and appears instead in the "paying on cycle" table, not the worklist

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-22 — Credit balance triggers a refund recommendation (Rule 1)
As the Assurance Agent
I want an account in credit to always recommend a refund first
So that money owed to a student is never buried under a collections action

- Given a student's account is in credit (owed to student)
- When the decision engine evaluates the case
- Then the recommended action is "Refund the credit balance" under policy FIN-02.6, status "Needs approval" — regardless of any other signal also being true

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-23 — Prior default with no payment triggers registration hold + collections hand-over (Rule 2)
As the Assurance Agent
I want a defaulted arrangement with no subsequent payment to escalate to collections
So that non-recoverable cases are handed over rather than re-offered another arrangement

- Given a student's prior payment arrangement defaulted and no payment has been made since
- When the decision engine evaluates the case
- Then the recommended action is "Registration hold + hand-over to collections" under FIN-09.3, status "Needs approval"

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-24 — Lapsed/declined funding triggers a capped hardship referral (Rule 3)
As the Funding Broker agent
I want a hardship award to never exceed 40% of debt or R6,000, whichever is lower
So that hardship fund exposure stays within policy limits

- Given a student's funding status is NSFAS declined or lapsed, with an outstanding debt of R20,000
- When the decision engine evaluates the case
- Then the recommended hardship award is R6,000 (since 40% of R20,000 = R8,000, but the R6,000 cap applies), one-semester bridge, under FIN-07.1, status "Needs approval"

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-25 — Funding pending with 2+ missed instalments triggers a holding arrangement (Rule 4)
As the Intervention Planner agent
I want a holding payment arrangement that suspends automatically if funding is later approved
So that a student isn't double-charged once their funding comes through

- Given a student's funding status is "NSFAS pending" and they have 2 or more missed instalments
- When the decision engine evaluates the case, and funding is subsequently approved
- Then a holding arrangement is recommended under FIN-04.2 with the hold suspended, and once funding is confirmed, the arrangement automatically falls away

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-26 — Funding pending with fewer than 2 missed instalments triggers an agent-acting funding chase (Rule 5)
As the Funding Broker agent
I want to chase a pending funding outcome automatically without officer approval
So that stalled NSFAS/bursary cases are followed up without adding to the officer's queue

- Given a student's funding status is "NSFAS pending" or "Bursary partial" and they have fewer than 2 missed instalments
- When the decision engine evaluates the case
- Then a funding chase action under FIN-05.4 executes automatically ("Agent acting"), with the registration hold suspended pending the funding outcome, and no approval request is created

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-27 — 2+ missed instalments (any funding status) triggers a standard payment arrangement (Rule 6)
As the Intervention Planner agent
I want a payment arrangement proposed whenever a student has 2 or more missed instalments and doesn't match a higher-priority rule
So that chronic non-payers get a structured recovery plan

- Given a student has 2+ missed instalments, is not in credit, has no prior default, and has no qualifying funding-pending/lapsed status
- When the decision engine evaluates the case
- Then a payment arrangement is recommended (instalment count per §3.5) under FIN-04.2, status "Needs approval"

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-28 — Exactly one missed instalment triggers an automatic reminder cadence (Rule 7)
As the Engagement Agent
I want a single missed instalment to trigger a low-friction reminder sequence without a hold
So that students get a nudge before any harsher action is considered

- Given a student has exactly 1 missed instalment and no higher-priority condition applies
- When the decision engine evaluates the case
- Then the Engagement Agent schedules SMS on day 1, WhatsApp on day 5, and an officer call on day 10, with no registration hold applied, status "Agent acting"

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-29 — No qualifying signal falls through to monitor-only (Rule 8)
As the Risk Sentinel agent
I want a student with a balance but no risk signal to simply be re-scored nightly
So that no unnecessary action is taken on a student who is current and not at risk

- Given a student has a balance but none of rules 1–7 match
- When the decision engine evaluates the case
- Then the action is "Monitor only; re-score nightly" under FIN-01.0, status "Agent acting", and the student is not added to the worklist

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-30 — Instalment count scales with outstanding balance
As the Intervention Planner agent
I want the number of instalments proposed to match the defined balance bands
So that arrangement terms stay proportionate and recoverable

- Given four students with outstanding balances of R4,000, R10,000, R25,000, and R35,000
- When a payment arrangement is proposed for each
- Then the instalment counts are 3, 4, 6, and 8 respectively, and each monthly instalment equals total balance ÷ instalment count

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-31 — Autonomy Level 1 (Observe) takes no action
As a debt manager
I want Level 1 to only score and report
So that I can pilot the risk model without any live action being taken

- Given the agent autonomy is set to Level 1 (Observe)
- When the nightly job runs and produces recommendations
- Then every case is scored and logged, but no action (reminder, hold, referral, refund) is executed or queued for approval

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-32 — Autonomy Level 3 auto-executes only low-risk reversible actions
As a debt manager
I want only reminder-cadence and funding-chase actions to run automatically at Level 3
So that higher-risk actions still get a human check even as autonomy increases

- Given autonomy is set to Level 3 (Act within policy)
- When the decision engine recommends a reminder cadence or funding chase
- Then the action executes automatically; when it recommends a registration hold, refund, or hardship referral, the case still requires human approval

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-33 — Registration holds and refunds always require approval regardless of autonomy level
As a compliance owner
I want registration holds and refunds to never auto-execute, at any autonomy level
So that the highest-impact, hardest-to-reverse actions always have a human decision-maker

- Given autonomy is set to Level 4 (Act and report), the highest level
- When the decision engine recommends a registration hold or a refund
- Then the case still shows status "Needs approval" and is not auto-executed, even though other actions at Level 4 run autonomously

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-34 — Funding-related actions always require approval regardless of autonomy level
As the Student Funding office
I want every funding-related action to require sign-off at any autonomy level
So that the funding-status weighting can never auto-penalise a student without human review

- Given autonomy is set to Level 4 and a case matches the hardship-referral or holding-arrangement rule (funding-related)
- When the decision engine produces its recommendation
- Then the action is queued as "Needs approval" rather than auto-executed, regardless of the autonomy level configured

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-50 — A debtor record missing a required field is flagged, not silently scored
As the Risk Sentinel agent
I want to flag a debtor record that's missing a minimum required field
So that incomplete data never produces a silently wrong risk score

- Given a debtor record is missing its funding status or last-payment date
- When the nightly extract and scoring job runs
- Then that record is excluded from scoring and surfaced on a data-quality/reconciliation-exceptions report, rather than being scored with a default or blank value

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-51 — Registered headcount is sourced from Student Records, not Debtors
As a finance executive
I want the "registered students" KPI to reflect actual registered headcount
So that coverage percentages (e.g. at-risk % of book) are calculated against the right denominator

- Given Student Records reports a registered headcount for the selected financial year
- When the Home dashboard computes the "registered students" KPI
- Then the figure matches the Student Records headcount for that year, not a count derived from the Debtors table alone

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-60 — Negative or zero balances never produce a negative risk score
As the Risk Sentinel agent
I want balance-based score components to floor at zero
So that a credit (negative) balance can't accidentally suppress or invert a risk score

- Given a student's "outstanding balance" field is zero or negative (i.e. in credit)
- When their score is computed
- Then they are routed to the refund path (Rule 1), not scored as a debtor with a negative contribution

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

---

## Section 3 — Case Workflow, Engagement & Operations

**Assigned to:** _______________________
**Prerequisites:** Backend and frontend running against the seeded database, signed in as both a standard
officer and the debt manager demo account (`Grace van Rooyen`) at different points. Independent of Section
2's API-level scoring checks; shares no state with Section 1 beyond needing a valid login.

### FTC-08 — Debt Management Tracker lists AI-flagged cases
As a student debt officer
I want to see the cases the agent has flagged overnight
So that I know which students need a human decision

- Given the nightly extract and risk-scoring job has run
- When I open the Debt Management Tracker tab
- Then I see a list of flagged cases, each showing risk score, risk band, proposed intervention, and a "Needs approval" status

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-09 — Approve an AI-recommended action
As a student debt officer
I want to approve the agent's recommended intervention
So that the proposed action is actioned without needing to redefine it myself

- Given I am viewing a case with a pending AI recommendation
- When I click "Approve"
- Then the case status updates to approved, the activity log records my decision, and the case is removed from the "needs approval" queue

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-10 — Amend terms before approving
As a student debt officer
I want to adjust the proposed arrangement terms before approving
So that the final terms match what was actually agreed with the student

- Given I am viewing a case with a proposed payment arrangement
- When I click "Amend terms", change the instalment amount or first debit date, and click "Save & approve"
- Then the case is approved with my edited terms, not the agent's original proposal, and this is reflected in the activity log

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-11 — Decline an AI-recommended action
As a student debt officer
I want to decline a recommendation I disagree with
So that no action is taken on the student's account without my approval

- Given I am viewing a case with a pending AI recommendation
- When I click "Decline"
- Then the case status updates to declined, no write-back to ITS Integrator occurs, and the decision is recorded in the activity log

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-15 — Debt manager retries an exhausted write-back
As a debt manager
I want to retry a write-back that failed all its automatic attempts
So that the record eventually syncs to ITS Integrator without manual re-entry

- Given I am signed in as a debt manager and the Write-back failures screen lists at least one exhausted entry
- When I click "Retry" on that entry
- Then the retry is sent immediately, the list refreshes, and on success the entry is removed with a confirmation message shown

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-35 — Credit held more than 90 days is flagged as an audit finding
As a compliance officer
I want any student credit balance outstanding for more than 90 days to be flagged automatically
So that unreleased credits are caught before they become a reportable audit finding

- Given a student has a credit balance that has been outstanding for 91+ days
- When I view the Age Analysis credit-ageing table
- Then that row is flagged as an audit finding

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-36 — Credit held past term end is flagged as a compliance finding
As a compliance officer
I want a credit still held after term end to be flagged distinctly
So that I can distinguish a routine ageing credit from one that has missed its natural release point

- Given a student credit balance is still unreleased after the term end date
- When I view the credit-ageing table
- Then that row is flagged as a compliance finding, independent of the 90-day audit-finding threshold

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-39 — Every agent action is written back to ITS Integrator with rationale and evidence
As the ITS Integrator platform
I want every agent recommendation and officer decision to write back with its rationale and evidence
So that the student's ITS Integrator record stays the single source of truth

- Given an officer approves, amends, or declines a recommended action
- When the decision is submitted
- Then a write-back is sent to ITS Integrator containing the action taken, its policy rationale, and the evidence the agent read, and this is reflected in the case's activity log

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-40 — Failed write-backs are retried and surfaced, never silently dropped
As a debt manager
I want a write-back that fails all automatic retries to be surfaced to me
So that no agent action or decision is ever silently lost

- Given a write-back to ITS Integrator fails on its first attempt
- When the system automatically retries up to the configured retry limit and still fails
- Then the entry appears on the Write-back failures screen with its attempt count and last error, rather than being dropped

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-44 — Credit balances appear in a separate refund queue, not the main worklist
As a student debt officer
I want refund cases kept separate from collections cases
So that I don't have to mentally filter refunds out of my collections worklist

- Given one or more students have a credit balance recommended for refund
- When I open the Debt Management Tracker
- Then those cases appear in a distinct "refund queue" section, separate from the risk-scored collections worklist

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-45 — Debtors paying on cycle appear in their own table, not the worklist
As a student debt officer
I want to see which debtors are current and not flagged
So that I have visibility of my full book, not just the problem cases

- Given a student has a balance but is not picked up (no missed instalments, no arrears, low funding risk)
- When I open the Debt Management Tracker
- Then that student appears in a separate "paying on cycle" table, not mixed into the picked-up worklist

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-46 — Send SMS logs the message on the case activity log
As a student debt officer
I want to send an SMS reminder from within a case
So that outreach is recorded against the student's record, not done off-system

- Given I am viewing a case with engagement channels available
- When I click "Send SMS"
- Then an SMS is dispatched via the SMS gateway and an entry is added to the case's activity log recording that it was sent, by whom, and when

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-47 — Send WhatsApp logs the message on the case activity log
As a student debt officer
I want to send a WhatsApp reminder from within a case
So that the full reminder cadence (SMS → WhatsApp → call) is auditable in one place

- Given I am viewing a case and the reminder cadence has reached day 5
- When I click "Send WhatsApp"
- Then a WhatsApp message is dispatched and logged on the case's activity log

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-48 — Log a call records a manual contact attempt
As a student debt officer
I want to record that I called a student
So that the case history shows every contact attempt, not just automated ones

- Given I am viewing a case
- When I click "Log a call" and enter the call outcome
- Then a call entry is added to the case's activity log with my name, timestamp, and the outcome I recorded

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-49 — Hand to Adapt Connect transfers a registration-hold case to collections
As the Assurance Agent
I want a registration-hold case to be handed to Adapt Connect
So that collections has what it needs without the officer re-keying the case

- Given a case has a recommended or approved registration-hold action
- When the officer approves and the case is handed to Adapt Connect
- Then the hand-over integration fires with the case's balance, ageing position, and decision rationale, and the case activity log records the hand-over

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-52 — First agent action occurs within 24 hours of a missed instalment
As a finance executive
I want the agent to act on a missed instalment within one nightly cycle
So that the "under 24 hours" success target is actually being met in production

- Given a student misses an instalment during the business day
- When the next nightly scoring run executes
- Then an agent action (recommendation or automatic reminder) exists for that case within 24 hours of the missed instalment, and this is measurable from the agent activity log timestamps

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-53 — Identified credit balances are refunded within 5 working days
As a compliance officer
I want an approved refund to be processed within the target SLA
So that the 190+ day refund delays in the current book don't recur

- Given a refund has been approved by an officer
- When I check the write-back/activity log after approval
- Then the refund write-back to Cashiering is recorded within 5 working days of approval, and any case exceeding this is flagged for follow-up

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-54 — Daily case-load cap prevents officer overload
As a debt manager
I want each officer's daily worklist capped at a manageable size
So that the nightly job never outpaces an officer's capacity to action cases

- Given the nightly scoring run picks up more cases than an officer's configured daily cap
- When the worklist is assigned
- Then only up to the cap is assigned to that officer for the day, and the excess rolls over or is redistributed rather than overwhelming one officer's queue

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-55 — Nightly reconciliation-exceptions report surfaces data-quality issues
As a debt manager
I want a report of records the nightly job couldn't reconcile or score correctly
So that data-quality problems are caught systematically, not discovered by accident

- Given the nightly extract encounters records with inconsistent or conflicting ageing/funding data across source modules
- When the nightly job completes
- Then those records appear on a reconciliation-exceptions report, distinct from the normal risk-scored worklist

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-61 — Concurrent approval of the same case is prevented
As the system
I want to prevent two officers from approving the same case simultaneously
So that a case is never double-actioned or written back twice to ITS Integrator

- Given two officers with access to the same case (e.g. team scope) both open it
- When both submit an "Approve" decision within moments of each other
- Then only the first decision is accepted; the second officer receives a conflict message indicating the case was already actioned

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

### FTC-64 — Nightly scoring job completes within its available window for the full book
As the platform/IT team
I want the nightly extract-and-score job to finish before officers start their day
So that every officer sees a fresh worklist at the start of business, not a stale one

- Given the full current debtor book size (confirmed during the integration spike)
- When the nightly job runs end-to-end (extract, score, classify, decision engine)
- Then it completes within the confirmed available completion window, with a job-run-log entry recording start time, end time, and records processed

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |

---

## Traceability

| Area | Business case reference |
|---|---|
| Risk scoring model | §3.3 |
| Decision engine | §3.4 |
| Instalment plan sizing | §3.5 |
| Autonomy levels | §3.6 |
| Functional modules (Home, Tracker, Case Management, Age Analysis) | §3.7 |
| Data model | §3.8 |
| Integration points | §3.9 |
| Measures of success | §7 |
| Risk and mitigation | §6 |

Test cases without a business-case reference (Section 1's security/concurrency/performance/CSV-formatting
cases, and FTC-61–65 in Section 3) are standard due-diligence checks for a system of this kind and are not
drawn from a specific section of the business case.
