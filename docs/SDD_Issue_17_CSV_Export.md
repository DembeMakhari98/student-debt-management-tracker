# Software Design Document: Issue #17
## Export Filtered Debt Tracker View to CSV

**Status:** Draft for Development  
**Complexity:** LOW  
**Estimated Effort:** 8–12 hours  
**Fast-Track Eligible:** YES (feature extension, clear spec, no upstream blockers)  
**Dependency:** Issue #11 (Debt Tracker workspace must be complete)

---

## 1. Purpose

Enable debt officers to export the currently filtered dataset (year + funding source) to a CSV file for offline analysis, external reporting, and data sharing with stakeholders. The export respects all active filters and preserves exact column order and calculated fields as shown on-screen.

---

## 2. Scope

**In Scope:**
- Export button in WorkspaceHeader (Global Filters section)
- Apply year and funding filters to exported dataset
- Generate CSV with 20 columns in exact order (per spec Section 6.5)
- Download file with automatic naming: `student-debt-tracker-{year}-{funding}.csv`
- Handle credit balances (negative `rowTotal`) and band mapping (literal "Credit" for in-credit debtors)
- UTF-8 encoding with BOM

**Out of Scope:**
- Real-time sync or live updates
- Custom column selection or reordering
- Scheduled/automatic exports
- Email delivery
- Filtering within the CSV file itself

---

## 3. Acceptance Criteria

**AC1:** Export button is visible in WorkspaceHeader next to the global filters (year and funding dropdowns)

**AC2:** CSV file respects the currently active year and funding filters; only rows matching both filters are included

**AC3:** Exported CSV has exactly 20 columns in this order (no more, no less):
```
Student ID, Name, Programme, Funding, Funding status, Year, Missed instalments,
Last payment, Current, 30 days, 60 days, 90 days, 120+ days, Balance, Risk score,
Band, Picked up by agent, AI recommendation, Status, Policy
```

**AC4:** Band column contains literal string "Credit" for in-credit debtors; otherwise the risk band (Watch/Elevated/High)

**AC5:** File downloads with the pattern `student-debt-tracker-{year}-{funding}.csv` where `{year}` is the fiscal year and `{funding}` is the funding source slug (e.g., `student-debt-tracker-2026-gov.csv`)

---

## 4. Technical Design

### 4.1 Trigger & UI

- **Location:** WorkspaceHeader component (next to funding filter dropdown)
- **Label:** "Export to CSV" or "Download CSV"
- **Icon:** Download icon (from existing UI library)
- **Placement:** After Funding filter, before or after Autonomy Level selector
- **Disabled state:** When filters produce 0 results

### 4.2 Logic Flow

```
User clicks Export button
  ↓
Resolve current filter state (year, funding) from Redux
  ↓
Fetch or use cached case list matching filters
  ↓
Transform each case → CSV row (apply field mappings, Section 4.3)
  ↓
Build CSV string (RFC 4180: CRLF line endings, quoted fields)
  ↓
Generate filename from filter state
  ↓
Trigger browser download (blob + URL.createObjectURL)
```

### 4.3 Field Mapping (Debtor → CSV Column)

| CSV Column | Source | Transform Rule |
|---|---|---|
| Student ID | `debtor.id` | Literal |
| Name | `debtor.name` | Literal |
| Programme | `debtor.programme` | Literal |
| Funding | `debtor.funding` | Enum: "Self", "Government (NSFAS)", "Private Bursary" |
| Funding status | `debtor.fundStatus` | Literal |
| Year | `debtor.year` | Integer, no formatting |
| Missed instalments | `debtor.missed` | Integer |
| Last payment | `debtor.lastPay` | ISO 8601 date or empty string if null |
| Current | `debtor.ageing.current` | ZAR, 2 decimals (no R symbol in CSV) |
| 30 days | `debtor.ageing.d30` | ZAR, 2 decimals |
| 60 days | `debtor.ageing.d60` | ZAR, 2 decimals |
| 90 days | `debtor.ageing.d90` | ZAR, 2 decimals |
| 120+ days | `debtor.ageing.d120` | ZAR, 2 decimals |
| Balance | `rowTotal` (sum of all 5 ageing buckets) | ZAR, 2 decimals; **can be negative** |
| Risk score | `caseState.score` | Integer 0–99 or empty if in credit |
| Band | `caseState.band` OR "Credit" if in credit | Literal: "Watch", "Elevated", "High", or "Credit" |
| Picked up by agent | `caseState.pickedUp` | Boolean → "Yes" / "No" |
| AI recommendation | `recommendation.action` | Literal action headline (e.g., "Refund 500 to the student") |
| Status | `recommendation.status` | Literal: "Needs approval", "Agent acting", "Monitoring", "Pending" |
| Policy | `recommendation.policyClause` | Literal: "FIN-01.0", "FIN-03.1", etc. |

