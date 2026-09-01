# Technical Specification
## Student Pro-active Debt Management Tracker

**Source of truth for this spec:** the working HTML prototype at
`student-proactive-debt-management-tracker (1).html` in this folder. Every business
rule, threshold, and label below is reproduced exactly from that prototype's code so a
developer can build against this document without re-reading the prototype's JavaScript.

**Companion document:** `Student-Debt-Tracker-Business-Case.docx` (why this is being
built, value, risk, success metrics). This spec covers *how* it is built.

**Status:** Draft for development kickoff. Items marked `[TO CONFIRM]` require a real
answer from ITS Integrator platform owners or Finance before build starts.

---

## 1. Purpose and Scope

Build a module inside ITS Integrator that:

1. Scores every registered student's debt risk, nightly, from existing ITS Integrator
   data — no new data entry.
2. Surfaces the students who need a human decision, ranked by risk.
3. Drafts a recommended action for each, with rationale, evidence, and a policy citation.
4. Lets a debt officer approve, amend, or decline every action (at launch autonomy).
5. Tracks credit balances owed *back* to students and flags stale ones as an audit risk.
6. Writes every agent decision and every officer decision back to the student's ITS
   record, so the trail is auditable.

Out of scope for this phase: actually executing collections (hand-off to Adapt Connect
is a hand-off, not an integration to build); actually disbursing NSFAS/bursary funds;
building a new SIS/finance ledger (this module reads and annotates existing ledgers, it
does not replace them).

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  ITS Integrator (existing)                                          │
│  ┌───────────┐ ┌──────────────┐ ┌────────────────┐ ┌──────────────┐ │
│  │ Debtors   │ │ Student Fees │ │ Student Funding │ │ Student      │ │
│  │           │ │              │ │ (NSFAS/Bursary) │ │ Records      │ │
│  └─────┬─────┘ └──────┬───────┘ └────────┬────────┘ └──────┬───────┘ │
│        │              │                  │                 │        │
│  ┌─────┴──────────────┴──────────────────┴─────────────────┴─────┐  │
│  │ Cashiering (payment reconciliation)                            │  │
│  └────────────────────────────────┬────────────────────────────────┘  │
└───────────────────────────────────┼──────────────────────────────────┘
                                    │  nightly extract (read-only)
                                    ▼
                    ┌───────────────────────────────┐
                    │  Debt Tracker Service (new)     │
                    │  ─────────────────────────────  │
                    │  1. Nightly Scoring Job         │
                    │  2. Decision Engine              │
                    │  3. Case Store                   │
                    │  4. Notification Dispatcher      │
                    │     (SMS / WhatsApp)              │
                    └───────────────┬───────────────┘
                                    │  write-back (action + evidence)
                                    ▼
                    ┌───────────────────────────────┐
                    │  ITS Integrator student record  │
                    │  (activity log entry per action)│
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Debt Tracker Web App (new)     │
                    │  4 workspaces — see Section 6    │
                    │  consumed by Student Debt Officer │
                    └───────────────────────────────┘
                                    │  collections hand-off
                                    ▼
                            ┌───────────────┐
                            │ Adapt Connect │
                            └───────────────┘
