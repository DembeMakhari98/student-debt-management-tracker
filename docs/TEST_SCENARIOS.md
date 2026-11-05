# Test Case Scenarios — Seeded Data Walkthrough

This document is the narrative behind `backend/src/main/resources/db/changelog/012-seed-test-scenarios.xml`,
the Liquibase changeset that extends the base demo book (`001`–`011`) so every business rule and every
screen in the app has at least one concrete, checkable example on a freshly built database. Every scenario
below was verified live against a running backend (`./mvnw spring-boot:run`) on 2026-11-03.

All seeded users sign in with password `Debt@2026!` (see `README.md`). Dates below are shown in UTC as the
API returns them; the backend's own logs use SAST (UTC+2).

## How to re-apply

```bash
docker compose up -d
cd backend && ./mvnw spring-boot:run   # Liquibase runs 012-seed-test-scenarios.xml automatically
```

The changeset runs under the `!prod and !test` context: like the demo users (`008`) and demo assignments
(`010`) it is skipped in a real deployment (`SPRING_LIQUIBASE_CONTEXTS=prod`), and it is additionally
excluded from the backend's own test suite (`src/test/resources/application.yml` sets
`spring.liquibase.contexts: test`) so the many tests that assert exact fixture shapes against the original
26-debtor demo book keep passing unchanged.

---

## 1. Risk scoring (`RiskScoringService`, business case §3.3)

The score is a sum of flat-rate and scaled components, clamped to 1–99, then banded WATCH (&lt;45),
ELEVATED (45–69), HIGH (≥70); `rowTotal &lt; 0` (a credit balance) is a separate CREDIT display band that
overrides the numeric score entirely.

| Scenario | Debtor | Expected | Verify |
|---|---|---|---|
| Zero debt → score 0 | any fully-paid debtor | score 0, no band shown | n/a (none seeded — all seeded debtors owe something) |
| Exact WATCH/ELEVATED boundary — 44 (WATCH) | `STU-100402-2026` Mandla Ndlovu | `riskScore: 44`, `riskBand: "WATCH"` | `GET /api/debtors/STU-100402-2026` |
| Exact WATCH/ELEVATED boundary — 45 (ELEVATED) | `STU-100403-2026` Siyabonga Radebe | `riskScore: 45`, `riskBand: "ELEVATED"` | `GET /api/debtors/STU-100403-2026` |
| Exact ELEVATED/HIGH boundary — 69 (ELEVATED) | `STU-100404-2026` Boitumelo Seroka | `riskScore: 69`, `riskBand: "ELEVATED"` | `GET /api/debtors/STU-100404-2026` |
| Exact ELEVATED/HIGH boundary — 70 (HIGH) | `STU-100405-2026` Karabo Modise | `riskScore: 70`, `riskBand: "HIGH"` | `GET /api/debtors/STU-100405-2026` |
| Low-risk baseline | `STU-100401-2026` Lindiwe Khumalo | `riskScore: 4`, `riskBand: "WATCH"` | `GET /api/debtors/STU-100401-2026` |
| Fresh credit (&lt;90 days) | `STU-100341-2026` Mpho Sithole | CREDIT band, `credit_days: 24` | already in `003` |
| Stale credit (&gt;90 days) | `STU-100355-2026` Jessica Adams, `STU-098140-2025` Hlengiwe Maluleke, `STU-095066-2024` Vanessa Coetzee | CREDIT band, `credit_days` 190/212/168 | already in `003` |

All four boundary cases were confirmed by calling the live API — e.g. Mandla Ndlovu's score is built from
`d60(+8) + d90(+14) + missed=2(+14) + fundingWeight("Bursary partial"=+8) = 44`.

## 2. Decision engine (`DecisionEngineService`, business case §3.4, 8 rules, first match wins)

