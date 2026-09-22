# Implementation Plan — Issue #5: Debtor Pick-Up Rule

Based on: `specs/issue-5-pickup-rule.md` (spec, pending your approval)
Gate: **do not implement until this plan is approved (Gate 1)**

## Scope recap

Unlike #4 (verification-only), this ticket includes one real production fix: `DebtMath.pickedUp()`
must exclude credit debtors (`owedToStudent`) entirely, per AC #3, not just via the `rowDebt <= 0`
side-effect that fails for mixed-sign debtors. Confirmed as a real defect, fix approach agreed.

## Step 1 — Unit tests: `DebtMathTest` (new)

New file: `backend/src/test/java/com/adaptit/studentdebt/service/DebtMathTest.java`. Plain JUnit 5,
constructing `Debtor` objects directly (same pattern as `RiskScoringServiceTest`), testing
`pickedUp()` and confirming `rowDebt`/`rowTotal`/`arrears`/`owedToStudent` behave as documented
(these currently have no direct test coverage either, and #5's fix depends on their exact
semantics being correct and well understood).

Cases:
1. `rowDebt <= 0` (zero balance, or a pure credit with all buckets ⇐ 0) → not picked up.
2. `missed > 0`, arrears = 0, weight < 8 → picked up.
3. Each arrears bucket individually (d30/d60/d90/d120 > 0) with missed = 0, weight < 8 → picked up.
4. Weight boundary: exactly 8 → picked up (with missed = 0, arrears = 0); exactly 7 → not picked
   up ("paying on cycle").
5. All three conditions false (`missed == 0`, arrears = 0, weight < 8, rowDebt > 0 via current
   bucket only) → not picked up, confirming the "paying on cycle" classification.
6. **The regression case**: current bucket = −15000 (credit), ageing90 = +3000 (arrears),
   `rowTotal` = −12000 (`owedToStudent` = true), `rowDebt` = 3000 (> 0 pre-fix). Written to FAIL
   against the current code and PASS after the fix — assert `pickedUp()` is `false`.
7. A second mixed-sign variant with the funding-weight branch instead of arrears (weight >= 8, no
   missed, no arrears bucket, but still a mixed-sign credit) to confirm the guard is unconditional,
   not just for the arrears path.

Run: `cd backend && ./mvnw test -Dtest=DebtMathTest` — case 6/7 must fail before the fix and pass
after, confirmed by running once before touching `DebtMath.java` and once after.

## Step 2 — Apply the fix

Edit `backend/src/main/java/com/adaptit/studentdebt/service/DebtMath.java`, `pickedUp()` method
only:

```java
public static boolean pickedUp(Debtor d, Map<String, Integer> fundingRiskWeights) {
    if (owedToStudent(d) || rowDebt(d).signum() <= 0) {
        return false;
    }
    int missed = d.getMissedInstalments() == null ? 0 : d.getMissedInstalments();
    int weight = fundingRiskWeights.getOrDefault(d.getFundingStatus(), 0);
    return missed > 0 || arrears(d).signum() > 0 || weight >= 8;
}
```

One line added (`owedToStudent(d) ||`). No other method in `DebtMath` changes.

## Step 3 — Integration test: no double-listing

New file: `backend/src/test/java/com/adaptit/studentdebt/service/DebtorQueryServiceTest.java` (or
confirm no suitable existing file at implementation time). `@SpringBootTest` against the H2 +
Liquibase seed profile (same pattern as #4's `DebtorControllerTest`):

- Call `pickedRows(null, null)`, `refundRows(null, null)`, `payingRows(null, null)` across all
  years/funding types.
- Assert the intersection of `pickedRows` debtor keys and `refundRows` debtor keys is empty.
- Assert every debtor with `rowDebt(d) > 0` appears in exactly one of `pickedRows` or `payingRows`
  (never both, never neither).

Run: `cd backend && ./mvnw test -Dtest=DebtorQueryServiceTest`.

## Step 4 — Full regression

`cd backend && ./mvnw test` — confirm all of #4's existing tests (`RiskScoringServiceTest`,
`RowAssemblerTest`, `DebtorControllerTest`, plus the original context test) still pass unchanged,
proving the fix doesn't touch risk scoring/banding.

## Step 5 — Manual e2e verification

1. `docker compose up -d --build` (reuse the same stack from #4's e2e pass).
2. Hit `GET /api/debtors?scope=picked`, `scope=paying`, `scope=refunds`, `scope=cases` against the
   real seeded Postgres data.
3. Confirm no seeded debtor's key appears in both the picked and refund response arrays.
4. Adversarial: since current seed data has no mixed-sign debtor, this real-data check confirms
   "no regression to existing classifications," not the fix itself — the fix itself is proven by
   the unit test in Step 1 (case 6/7). Document this distinction in the PR description so it's
   clear what the live e2e pass does and doesn't cover.
5. Document exact debtor keys checked, expected vs. actual, per `CLAUDE.md`'s e2e reporting
   requirement.

## Step 6 — Acceptance criteria sign-off

Walk all 4 checkboxes in the ticket and spec; mark each verified by the specific test that proves
it. Update `specs/issue-5-pickup-rule.md` status from Draft to Implemented, same pattern as #4.

## Files touched

- New: `backend/src/test/java/com/adaptit/studentdebt/service/DebtMathTest.java`
- New: `backend/src/test/java/com/adaptit/studentdebt/service/DebtorQueryServiceTest.java` (exact
  name/placement confirmed at implementation time)
- Changed: `backend/src/main/java/com/adaptit/studentdebt/service/DebtMath.java` (`pickedUp()`,
  one line added) — **this is the one production code change in this ticket**
- Updated: `specs/issue-5-pickup-rule.md` (status → Implemented, checkboxes ticked)

## Commit / PR (Gate 2 — separate approval required)

No commit without explicit approval tied to #5. PR would reference "Closes #5" and call out the
`DebtMath.pickedUp()` fix specifically, since it's a behavior change (however small) rather than
verification-only like #4 — worth a reviewer's extra attention.
