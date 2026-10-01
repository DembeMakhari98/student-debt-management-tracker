# System Design Document: Debt Management Tracker Workspace
## Issue #11

**Document Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Claude Code  
**Status:** Draft  
**Reviewed By:** [Pending]  

---

## Table of Contents

1. [Goals](#goals)
2. [User Stories & Acceptance Criteria](#user-stories--acceptance-criteria)
3. [Technical Design](#technical-design)
4. [API & Data Model](#api--data-model)
5. [Testing Strategy](#testing-strategy)
6. [Risks & Mitigations](#risks--mitigations)
7. [Open Questions](#open-questions)
8. [Dependencies](#dependencies)

---

## Goals

### Primary Goals

1. **Single Risk-Ranked Worklist**: Provide debt officers with a single, unified view of all debtors requiring attention, sorted by risk score descending, enabling rapid triage of the highest-priority cases.
2. **Multi-View Organization**: Surface three distinct debtor populations (picked-up, refunded, on-cycle) in separate, filterable lists, each with contextual information relevant to the officer's workflow.
3. **Immediate Filter Feedback**: Ensure all three lists update instantly when global filters (year, funding source) change, eliminating stale data and re-query delays.

### Non-Goals

- **Automated Actions**: This workspace is read-only; execution of debt actions (payment plan amendments, refund approvals, etc.) is handled by the Case Management workspace (Issue #12).
- **Risk Scoring**: Risk scores and bands are computed by the Risk Scoring Job; this workspace only consumes the output.
- **Bulk Operations**: Bulk selection, batch actions, and multi-case workflows are out of scope for this phase.

---

## User Stories & Acceptance Criteria

### User Story
**As a** debt officer  
**I want** one worklist of every student who needs my attention, sorted by risk, plus a separate view of refunds and of students paying on cycle  
**So that** I always know where to focus first.

### Acceptance Criteria

1. **Picked-up List Rendering** (AC1)
   - Renders a sorted list of debtors flagged by the risk engine for human attention.
   - Sort order: **risk score descending** (highest risk first).
   - Each row displays:
     - Risk badge (risk score + band: Watch/Elevated/High)
     - Student name, ID, programme
     - Funding pill (self/gov/private)
     - Signal chips (hot signals in red, normal signals in grey)
     - Recommended action + owning agent name
     - Amount owed
     - Status pill (Pending/Approved/Amended/Declined)
     - Clickable row target to open the case in Case Management workspace

2. **Refund Queue Rendering** (AC2)
   - Renders separately for debtors in credit (institution owes money).
   - Sort order: **largest credit amount first** (default; to be confirmed with stakeholders).
   - Each row displays: student name, ID, programme, funding pill, credit amount, date flagged.

3. **Not Picked Up Table Rendering** (AC3)
   - Renders read-only; for students paying on cycle, no action needed.
   - Each row displays: student name, funding source, funding status, last payment date, current balance.
   - Sort order: **default (oldest last payment first)** or **by balance descending** (to be confirmed).

4. **Debt Summary KPI Reuse** (AC4)
   - The workspace header includes the Debt Summary KPI block from Issue #10 (total debtors, total amount, critical count, at-risk count).
   - KPIs update whenever filters change.

5. **Immediate Filter Updates** (AC5)
   - Year filter changes trigger re-query of all three lists.
   - Funding filter changes trigger re-query of all three lists.
   - All lists re-render synchronously within 500ms.

6. **Case Navigation** (AC6)
   - Clicking any row in the picked-up or refund queue list opens the corresponding case in the Case Management workspace (Issue #12).
   - Navigation passes the `debtorId` and `caseId` as route parameters.

---

## Technical Design

### Architecture Overview

The Debt Management Tracker workspace is a **read-only, filter-driven dashboard** that:
- Consumes a filtered dataset of `Case` objects from the Case Store (Section 3.5 of technical spec).
- Applies client-side sorting and grouping logic to partition cases into three populations.
- Renders three synchronized, interactive list views.
- Maintains shared filter state (year, funding source) and propagates changes to all three lists.
- Provides navigation to the Case Management workspace.

### Data Flow

1. **Initialization**
   - Workspace mounts; retrieves global filter state (year, funding) from Redux or context.
   - Calls `/api/cases?year={year}&funding={funding}` (or queries Case Store directly).
   - Partitions returned cases into three groups:
     - **Picked-up**: cases where `band !== 'None'` (i.e., `band` is Watch/Elevated/High).
     - **Refund queue**: cases where `amount < 0` (debtors in credit).
     - **Not picked up**: remaining cases (on-cycle, no action flagged).

2. **Filter Change**
   - User changes year or funding filter via global header controls.
   - Redux action dispatches with new filter values.
   - Workspace re-queries `/api/cases` with updated filters.
   - Three lists re-partition and re-sort.
   - KPI block re-calculates aggregates.

3. **Row Click**
   - User clicks a picked-up or refund queue row.
   - Workspace captures the `debtorId` and `caseId`.
   - Navigates to `/case-management/${caseId}` (or equivalent route).

### UI Component Structure

```
┌─ DebtTrackerWorkspace
│  ├─ WorkspaceHeader
│  │  ├─ YearFilter
│  │  ├─ FundingFilter
│  │  └─ DebtSummaryKPI (from Issue #10)
│  │
│  ├─ PickedUpList
│  │  ├─ ListHeader (sort indicator)
│  │  ├─ ListRow (x N)
│  │  │  ├─ RiskBadge
│  │  │  ├─ StudentInfo
│  │  │  ├─ FundingPill
│  │  │  ├─ SignalChips
│  │  │  ├─ ActionInfo
│  │  │  ├─ AmountDisplay
│  │  │  └─ StatusPill
│  │  └─ Pagination (if applicable)
│  │
│  ├─ RefundQueueList
│  │  ├─ ListHeader (sort indicator)
│  │  ├─ ListRow (x N)
│  │  │  ├─ StudentInfo
│  │  │  ├─ FundingPill
│  │  │  ├─ CreditAmount
│  │  │  └─ DateFlagged
│  │  └─ Pagination (if applicable)
│  │
│  └─ NotPickedUpTable
│     ├─ TableHeader
│     ├─ TableRow (x N)
│     │  ├─ StudentInfo
│     │  ├─ FundingSource
│     │  ├─ FundingStatus
│     │  ├─ LastPaymentDate
│     │  └─ CurrentBalance
│     └─ Pagination (if applicable)
```

### State Management

**Global State (Redux / Context)**
```javascript
{
  filters: {
    year: number,          // e.g., 2024, 2025
    fundingSource: string  // 'all' | 'self' | 'gov' | 'private'
  },
  selectedCase: {
    caseId: string,
    debtorId: string
  }
}
```

**Local Workspace State**
```javascript
{
  cases: Case[],                    // filtered cases from API
  pickedUpCases: Case[],            // filtered & sorted
  refundCases: Case[],              // filtered & sorted
  notPickedUpCases: Case[],         // filtered & sorted
  loading: boolean,
  error: string | null,
  pickedUpPage: number,             // pagination
  refundPage: number,
  notPickedUpPage: number
}
```

### Responsive Breakpoints

The workspace implements progressive collapse at the following breakpoints:

| Breakpoint | Behavior |
|-----------|----------|
| 1500px+ (Desktop XL) | Full multi-column layout; all fields visible; 3-column dashboard (if applicable). |
| 1240px–1499px (Desktop L) | Compact multi-column; signal chips may wrap; funding pill text truncated. |
| 1040px–1239px (Desktop M) | Single-column list; hidden columns: "owning agent" (tooltip on action); "programme" (in tooltip on name). |
| 900px–1039px (Tablet) | Single-column list; hidden columns: "signal chips" (available on row expansion); KPI block stacks vertically. |
| 820px–899px (Mobile L) | Single-column list; compact rows; action info in expandable drawer; status pill inline. |
| <820px (Mobile S) | Single-column list; student name + ID only; risk badge in row header; amount and status in row subheader; all other fields hidden (available via row tap to expand). |

### Filter Logic

**Year Filter**
- Filters cases to those matching the selected academic year.
- Default: current year.
- Options: last 3 years + current year (configurable).

**Funding Filter**
- Filters cases by funding source: `case.funding === fundingSource`.
- Options: All / Self / Government / Private.
- Default: All.

**Combined Filter**
- Cases must satisfy both year AND funding filter to be included.
- Logical AND operation; no OR conditions.

---

## API & Data Model

### Input: Case Store / API Endpoint

The workspace consumes cases from one of two sources (to be confirmed in Open Questions):
- Direct Case Store query.
- `/api/cases?year={year}&funding={funding}` REST endpoint.

**Query Parameters**
```
GET /api/cases
  ?year=2024
  &funding=all | self | gov | private
```

### Case Object Structure

(Reference: Technical Specification Section 3.5)

```javascript
{
  caseId: string,              // unique case identifier
  debtorId: string,            // student ID
  name: string,                // student name
  programme: string,           // e.g., "BSc Computer Science"
  funding: 'self' | 'gov' | 'private',
  fundingStatus: string,       // e.g., "Active", "Deferred", "Complete"
  amount: number,              // rowDebt (negative if in credit/refund)
  rowTotal: number,            // alternative field for amount (if used in spec)
  score: number,               // risk score (0-100 or 0-10)
  band: 'None' | 'Watch' | 'Elevated' | 'High',  // risk band
  signals: {
    // array of flagged risk signals
    signal: string,            // e.g., "no_payment_6mo", "npl", "enrollment_changed"
    severity: 'hot' | 'normal' // display color: red or grey
  }[],
  recommendation: string,      // recommended action, e.g., "Payment plan review"
  owningAgent: string,         // name of assigned debt officer
  status: 'Pending' | 'Approved' | 'Amended' | 'Declined',
  lastPaymentDate: string,     // ISO 8601 date
  createdAt: string,           // ISO 8601 timestamp
  updatedAt: string            // ISO 8601 timestamp
}
```

### Output

**No output data** — the workspace is read-only. Navigation to Case Management passes only route parameters:
```
Route: /case-management/:caseId
Parameters: { caseId, debtorId }
```

### Response Structure

```javascript
{
  success: boolean,
  data: Case[],
  meta: {
    total: number,            // total cases matching filters
    pageSize: number,         // rows per page (if paginated)
    currentPage: number
  },
  error?: string              // error message if applicable
}
```

---

## Testing Strategy

### Unit Tests

1. **Filter Application Logic**
   - Test that year filter correctly excludes mismatched years.
   - Test that funding filter correctly excludes mismatched sources.
   - Test combined filters (year AND funding).

2. **List Partitioning**
   - Test that cases with `band !== 'None'` are included in picked-up list.
   - Test that cases with `amount < 0` are included in refund queue.
   - Test that remaining cases are in not-picked-up list.

3. **Sorting Logic**
   - Picked-up: sorted by risk score descending.
   - Refund queue: sorted by amount ascending (largest credit first, i.e., most negative).
   - Not picked up: sorted by last payment date ascending.

4. **Component Rendering**
   - Test RiskBadge displays correct score and band label.
   - Test FundingPill displays correct funding type and color.
   - Test SignalChips display correct severity colors (hot=red, normal=grey).
   - Test StatusPill displays correct status and color.

5. **Responsive Breakpoints**
   - Test that columns are hidden at each breakpoint.
   - Test that layout shifts correctly (multi-column → single-column).

### Integration Tests

1. **Filter Propagation**
   - Load workspace with default filters.
   - Change year filter; verify all three lists re-render with filtered cases.
   - Change funding filter; verify all three lists re-render with filtered cases.
   - Change both filters; verify synchronous update across all lists.

2. **KPI Update**
   - Verify Debt Summary KPI block updates when filters change.
   - Verify totals and counts are accurate for filtered data.

3. **Navigation**
   - Click a row in picked-up list; verify navigation to `/case-management/{caseId}` with correct parameters.
   - Click a row in refund queue; verify navigation to correct case.

### End-to-End Tests

1. **Workspace Load**
   - Navigate to Debt Management Tracker workspace.
   - Verify KPI block and three lists render.
   - Verify initial data is loaded (year = current year, funding = all).

2. **Filter Workflow**
   - Load workspace.
   - Select a past year from year dropdown.
   - Verify all lists update and display only that year's cases.
   - Select a funding source from funding dropdown.
   - Verify all lists update and display only matching funding.
   - Clear filters (select "all" year and "all" funding).
   - Verify lists reset to full dataset.

3. **Case Navigation**
   - Load workspace.
   - Click a row in the picked-up list.
   - Verify browser navigates to Case Management workspace with correct case details displayed.
   - Return to Debt Tracker (browser back).
   - Verify Debt Tracker retains filter state.

---

## Risks & Mitigations

### Risk 1: Large Debtor Dataset Performance Degradation

**Description**: If the debtor book contains 100+ cases, rendering all rows in a single list may cause UI lag, especially on lower-end devices.

**Mitigation**:
- Implement **pagination** with a configurable page size (default 25 rows per page).
- Alternatively, implement **virtual scrolling** (virtualization) to render only visible rows, reducing DOM size.
- Monitor render time in development; escalate if render exceeds 500ms.
- Reference Technical Specification Section 7 for pagination patterns used elsewhere in the system.

### Risk 2: Stale Data After Filter Change

**Description**: If the backend Case Store is not re-queried after a filter change, the workspace may display cached data from the previous filter state.

**Mitigation**:
- Ensure filter change triggers a new API call (not a cached read).
- Implement request debouncing (e.g., 300ms) if filters are user-typed (not applicable here; filters are dropdowns).
- Add a manual "Refresh" button if immediate re-fetch is not guaranteed.
- Log filter changes and API calls during development to verify correct sequencing.

### Risk 3: Missing Owning Agent Data

**Description**: If the `owningAgent` field is not populated for a case, the action info cell may display incomplete information.

**Mitigation**:
- Default to "Unassigned" if `owningAgent` is null or empty.
- Add a visual indicator (e.g., icon tooltip) for unassigned cases.
- Verify data completeness in test fixtures before launch.

### Risk 4: Responsive Collapse Accuracy

**Description**: CSS media queries may not accurately collapse layouts on all device sizes, especially if padding/margin is not standardized.

**Mitigation**:
- Use CSS Grid or Flexbox with mobile-first design.
- Test on actual devices (iOS Safari, Chrome Android) at each breakpoint.
- Implement viewport-relative font sizes (rem) to avoid hardcoded pixels.

### Risk 5: Navigation Context Loss

**Description**: If a user navigates from Debt Tracker to Case Management and returns, the filter state and scroll position may be lost.

**Mitigation**:
- Store filter state in Redux/Context, not local component state.
- On workspace mount, restore filter state from Redux before rendering.
- Preserve scroll position using a ref or sessionStorage key (e.g., `debtTrackerScroll`).

---

## Open Questions

1. **Refund Queue Sort Order** (AC2)
   - Should the refund queue be sorted by credit amount descending (largest credit first) or ascending (smallest credit first)?
   - **Current Assumption**: Largest credit first (most negative amount), as this prioritizes urgent refunds.
   - **Action**: Confirm with stakeholders (debt officers).

2. **Case Store Access Pattern** (API & Data Model)
   - Does the project already have a `/api/cases` REST endpoint, or should this workspace query the Case Store directly?
   - If Case Store is used directly, what is the API contract (method signature, return type)?
   - **Action**: Clarify with backend team or review existing API documentation.

3. **Pagination Threshold**
   - At what debtor count should pagination be enabled (e.g., >50 cases)?
   - What is the default page size (25, 50, 100)?
   - **Current Assumption**: Enable pagination if `total > 50`, default page size 25.
   - **Action**: Confirm based on typical debtor book size and performance testing.

4. **Not Picked Up Visibility**
   - Should the "Not Picked Up" section be collapsible (hidden by default) or always visible?
   - Current assumption: always visible for transparency, but low priority (rendered last).
   - **Action**: Confirm with debt officers; may affect responsive breakpoint behavior.

5. **Sort Order for Not Picked Up**
   - Default sort order for "Not Picked Up" list: oldest last payment first, or by balance descending?
   - **Current Assumption**: Oldest last payment first (early warning for dormant accounts).
   - **Action**: Confirm with stakeholders.

6. **Filter State Persistence**
   - Should filter state (year, funding) persist when the user navigates away and returns to the workspace?
   - **Current Assumption**: Yes, filter state stored in Redux and restored on mount.
   - **Action**: Confirm if cookies or localStorage should be used as a fallback.

7. **KPI Block Scope**
   - Does the Debt Summary KPI block show totals for the filtered dataset or for all cases (regardless of filters)?
   - **Current Assumption**: Filtered dataset (consistent with list filtering).
   - **Action**: Confirm with stakeholders.

---

## Dependencies

### Upstream Dependencies

1. **Issue #10: Debt Summary KPI Block**
   - This workspace reuses the Debt Summary KPI component (AC4).
   - Dependency: The KPI block must be a reusable, filter-aware component that accepts `(year, funding)` as props and re-renders on change.
   - **Status**: [Pending completion of Issue #10]

2. **Issue #12: Case Management Workspace**
   - This workspace navigates to Case Management when a row is clicked (AC6).
   - Dependency: Case Management must expose a route `/case-management/:caseId` that accepts debtor and case context.
   - **Status**: [Pending completion of Issue #12]

3. **Technical Specification Section 3.5: Case Data Model**
   - This SDD references the Case object structure from the tech spec.
   - Dependency: The actual Case Store implementation must match or be compatible with the spec.
   - **Status**: [In progress or complete]

4. **Case Store Implementation**
   - Backend must provide either a direct Case Store query interface or a REST API (`/api/cases`) with filtering support.
   - Dependency: Must support query parameters `year` and `funding`.
   - **Status**: [To be confirmed]

### Development Dependencies

- React 18+ (or framework in use for UI rendering).
- Redux or Context API for state management.
- CSS Grid / Flexbox for responsive layout.
- Testing library (Jest, React Testing Library, Cypress for E2E).

---

## Appendix: Field Definitions Quick Reference

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `caseId` | string | `case_12345` | Unique identifier for the case. |
| `debtorId` | string | `S00123456` | Student ID. |
| `name` | string | `Jane Doe` | Full name of student. |
| `programme` | string | `BSc Computer Science` | Degree name; hidden on mobile. |
| `funding` | enum | `gov`, `self`, `private` | Funding source. |
| `amount` | number | `-500`, `2000` | Negative = in credit (refund); positive = owed. |
| `score` | number | `75` | Risk score (0-100). |
| `band` | enum | `Watch`, `Elevated`, `High`, `None` | Risk category. |
| `signals` | array | `[{ signal: 'no_payment_6mo', severity: 'hot' }]` | List of flagged risks. |
| `recommendation` | string | `Payment plan review` | Suggested action. |
| `owningAgent` | string | `Alice Smith` | Assigned debt officer. |
| `status` | enum | `Pending`, `Approved`, `Amended`, `Declined` | Case status. |
| `lastPaymentDate` | ISO date | `2024-08-15` | Most recent payment. |

---

**End of Document**
