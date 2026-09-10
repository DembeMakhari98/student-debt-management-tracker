# Data Dictionary — Daily CSV Extract (interim source, issue #33)

**Source file analysed:** `1523677863_10-SEP-2026-093322.csv` (`C:\Working\Files`, not committed to
this repo — contains real student PII).
**Status:** Interim replacement for `MockDebtorSourceAdapter` until the 5 ITS Integrator read
APIs and the write-back path exist (see #1, #33). Cadence: **daily** file drop, filename pattern
`<id>_<DD-MON-YYYY>-<HHMMSS>.csv`.
**Rows analysed:** 2,712 lines (2,705 usable data rows once the footer and malformed rows below
are excluded), 65 columns.
**PII note:** this repo is public. Real student numbers and names observed during analysis have
been redacted from this document — where a specific record needs to be located (e.g. to fix the
XSS payload or the corrupted balances), get the real identifiers from whoever ran this analysis
rather than from git history.

---

## 0. Findings that need action before this file is wired into anything

These aren't schema notes — they're things that will bite in production if ignored.

### 0.1 SECURITY — stored XSS payload present in the extract
6 rows contain a literal `"><SCRIPT>ALERT(1)</SCRIPT>` payload in `FirstNames` (real
`StudentNo` values are redacted from this doc since this repo is public — see them in the
private follow-up communication instead). This is either a leftover penetration-test
artifact or an actual injection that landed in the source system. Either way:
- **Never render `FirstNames`/`Surname`/any free-text field from this file unescaped** in the
  Angular frontend — Angular's default interpolation escapes HTML, so this is only a risk if
  anything binds these fields via `[innerHTML]` or similar. Worth a quick grep of the frontend
  for that pattern regardless.
- The same rows also carry an unescaped `"` inside a quoted CSV field, which breaks naive CSV
  parsing (see 0.3). This should be escalated to whoever owns the export — production extracts
  should not contain test-injection strings.
- Recommend flagging this to data governance / whoever owns the source system, not just quietly
  filtering it.

### 0.2 Two records have corrupted balance totals
`LocalBal`/`StudCurrBal` are non-sensical for 2 rows (real `StudentNo` values redacted from this
public doc): one shows **-R109,790,240,494.77** and the other **+R869,761,778.65**. Both students'
`AgeLastCol`/`AgePayable` fields (the ageing-bucket totals) hold sane, small values for the same
rows — so `LocalBal`/`StudCurrBal` are the corrupted fields, not the ageing buckets.
**Recommendation:** don't trust `LocalBal`/`StudCurrBal` as the source of truth for a debtor's
total. Derive the total from the ageing buckets (Section 2 below) and reject/quarantine any row
where `LocalBal` disagrees with the bucket-derived total by an implausible margin (e.g. >R5m) —
log it to `JobRunLog` as a partial-failure rather than silently ingesting a nine-digit garbage
balance into risk scoring.

### 0.3 Malformed CSV rows (unescaped quote inside a quoted field)
6 of 2,712 raw lines fail strict CSV parsing because a field contains an unescaped `"` (the same
rows as 0.1). A `CsvDebtorSourceAdapter` needs a tolerant parser (e.g. Apache Commons CSV with
lenient quote handling, or pre-clean with a regex) rather than a naive `split(',')` or a strict
RFC-4180 parser that would throw and fail the whole nightly job over 6 bad rows.

### 0.4 Trailing footer line
The last line of the file is `*** End of Report ***`, not data. Strip it (and any other non-CSV
trailer) before parsing, or the row-count/column-count check will misfire on it.

### 0.5 Test/QA records mixed into the extract
311 rows (~11.5%) carry a `TEST` token in `StatusCodes`; other rows have `FacultyName` = "Test
Offering Type", `CancDesc` = "Test Reason" / "Test Two Chars", and a cluster of obviously-dummy
`IdNumber` values (`1234567890123` ×6, `1111111111111` ×16, `9999999999999` ×2, sequential
`7XXXXXXXXXXXX` patterns, non-numeric IDs like `8349172KX`, `R985879849598`). If this is a genuine
production nightly extract, QA/test records should not be in it. **Open question for the data
owner:** is `TEST` in `StatusCodes` a reliable, complete filter for excluding these, or are there
test records without that tag? Until confirmed, treat any row with `TEST` in `StatusCodes` OR an
`IdNumber` matching an obvious dummy pattern as excluded from risk scoring, and log the excluded
count per run.

### 0.6 20% of rows have no financial year
540 of 2,705 rows have a blank `RegYear` (and, in the same rows, blank `Block`/`Campus`/
`Faculty`/`Qualification` etc.) — these look like historical/balance-carry-forward records with
no year attribution. Since `financialYear` is part of this app's primary key
(`debtorKey = studentId + "-" + year`), **these rows cannot be loaded as-is.** Needs a business
decision: exclude them, or assign them to a synthetic "unknown/legacy" year bucket.

### 0.7 Currency mix is unexplained
2,505 of 2,705 rows (92.6%) are in `SAR` (Saudi Arabian Riyal), not `ZAR`. Only 111 rows are
`ZAR`. If this extract is meant to represent the institution's South African student debt book,
this is either (a) evidence this file is a test/staging extract rather than representative
production data, or (b) this institution has a large offshore/international cohort billed in
local currency and the app needs an FX-conversion step it doesn't currently have. **Needs
business confirmation before this file is treated as ground truth** — Section 3.1 of the spec
assumes ZAR throughout.

---

## 1. Full column dictionary

| # | Column | Sample value | Distinct/blank | Notes |
|---|---|---|---|---|
| 0 | `StudentNo` | `STU-000001` *(real values redacted — public repo)* | 2,705 unique, 0 blank | Student identifier. Maps to app's `studentId`. |
| 1 | `Title` | `MRS` | — | |
| 2 | `Initials` | `EM` | — | |
| 3 | `Surname` | `SURNAME` *(real value redacted — public repo)* | — | Contains the XSS payload in 6 rows — see 0.1. |
| 4 | `FirstNames` | *(often blank)* | — | Same as above. |
| 5 | `StudentCurrency` | `SAR` | 10 values: SAR(2505), ZAR(111), NZD(52), US(16), GBP(15), CAN(2), YEN(1), ITL(1), JEN(1), DES(1) | See 0.7. |
| 6 | `CurrencyDesc` | `SAUDI ARABIAN RIYAL` | mirrors col 5 | |
| 7 | `Employer` | *(blank 94.6%)* | | Not used by app. |
| 8 | `EmployerName` | *(blank 94.6%)* | | Not used by app. |
| 9 | `IdNumber` | `7208170000000` | blank 54.6% | SA ID number. Contains dummy/test values — see 0.5. Not part of app's `Debtor` model (PII — should not flow further than needed for matching). |
| 10 | `TypeOfFunding` | `Private` | 3 values: `Private`(2692), `AWTB_0`(9), `NSFAS`(4) | Candidate source for `fundingSource` enum — see Section 2, open question. |
| 11 | `RegYear` | `1998` | 29 values, **blank 20.0%** | Candidate source for `financialYear` — see 0.6. |
| 12 | `Block` | `0` | blank 20.0% (same rows as RegYear) | Not used by app. |
| 13 | `BlockName` | `Year Block` | " | Not used by app. |
| 14 | `Faculty` | `10` | 15 values, blank 20.0% | Not used by app directly. |
| 15 | `FacultyName` | `Business School` | 14 values | Not used by app directly; "Test Offering Type"-adjacent values are a QA signal (0.5). |
| 16 | `Dept` | `10` | blank 20.0% | Not used by app. |
| 17 | `Deptname` | `Business Ethics` | | Not used by app. |
| 18 | `Qualification` | `100A-1` | blank 20.0% | Qualification code. |
| 19 | `QualName` | `B Domestic Science (Clothing)` | | Best candidate for app's `programme` (full qualification name). |
| 20 | `Campus` | `1` | blank 20.0% | Not used by app. |
| 21 | `CampusName` | `Main Campus` | | Not used by app. |
| 22 | `OffType` | `01` | 11 values | Not used by app. |
| 23 | `OfftypeName` | `Full Time (Main Campus)` | 11 values, incl. "Test Offering Type", "Test iEnabler 3" | QA signal (0.5). |
| 24 | `OfftypeSub` | `A` | blank 20.0% | Not used by app. |
| 25 | `StudType` | `N` | 9 values | Not used by app. |
| 26 | `StudTypeName` | `Normal Student` | incl. "Test 1" | QA signal (0.5). |
| 27 | `StudyPeriod` | `5` | blank 20.0% | Not used by app. |
| 28 | `StudyPerName` | `Fith Academic Level` | | Not used by app. |
| 29 | `CashTerms` | `C` | 3 values: `T`(1653), blank(540), `C`(512) | Loose proxy for "on a term/instalment plan" (`T`) vs "cash/paid in full" (`C`) — **not** equivalent to the app's `arrangementStatus` (which expects values like `"Defaulted"`). See Section 2. |
| 30 | `UnderPostGraduate` | `U` | `U`/`P`/blank | Not used by app. |
| 31 | `CancReason` | *(blank 96.5%)* | 16 codes | De-registration reason code, not a debt/collections field. Not used by app. |
| 32 | `CancDesc` | `Financial Reasons` | 16 values, incl. "Test Reason", "Test Two Chars" | QA signal (0.5). Describes *why a student cancelled/deregistered*, not a debt-collections reason — do not repurpose as `creditReason`. |
| 33 | `QualAwarded` | *(blank 91.5%)* | | Not used by app. |
| 34 | `QualAwardedYear` | *(blank 91.5%)* | | Not used by app. |
| 35 | `ResultCode` | `P` | 13 values (academic pass/fail codes) | Not used by app — this is an academic result, not a financial/funding status. |
| 36 | `DecisionDate` | *(blank 94.7%)* | | Not used by app. |
| 37 | `CeremonyDate` | *(blank 93.6%)* | | Not used by app. |
| 38 | `CeremonyTime` | *(blank 93.7%)* | | Not used by app. |
| 39 | `LocalBal` | `7930.67` | — | See 0.2 — do not trust blindly. |
| 40 | `StudCurrBal` | `7930.67` | — | Same balance in student's currency; see 0.2 and 0.7. |
| 41 | `AgeLastCol` | `7930.67` | — | Appears to be a running total (matches `AgePayable` in sane rows), not a day-bucket despite the name. Useful as a cross-check against `LocalBal`. |
| 42 | `AgeCol365` | `0` | **always 0** in this file | Day-365+ bucket. Roll into app's `ageing120` (120+ consolidated). |
| 43 | `AgeCol330` | `0` | max 6180 | " |
| 44 | `AgeCol300` | `0` | **always 0** | " |
| 45 | `AgeCol270` | `0` | max 855.37 | " |
| 46 | `AgeCol240` | `0` | max 8215 | " |
| 47 | `AgeCol210` | `0` | **always 0** | " |
| 48 | `AgeCol180` | `0` | max 850 | " |
| 49 | `AgeCol150` | `0` | max 53628.80 | " |
| 50 | `AgeCol120` | `0` | max 2060 | Start of the "120+" consolidated bucket. |
| 51 | `AgeCol90` | `0` | **always 0** | Maps directly to app's `ageing90`. |
| 52 | `AgeCol60` | `0` | max 654109.28 | Maps directly to app's `ageing60`. |
| 53 | `AgeCol30` | `0` | max 2210 | Maps directly to app's `ageing30`. |
| 54 | `AgeColCurrent` | `0` | min -0.01 | Maps directly to app's `ageingCurrent`. |
| 55 | `AgeUnall` | `0` | negatives present (44 rows) | "Unallocated" cash — a suspense amount, not one of the app's 5 buckets. Needs a decision: fold into `ageingCurrent`, or drop. |
| 56 | `AgeFuture` | `0` | max 6490 | Charges not yet due. Not part of the app's current ageing model. |
| 57 | `AgePayable` | `7930.67` | — | Aggregate of positive buckets — good cross-check against the sum of buckets 42–54. |
| 58 | `AgeCredits` | `0` | negatives present (247 rows), always ≤ 0 | Aggregate credit total. A row with `AgeCredits < 0` is an "owed to student" case (app's `owedToStudent`). |
| 59 | `FutureCurrent` | `0` | **always 0** | Not used. |
| 60 | `Future30` | `0` | **always 0** | Not used. |
| 61 | `Future60` | `0` | **always 0** | Not used. |
| 62 | `Future90` | `0` | **always 0** | Not used. |
| 63 | `FutureLastCol` | `0` | **always 0** | Not used. |
| 64 | `StatusCodes` | `\|0610\|A2\|A21\|...` | 128 distinct pipe-delimited tokens across the file | Administrative status flags. `TEST` is the QA-record signal (0.5). The rest (`FIN`, `FINB`, `FINW`, `FIND`, `FINT`, `FINR`, `FINS`, `BURS`, `BREG`, etc.) look finance-related but **there is no legend in this extract** — can't be safely decoded into `fundingStatus` without the platform team providing a code glossary. |

---

## 2. Mapping to the app's `Debtor` model (§3.1 of TECHNICAL_SPECIFICATION.md)

| App field | Source | Transformation | Status |
|---|---|---|---|
| `debtorKey` | `StudentNo` + `RegYear` | `"{StudentNo}-{RegYear}"` | ⚠️ Blocked for the 20% of rows with blank `RegYear` (0.6) |
| `studentId` | `StudentNo` | direct | ✅ Direct |
| `name` | `Title`, `Initials`, `Surname`, `FirstNames` | `FirstNames` is blank in most rows sampled — build from `Initials` + `Surname` (e.g. `"AB Nkosi"`, illustrative), title-cased | ✅ Derivable |
| `financialYear` | `RegYear` | parse int | ⚠️ 20% blank (0.6) |
| `programme` | `QualName` | direct | ✅ Direct (blank 20% same rows as 0.6) |
| `fundingSource` (enum `SELF`/`GOV`/`PRIVATE`) | `TypeOfFunding` | `NSFAS` → `GOV`; `Private` → ?; `AWTB_0` → ? | ❌ **Needs confirmation** — see below |
| `fundingStatus` (free text, drives risk weight, §3.3) | *no direct column* | Cannot be derived from `StatusCodes` without a code legend | ❌ **Not available in this file** |
| `missedInstalments` | *no column* | — | ❌ **Not available in this file** |
| `lastPaymentDate` | *no column* | — | ❌ **Not available in this file** |
| `arrangementStatus` | *no column* (loose proxy: `CashTerms`) | `CashTerms` distinguishes "on terms" vs "cash" but has no "Defaulted" concept | ❌ **Not available in this file** |
| `ageingCurrent` | `AgeColCurrent` | direct | ✅ Direct |
| `ageing30` | `AgeCol30` | direct | ✅ Direct |
| `ageing60` | `AgeCol60` | direct | ✅ Direct |
| `ageing90` | `AgeCol90` | direct | ✅ Direct |
| `ageing120` | `AgeCol120 + AgeCol150 + AgeCol180 + AgeCol210 + AgeCol240 + AgeCol270 + AgeCol300 + AgeCol330 + AgeCol365` | sum the 9 finer buckets into the app's single "120+" bucket | ✅ Derivable |
| `creditSince` | *no column* | — | ❌ **Not available in this file** |
| `creditDays` | *no column* | — | ❌ **Not available in this file** |
| `creditReason` | *no column* (do not reuse `CancDesc` — different meaning) | — | ❌ **Not available in this file** |

**`RegisteredCount`:** could be approximated by counting distinct `StudentNo` per `RegYear` in
this same file, but this file appears to be a *debtors ledger* (only students with a balance),
not a full registration roster — counting it here would understate the true registered headcount
used for the "% of book" KPI (§3.4). **Needs a separate source or explicit confirmation this file
is the full population, not just the debtor subset.**

---

## 3. Net assessment

**What this file gives us today:** identity (`studentId`, `name`), `financialYear` (80% of rows),
`programme`, and a fully derivable 5-bucket ageing profile (`ageingCurrent`…`ageing120`) — enough
to run risk scoring's ageing-based signals (arrears, over90, owedToStudent, oldestBucket, §3.2)
and the pick-up rule's `rowDebt`/`arrears` checks (#5).

**What it does not give us:** `fundingStatus` (the single biggest input to the risk-weight table,
§3.3 — worth up to 16 points), `missedInstalments`, `lastPaymentDate`, and `arrangementStatus`.
Without these, the risk scoring engine (§4) and decision engine (§5) would be running on a
meaningfully incomplete `Debtor` record — case signals like *"3 missed instalments"* or evidence
like *"Funding · NSFAS pending"* (§4.5) cannot be generated from this file as it stands.

**Recommendation:** before wiring a `CsvDebtorSourceAdapter` in as `MockDebtorSourceAdapter`'s
daily replacement, get the file's owner to either (a) add the missing four fields to the daily
export, or (b) confirm a legend for `StatusCodes` and `TypeOfFunding` that can reliably derive
`fundingStatus`, and a source for `missedInstalments`/`lastPaymentDate`/`arrangementStatus`. In
the meantime the adapter can populate what's derivable and default the rest (e.g.
`fundingStatus = "Unknown"`, `missedInstalments = 0`) — but that would silently understate risk
for every debtor, so it should ship with the risk clearly flagged, not treated as good enough for
production scoring.

---

## 4. Open questions for the data/business owner

1. Does `Private` in `TypeOfFunding` map to the app's `SELF` (self-funded) or `PRIVATE`
   (bursary/sponsor)? Given it's 99.5% of records, this materially changes the risk profile of
   almost the whole book depending on the answer.
2. What is `AWTB_0` (9 records)? Looks like a specific sponsor/bursary code.
3. Is there a legend for the 128 `StatusCodes` tokens, specifically the `FIN`/`FINB`/`FINW`/
   `FIND`/`FINT`/`FINR`/`FINS` family — could any of these reliably derive `fundingStatus`?
4. Is `TEST` in `StatusCodes` a complete and reliable filter for excluding QA/test records (0.5)?
5. Should the 540 rows with blank `RegYear` (0.6) be excluded, or assigned an "unknown year"
   bucket?
6. Is the `SAR`/`ZAR` currency mix (0.7) expected for this institution's real debtor book, or is
   this extract test/staging data?
7. Can `missedInstalments`, `lastPaymentDate`, and `arrangementStatus` be added to the daily
   export? These are currently the biggest gap against the app's data model.