```

**Components to build:**

| Component | Responsibility |
|---|---|
| Nightly Scoring Job | Pull the day's data from the four sources, compute `riskScore`, `band`, and `pickedUp` for every debtor (Section 4). |
| Decision Engine | Given a scored debtor, evaluate the 8-rule decision tree (Section 5) and produce one recommendation. |
| Case Store | Persist one case per picked-up/credit debtor: score, recommendation, evidence, status, activity log. |
| Notification Dispatcher | Executes the Engagement Agent's SMS/WhatsApp cadence when autonomy permits (Section 5.7, rule 7). |
| Web App | The 4 workspaces (Home, Tracker, Case Management, Age Analysis) — Section 6. |
| Write-back Adapter | Pushes every agent/officer action and its rationale into the ITS Integrator student activity log. |

`[TO CONFIRM]` Whether the Debt Tracker Service runs as a new microservice alongside
ITS Integrator, or as a module inside the existing ITS Integrator codebase — depends on
ITS Integrator's extensibility model and should be settled with the platform team before
build.

---

## 3. Data Model

### 3.1 `Debtor` (one row per student per financial year)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Student ID, e.g. `STU-100234` |
| `name` | string | |
| `year` | integer | Financial year this record belongs to |
| `programme` | string | Full qualification name |
| `funding` | enum | `self` \| `gov` \| `private` |
| `fundStatus` | string | Free-text status read from Student Funding — see Section 3.3 for the known set and their risk weights |
| `missed` | integer | Count of instalments flagged unpaid |
| `lastPay` | date \| null | Date of last receipt; `null` = no payment on record |
| `arrangement` | string \| null | e.g. `"Defaulted"`, or `null` if no prior arrangement |
| `ageing` | object | `{ current, d30, d60, d90, d120 }` — amounts in ZAR per bucket. **Negative values mean the institution owes the student** (a credit) |
| `creditSince` | date \| null | Only set when the account is in credit — date the credit arose |
| `creditDays` | integer \| null | Only set when in credit — days the credit has been owing |
| `creditReason` | string \| null | Only set when in credit — free text, e.g. "Duplicate EFT receipted twice" |

### 3.2 Derived fields (computed, not stored — recompute on read or cache per scoring run)

| Field | Formula |
|---|---|
| `rowTotal` | sum of all 5 ageing buckets (can be negative → credit) |
| `rowDebt` | sum of only the *positive* amounts across the 5 buckets (never negative) |
| `arrears` | sum of positive `d30 + d60 + d90 + d120` (excludes `current`) |
| `over90` | sum of positive `d90 + d120` |
| `owedToStudent` | `true` if `rowTotal < 0` |
| `oldestBucket` | the oldest ageing bucket (walking `d120 → current`) that holds a positive amount |

### 3.3 Funding status → risk weight table

This is the exact lookup used by the risk score (Section 4) and the decision engine
(Section 5). Any `fundStatus` string not in this table contributes `0`.

| `fundStatus` | Risk weight |
|---|---|
| `NSFAS declined` | 16 |
| `NSFAS lapsed` | 15 |
| `Bursary lapsed` | 14 |
| `NSFAS pending` | 12 |
| `Bursary partial` | 8 |
| `Self-funded` | 4 |
| `Bursary confirmed` | 0 |
| `Bursary overpaid` | 0 |

`[TO CONFIRM]` Confirm this is the complete set of funding-status values Student Funding
actually produces; the decision engine (Section 5) also pattern-matches on the words
"pending", "lapsed", and "declined" appearing anywhere in the string, so any new status
introduced later must be reviewed against those three regex checks, not just added to
this table.

### 3.4 `RegisteredCount`

One row per financial year: `{ year, registeredCount }` — sourced from Student Records,
used only to compute the "registered students" KPI and its "% of book" context. Not
joined to individual debtors.

### 3.5 `Case` (persisted; one per picked-up debtor or credit debtor, per scoring run)

| Field | Type | Notes |
|---|---|---|
| `debtorId`, `year` | | composite key back to `Debtor` |
| `score` | integer 1–99 | 0 if no debt |
| `band` | enum | `Watch` \| `Elevated` \| `High` \| `Credit` |
| `signals` | array | Human-readable flags shown on the case, e.g. "3 missed instalments" — see Section 4.4 |
| `recommendation` | object | `{ type, action, status, rationale, terms[] }` — see Section 5 |
| `evidence` | array of strings | e.g. `"Ageing · 120+ days"`, `"Funding · NSFAS pending"` — see Section 4.5 |
| `activity` | array of `{ text, source }` | Append-only log — see Section 4.6 |
| `decision` | enum | `Pending` \| `Approved` \| `Amended` \| `Declined` — officer's decision on the current recommendation |
| `decidedBy`, `decidedAt` | | Audit fields |

---

## 4. Risk Scoring Engine

Run once per debtor, per nightly scoring cycle. Pure function of the `Debtor` record —
no per-student hardcoding.

### 4.1 Score formula

```
score = 0
if rowDebt(d) <= 0: return 0                      // nothing owed → always 0