| Rule | Recommendation | Debtor(s) already covering it | New debtor added |
|---|---|---|---|
| 1. `rowTotal &lt; 0` | REFUND | Mpho Sithole, Jessica Adams, Hlengiwe Maluleke, Vanessa Coetzee | — |
| 2. Defaulted **and** no last payment | REGISTRATION_HOLD | Refilwe van Wyk, Oratile Mabaso | — |
| 2 (negative case) — Defaulted **but has** a last payment → rule 2 does **not** fire, falls through | PAYMENT_ARRANGEMENT (via rule 6) | **`STU-098012-2025` Dineo Nkosi** (`arrangement_status=Defaulted`, `last_payment_date=2025-04-14`) | already existed — verified live: `recommendation.type = "PAYMENT_ARRANGEMENT"`, not REGISTRATION_HOLD |
| 3. Funding lapsed/declined | HARDSHIP_FUND | several NSFAS lapsed/declined, Bursary lapsed | Siyabonga Radebe (45), Boitumelo Seroka (69), Karabo Modise (70) also land here since their funding status matches first |
| 4. Pending **and** missed≥2 | PAYMENT_ARRANGEMENT (holding) | Lerato Naidoo | — |
| 5. Pending, missed&lt;2 | FUNDING_CHASE | Naledi Mahlangu | — |
| 6. missed≥2, any funding | PAYMENT_ARRANGEMENT | Ayanda Pillay, Farhana Jacobs, Gerrit Petersen, Dineo Nkosi | **Mandla Ndlovu** (44) |
| 7. missed==1 | REMINDER_CADENCE | Kagiso Botha | **Nandi Mkhize, Tumi Sithole, Zanele Dube** |
| 8. Otherwise | MONITOR | Sipho Dlamini, Palesa Khumalo | **Lindiwe Khumalo** |

**Key interaction to demo:** rule 3 (funding status) is checked *before* the missed-instalment rules, so a
debtor with `NSFAS declined`/`lapsed` always gets HARDSHIP_FUND regardless of how many instalments are
missed — this is why the 45/69/70 score-boundary debtors all show HARDSHIP_FUND rather than
PAYMENT_ARRANGEMENT or REMINDER_CADENCE even though their `missed_instalments` would otherwise qualify.

## 3. Autonomy levels (business case §3.6) and the reminder-cadence gate

System is seeded at **Level 2 (Recommend)** — nothing auto-executes. `autonomy_level_audit` carries a full
history ending at the current value, so the audit trail is consistent with `system_setting`:

| old → new | by | when |
|---|---|---|
| 1 → 2 | System Administrator | 2026-08-01 (go-live default) |
| 2 → 3 | Grace van Rooyen | 2026-09-15 (manager trial) |
| 3 → 2 | System Administrator | 2026-09-22 (reverted) |

(No GET endpoint exposes this table — `PUT /api/settings/autonomy` both changes the level and appends the
next audit row; verify history directly in Postgres: `SELECT * FROM autonomy_level_audit ORDER BY changed_at`.)

**Reminder cadence progress** (`GET /api/reminders/progress?portfolio=all`) — four debtors, each at a
different stage, confirmed live:

| Debtor | Started | Steps sent | Demonstrates |
|---|---|---|---|
| `STU-100406-2026` Nandi Mkhize | today (2026-11-03) | 0/3, next due tomorrow | Day-0 — cadence just started, nothing due yet |
| `STU-100288-2026` Kagiso Botha | 2026-10-29 | 1/3 (SMS sent 2026-10-30), next due **today** | Mid-cadence — step 2 (WhatsApp) is due right now |
| `STU-100407-2026` Tumi Sithole | 2026-10-18 | 3/3 complete | Full cadence completion |
| `STU-100408-2026` Zanele Dube | 2026-10-25 (9 days ago) | 0/3, `nextStepDueAt` already **in the past** | **Gated/withheld** — day 1 and day 5 thresholds passed, but Level 2 blocks all auto-dispatch; the clock keeps running, dispatch does not |

**Live test:** raise autonomy to Level 3 (`PUT /api/settings/autonomy`) and call `POST /api/admin/reminders/run`
(MANAGER/ADMIN only). Expected: Kagiso Botha's step 2 fires; Zanele Dube's steps 1 **and** 2 fire together
(both overdue); step 3 doesn't fire for anyone yet (10-day threshold not reached for either). Revert to
Level 2 afterwards to keep the seed's documented state accurate.