---

## 5. Edge Cases & Handling

**Credit Debtors (owedToStudent == true):**
- Balance column: negative value (e.g., `-2500.00`)
- Risk score column: empty string (no score for credits)
- Band column: literal string "Credit" (not the score band)
- Row is included if filtered scope matches

**Null/Missing Values:**
- `lastPay == null` → empty string in CSV
- No policy assigned → empty string
- Missing recommendation → empty string
- Zero or negative values in ageing buckets → "0.00"

**File Naming:**
- Year: use numeric fiscal year (e.g., `2026`)
- Funding: use slug format
  - "All years" filter → filename: `student-debt-tracker-all-all.csv`
  - "All funding" filter → filename: `student-debt-tracker-{year}-all.csv`
  - Single selection → use that value (e.g., `2026-gov`)
- Replace spaces in filenames with hyphens

**Encoding:**
- UTF-8 with BOM (for Excel compatibility on Windows)
- Line endings: CRLF (\r\n)
- Quote all fields (RFC 4180)

---

## 6. User Flow

1. Officer navigates to Debt Tracker (or any workspace with filters)
2. Officer sets Year and Funding filters to scope
3. Officer sees filtered list update
4. Officer clicks "Export to CSV" button
5. Browser downloads `student-debt-tracker-{year}-{funding}.csv`
6. Officer opens file in Excel/Sheets and performs analysis/sharing

---

## 7. Implementation Details

### 7.1 Service Layer (New)

**File:** `src/features/debtTracker/services/csvExportService.ts`

```typescript
/**
 * Transform filtered case list to CSV string (RFC 4180)
 */
export async function generateCSVForFilteredCases(
  cases: Case[],
  year: string,
  funding: string
): Promise<string>

/**
 * Build filename from filter state
 */
export function buildCSVFilename(year: string, funding: string): string

/**
 * Trigger browser download via blob
 */
export function downloadCSV(csvContent: string, filename: string): void
```

### 7.2 Component Changes

**File:** `src/features/debtTracker/components/WorkspaceHeader/WorkspaceHeader.tsx`

Add "Export to CSV" button after funding filter dropdown:
```tsx
<button 
  onClick={handleExportCSV}
  disabled={cases.length === 0}
  className="btn btn-secondary"
>
  ↓ Export to CSV
</button>
```

Handler dispatches Redux action or calls service directly (no state mutation).

### 7.3 Redux Integration (Optional)

If export state tracking is desired:
- Add action: `setExportLoading(bool)` / `setExportError(string)`
- Update UI to show "Exporting..." during generation

---

## 8. Testing Strategy

### 8.1 Unit Tests (csvExportService.ts)

**Test:** Field mapping transforms
- Assert `rowTotal` calculated correctly (sum of all ageing buckets)
- Assert negative `rowTotal` renders as negative in CSV
- Assert credit debtors have "Credit" in Band column, not score band
- Assert missing `lastPay` renders as empty string, not "null"
- Assert `fundStatus` matches lookup table (Section 3.3 of tech spec)

**Test:** CSV format compliance
- Assert RFC 4180: CRLF line endings
- Assert all fields are quoted
- Assert commas inside quoted fields are preserved
- Assert UTF-8 with BOM

**Test:** Filename generation
- Assert `{year}-{funding}` replacement
- Assert "All funding" → "all"
- Assert "All years" → "all"
- Assert spaces replaced with hyphens

### 8.2 Integration Tests

