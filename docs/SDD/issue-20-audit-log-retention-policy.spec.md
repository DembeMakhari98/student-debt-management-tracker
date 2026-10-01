# Spec: Define audit log retention policy

**Ticket:** [#20](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/20)
**Branch base:** `develop` (branch: `feat/audit-log-retention-policy`)
**Spec reference:** TECHNICAL_SPECIFICATION.md §7 (Auditability / POPIA), Open Item 7

## Overview / Goals

TECHNICAL_SPECIFICATION.md §7 currently carries two statements that are in tension:

- The POPIA bullet: "Data retention period for case history `[TO CONFIRM]`."
- The Auditability bullet: the activity log and officer decision records "must be
  immutable and permanently retained."

The POPIA impact assessment BA answer (2026-09-08, incorporated into
`docs/compliance/popia-impact-assessment.md` on the still-unmerged
`feat/popia-impact-assessment` branch) already settled the open question: **retain
case history for 7 years after a student's final financial year.** This ticket does
not depend on that branch merging — the 7-year figure is an independently confirmed
fact, and this ticket documents and enforces it directly on `develop`.

"Immutable and permanently retained" and "7 years then purge" are not actually
contradictory: immutable means no *edit* path exists (true today — no
update/delete endpoint is exposed for `ActivityLogEntry` or `OfficerDecision`), while
retention is about how long the data is kept before scheduled deletion. This ticket
corrects the Auditability bullet's "permanently" wording to reflect the finite,
POPIA-driven retention window, and adds the one deletion path that's allowed to
exist: an internal, scheduled compliance purge — never an API-triggered delete.

## Non-Goals

- **Not blocked on #2 (nightly extraction) or #33 (ITS Integrator APIs).** The purge
  job is a separate nightly schedule that runs against whatever `Debtor` rows already
  exist; it does not require real ITS integration to exist first.
- **No delete/purge exposed via the API.** The only deletion path is the internal
  scheduled job — preserves the existing "no update/delete path exposed anywhere in
  the API" guarantee for officers and agents.
- **No true enrolment-status signal.** Determining a student's actual "final"
  financial year (graduated / withdrawn) would need a real signal from ITS
  Integrator, which doesn't exist yet. This ticket approximates "final" as *the
  latest financial year currently on file for that student* — see Open Questions.
- **No new Liquibase changelog.** This is pure application logic against the existing
  schema; no columns or tables change.

## Acceptance Criteria (from the ticket, mapped to implementation)

- [x] **Retention period agreed with compliance/records-management** — already
      satisfied by the BA's 2026-09-08 answer (7 years after a student's final
      financial year); no further action needed here.
- [ ] **Retention enforced in the data store** — new `RetentionPolicyService` in the
      backend, run nightly via `@Scheduled`, purges `Debtor`, `ActivityLogEntry`, and
      `OfficerDecision` rows for a `studentId` once its retention window has expired.
- [ ] **Decision documented in the technical spec** — TECHNICAL_SPECIFICATION.md §7
      updated (both bullets reconciled) and Open Items list item 7 marked resolved.

## Technical Design

### Retention eligibility

- A student's **latest financial year on file** (`max(financialYear)` across all
  their `Debtor` rows, grouped by `studentId`) stands in for their "final" financial
  year, per the Non-Goals note above.
- **Assumption (flagging for approval):** a financial year `N` is treated as ending
  **31 December of year N**. Nothing in the codebase currently defines a financial
  year's end date — `financialYear` is stored as a plain calendar-year `Integer`
  (`Debtor.java:39`) with no start/end fields. This is the one real judgment call in
  this spec.
- A `studentId` becomes purge-eligible once `today >= 31-Dec-<latestFinancialYear> +
  7 years`.

### `RetentionPolicyService` (new)

```java
@Service
public class RetentionPolicyService {
    private final DebtorRepository debtorRepository;
    private final ActivityLogEntryRepository activityLogEntryRepository;
    private final OfficerDecisionRepository officerDecisionRepository;
    private final Clock clock; // default Clock.systemDefaultZone(), fixed in tests
    private final int retentionYears; // @Value("${app.retention.case-history-years:7}")

    /** Pure — no I/O, easy to unit test exhaustively. */
    boolean isEligibleForPurge(int latestFinancialYear, LocalDate today) {
        LocalDate expiry = LocalDate.of(latestFinancialYear, 12, 31).plusYears(retentionYears);
        return !today.isBefore(expiry);
    }

    /** Groups Debtor rows by studentId, keeps the max financialYear per student. */
    List<String> findStudentIdsEligibleForPurge(LocalDate today) { ... }

    @Scheduled(cron = "0 30 1 * * *")
    public void purgeExpiredCaseHistory() {
        LocalDate today = LocalDate.now(clock);
        for (String studentId : findStudentIdsEligibleForPurge(today)) {
            List<Debtor> rows = debtorRepository.findAllByStudentId(studentId);
            for (Debtor d : rows) {
                activityLogEntryRepository.deleteAllByDebtorKey(d.getDebtorKey());
                officerDecisionRepository.deleteAllByDebtorKey(d.getDebtorKey());
            }
            debtorRepository.deleteAll(rows);
            log.info("Purged case history for studentId={} ({} financial year rows)", studentId, rows.size());
        }
    }
}
```

