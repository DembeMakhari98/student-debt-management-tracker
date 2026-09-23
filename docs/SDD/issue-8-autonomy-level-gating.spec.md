# Spec: Gate automatic execution of recommendations by autonomy level

**Ticket:** [#8](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/8)
**Branch base:** `develop` (branch: `feat/autonomy-level-gating`)
**Spec reference:** TECHNICAL_SPECIFICATION.md §5.10

## Overview / Goals

As a compliance owner, the system's ability to act on a recommendation automatically
must be limited by a configurable autonomy level (1–4), so risk of an unattended wrong
action is controlled as trust in the system grows — and two action types (Refund,
Registration hold) must never auto-execute at any level.

**What already exists (verified by reading the code, not assumed from the issue
checkboxes):**
- An `autonomy` signal (`frontend/src/app/core/debt.service.ts:52`, default `2`) and a
  UI selector (`app.component.html:21`, wired via `onAutonomyChange` →
  `debt.setAutonomy()`) that lets an officer pick a level.
- A mirrored backend `system_setting` row (`autonomy_level`, seeded to `2` in
  `002-seed-lookups.xml`), read (read-only, no write endpoint) by
  `MetaController.meta()` and returned over `GET /api/meta`.
- Both sides define the same four level names/hints (`constants.ts` `LEVELS`,
  `MetaController.LEVELS`).

**What does not exist — the actual gap this ticket closes:** the autonomy level is
purely cosmetic. Nothing reads it to gate anything. The only path that ever resolves a
recommendation today is the officer manually clicking Approve/Amend/Decline
(`cases.component.ts:108-141`, issue #13) — this happens unconditionally regardless of
`autonomy()`'s value or the recommendation's `status`. There is no auto-execution
pathway anywhere in the frontend or backend to gate. Confirmed by grepping both trees
for any consumer of `autonomy()` / `autonomy_level` beyond display — there is none.

So issue #8's four "already implemented" checkboxes (Levels 2–4) are **not actually
true** — they describe the target behaviour, not current behaviour. Level 2 (queue
everything for approval) is accidentally satisfied today only because *nothing* ever
auto-executes yet, not because level-aware logic exists.

## Non-Goals

- **No real scheduler / background job.** There is no nightly batch process anywhere
  in this repo yet (the nightly *extraction* job on `feat/frontend-backend-scaffold`,
  issues #1/#2, only pulls debtor rows — it does not run the decision engine or
  execute anything). "Auto-execution" here means: given the current recommendation set,
  which ones the system is *allowed* to resolve without a human click — exposed as an
  explicit, callable operation (a "scoring run"), not a live cron/timer. Wiring an
  actual scheduler is out of scope.
- **No frontend/backend integration**, consistent with issue #7's non-goal — the two
  implementations are built and tested independently, matching the existing
  `DebtService.recommend()` / `DecisionEngineService.recommend()` split.
- **No change to the 8 decision rules themselves** (issue #7, already closed) — this
  ticket only gates what happens to a recommendation *after* it's produced.
- **No backend write endpoint for `autonomy_level`** unless Open Question 2 below is
  resolved in favour of adding one — read-only via `/api/meta` is the current state.

## Acceptance Criteria (from the ticket, mapped to verification approach)

- [ ] **Level 1 (Observe):** no action executes automatically, regardless of status —
      **verify via test**: run the scoring-run operation at level 1 across all 8 rule
      fixtures, assert zero auto-decisions recorded.
- [ ] **Level 2 (Recommend, default):** every action, including `Agent acting`, is
      queued for officer approval — **verify via test**: same run at level 2, assert
      zero auto-decisions (this is the current de-facto behaviour; the test makes it a
      guaranteed invariant instead of an accident).
- [ ] **Level 3 (Act within policy):** only recommendations already `Agent acting`
      (Rules 5 Funding chase, 7 Reminder cadence — Rule 8 Monitor has status
      `Monitoring`, not `Agent acting`, and is inherently passive, so it's never
      "executed") auto-resolve; `Needs approval` ones (Rules 1, 2, 3, 4, 6) still
      require a human — **verify via test**: one fixture per rule at level 3, assert
      auto-decision exists only for Rules 5 and 7.
- [ ] **Level 4 (Act and report):** the full set, including `Needs approval` actions,
      auto-resolves and is surfaced for post-hoc review — **verify via test**: same 8
      fixtures at level 4, assert auto-decision exists for every rule **except** the
      hard-rule exceptions below.
- [ ] **Hard rule, enforced regardless of level:** Refund (Rule 1) and Registration
      hold (Rule 2) never auto-execute, even at Level 4 — **verify via test**: those
      two fixtures at level 4 must still show no auto-decision.
- [ ] **Autonomy level is configurable per rollout phase (not hardcoded) and changes
      take effect from the next scoring run** — the level is already
      signal/DB-backed and UI-selectable (not hardcoded); "next scoring run" is
      satisfied by making the gate a discrete, explicitly-invoked operation (see
      Technical Design) rather than a continuously-reactive one — **verify via test**:
      change the level, assert the *previous* run's auto-decisions are untouched and
      only the *next* invocation reflects the new level.

## Technical Design

### Why the gate can't just live inside `recommend()` / `caseOf()`

`caseOf()` is called from inside Angular `computed()` selectors (e.g.
`cases.component.ts:40` `list = computed(() => ... this.debt.caseOf(d))`, and the CSV
export loop). Angular signals forbid writing state from within a `computed()` — and
recording an auto-decision is a write to the `decisions` signal
(`debt.service.ts:100`). Embedding the gate in the read path would either violate that
rule or silently do nothing. This is *why* the ticket's own wording says "takes effect
from the next **scoring run**" rather than "immediately" — it's describing a
run/apply model, not a continuous one.

**Design:** a pure predicate plus an explicit run method, both new, added next to the
existing decision helpers in `DebtService`:

```ts
private static readonly HARD_MANUAL_TYPES = new Set(['Refund', 'Registration hold']);

/** Pure — no side effects — Technical Spec §5.10 gate, safe to call from a computed(). */
autoEligible(rec: Recommendation, level: number): boolean {
  if (DebtService.HARD_MANUAL_TYPES.has(rec.type)) return false;   // hard rule, all levels
  if (rec.status === 'Monitoring') return false;                    // nothing to execute
  if (level >= 4) return true;                                      // Act and report
  if (level === 3) return rec.status === 'Agent acting';            // Act within policy
  return false;                                                     // 1 Observe, 2 Recommend
}

/** The "scoring run" — explicit, not reactive. Auto-resolves every eligible,
 *  not-yet-decided case at the current autonomy level. Call on demand (e.g. after a
 *  re-score) or when the level changes going forward — never retroactively. */
runAutonomousExecution(): void {
  const level = this.autonomy();
  for (const d of this.rows()) {
    const rec = this.recommend(d);
    if (this.decisionOf(d, rec)) continue;          // already decided (manual or prior auto run)
    if (!this.autoEligible(rec, level)) continue;
    this.decide(d, 'Approved', {}, `Autonomous Agent (Level ${level})`);  // default actor — Open Question 1
  }
}
```

`decide()` gains a 4th, optional `actor` parameter (defaults to `CURRENT_OFFICER` for
the existing manual call sites, which stay unchanged) so an auto-decision's
`decidedBy` and activity-log entry are distinguishable from a human officer's, per the
resolved default in Open Question 1.

`setAutonomy()` stays a pure signal write (no auto-run triggered from inside it,
consistent with "next scoring run" meaning the *next explicit run*, not this one) —
callers (e.g. a future "Re-score now" button, or a test) invoke
`runAutonomousExecution()` separately.

### Backend mirror

Add an equivalent pure predicate, `AutonomyGateService.autoEligible(RecommendationStatus
status, String recommendationType, int autonomyLevel)`, in
`backend/src/main/java/com/adaptit/studentdebt/service/`, same rule as above, unit
tested against `DecisionEngineService.recommend()`'s output for all 8 rule fixtures
already built for issue #7. No scheduler or `OfficerDecision`-writing run method on the
backend (there is no backend equivalent of a "run" trigger to hang it off yet, and
adding one is out of scope per Non-Goals).

## Testing Strategy

**Frontend** — new `describe('DebtService — autonomy gating (issue #8)', ...)` in
`debt.service.spec.ts`, reusing the 8 rule fixtures already built for issue #7's
`describe`:
- `autoEligible()` truth table: 8 rules × 4 levels = 32 cases (small, exhaustive —
  written as a single parametrised table rather than 32 individual `it()`s)
- `runAutonomousExecution()` integration cases: level 1/2 → zero decisions across all
  rules; level 3 → only Rules 5/7 decided; level 4 → every rule except Refund/
  Registration hold decided
- Re-run invariant: decide one case manually first, then run — assert the manual
  decision isn't overwritten
- Level-change invariant: run at level 3, change to level 4, run again — assert the
  first run's decisions are untouched and only newly-eligible cases pick up the second

**Backend** — new `AutonomyGateServiceTest`, plain JUnit 5, same 32-case truth table,
run via `./mvnw test`.

## Metrics & Success Criteria

- All 6 acceptance-criteria checkboxes ticked with a passing test backing each.
- `ng test` and `./mvnw test` both pass with the new specs included.
- No behaviour change to existing manual approve/amend/decline flow (issue #13)
  untouched — `runAutonomousExecution()` only acts on cases with no existing decision.

## Risks & Mitigations

- **Risk:** an auto-executed decision looks identical in the UI to an officer's manual
  approval (`decidedBy: CURRENT_OFFICER`), which would misrepresent who acted — a
  compliance-relevant distinction given this whole ticket is about controlling
  unattended action. **Mitigation:** see Open Question 1 — needs a decision before
  Stage 4.
- **Risk:** "next scoring run" could instead mean "re-evaluate live, immediately,"
  which would require a different (reactive-but-signal-safe) design, e.g. an
  `effect()` outside the render path. **Mitigation:** see Open Question 3.

## Resolved Assumptions (defaulted, not blocked on further input)

These three were flagged as open questions during spec drafting. None require a
Business Analyst — they're engineering scoping/design calls, not product or compliance
policy decisions — so defaults are adopted here rather than pausing the ticket:

1. **Actor attribution for auto-decisions — DEFAULTED.** `decide()` gains an optional
   4th `actor` parameter; auto-decisions stamp `decidedBy: 'Autonomous Agent (Level
   N)'` instead of `CURRENT_OFFICER`, and the activity-log line reads `Auto-decision ·
   Autonomous Agent (Level N)` instead of `Officer decision · <name>`, so the audit
   trail never misrepresents an autonomous action as a human's. This *is* the kind of
   record #20 (audit log retention, currently blocked on the POPIA assessment) will
   need to account for once that's unblocked — noted in the PR description, not
   re-raised as a new question to the BAs now.
2. **Backend write endpoint for `autonomy_level` — DEFAULTED to skip.** Stays
   read-only via `/api/meta` this ticket; no consumer exists yet (no frontend/backend
   integration). Revisit if/when that integration work is scheduled.
3. **"Next scoring run" = explicit `runAutonomousExecution()` call — DEFAULTED,
   adopted as the design.** Not just a guess: it's forced by Angular's no-write-in-
   `computed()` constraint (see Technical Design), and it matches existing domain
   language already in the app (Rule 8's Monitor terms literally say "Re-score:
   Nightly" — the app already models discrete re-score events, not live continuous
   scoring).

**Why these don't need Business Analyst input:** all three are implementation
mechanics — how the code represents "who/what decided" and "when a level change takes
effect" — not what the autonomy policy itself should *do*, which TECHNICAL_SPECIFICATION.md
§5.10 already specifies precisely (the actual compliance-sensitive content: the four
levels' behaviour and the Refund/Registration-hold hard rule). If a reviewer disagrees
with a default, it's a cheap code change, not a policy question.
