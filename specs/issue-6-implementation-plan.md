# Implementation Plan — Issue #6: Case Signals, Evidence Chips & Activity Log

Based on: `specs/issue-6-signals-evidence-activity-log.md` (spec, pending your approval)
Gate: **do not implement until this plan is approved (Gate 1)**

## Scope recap

Like #4, this is verification-only — no production code change is expected. The spec's Open
Question is resolved as follows for this plan: "append-only, each run adds entries" is read as a
property of the **persisted** activity trail (currently populated only by officer decisions, #13),
which already satisfies it — no delete/update path exists anywhere on
`ActivityLogEntryRepository`. The five §4.6 scoring-run entries stay computed-on-read, since there
is no nightly-run trigger (#2) yet to persist them from. If you disagree with this reading, say so
before I start — it would turn this into a real implementation ticket (new persistence path,
`ActivityLogEntry` writes on read or on a new "run" concept) rather than a test-coverage one.

## Step 1 — Unit tests: `CaseAssemblyServiceTest` (new)

New file: `backend/src/test/java/com/adaptit/studentdebt/service/CaseAssemblyServiceTest.java`.
Plain JUnit 5, constructing `Debtor` objects directly (same pattern as `RiskScoringServiceTest`).

**`signalsOf` cases (§4.4, order matters — assert on list order, not just membership):**
1. `missed == 0` → no missed-instalment signal; `missed == 1` → `"1 missed instalment"` (no `s`);
   `missed > 1` → `"{n} missed instalments"`. All flagged `hot`.
2. `lastPaymentDate == null` → `"No payment on record"`, hot; populated → `"Last paid {date}"`
   (format `dd MMM yyyy`), not hot.
3. Ageing-priority chain, one debtor per branch: `d120 > 0` → `"120+ days {amount}"` hot (and
   confirm `d90`/arrears are suppressed even if also > 0); `d120 == 0, d90 > 0` → `"90 days
   {amount}"` hot; `d120 == 0, d90 == 0`, arrears (`d30`/`d60`) `> 0` → `"In arrears {amount}"`,
   not hot; all zero → no ageing signal at all.
4. Funding status: risk weight `< 8` → no funding signal; `== 8` and `> 8` → funding status text,
   not hot (weight boundary at exactly 8, mirroring #4's weight-boundary tests).
5. `arrangementStatus` `"Defaulted"` (and mixed-case variants, matching existing
   `equalsIgnoreCase`) → `"Arrangement defaulted"`, hot; other/null values → no signal.
6. Full stack: a debtor that fires all five signals at once, asserting the exact list order
   matches §4.4's numbered order.

**`evidenceOf` cases (§4.5):**
1. `oldestBucket` selection at each boundary — a debtor with only `d30 > 0`, only `d60 > 0`, etc.,
   confirming `"Ageing · {label}"` uses the correct bucket label; all-zero buckets →
   `"Ageing · Current"`.
2. Payment-history year range: `financialYear = 2026` → `"Payment history 2025–2026"` (confirm
   exact en-dash character, not a hyphen).
3. `"Funding · {fundStatus}"` always present.
4. `arrangementStatus != null` → `"Arrangement · {arrangement}"` present, in list; `null` →
   absent (confirm list length differs, not just content).

**`activityOf` cases (§4.6):**
1. Entries 1–2 (`"Risk scored {score} and banded {band}"` / Risk Sentinel · overnight run;
   `"Funding status read as {fundStatus}"` / Funding Broker · Student Funding) always present, in
   that order, first two positions.
2. `missed > 0` → `"{n} instalment(s) flagged unpaid"` / Assurance Agent · Debtors present at
   position 3; `missed == 0` → absent (position shifts, assert on the next entry directly).
3. Receipt entry always present: `lastPaymentDate == null` → `"No receipt found on the account"`;
   populated → `"Last receipt {date} confirmed"`. Source `"Cashiering reconciliation"` in both
   cases.
4. `arrangementStatus != null` → `"Prior arrangement {arrangement, lowercased}"` / Assurance
   Agent present as the last entry; `null` → absent.
5. Full stack + adversarial: a debtor with every optional field null/zero, confirming no entry
   throws or renders `"null"` as text, and the entry list is exactly the 2 unconditional entries.

Run: `cd backend && ./mvnw test -Dtest=CaseAssemblyServiceTest`.

## Step 2 — Integration test: `CaseService` / `DebtorController` merge behavior

Extend `backend/src/test/java/com/adaptit/studentdebt/web/DebtorControllerTest.java` (or add a
`CaseServiceTest`, decided at implementation time based on which gives cleaner real-data coverage,
matching #4's precedent of preferring the `@SpringBootTest` + `MockMvc` tier for real-pipeline
proof) — `@SpringBootTest` against the H2 + Liquibase seed profile:

1. `GET /api/debtors/{debtorKey}` for a known seeded debtor with a missed instalment, arrears, a
   funding status above the weight-8 threshold, and an arrangement — assert `evidence` and
   `activity` content/order match hand-derived expectations from the seed data.
2. Confirm the computed scoring-run activity entries (from `CaseAssemblyService.activityOf`) and
   any persisted `ActivityLogEntry` rows for that debtor appear together in `activity`, computed
   entries first (matching `CaseService.detailFor`'s current append order).
3. **Append-only check**: call the endpoint twice for the same debtor key; assert the persisted
   entry count (via `ActivityLogEntryRepository.findAllByDebtorKeyOrderByCreatedAtDesc`) is
   unchanged between calls — proves the read path never writes.
4. `GET /api/debtors?scope=cases` — assert `signals` on the row DTO for the same debtor matches
   the `CaseAssemblyServiceTest` expectations for that debtor's known field values.

Run: `cd backend && ./mvnw test -Dtest=DebtorControllerTest`.

## Step 3 — Full regression

`cd backend && ./mvnw test` — confirm all existing tests (#4/#5's suites, plus #13's
`RowAssemblerTest`/`DecisionServiceTest`) still pass unchanged, proving no shared code was
touched.

## Step 4 — Manual e2e verification

1. `docker compose up -d --build`.
2. Hit `GET /api/debtors?scope=cases` — pick 2–3 known seeded debtors covering different signal
   branches (one with missed instalments + arrears, one paying-on-cycle-adjacent, one with a
   defaulted arrangement if seed data has one) and manually verify signal text/order against
   hand-derived expectations.
3. Hit `GET /api/debtors/{debtorKey}` for the same debtors, verify `evidence` and `activity`
   content/order.
4. Adversarial: find or note the absence of a seeded debtor exercising the "all optional fields
   null" case; if none exists, rely on the unit test for that case and say so explicitly in the
   PR description (same transparency pattern #5 used for its mixed-sign regression case, which
   also had no matching seed data).
5. Document exact debtor keys checked, expected vs. actual, per `CLAUDE.md`'s e2e reporting
   requirement.

## Step 5 — Acceptance criteria sign-off

Walk all 4 checkboxes in the ticket and spec; mark each verified by the specific test that proves
it — including the 4th ("append-only") against the Scope recap's resolution of the Open Question.
Update `specs/issue-6-signals-evidence-activity-log.md` status from Draft to Implemented, same
pattern as #4/#5.

## Files touched

- New: `backend/src/test/java/com/adaptit/studentdebt/service/CaseAssemblyServiceTest.java`
- Changed: `backend/src/test/java/com/adaptit/studentdebt/web/DebtorControllerTest.java` (or a new
  `CaseServiceTest` — decided at implementation time)
- Updated: `specs/issue-6-signals-evidence-activity-log.md` (status → Implemented, checkboxes
  ticked, Open Question resolved)
- **No production code changes expected**, per the Scope recap above.

## Commit / PR (Gate 2 — separate approval required)

No commit without explicit approval tied to #6. PR would reference "Closes #6" and call out the
Open Question's resolution explicitly in the description, since it's a scope decision a reviewer
should be able to see and challenge, not just an implementation detail.