### Repository additions

- `DebtorRepository.findAllByStudentId(String studentId)` (new).
- `ActivityLogEntryRepository.deleteAllByDebtorKey(String debtorKey)` (new).
- `OfficerDecisionRepository.deleteAllByDebtorKey(String debtorKey)` (new).

### Wiring

- `@EnableScheduling` added to `StudentDebtTrackerApplication` — this is the first
  scheduled job in the app.
- `application.yml`: new `app.retention.case-history-years: 7` (matches the existing
  `app.cors.allowed-origins` style of externalising a policy constant rather than
  hardcoding it).

### Documentation

- TECHNICAL_SPECIFICATION.md §7: POPIA bullet's `[TO CONFIRM]` replaced with "7 years
  after a student's final financial year (confirmed via POPIA impact assessment BA
  answer, 2026-09-08)"; Auditability bullet's "permanently retained" reworded to
  "retained for the POPIA-confirmed retention period (see above), immutable
  throughout — no update/delete path is exposed via the API."
- Open Items list (§10), item 7: struck through / marked resolved with a pointer to
  this section.

## Testing Strategy

New `RetentionPolicyServiceTest` (plain JUnit5 + Mockito + AssertJ, mocked
repositories, fixed `Clock` — matches `DecisionServiceTest`'s style, no Spring
context):

- `isEligibleForPurge`: false well before the 7-year mark; false the day before
  expiry; true on the exact expiry date; true well after.
- `findStudentIdsEligibleForPurge`: a studentId whose only/latest year is expired is
  included; a studentId with an expired *old* year but a newer, current year is
  excluded (eligibility is per-student off their latest year, not per-row); a
  studentId with no expired year is excluded entirely.
- `purgeExpiredCaseHistory`: for an eligible studentId, verifies deletes are invoked
  against all three repositories for every financial-year row belonging to that
  student; verifies an ineligible studentId's rows are never touched
  (`verify(..., never())`).

## Metrics & Success Criteria

- TECHNICAL_SPECIFICATION.md §7 no longer lists retention as `[TO CONFIRM]`; Open
  Items list item 7 marked resolved.
- `mvnw test` passes (JDK 21 required — see workspace notes) with the new test class
  included, no regressions to existing suites.
- App boots cleanly with `@EnableScheduling` wired (checked manually, not by waiting
  for the cron trigger).

## Risks & Mitigations

- **Risk: irreversible deletion.** A bug here permanently destroys audit-trail data —
  the opposite of what a retention *policy* ticket should ever cause.
  **Mitigation:** eligibility logic isolated in a pure, exhaustively unit-tested
  method; every purge run logs exactly which `studentId`s and row counts were
  removed, so the purge itself is auditable after the fact even though the purged
  rows are gone; retention years is a config value, not a scattered literal.
- **Risk: "latest year on file" is an approximation of "final year."** If a student's
  nightly extract has a gap year for a reason unrelated to leaving (e.g., a term with
  no debt), this could purge their older history too early. Known limitation, not
  solvable without a real enrolment-status signal from ITS Integrator (#33) —
  flagged, not fixed, in this ticket.
- **Risk: nothing currently exercises this path with real data.** All seed data is
  financial year 2026, nowhere near the 7-year threshold — so behaviour is verified
  by unit tests only until real data ages. Expected for a policy-enforcement ticket
  at this stage.

## Known Limitations (deferred, not fixed in this ticket)

- **Full-table scan + single transaction.** `findStudentIdsEligibleForPurge` loads
  every `Debtor` row nightly via `findAll()`, and `purgeExpiredCaseHistory()` runs
  every eligible student's purge inside one `@Transactional` method — a failure part
  way through rolls back the whole run, not just the offending student. Caught in
  Stage 6 review. Not fixed here because the current dataset is ~25 rows and no
  nightly job infrastructure exists anywhere else in this app yet (see #2/#33) —
  revisit with a DB-side aggregate query (`max(financial_year) group by student_id`)
  and per-student transactions once the debtor book and nightly job cadence are
  real.

## Open Questions

None — both judgment calls below were confirmed with the user before development:

1. **FY-end-date assumption:** confirmed as 31 December of the financial year.
2. **Scope of "case history":** confirmed as the full case record (`Debtor` +
   `ActivityLogEntry` + `OfficerDecision`) — matches the Technical Design above.