if ageing.d120 > 0: score += 18 + min(12, ageing.d120 / 4000)
if ageing.d90  > 0: score += 14
if ageing.d60  > 0: score += 8
if ageing.d30  > 0: score += 5

score += min(22, missed * 7)                       // missed instalments, capped
score += fundingRiskWeight(fundStatus)             // Section 3.3, 0 if not found
if arrangement == "Defaulted": score += 10
if lastPay is null: score += 8

score = max(1, min(99, round(score)))              // clamp, but only if rowDebt > 0
```

### 4.2 Risk bands

| Band | Score |
|---|---|
| Watch | < 45 |
| Elevated | 45–69 |
| High | ≥ 70 |

A debtor in credit (`owedToStudent == true`) is never scored or banded by this
function — it is handled entirely as a `Refund` case (Section 5, rule 1).

### 4.3 Pick-up rule

A debtor is **picked up** (shown to a human) only if:

```
rowDebt(d) > 0
AND ( missed > 0
      OR arrears(d) > 0
      OR fundingRiskWeight(fundStatus) >= 8 )
```

Debtors with `rowDebt > 0` who fail this test are "paying on cycle" — shown in a
separate, non-actioned list (Section 6.2).

### 4.4 Signals (chips shown on a case/row)

Generate in this order, skip any that don't apply:

1. `"{missed} missed instalment(s)"` if `missed > 0` — flagged **hot**
2. `"No payment on record"` if `lastPay` is null — flagged **hot**; otherwise `"Last paid {lastPay}"` — not hot
3. `"120+ days {amount}"` if `d120 > 0` — **hot**; else `"90 days {amount}"` if `d90 > 0` — **hot**; else `"In arrears {amount}"` if any arrears > 0 — not hot
4. `"{fundStatus}"` if its risk weight ≥ 8 — not hot
5. `"Arrangement defaulted"` if `arrangement == "Defaulted"` — **hot**

"Hot" signals should render with a distinct (red-tinted) style; the prototype uses
`.sig.hot`.

### 4.5 Evidence (shown as read-only chips on the case detail, distinct from signals)

1. `"Ageing · {oldest non-zero bucket label}"` (or `"Ageing · Current"` if nothing is overdue)
2. `"Payment history {year-1}–{year}"`
3. `"Funding · {fundStatus}"`
4. `"Arrangement · {arrangement}"` — only if an arrangement exists

### 4.6 Activity log (auto-generated on every scoring run, append-only)

1. `"Risk scored {score} and banded {band}"` — source: *Risk Sentinel · overnight run*
2. `"Funding status read as {fundStatus}"` — source: *Funding Broker · Student Funding*
3. `"{missed} instalment(s) flagged unpaid"` — source: *Assurance Agent · Debtors* — only if `missed > 0`
4. `"Last receipt {lastPay} confirmed"` or `"No receipt found on the account"` — source: *Cashiering reconciliation*
5. `"Prior arrangement {arrangement, lowercased}"` — source: *Assurance Agent* — only if an arrangement exists

---

## 5. Decision Engine

Evaluate rules **in this exact order**; the first match wins. Every recommendation
carries a `type`, an `action` label, a `status`, a human-readable `rationale`, and a
`terms` list of key/value pairs. Each `type` maps to one **agent owner** and one
**policy clause** (Section 5.8) — these two mappings are fixed and do not vary by rule.

### Rule 1 — Refund
**Condition:** `owedToStudent(d)` (account is in credit)
**Status:** `Needs approval`
**Action:** `"Refund {credit amount} to the student"`
**Rationale template:** cites the funding status that produced the credit, states that
holding a student credit past term end is a compliance finding, and that the release has
been prepared because banking details are verified.
**Terms:** `Refund` = credit amount, `Method` = "EFT, verified account", `Turnaround` =
"5 working days"

### Rule 2 — Registration hold + hand-over
**Condition:** `arrangement == "Defaulted"` AND `lastPay is null`
**Status:** `Needs approval`
**Action:** `"Registration hold and hand-over"`
**Rationale:** prior arrangement defaulted, no payment on record, funding status also
cited; states every agent channel has been tried without engagement.
**Terms:** `Hold` = "Registration", `Hand-over` = "Adapt Connect", `Review` = "On first contact"

### Rule 3 — Hardship fund referral
**Condition:** `fundStatus` matches `/lapsed|declined/i`
**Status:** `Needs approval`
**Action:** `"Hardship fund referral and sponsor follow-up"`
**Rationale:** funding removed cover the student had budgeted against; frames the
shortfall as not the student's conduct.
**Terms:** `Award sought` = `min(rowDebt * 0.4, 6000)`, `Bridge` = "One semester",
`Re-test` = "Next funding window"

### Rule 4 — Holding payment arrangement
**Condition:** `fundStatus` matches `/pending/i` AND `missed >= 2`
**Status:** `Needs approval`
**Action:** `"Holding arrangement, {n} instalments"` (n from Section 5.9)
**Rationale:** balance can't be settled in one payment while NSFAS is unresolved.
**Terms:** `Instalments` = `n × (rowDebt / n)`, `Hold on registration` = "Suspended",
`Falls away if` = "NSFAS approves"

### Rule 5 — Funding chase
**Condition:** `fundStatus` matches `/pending/i` (and rule 4 did not already match, i.e. `missed < 2`)
**Status:** `Agent acting` (no approval needed — see autonomy note below)
**Action:** `"Chase funding verification, suspend hold"`
**Rationale:** chasing outstanding documents is cheaper than collections.
**Terms:** `Outstanding` = "Supporting documents", `Reminders` = "SMS and WhatsApp",
`Hold` = "Suspended pending outcome"

### Rule 6 — Payment arrangement
**Condition:** `missed >= 2` (any funding status, having fallen through rules 1–5)
**Status:** `Needs approval`
**Action:** `"Payment arrangement, {n} instalments"`
**Rationale:** cites the student's prior payment history (last receipt date) as
justification for an arrangement over a registration hold, referencing that holds
historically convert to withdrawal in 41% of comparable cases.
**Terms:** `Instalments` = `n × (rowDebt / n)`, `First debit` = "22nd of next month",
`Hold on registration` = "Suspended"

### Rule 7 — Reminder cadence
**Condition:** `missed == 1`
**Status:** `Agent acting`
**Action:** `"Reminder cadence, no hold"`
**Rationale:** a three-step cadence resolves this pattern without a human in 8 of 10
comparable cases.
**Terms:** `Step 1` = "SMS, day 1", `Step 2` = "WhatsApp, day 5", `Step 3` = "Officer
call, day 10"

### Rule 8 — Monitor only (fallback)
**Condition:** none of the above match (i.e. `missed == 0` and nothing else triggered pick-up on funding risk alone would already have failed the pick-up test in Section 4.3 — this rule is reached only for debtors *not* picked up, or as the default state)
**Status:** `Monitoring`
**Action:** `"Monitor only"`
**Terms:** `Action` = "None required", `Re-score` = "Nightly"

### 5.8 Agent and policy mapping (fixed, does not vary by case)

| Recommendation type | Agent | Policy clause |
|---|---|---|
| Monitor | Risk Sentinel | FIN-01.0 |
| Reminder cadence | Engagement Agent | FIN-03.1 |
| Payment arrangement | Intervention Planner | FIN-04.2 |
| Funding chase | Funding Broker | FIN-05.4 |
| Hardship fund | Funding Broker | FIN-07.1 |
| Registration hold | Assurance Agent | FIN-09.3 |
| Refund | Assurance Agent | FIN-02.6 |

### 5.9 Instalment count

```
n = debt <= 5000  ? 3
  : debt <= 15000 ? 4
  : debt <= 30000 ? 6
  : 8