**Test:** Filter application
- Mock Redux state with filtered cases (year=2026, funding=gov)
- Call `generateCSVForFilteredCases()`
- Assert CSV contains only cases matching (year=2026, funding=gov)
- Assert count matches filtered list on-screen

**Test:** Download trigger
- Mock window.URL.createObjectURL and click simulation
- Call `downloadCSV()`
- Assert blob is created with CSV content
- Assert filename in download matches expectation

### 8.3 Manual Smoke Test

1. Load Debt Tracker with default filters
2. Click "Export to CSV"
3. Verify file downloads with correct name
4. Open in Excel/Sheets
5. Verify 20 columns visible
6. Spot-check 3 rows against on-screen values
7. Verify credit debtors show "Credit" in Band column
8. Verify negative Balance values render correctly
9. Apply different filters (year, funding), export again
10. Verify filename changes accordingly

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Large dataset export (10k+ rows) slows browser | Use streaming CSV generation or chunked array processing; monitor performance in E2E test |
| Excel opens CSV as ANSI instead of UTF-8 | Include BOM; add note in export button tooltip |
| User exports partial data unaware of filter | Disable export button when no filters active (or show warning) |
| Negative values misinterpreted | Document in exported header row or user guide |
| Missing policy/recommendation fields | Render as empty string; no errors |

---

## 10. Acceptance Gates

- [ ] Export button renders in WorkspaceHeader and is clickable
- [ ] CSV file downloads with correct filename pattern
- [ ] All 20 columns present and in exact order
- [ ] Sample export validated: 3+ rows checked against on-screen
- [ ] Credit debtors show "Credit" in Band column
- [ ] Negative Balance values export correctly
- [ ] File opens correctly in Excel/Sheets
- [ ] Unit test coverage ≥80% for csvExportService
- [ ] Integration test passes: filter application + download
- [ ] No console errors or warnings during export
- [ ] Export works across all filter combinations (year, funding, both)

---

## 11. Dependencies

- **Issue #11:** Debt Tracker workspace must be complete (provides filtered cases and Redux state)
- **Issue #10:** KPI block must exist (uses same case data model)
- **No external packages required** — use native Blob/URL APIs

---

## 12. Effort Breakdown

| Task | Hours |
|---|---|
| csvExportService (transform logic + RFC 4180) | 2 |
| Component integration (button + handler) | 1 |
| Unit tests (field mapping, format, filename) | 2 |
| Integration test (filter + download) | 1 |
| Manual testing + debugging | 2 |
| **Total** | **8** |

---

## 13. Glossary / Definitions

- **Filtered scope:** The set of cases currently matching the year and funding filters selected by the officer
- **rowTotal:** Sum of all 5 ageing buckets (current + d30 + d60 + d90 + d120); can be negative if account is in credit
- **Band:** Risk classification (Watch, Elevated, High) OR literal "Credit" for in-credit debtors
- **RFC 4180:** CSV format standard (quoted fields, CRLF line endings, commas inside quoted fields)
- **BOM (Byte Order Mark):** UTF-8 BOM (EF BB BF hex) ensures Windows Excel recognizes encoding

---

## Appendix A: Sample CSV Output

```
"Student ID","Name","Programme","Funding","Funding status","Year","Missed instalments","Last payment","Current","30 days","60 days","90 days","120+ days","Balance","Risk score","Band","Picked up by agent","AI recommendation","Status","Policy"
"STU-100001","Alice Smith","B.Sc Computer Science","Government (NSFAS)","NSFAS declined","2026","2","2026-06-15","1500.00","800.00","600.00","400.00","200.00","3500.00","72","High","Yes","Hardship fund referral and sponsor follow-up","Needs approval","FIN-07.1"
"STU-100002","Bob Johnson","B.Comm Accounting","Self","Self-funded","2026","0","2026-08-01","0.00","0.00","0.00","0.00","0.00","-500.00","0","Credit","Yes","Refund 500 to the student","Needs approval","FIN-02.6"
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-10  
**Status:** Ready for Developer Review & Approval  
**Approver:** [dev-its-workflow spec-agent]

---

*For questions about this spec, consult TECHNICAL_SPECIFICATION.md Section 6.5 or Issue #11 design decisions.*
