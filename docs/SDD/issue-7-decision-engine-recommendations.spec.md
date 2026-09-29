# Spec: Recommend an action for each picked-up debtor using the decision engine

**Ticket:** [#7](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/7)
**Branch base:** `develop` (branch: `feat/decision-engine-recommendations`)
**Spec reference:** TECHNICAL_SPECIFICATION.md §5.1–§5.9

## Overview / Goals

As a debt officer, every flagged case should arrive with one clear recommended action,
its rationale, proposed terms, the owning agent, and the policy clause it sits under.

**This logic already exists on both sides of the repo, correct against the spec:**
- Frontend: `DebtService.recommend()` — `frontend/src/app/core/debt.service.ts:218-335`
- Backend: `DecisionEngineService.recommend()` —
  `backend/src/main/java/com/adaptit/studentdebt/service/DecisionEngineService.java`

Both were added in the initial scaffold commit (`48b272f`), which implemented most of
the epic's issues (#2, #4–#17) at once, ahead of the per-issue dev-workflow this repo
now follows. Issue #7's checkboxes are still unticked in GitHub and neither
implementation has any test coverage — that's the actual gap this ticket closes,
verified directly rather than assumed:
- No spec/test file anywhere exercises `DebtService.recommend()`.
- The only backend test is a bare `@SpringBootTest` context-load smoke test —
  nothing exercises `DecisionEngineService`, `RiskScoringService`, or `DebtMath`.

**Goal of this ticket:** confirm both implementations are correct against every
acceptance criterion, add unit test coverage for both, and go through the same
formal pickup → PR → close flow issue #14 already went through (the one issue in
this repo actually closed to date), rather than leaving #7 open with working-but-
unverified code.

## Non-Goals

- **No new business logic.** Rules, the instalment-count formula, the hardship-award
  formula, agent/policy mapping, and rationale/terms text all already match
  TECHNICAL_SPECIFICATION.md §5 on inspection — this ticket does not rewrite them
  unless a test uncovers an actual defect.
- **No frontend/backend integration.** The Angular app has zero `HttpClient` usage
  and reads `mock-data.ts` directly; wiring it to the Spring Boot API is explicitly
  called out in `frontend/README.md` as unscheduled future work, not tracked by any
  currently open issue (confirmed against the full issue list — #1, #18–#21 are the
  only issues flagged as non-code). Not invented as scope here.
