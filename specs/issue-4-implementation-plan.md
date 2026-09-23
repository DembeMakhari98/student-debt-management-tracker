# Implementation Plan — Issue #4: Nightly Risk Score & Band

Based on: `specs/issue-4-risk-scoring.md` (spec, pending your approval)
Gate: **do not implement until this plan is approved (Gate 1)**

## Scope recap

Logic already exists and matches §4.1/§4.2 (`RiskScoringService`). This plan adds the missing
test coverage that verifies it, plus a manual e2e pass. No production code changes are expected
unless a test uncovers a real discrepancy — if that happens, I'll stop and confirm the fix with
you before changing `RiskScoringService`, since that's a behavior change beyond "add tests."

## Step 1 — Unit tests: `RiskScoringServiceTest`

New file: `backend/src/test/java/com/adaptit/studentdebt/service/RiskScoringServiceTest.java`.

Plain JUnit 5 unit tests against `RiskScoringService` directly, constructing `Debtor` objects
in-memory (no Spring context, no DB needed — `score()`/`bandOf()` are pure functions once given a
`Debtor` and a `Map<String,Integer>` of funding weights). Cases:

1. `rowDebt <= 0` (all ageing buckets zero, or net negative/credit) → score `0`, and confirm
   `bandOf(0)` is never called in the actual pipeline for this case (see Step 2 for the
   `RowAssembler`-level check).
2. Each ageing bucket in isolation: d120-only (check the `18 + min(12, d120/4000)` formula at a
   value below the cap, e.g. d120=4000 → +19, and at/above the cap, e.g. d120=60000 → +30 capped
   contribution), d90-only (+14), d60-only (+8), d30-only (+5), and all four stacked together.
3. Missed instalments: 0 (+0), 2 (+14), 3 (at cap boundary, +21), 4+ (capped at +22).
4. Funding status: one case per row in the lookup table (NSFAS declined/lapsed, Bursary
   lapsed/partial/confirmed/overpaid, NSFAS pending, Self-funded) plus an unrecognized string →
   must default to `0`, not throw.
5. `arrangementStatus`: `"Defaulted"` (+10), a differently-cased variant e.g. `"defaulted"` (+10,
   confirms current case-insensitive behavior), `null`, and another value e.g. `"Active"` (+0).
6. `lastPaymentDate`: `null` (+8) vs. populated (+0).
7. Clamp: a combination that would mathematically exceed 99 → asserted result is exactly `99`; a
   debtor with `rowDebt > 0` but every other field at its zero-contribution state → asserted
   result is exactly `1` (never `0` for a real debt, per the clamp floor).
8. Band boundaries: score `44` → WATCH, `45` → ELEVATED, `69` → ELEVATED, `70` → HIGH (test
   `bandOf()` directly at each boundary).

Run: `cd backend && ./mvnw test -Dtest=RiskScoringServiceTest`.

## Step 2 — Integration test: credit debtors excluded from scoring/banding

New file: `backend/src/test/java/com/adaptit/studentdebt/service/RowAssemblerTest.java` (or add to
an existing test if one is more appropriate once I look at conventions again — will confirm
placement during implementation, not a plan-level decision).

The "in-credit debtor is never scored/banded" rule lives in `RowAssembler`/`DebtMath`
(`owedToStudent`), not in `RiskScoringService` itself. Test: a `Debtor` with negative `rowTotal`
(credit) → `RowAssembler.toRow()` returns `band == "CREDIT"`, and confirm the `riskScore` value
returned is not used/displayed as a Watch/Elevated/High band anywhere downstream (i.e. assert the
band string specifically, since `score` is still computed as a number internally but must not be
banded).

## Step 3 — Integration test: real-data pipeline via H2

New or extended file: `backend/src/test/java/com/adaptit/studentdebt/web/DebtorControllerTest.java`
(check first whether one already exists under a different name — none did as of the spec's
research, but I'll re-check at implementation time).

`@SpringBootTest` + `@AutoConfigureMockMvc` (or `TestRestTemplate`) against the H2 profile
(`ddl-auto: none`, Liquibase-managed schema — matches `backend/src/test/resources/application.yml`
and `backend/README.md`'s documented pattern). Liquibase's existing seed data
(`003-seed-debtors.xml`) already runs against this profile, so:

- Hit `GET /api/debtors?scope=cases&year=2026` and assert `riskScore`/`band` for a handful of the
  seeded debtors (e.g. `STU-100301-2026`, which has `Defaulted` + NSFAS declined + d90/d120 —
  should land in HIGH) match hand-calculated expected values.
- This proves the full pipeline (`DebtorRepository` → `DebtorQueryService` → `RowAssembler` →
  `RiskScoringService` → DTO → controller) is accurate against real persisted rows, not just the
  pure function in isolation.

Run: `cd backend && ./mvnw test -Dtest=DebtorControllerTest`, then the full `./mvnw test` to
confirm no regressions elsewhere.

## Step 4 — Manual e2e verification

1. `docker compose up -d --build` (Postgres + backend + frontend, real containers).
2. `curl http://localhost:8080/api/debtors?scope=cases` (or equivalent) and hand-verify the
   `riskScore`/`band` for at least 3 seeded debtors spanning different signal combinations against
   the §4.1 formula, cross-checked against the unit test expectations from Step 1.
3. Adversarial checks against the live stack:
   - A debtor with all ageing buckets at 0 (no debt) — confirm score `0`/no band in the live
     response, not just in the unit test.
   - Restart the backend container and re-hit the endpoint — confirm scores are stable/idempotent
     for unchanged data (this is a property of a pure function, but worth confirming end-to-end
     since nothing here should be caching stale results).
4. Document what was tested (exact debtor keys, expected vs. actual) in the PR description per
   `CLAUDE.md`'s requirement to state e2e/adversarial testing explicitly.

## Step 5 — Acceptance criteria sign-off

Walk the 8 checkboxes in the ticket and in the spec's User Stories section; mark each as verified
by naming which test (Step 1/2/3) proves it. Update `specs/issue-4-risk-scoring.md` status from
Draft to Implemented.

## Out of scope (confirmed)

- Nightly batch job / scheduler — owned by #2.
- CI pipeline — unowned repo-wide; not part of this ticket (see spec's Open Questions resolution).
- Any change to `RiskScoringService`'s actual formula, unless a test in Step 1–3 reveals a real
  discrepancy against §4.1/§4.2 — in which case I stop and confirm with you before changing
  production code, since that's a distinct piece of work from "add tests."

## Files touched

- New: `backend/src/test/java/com/adaptit/studentdebt/service/RiskScoringServiceTest.java`
- New: a `RowAssembler`-level test (exact file/placement confirmed at implementation time)
- New or extended: a `DebtorController`/`DebtorQueryService` integration test
- Updated: `specs/issue-4-risk-scoring.md` (status → Implemented, checkboxes ticked)
- No changes to `backend/src/main/**` unless a defect is found (see above)

## Commit / PR (Gate 2 — separate approval required)

Per `CLAUDE.md`: no commit without explicit approval tied to #4. Once tests are written and
passing, and e2e is done, I'll stop and ask before committing. PR would reference "Closes #4" and
summarize which tests cover which acceptance criteria.