## 4. Officer decisions — approve / amend / decline (`DecisionService`, issue #13)

Each decision was written against a debtor whose *live* recommendation still matches the stored
`recommendation_type`, so the case shows as resolved. Verified via `GET /api/debtors/{key}` → `lastDecision`.

| Action | Debtor | Recommendation type | Decided by | Detail |
|---|---|---|---|---|
| APPROVE | `STU-100355-2026` Jessica Adams | REFUND | Priya Naidoo | no amended terms / reason needed |
| AMEND | `STU-100333-2026` Ayanda Pillay | PAYMENT_ARRANGEMENT | Nomsa Mahlangu | `amendedTerms`: "6 instalments of R866.67, first debit on the 1st of next month — student requested month-end pay-cycle alignment instead of the 22nd." |
| DECLINE | `STU-100301-2026` Refilwe van Wyk | REGISTRATION_HOLD | Thato Mokoena | `reason`: "Student has since made contact; holding the registration hold pending a hardship-fund assessment this week." |

Each decision also produced a matching `activity_log_entry` and a `write_back_attempt` (SUCCESS, attempt 1) —
the normal happy path.

**Not yet exercised (needs a live UI/API action, not seedable meaningfully):** `AMEND` without `amendedTerms`
→ expect `400` ValidationException; `DECLINE` without `reason` → expect `400`; submitting a decision whose
`recommendationType` no longer matches the debtor's current (re-scored) recommendation.

## 5. Write-back attempts and failures (`ActivityLogWriteBackService`, issue #3/#61)

The real `MockActivityLogWriteBackAdapter` **always succeeds**, so failure/retry states can only be produced
by seeding `write_back_attempt` rows directly (confirmed by reading the adapter source).

| Scenario | Entry | Attempts seeded | Live behaviour observed |
|---|---|---|---|
| **Stuck failure** (surfaces in failures list) | Lerato Naidoo's holding-arrangement confirmation (`STU-100251-2026`) | 1 FAILED, 2 FAILED, 3 FAILED (connection refused → timeout → 503) | Appears in `GET /api/admin/writeback/failures`. `POST /api/admin/writeback/{attemptId}/retry` with this attempt's id will force a 4th attempt, which **will succeed** (mock always succeeds) and clear it from the list — good smoke test for the admin retry button, the current feature branch (`feature/69-admin-writeback-failures`). |
| **Not yet exhausted** (self-heals) | Gerrit Petersen's step-2 WhatsApp reminder (`STU-098111-2025`) | 1 FAILED, 2 FAILED seeded | The `@Scheduled` sweep (`fixedRate=15min`, fires immediately on app startup) already picked this up and recorded a 3rd, **SUCCESS** attempt within seconds of the backend restarting — confirmed in the DB. This is the intended self-heal behaviour, not a bug: it demonstrates that a transient failure clears on its own once the integration is healthy again. To see it still "in progress" (2/3, not yet in the failures list), inspect it immediately after a fresh `docker compose up` + backend start, before 15 minutes elapse. |
| **Happy path baseline** | All 3 officer-decision write-backs (§4), the manual CALL engagement (§6), and all reminder-cadence dispatches (§3) | SUCCESS, attempt 1 | — |

## 6. Manual engagement channels (`EngagementService`, issue #59)

| Channel | Debtor | Note |
|---|---|---|
| CALL | `STU-098044-2025` Christo Meyer | "Explained the hardship fund referral and requested an updated NSFAS appeal reference number." — logged by Grace van Rooyen, his assigned manager |

SMS and WhatsApp manual engagements follow the identical `EngagementService` code path with a different
`channel` value — exercise these live via the UI's engagement buttons or `POST /api/debtors/{key}/engagements`
rather than seeding more rows; the reminder-cadence dispatches in §3 already seed SMS/WhatsApp activity
entries via the *other* code path (`ReminderCadenceService`), so both producers of `activity_log_entry` are
represented.