monthlyInstalment = debt / n
```

### 5.10 Autonomy gating (applies on top of the rules above)

The decision engine always computes a recommendation and a `status` of either `Needs
approval` or `Agent acting`. What the **system is allowed to do automatically** with
that status depends on the configured autonomy level:

| Level | Behaviour |
|---|---|
| 1 · Observe | Score and report only — no action executes, even ones marked `Agent acting` |
| 2 · Recommend (**default/launch**) | Every action, including `Agent acting` ones, is queued for officer approval |
| 3 · Act within policy | Actions already marked `Agent acting` by the rules above (Rules 5, 7, 8) execute automatically; everything marked `Needs approval` (Rules 1, 2, 3, 4, 6) still requires a human |
| 4 · Act and report | Full workflow, including `Needs approval` actions, executes automatically and is surfaced for post-hoc review |

**Hard rule, non-negotiable at any autonomy level:** Registration hold (Rule 2) and
Refund (Rule 1) must always require explicit human approval. Do not let Level 4
auto-execute these two regardless of what the generic table above implies — this is a
deliberate override of the generic autonomy behaviour, driven by the risk register in
the business case (compliance and reputational risk of an unattended hold or refund).

---

## 6. Functional Modules (UI)

Global chrome, present on every workspace:

- **Brand bar:** product name, subtitle "ITS Integrator · Debtors and Student Funding",
  an "agent active" status chip, an autonomy-level selector (Section 5.10, four options
  with their hint text), and the signed-in officer's name/role.
- **Tab bar:** Home, Debt Management Tracker (badge = count of picked-up students),
  Case Management & AI Recommendation (badge = count of cases with status `Needs
  approval`), Age Analysis (no badge).
- **Global filters**, present on every tab and driving the same shared state:
  - **Financial year** — one option per year on record, newest first, plus an "All
    years" option; the option matching the current calendar year is labelled "(current)".
  - **Funding source** — All / Self-funded / Government (NSFAS) / Private-Bursary.
  - **Export CSV** button — see Section 6.5.
- Changing either filter resets any open case selection and re-renders the active tab.
- **Default year on load:** the current calendar year if it exists in the data,
  otherwise the latest year on record.

### 6.1 Home

- Hero banner with a one-paragraph product description and two CTAs: "Open the Debt
  Management Tracker" and "Go to case management".
- **Debt summary** — 5 KPI cards (reused verbatim on the Tracker tab too):
  1. Registered students — from `RegisteredCount`, summed across years if "All years"
     is selected.
  2. Total debt owed to institution — sum of `rowTotal` over all debtors with a
     positive total, in the current filter scope.
  3. Owed to students (credits) — absolute sum of `rowTotal` over debtors in credit.
  4. At risk (90+ days) — sum of `over90` across the scope, plus that as a % of total
     debt.
  5. Average balance per debtor — total debt ÷ count of debtors with positive balance.
- **Debt-by-year chart** — stacked bar, one bar per financial year, segments coloured
  by funding source; the currently selected year is highlighted.
- **Funding-mix donut** — for the current scope, one ring per funding source with
  amount and percentage.
- **Pickup callout** — "The agent has picked up {n} students for a human today" with a
  link into the Tracker.
- **Workspace launcher cards** — one per non-Home tab, with its one-line description.

### 6.2 Debt Management Tracker

- Reuses the debt summary KPI block from Home, filtered to the current scope.
- **Picked-up list** (Section 4.3), sorted by risk score descending. Each row shows:
  avatar-less risk badge (score + band, or a credit icon), student name/ID/programme,
  funding pill, signal chips, the recommended action with its owning agent name, the
  amount, the status pill, and a "click to open case" affordance.
- **Refund queue** — a second list, same row layout, for credit-balance debtors sorted
  by amount owed (smallest credit first is the prototype's default — confirm this is
  intentional or should be largest-first `[TO CONFIRM]`).
- **Not picked up table** — debtors with `rowDebt > 0` who failed the pick-up test:
  name, funding, funding status, last payment, current balance. Read-only, no case
  link.

### 6.3 Case Management & AI Recommendation

Two-pane layout: a sticky, scrollable case list on the left (all picked-up + credit
cases, same scope as the Tracker), and the selected case's detail on the right.
Selecting a case from anywhere (Tracker row, Home pickup link) opens this tab with that
case pre-selected; default selection is the first case in the list.

Case detail contains:

- **Header:** score/band badge, student name, ID + programme, funding pill, signal
  chips, amount (owed-to-institution or owed-to-student, styled differently), and the
  policy clause.
- **AI recommendation panel:** owning agent name, status pill, the `action` headline,
  the `rationale` paragraph, a `terms` key/value block, and the `evidence` chips
  (Section 4.5). Actions: **Approve**, **Amend terms**, **Decline** — these write the
  officer's `decision` back to the case (Section 3.5) and must be logged as an activity
  entry.
- **Ageing position panel:** a bar per ageing bucket (Current → 120+) scaled to the
  largest bucket on this case, plus the total.
- **Agent activity panel:** the `activity` log (Section 4.6), newest first, each entry
  with its text and source.
- **Engagement channels panel:** buttons for Send SMS, Send WhatsApp, Log a call, Hand
  to Adapt Connect — availability of each should be gated by the current autonomy level
  and the case's recommendation type `[TO CONFIRM exact gating rules with the Engagement
  Agent's owner — the prototype renders all four unconditionally]`.

### 6.4 Age Analysis

- **Ageing bar chart** — one horizontal bar per bucket (Current…120+), summed across
  the current filter scope.
- **Funding source × ageing bucket matrix** — rows = 3 funding sources, columns = 5
  buckets + total + % share of grand total, plus a totals row.
- **Student ageing detail table** — every debtor with `rowDebt > 0`, one column per
  bucket, sorted by oldest-money-first (120-day desc, then 90-day desc, then total desc),
  plus their "oldest arrear" band as a pill. Shows a Year column when scope is "All
  years".
- **Credit ageing table** — every debtor in credit: funding, reason the credit arose,
  credit-since date, days owing, ageing band (reusing the same 5-bucket bands, applied
  to *days owing* — see `daysBand` below), and amount owed to the student. Sorted by
  days owing, descending.
  - **Stale-credit banner:** if any credit has been owing more than 90 days, render a
    warning banner citing the total stale amount, count of students affected, and the
    single oldest case by name and days — labelled as an audit finding.
  - `daysBand(days)`: `> 120 → "120+ days"`, `> 90 → "90 days"`, `> 60 → "60 days"`,
    `> 30 → "30 days"`, else `"Current"`. (Same 5 bands and colours as the debt ageing
    buckets, reused for a different measure — days, not Rand.)

### 6.5 CSV Export

Exports the **currently filtered scope** (respecting year + funding filters), one row
per debtor, columns in this exact order:

```
Student ID, Name, Programme, Funding, Funding status, Year, Missed instalments,
Last payment, Current, 30 days, 60 days, 90 days, 120+ days, Balance, Risk score,
Band, Picked up by agent, AI recommendation, Status, Policy
```

`Band` is the literal string `"Credit"` for debtors in credit, not their score band.
`Balance` is `rowTotal` (can be negative). File name pattern:
`student-debt-tracker-{year}-{funding}.csv`.

---

## 7. Non-Functional Requirements

- **Security / access control:** an officer must only see debtors in their assigned
  portfolio `[TO CONFIRM scope — campus? programme? caseload assignment?]`. Every read
  of a student's financial detail and every action taken must be attributable to a
  logged-in user.
- **POPIA:** this module processes special personal information (identifiable
  students' financial position and funding status). A POPIA impact assessment is a
  prerequisite to go-live (see business case, Section 6). Data retention period for
  case history `[TO CONFIRM]`.
- **Auditability:** the `activity` log (Section 4.6) and the officer `decision` fields
  (Section 3.5) must be immutable and permanently retained — this *is* the audit trail
  referenced throughout the business case.
- **Performance:** the nightly scoring job must complete before officers start their
  working day `[TO CONFIRM target window and current debtor-book size to size this]`.
  The web app's list views must remain responsive against the full multi-year book (the
  reference data spans 2022–2026); paginate or virtualise the Age Analysis detail table
  if the production book is materially larger than the ~25-row prototype dataset.
- **Currency/locale:** all monetary values in ZAR, formatted `en-ZA` (e.g. `R 12,000`).
- **Responsiveness:** the prototype defines breakpoints at 1500px, 1240px, 1040px,
  900px, and 820px that progressively collapse the KPI grid, two-column layouts, and
  chrome to single-column/stacked layouts. Match this behaviour or replace it with the
  organisation's standard responsive breakpoints if one exists.
- **Browser support** `[TO CONFIRM against Adapt IT's standard support matrix]`.

---

## 8. Suggested Tech Stack

`[TO CONFIRM against ITS Integrator's existing stack — the below assumes no existing
constraint and should be reconciled with the platform team before build.]`

- **Web app:** any component framework consistent with ITS Integrator's existing
  front-end (the prototype is framework-agnostic vanilla JS/HTML/CSS and can be treated
  as a design/behaviour reference, not a code base to extend).
- **Debt Tracker Service:** a scheduled job (nightly) plus a query API the web app
  calls — language/runtime should match ITS Integrator's existing service stack for
  operability.
- **Notification dispatch:** integrate with Adapt IT's existing SMS/WhatsApp gateway,
  if one exists, rather than procuring a new one `[TO CONFIRM]`.

---

## 9. Glossary

| Term | Meaning |
|---|---|
| Picked up | A debtor surfaced to a human because they owe money and show a risk signal (Section 4.3) |
| Ageing bucket | One of Current / 30 / 60 / 90 / 120+ days outstanding |
| Band | Watch / Elevated / High risk classification, or "Credit" for a refund case |
| Autonomy level | How much the system may act without a human — 1 (Observe) to 4 (Act and report) |
| Agent | One of five named roles the recommendation engine attributes an action to: Risk Sentinel, Engagement Agent, Intervention Planner, Funding Broker, Assurance Agent |
| Policy clause | The finance policy reference (e.g. `FIN-04.2`) an action is taken under |
| Stale credit | A refund owed to a student for more than 90 days — an audit finding |

---

## 10. Open Items Before Build (`[TO CONFIRM]` roll-up)

1. Exact API/endpoint availability on Debtors, Student Fees, Student Funding, Student
   Records, Cashiering (Section 2) — needs an integration spike.
2. Where the Debt Tracker Service physically runs relative to ITS Integrator (Section 2).
3. Complete set of `fundStatus` values Student Funding can produce (Section 3.3).
4. Refund-queue sort order intent (Section 6.2).
5. Engagement-channel button gating rules by autonomy level (Section 6.3).
6. Officer portfolio/access scoping model (Section 7).
7. Data retention period for case history (Section 7).
8. Nightly job completion window and current debtor-book size (Section 7).
9. Browser support matrix (Section 7).
10. Tech stack alignment with existing ITS Integrator services (Section 8).
11. Existing SMS/WhatsApp gateway to integrate with, if any (Section 8).
