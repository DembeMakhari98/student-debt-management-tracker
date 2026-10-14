# Spec: API — run autonomous execution of eligible cases on the server

**Ticket:** [#58](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/58)
**Branch base:** `feature/57-autonomy-level-write-endpoint` (stacked — see Non-Goals) (branch:
`feature/58-autonomous-execution-endpoint`)
**Spec reference:** TECHNICAL_SPECIFICATION.md §5.10; `docs/SDD/issue-8-autonomy-level-gating.spec.md`;
`docs/SDD/issue-57-autonomy-level-write-endpoint.spec.md`

## Overview / Goals

`AutonomyGateService.autoEligible()` (issue #8) already encodes which recommendations may
be auto-resolved at the configured level, and #57 makes that level persistent — but
nothing on the server actually *runs* a scoring pass. Today it only happens in the
browser, per-session, via `DebtService.runAutonomousExecution()`. This ticket adds the
missing piece: a server-side `POST /api/cases/auto-resolve` that auto-resolves every
eligible, undecided case using the real (persisted) level, the real decision/audit/
write-back pipeline, and the real database — not a tab-local mock.

## Non-Goals

- **No scheduler.** Same non-goal as issue #8: this is a callable operation, not a cron
  job. A future ticket can wire it to `@Scheduled` once the business wants a live
  nightly run; today it's triggered on demand (by a manager/admin, or a test).
- **No change to `AutonomyGateService` or the decision engine** — this ticket is pure
  orchestration around already-built, already-tested pieces.
- **This branches off `feature/57-autonomy-level-write-endpoint`, not `develop`,**
  because this ticket's own "Depends on #57 (stored autonomy level)" is literal: without
  #57, there is no persisted level to read, only the hardcoded `system_setting` seed
  value. The PR will be retargeted to `develop` (or rebased) once #57 merges — flagged
  explicitly in both PRs so reviewers aren't surprised by the stacked diff.

## Acceptance Criteria (from the ticket, mapped to implementation)

- [ ] `POST /api/cases/auto-resolve` resolves every undecided case
      `AutonomyGateService.autoEligible()` allows at the stored level —
      `AutoResolveService.autoResolve()` iterates `DebtorQueryService.allCaseDebtors()`
      (new method; same "picked-up OR owed-to-student, full dataset" rule the frontend's
      `allCases()` already uses — deliberately *not* scoped to any year/funding filter,
      matching issue #8's existing reasoning that a scoring run must not silently skip
      cases outside whatever filter happens to be selected).
- [ ] Registration holds and refunds are never auto-executed, regardless of level — for
      free: `AutonomyGateService.autoEligible()` already hard-codes this (issue #8); no
      new logic needed, just a regression test at this new call site.
- [ ] Each auto-decision is saved as an `officer_decision` with `decidedBy` =
      "Autonomous Agent" and written back to ITS Integrator — rather than re-implement
      decision persistence + activity log + write-back, `AutoResolveService` calls the
      existing `DecisionService.decide(debtorKey, new DecisionRequestDto("APPROVE", null,
      null, "Autonomous Agent"))` per eligible case. This is the same save path a human's
      APPROVE click uses (issue #13), so it gets the write-back call (issue #3) and the
      activity-log entry for free, correctly attributed.
- [ ] Response returns the number of cases resolved and their keys —
      `AutoResolveResultDto(int resolvedCount, List<String> debtorKeys)`.
- [ ] MANAGER/ADMIN only; tests cover levels 1–4 and the hold/refund exclusions — same
      `SecurityConfig` path-matcher pattern as #57:
      `requestMatchers(HttpMethod.POST, "/api/cases/auto-resolve").hasAnyRole("ADMIN","MANAGER")`.
      The levels-1-4 and hold/refund truth table is already exhaustively covered by
      `AutonomyGateServiceTest` (issue #8) — this ticket's tests cover the *orchestration*
      (does calling this endpoint at each level actually resolve the right cases, does it
      skip already-decided ones, does it skip the hard-rule types end-to-end) rather than
      re-deriving the same 32-case matrix.

## Technical Design

- `DebtorQueryService.allCaseDebtors()`: `rows(null, null)` filtered to
  `DebtMath.pickedUp(d, weights) || DebtMath.owedToStudent(d)` — the server-side mirror
  of `DebtService.allCases()`.
- `AutoResolveService.autoResolve()`:
  ```java
  int level = autonomySettingService.currentLevel();   // new accessor, see below
  List<String> resolved = new ArrayList<>();
  for (Debtor d : debtorQueryService.allCaseDebtors()) {
      RecommendationDto rec = decisionEngineService.recommend(d);
      boolean alreadyDecided = officerDecisionRepository
              .findFirstByDebtorKeyAndRecommendationTypeOrderByDecidedAtDesc(d.getDebtorKey(), rec.type())
              .isPresent();                                   // keyed to the *current* recommendation type,
                                                                // same re-opens-on-rescore rule as the frontend
      if (alreadyDecided || !autonomyGateService.autoEligible(rec, level)) continue;
      decisionService.decide(d.getDebtorKey(), new DecisionRequestDto("APPROVE", null, null, "Autonomous Agent"));
      resolved.add(d.getDebtorKey());
  }
  return new AutoResolveResultDto(resolved.size(), resolved);
  ```
  Not `@Transactional` as one big unit — each `decisionService.decide()` call is already
  its own transaction, and one failing case (e.g. a write-back hiccup) should not roll
  back every other case's already-correct decision.
- `AutonomySettingService.currentLevel()`: the "read with default 2" logic that already
  exists, duplicated, in both `AutonomySettingService.update()` and
  `MetaController.meta()`. Extracted to one method and called from both places — a small,
  directly-motivated dedup now that a *third* call site (`AutoResolveService`) needs the
  exact same read, not a speculative refactor.
- `CaseAutoResolveController`: `POST /api/cases/auto-resolve`, no request body, returns
  `AutoResolveResultDto`.

## Testing Strategy

- `AutoResolveServiceTest` (unit, mocked `DebtorQueryService`/`OfficerDecisionRepository`/
  `DecisionService`/`AutonomySettingService`, real `DecisionEngineService` +
  `AutonomyGateService` — same "no Spring context needed" style as
  `AutonomyGateServiceTest`): level 1/2 → `decisionService.decide()` never called; level 3
  → called only for the Agent-acting fixture; level 4 → called for every fixture except
  Refund/Registration hold; an already-decided fixture is skipped even when eligible;
  result's `resolvedCount`/`debtorKeys` match what was actually resolved.
- `CaseAutoResolveControllerTest` (`@SpringBootTest @AutoConfigureMockMvc`, real JWTs,
  same `tokenFor()` pattern as `SettingsControllerTest`): OFFICER → 403; MANAGER/ADMIN →
  200 with a well-formed body; running it twice in a row resolves nothing the second time
  (idempotent against its own prior run, proving the already-decided check works
  end-to-end against the real database, not just the mock).

## Metrics & Success Criteria

- All 5 acceptance-criteria checkboxes backed by a passing test.
- `./mvnw test` passes.
- The 8 decision-engine rule fixtures behave identically through this endpoint as they
  already do through `AutonomyGateServiceTest`'s direct unit tests — no new gating
  behaviour introduced, only a new way to trigger it.

## Risks & Mitigations

- **Risk:** running this against the full, unfiltered debtor book on a large dataset
  could be slow (`O(n)` recommend + one query per case for the decided check).
  **Mitigation:** out of scope for the current seeded demo dataset (dozens of rows); the
  non-goal above already defers a real scheduled/batched run to a future ticket if this
  becomes a real nightly job.
- **Risk:** stacking this PR on #57's unmerged branch means its diff includes #57's
  changes until #57 merges. **Mitigated** by saying so explicitly in both PR
  descriptions, and by this spec's Non-Goals section, so no reviewer mistakes the size of
  the diff for this ticket's actual scope.