## 7. Nightly extract job history (`NightlyExtractService`, issue #2)

| Status | When | Records | Error |
|---|---|---|---|
| SUCCESS | 2026-11-02 | 34 | — |
| FAILURE | 2026-11-01 | 0 | "Connection to the Debtors source view timed out after 5000ms" (failed before processing anything) |
| FAILURE | 2026-10-31 | 14 | "Student Funding extract returned a malformed row at offset 15 — batch aborted" (partial processing then aborted) |

Verify: `GET /api/admin/extract/history?limit=10` (MANAGER/ADMIN only).

## 8. Portfolio scope, assignment, and escalation audit (issues #55/#56/#62)

| Scenario | Debtor / user | Verify |
|---|---|---|
| **Unassigned debtor** — only visible under `portfolio=all` | `STU-100401-2026` Lindiwe Khumalo (`assignedOfficer: null`) | `GET /api/debtors?portfolio=own` as any officer excludes her; `GET /api/debtors?portfolio=all` as MANAGER/ADMIN includes her |
| OFFICER attempting `portfolio=all` | any OFFICER account (e.g. `nomsa.mahlangu`) | expect `403` |
| TEAM scope with 2 officers | Team A (`nomsa.mahlangu`, `sibusiso.khoza`) or Team B (`anele.dube`, `priya.naidoo`) | `portfolio=team` as one officer should include the other's cases |
| Reassignment (MANAGER/ADMIN only) | any debtor | `PATCH /api/debtors/{key}/assignment` |
| Portfolio escalation audit | — | 3 seeded rows (`grace.vanrooyen` on `/api/debtors` and `/api/debtors/export`, `admin` on `/api/summary`) plus whatever real `portfolio=all` calls have been made since — `GET /api/audit/portfolio-escalations?limit=20` (MANAGER/ADMIN only) |

## 9. Retention (issue #20) — not practically seedable

Purge eligibility is `max(financial_year) + 7 years` past 31 Dec. "Today" is 2026-11-03, so only
`financial_year ≤ 2019` qualifies — nothing in this dataset (earliest seeded year is 2022) should ever be
purged by design. Testing the actual purge requires manipulating the `Clock` bean in an integration test,
not live seed data; seeding a qualifying row would make a demo student vanish on the next run, which is the
opposite of what this dataset is for.

---

## Appendix — every new debtor added by `012-seed-test-scenarios.xml`

| Key | Name | Purpose | Score | Band | Recommendation | Officer |
|---|---|---|---|---|---|---|
| STU-100401-2026 | Lindiwe Khumalo | Unassigned caseload | 4 | WATCH | MONITOR | *(none)* |
| STU-100402-2026 | Mandla Ndlovu | WATCH/ELEVATED boundary (44) | 44 | WATCH | PAYMENT_ARRANGEMENT | sibusiso-khoza |
| STU-100403-2026 | Siyabonga Radebe | WATCH/ELEVATED boundary (45) | 45 | ELEVATED | HARDSHIP_FUND | anele-dube |
| STU-100404-2026 | Boitumelo Seroka | ELEVATED/HIGH boundary (69) | 69 | ELEVATED | HARDSHIP_FUND | priya-naidoo |
| STU-100405-2026 | Karabo Modise | ELEVATED/HIGH boundary (70) | 70 | HIGH | HARDSHIP_FUND | thato-mokoena |
| STU-100406-2026 | Nandi Mkhize | Reminder cadence, day 0 | 16 | WATCH | REMINDER_CADENCE | nomsa-mahlangu |
| STU-100407-2026 | Tumi Sithole | Reminder cadence, complete | 16 | WATCH | REMINDER_CADENCE | sibusiso-khoza |
| STU-100408-2026 | Zanele Dube | Reminder cadence, gate-withheld | 16 | WATCH | REMINDER_CADENCE | anele-dube |

Total debtor count after seeding: **34** (26 original + 8 new).
