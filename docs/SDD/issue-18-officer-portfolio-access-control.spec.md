# Spec: Scope officer portfolio access control

**Ticket:** [#18](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/18)
**Branch base:** `develop` (branch: `feat/officer-portfolio-access-control`)
**Spec reference:** TECHNICAL_SPECIFICATION.md §7 (Security / access control), open item 6;
`docs/compliance/popia-impact-assessment.md` §5

## Overview / Goals

Any officer can currently view and act on any debtor — there is no portfolio scoping
at all. The POPIA impact assessment (#19) was updated 2026-09-09 with a
BA-confirmed (DembeMakhari98) hybrid tiered access model, settled and not
re-litigated here:

| Level | Scope | Approval |
|---|---|---|
| 1 (narrow, default) | Officer sees only their own caseload | None |
| 2 (medium) | Same-team officers can view peer cases (vacation/absence coverage) | None |
| 3 (broad, override) | Debt manager escalates to full portfolio view | Manager-only; logged |

Never permitted: campus-wide, programme-wide, or finance-officer-sees-all access.
Caseload assignment already matches real operations (3 debt recovery teams,
individually-assigned cases, a supervisor needing the Level 3 view for performance
monitoring).

**What this ticket actually builds:** there is currently no multi-officer concept in
this app at all — `CURRENT_OFFICER` (`frontend/src/app/core/constants.ts:79`) is a
single hardcoded string used everywhere as "the signed-in officer," and `Debtor`
(`models.ts:16`) has no assigned-officer field. Per user decision, this ticket adds a
real multi-officer identity (a switcher, not just a hardcoded name) and a caseload
field, so portfolio scoping is genuinely demoable in the running app, not just
asserted in unit tests.

## Non-Goals

- **No backend mirror.** Per user decision, this is frontend-only — matches #18's
  literal acceptance criterion wording ("implemented in the case list/detail views")
  and this app's established no-integration pattern (frontend is the demoed,
  authoritative side; the backend has no caller for this either).
- **No real authentication.** The officer switcher is a UI convenience for
  demonstrating/testing scoping, not a login system — same spirit as the existing
  autonomy-level selector, which anyone can change freely.
- **No request/approval workflow for Level 3.** "Requires manager approval" is
  implemented as: only officers with the `manager` role can select the Level 3 view
  themselves (they *are* the approval authority, per the BA's org model) — not a
  separate request-then-grant flow between two people. Building that would be new
  scope well beyond what #18's acceptance criteria ask for.
- **Home and Age Analysis tabs are NOT scoped by this ticket.** They're
  institution-wide aggregate/KPI views (registered headcount, total debt, funding
  mix), not per-student case work — #18's acceptance criteria are specifically about
  "view and act on debtors" (case-level access), which maps to the Tracker (#11) and
  Cases (#12) views only. Scoping the aggregate dashboards is a judgment call outside
  this ticket's literal scope; flagged here rather than silently expanded into.
- **No change to the decision engine, autonomy gating (#8), or officer-decision flow
  (#13)** — this ticket only gates *which debtors an officer's queries return*, not
  what they can do once a case is in view.

## Acceptance Criteria (from the ticket, mapped to implementation)

- [x] **Portfolio scoping model agreed with Finance/Debtors management** — already
      satisfied by the BA's 2026-09-09 answer (see Overview); no further action here.
- [x] **An officer can only view and act on debtors within their assigned
      portfolio** — implemented via a pure `inPortfolio(d, officer, scope)` filter
      applied to `pickedRows()`/`refundRows()`/`payingRows()` (feeds Tracker, Cases,
      and CSV export — the last of which needed a Stage 6 fix, see below), gated on
      the selected officer and portfolio-scope level.
- [x] **Every read of a student's financial detail is attributable to a logged-in
      user** — `setCase()` (the single method both Tracker and Cases route through to
      open a case) logs an access entry naming the current officer.
- [x] **Model documented in the technical spec and implemented in the case
      list/detail views (#11, #12)** — TECHNICAL_SPECIFICATION.md §7's
      `[TO CONFIRM scope — campus? programme? caseload assignment?]` placeholder
      replaced with the confirmed tiered model; implementation in `DebtService`,
      consumed by `tracker.component.ts` and `cases.component.ts`.

## Technical Design

### Data model additions

**`frontend/src/app/core/models.ts`:**
```ts
export type OfficerRole = 'officer' | 'manager';

export interface Officer {
  id: string;
  name: string;
  team: string;       // one of 3 debt-recovery teams
  role: OfficerRole;
}
```
`Debtor` gains one new field: `assignedOfficer: string` (an `Officer.id`).

**`frontend/src/app/core/mock-data.ts`:** each of the 25 existing debtors gets an
`assignedOfficer` value, distributed across 3 teams so Level 2 (team coverage) has
real cross-officer, same-team examples to demo/test, and at least one debtor per
officer so Level 1 has something to show.

**New `frontend/src/app/core/officers.ts`:**
```ts
export const OFFICERS: Officer[] = [
  { id: 'nomsa-mahlangu', name: 'Nomsa Mahlangu', team: 'Team A', role: 'officer' },
  { id: 'sibusiso-khoza', name: 'Sibusiso Khoza', team: 'Team A', role: 'officer' },
  { id: 'anele-dube', name: 'Anele Dube', team: 'Team B', role: 'officer' },
  { id: 'priya-naidoo', name: 'Priya Naidoo', team: 'Team B', role: 'officer' },
  { id: 'thato-mokoena', name: 'Thato Mokoena', team: 'Team C', role: 'officer' },
  { id: 'grace-van-rooyen', name: 'Grace van Rooyen', team: 'Team C', role: 'manager' },
];
```
`CURRENT_OFFICER` (the plain-string constant) stays as-is for existing `decidedBy`
call sites' default value, but the app's *displayed* signed-in identity moves to the
new officer signal — `nomsa-mahlangu` is the default so `CURRENT_OFFICER`'s string
value (`'Nomsa Mahlangu'`) and the default officer's name match, avoiding any visible
inconsistency.

### DebtService additions

```ts
readonly currentOfficerId = signal<string>('nomsa-mahlangu');
readonly portfolioScope = signal<'own' | 'team' | 'all'>('own');

readonly currentOfficer = computed<Officer>(() =>
  OFFICERS.find((o) => o.id === this.currentOfficerId())!,
);

setCurrentOfficer(id: string): void {
  this.currentOfficerId.set(id);
  this.portfolioScope.set('own'); // switching officer resets scope — no carried-over broad view
}

/** Manager-only; the widest scope requires the manager role, per the BA's model. */
setPortfolioScope(scope: 'own' | 'team' | 'all'): void {
  if (scope === 'all' && this.currentOfficer().role !== 'manager') return;
  this.portfolioScope.set(scope);
  if (scope === 'all') {
    this.logAccessEvent(`Portfolio view escalated to Level 3 (all) by ${this.currentOfficer().name}`);
  }
}

/** Pure — safe to call from a computed(). */
inPortfolio(d: Debtor, officer: Officer, scope: 'own' | 'team' | 'all'): boolean {
  if (scope === 'all') return true;
  if (scope === 'team') return this.officerOf(d.assignedOfficer)?.team === officer.team;
  return d.assignedOfficer === officer.id;
}
```

`pickedRows()` and `refundRows()` (the two computeds that feed `caseRows()`, which
Tracker's and Cases' lists both consume) add `.filter((d) => this.inPortfolio(d,
this.currentOfficer(), this.portfolioScope()))` alongside their existing filters.

### Access logging (AC #2)

`setCase(id: string)` — currently just `this.caseId.set(id)` — gains a call to a new
`logAccessEvent()` (mirroring the existing `logEngagementAction()` pattern, appended
to each debtor's activity feed) whenever the id changes to a *different* case,
recording `"Case detail viewed by ${officer.name} (${officer.team})"`. Re-selecting
the already-open case does not re-log (avoids noise from UI re-renders).

### UI

**`app.component.html`:** the hardcoded avatar/name block (`NM` / `Nomsa Mahlangu` /
`Student debt officer`) becomes a `<select>`, styled and wired identically to the
existing autonomy-level selector (`aut-select`), listing all `OFFICERS` grouped by
team. A second, smaller control next to it — visible only when
`debt.currentOfficer().role === 'manager'` — offers "My caseload / My team / Full
portfolio" (own/team/all), calling `setPortfolioScope()`. Non-manager officers get a
simpler "My caseload / My team" toggle with no "all" option, since they're not
permitted that scope.

## Testing Strategy

New `describe('DebtService — portfolio access control (issue #18)', ...)` in
`debt.service.spec.ts`, reusing the existing `debtor()` fixture factory (extended
with an `assignedOfficer` override) and `TestBed.inject` pattern:
- `inPortfolio()`: own-scope only matches the assigned officer; team-scope matches
  same-team officers regardless of assignment, not other teams; all-scope matches
  everyone.
- `setPortfolioScope('all')` is a no-op for a non-manager officer (scope stays
  `'own'`), and succeeds for a manager — with an access-log entry recorded only on
  success.
- `pickedRows()`/`caseRows()` reflect the current officer + scope — switching officer
  changes the visible set; switching scope from 'own' to 'team' only ever grows the
  set, never shrinks it relative to 'own'.
- `setCurrentOfficer()` resets scope back to `'own'`.
- `setCase()` logs exactly one access entry per distinct case opened, attributed to
  the current officer, and does not duplicate on re-selecting the same case.

## Metrics & Success Criteria

- All 4 remaining acceptance-criteria checkboxes backed by a passing test.
- `ng test` passes with the new specs included, no regressions to #7/#8/#11/#12/#13/
  #14's existing suites (portfolio filtering must not break any of their fixtures —
  cross-check that existing tests' implicit officer assignment doesn't accidentally
  fall outside the default `'own'` scope and start failing).
- Running the app: switching the officer selector visibly changes the Tracker and
  Cases lists; a non-manager has no "full portfolio" option; a manager does, and
  using it produces a logged access entry.

## Risks & Mitigations

- **Risk:** existing tests for #7/#8/#13/#14 call `service.caseRows()`/`pickedRows()`
  expecting the full mock dataset, keyed off whichever debtor happens to be first —
  adding portfolio filtering with a non-'all' default scope could silently shrink
  that set and break those tests in confusing ways. **Mitigation:** verify the full
  existing suite still passes after this change; if any fixture's debtor isn't
  assigned to the default officer (`nomsa-mahlangu`), either reassign mock data so
  the default officer's caseload still covers every rule/status combination those
  tests depend on, or fix the affected tests to select/set an appropriate officer
  first — decide per failure, not preemptively.
- **Risk:** `mock-data.ts`'s `assignedOfficer` distribution is arbitrary (invented
  for this ticket, not sourced from a real caseload roster) — reasonable for a demo,
  but should not be read as real operational data.

## Open Questions

None — the two genuinely ambiguous scope decisions (multi-officer switcher vs.
hardcoded + tests only; frontend-only vs. mirrored backend) were resolved directly
with the user before this spec was written.

## Stage 6 (Test-Review) findings and fixes

Independent review caught three real gaps in the first implementation pass, all
fixed before PR:

1. **`exportCsv()` was left unscoped**, exporting every named debtor in the current
   year/funding filter regardless of portfolio — a direct leak of the exact
   identifiable data this ticket exists to restrict. The original spec had called
   CSV export a "global-chrome action" and left it out of scope; that call was wrong
   — it lists named students, so it must respect the portfolio the same way
   Tracker/Cases do. **Fixed**: `exportCsv()` now filters through `inPortfolio()`
   before building rows, with a regression test.
2. **`payingRows()` (Tracker's "paying on cycle" list) was never scoped**, even
   though Tracker (#11) is one of the two views this ticket's acceptance criteria
   name explicitly. **Fixed** — see design change below.
3. **Scoping `pickedRows()`/`refundRows()` in place silently affected Home**, which
   also reads them for its aggregate KPIs — contradicting this spec's own Non-Goal
   that Home must stay unscoped. Home ended up with a mix of scoped and unscoped
   numbers on the same page.

**Design fix for (2) and (3):** split each of `pickedRows`/`refundRows`/`payingRows`
into a private-in-spirit `all*` variant (institution-wide, unfiltered — the only
correct source for Home's `picked`/`paying` KPIs) and the public scoped name
(filtered through `inPortfolio()` — used by Tracker, Cases, and now CSV export).
`home.component.ts` was updated to read `debt.allPickedRows()`/`debt.allPayingRows()`
instead of the now-scoped `pickedRows()`/`payingRows()`.

**Reviewed and deliberately left unscoped:** Tracker's `app-summary-cards` (total
debt, credit total, average balance, registered count) reads `debt.summary()`, which
stays derived from the unscoped `rows()`. Unlike the three items above, these are
aggregate totals with no named individual disclosed — POPIA's concern is about
identifiable students, which an aggregate sum isn't. Scoping it would also require
parameterising `summary()` by portfolio for Tracker only (Home needs the unscoped
version on the same computed), a bigger change than this ticket's acceptance
criteria ask for. Flagged here as a conscious call, not an oversight, since the
reviewer raised it as a page-level consistency concern (scoped case list next to
unscoped headline totals) even though it isn't a compliance gap.