- **No changes to risk scoring (#4), pick-up rule (#5), or signals/evidence (#6)** —
  `recommend()` consumes their outputs (`rowDebt`, `owedToStudent`, `arrears`, etc.)
  but this ticket doesn't touch those functions.

## Acceptance Criteria (from the ticket, mapped to verification approach)

- [ ] Rules evaluated in fixed order, first match wins — **verify via test**, one
      case per rule, asserting no earlier rule accidentally also matches (e.g. a
      Rule-6 fixture must not also satisfy Rule 3's regex)
- [ ] Instalment count formula (`≤5000→3, ≤15000→4, ≤30000→6, >30000→8`) — **verify
      via test**, one case per band. Frontend's `instalments()` is `private`
      (`debt.service.ts:200`), so it's asserted indirectly through `recommend()`'s
      `action`/`terms` strings (e.g. `"Payment arrangement, 4 instalments"`); backend's
      `DebtMath.instalments()` is a public static method and can be called directly
- [ ] Hardship award = `min(debt * 0.4, 6000)` — **verify via test**, one case below
      the cap and one above it
- [ ] Each recommendation includes `type`, `action`, `status`, `rationale`, `terms[]`
      — **verify via test**, asserting shape on at least one recommendation
- [ ] Unit tests cover all 8 rules with at least one example case each — **this is
      the actual new work**, on both frontend and backend

## Technical Design → Test Fixtures

Rather than depending on `mock-data.ts` rows (real display data whose rule coverage
is incidental, not guaranteed to stay stable), each test builds a minimal, self-
documenting `Debtor` via a local factory function with sane defaults, overridden
per case — e.g. frontend:

```ts
function debtor(overrides: Partial<Debtor>): Debtor {
  return {
    id: 'STU-TEST', name: 'Test Student', funding: 'self', year: 2026,
    prog: 'Test Programme', fundStatus: 'Self-funded', missed: 0,
    lastPay: '01 Jan 2026', arrangement: null,
    ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 0 },
    ...overrides,
  };
}
```

One fixture per rule, matching the rule's exact condition:

| Rule | Fixture shape |
|---|---|
| 1 Refund | `ageing.current: -4200` (any negative bucket) |
| 2 Registration hold | `arrangement: 'Defaulted', lastPay: null` |
| 3 Hardship fund | `fundStatus: 'NSFAS lapsed'` (or `'...declined'`), `arrangement: null`, `lastPay` set |
| 4 Holding arrangement | `fundStatus: 'NSFAS pending', missed: 2` |
| 5 Funding chase | `fundStatus: 'NSFAS pending', missed: 1` |
| 6 Payment arrangement | `fundStatus: 'Self-funded', missed: 2` |
| 7 Reminder cadence | `fundStatus: 'Self-funded', missed: 1` |
| 8 Monitor | `fundStatus: 'Self-funded', missed: 0` |

Each "clean" fixture above is constructed so it doesn't accidentally overlap an
earlier rule's condition — but that alone only proves each rule fires correctly in
isolation, not that ordering is enforced when two conditions really can be true at
once. So, in addition, every rule that has a realistic conflict with an earlier rule
gets a dedicated **order-proof fixture** that deliberately satisfies both conditions,
asserting the earlier rule wins:

- Rule 1 vs. 2/3/6 — a credit account that's also defaulted-with-no-payment and
  lapsed-funding and missed≥2; Refund must still win
- Rule 2 vs. 3/6 — defaulted-with-no-payment that's also lapsed-funding and missed≥2;
  Registration hold must still win
- Rule 3 vs. 6 — lapsed funding with missed=2 (which alone would satisfy Rule 6);
  Hardship fund must still win
- Rule 4 vs. 6 — funding pending with missed≥2 (which alone would satisfy Rule 6);
  Holding arrangement must still win
- Rule 5 vs. 7 — funding pending with missed=1 (which alone would satisfy Rule 7);
  Funding chase must still win (the Rule 5 fixture above doubles as this proof)

Rules 6, 7, and 8 have no realistic conflict with a *later* rule (their trigger
values — `missed >= 2`, `missed == 1`, `missed == 0` — are mutually exclusive by
construction), so no further order-proof is needed past Rule 5.

Backend fixtures follow the same table, built via `Debtor`'s all-args constructor or
a builder, using `BigDecimal` ageing values and `LocalDate`/`null` for `lastPaymentDate`.

## Testing Strategy

**Frontend** — new `describe('DebtService — decision engine (issue #7)', ...)` block
in `frontend/src/app/core/debt.service.spec.ts` (matching the existing `TestBed.inject`
pattern already used there for issue #14), covering:
- One `it()` per rule (8 total) asserting `type`, `status`, and a key term value
- Instalment-count boundary cases (4 bands)
- Hardship-award cap case (above and below `6000`)
- One fall-through case proving rule order (e.g. a debtor that would match Rule 6's
  `missed >= 2` but should hit Rule 4 first because funding is pending)

**Backend** — new `DecisionEngineServiceTest` in
`backend/src/test/java/com/adaptit/studentdebt/service/`, plain JUnit 5 (no
`@SpringBootTest` needed — `DecisionEngineService` has no injected dependencies,
confirmed by reading it), same 8-rule + instalment + hardship-award coverage as the
frontend, run via `./mvnw test` (uses the existing H2 test profile, no Postgres
needed).

## Metrics & Success Criteria

- All 5 acceptance-criteria checkboxes can be ticked with a passing test backing
  each, not just visual inspection.
- `ng test` and `./mvnw test` both pass with the new specs included.
- No behavior change to the running app (frontend logic untouched unless a test
  reveals a real defect against the spec).

## Risks & Mitigations

- **Risk:** discovering the existing logic has a real bug against §5 while writing
  tests (e.g. an edge case in the fall-through order). **Mitigation:** fix it as part
  of this ticket if found — cite the exact spec clause it violates in the fix's
  commit/PR description, since that's a legitimate, in-scope correction, not scope
  creep.
- **Risk:** frontend and backend implementations silently drift from each other over
  time since they're not sharing code. **Mitigation:** out of scope to fix here (no
  shared-package option in an Angular+Spring Boot split repo), but flagging it in the
  PR description as a known duplication risk for whoever eventually wires the backend
  in.

## Open Questions

None — this spec was written after directly reading both implementations, the full
issue list, and both project READMEs; no `[TO CONFIRM]` items from the tech spec
apply to this ticket's actual scope.
