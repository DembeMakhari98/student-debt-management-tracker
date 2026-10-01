# Implementation Plan: Issue #11 — Debt Management Tracker Workspace

**Document Version:** 1.0  
**Date:** 2026-09-10  
**Author:** Claude Code  
**Status:** Pending Review  
**Related Spec:** `SDD_Issue_11_Debt_Management_Tracker_Workspace.md`

---

## Table of Contents

1. [Project Structure & File Layout](#project-structure--file-layout)
2. [Implementation Order (Sequential Steps)](#implementation-order-sequential-steps)
3. [Dependencies & Assumptions](#dependencies--assumptions)
4. [Technology & Libraries](#technology--libraries)
5. [Risk Mitigation & Validation Steps](#risk-mitigation--validation-steps)
6. [Rollback Plan](#rollback-plan)
7. [Estimated Effort & Timeline](#estimated-effort--timeline)
8. [Success Criteria](#success-criteria)

---

## Project Structure & File Layout

### Directory Organization

The Debt Management Tracker workspace will be organized as follows:

```
src/
├── features/
│   └── debtTracker/
│       ├── components/
│       │   ├── DebtTrackerWorkspace.tsx           [Root container component]
│       │   ├── WorkspaceHeader.tsx                [Header with filters & KPI]
│       │   ├── PickedUpList/
│       │   │   ├── PickedUpList.tsx              [Main picked-up list container]
│       │   │   ├── PickedUpListRow.tsx           [Individual row component]
│       │   │   ├── RiskBadge.tsx                 [Risk score + band display]
│       │   │   ├── StudentInfo.tsx               [Name, ID, programme]
│       │   │   ├── FundingPill.tsx               [Funding source badge]
│       │   │   ├── SignalChips.tsx               [Risk signals display]
│       │   │   ├── ActionInfo.tsx                [Recommendation + agent]
│       │   │   ├── StatusPill.tsx                [Case status badge]
│       │   │   └── AmountDisplay.tsx             [Amount owed display]
│       │   ├── RefundQueueList/
│       │   │   ├── RefundQueueList.tsx           [Main refund list container]
│       │   │   ├── RefundQueueListRow.tsx        [Individual row component]
│       │   │   └── CreditAmountDisplay.tsx       [Credit amount display]
│       │   ├── NotPickedUpTable/
│       │   │   ├── NotPickedUpTable.tsx          [Main not-picked-up list]
│       │   │   └── NotPickedUpTableRow.tsx       [Individual row component]
│       │   ├── FiltersSection.tsx                [Year & funding filters]
│       │   └── PaginationControl.tsx             [Shared pagination component]
│       ├── redux/
│       │   ├── debtTrackerSlice.ts               [Redux slice with reducer, actions]
│       │   ├── debtTrackerSelectors.ts           [Redux selectors]
│       │   └── debtTrackerThunks.ts              [Async thunks for API calls]
│       ├── services/
│       │   ├── debtTrackerApi.ts                 [API calls to /api/cases]
│       │   └── casePartitionService.ts           [Logic to partition cases]
│       ├── hooks/
│       │   ├── useDebtTrackerFilters.ts          [Hook for filter state & actions]
│       │   ├── useCases.ts                       [Hook to fetch & partition cases]
│       │   └── useResponsiveBreakpoint.ts        [Hook for responsive behavior]
│       ├── styles/
│       │   ├── debtTrackerWorkspace.module.css   [Workspace-level styles]
│       │   ├── lists.module.css                  [List & row shared styles]
│       │   ├── responsiveBreakpoints.module.css  [Breakpoint-specific styles]
│       │   └── components.module.css             [Individual component styles]
│       └── __tests__/
│           ├── redux/
│           │   ├── debtTrackerSlice.test.ts      [Reducer & action tests]
│           │   └── debtTrackerSelectors.test.ts  [Selector tests]
│           ├── services/
│           │   ├── debtTrackerApi.test.ts        [API mock tests]
│           │   └── casePartitionService.test.ts  [Partitioning logic tests]
│           ├── components/
│           │   ├── DebtTrackerWorkspace.test.tsx [Integration test]
│           │   ├── PickedUpList.test.tsx         [List component tests]
│           │   ├── RefundQueueList.test.tsx      [List component tests]
│           │   ├── NotPickedUpTable.test.tsx     [List component tests]
│           │   ├── WorkspaceHeader.test.tsx      [Header & filter tests]
│           │   └── [Component name].test.tsx     [Individual component tests]
│           └── hooks/
│               ├── useDebtTrackerFilters.test.ts [Hook tests]
│               └── useCases.test.ts              [Hook tests]
├── shared/
│   ├── components/
│   │   ├── KPIBlock/                             [Reused from Issue #10]
│   │   ├── Pagination/                           [Reused pagination]
│   │   └── [Other shared components]
│   └── styles/
│       └── variables.css                          [CSS variables: colors, breakpoints]
└── routes/
    └── debtTrackerRoute.tsx                       [Route definition & lazy load]
```

### Naming Conventions

- **Component files**: PascalCase (e.g., `PickedUpList.tsx`)
- **Style modules**: kebab-case.module.css (e.g., `lists.module.css`)
- **Test files**: `[ComponentName].test.tsx` or `[serviceName].test.ts`
- **Redux slices**: `[featureName]Slice.ts`
- **API services**: `[featureName]Api.ts`
- **Custom hooks**: `use[HookName].ts`
- **CSS classes**: kebab-case (e.g., `.picked-up-list`, `.risk-badge`)

---

## Implementation Order (Sequential Steps)

### Step 1: Create Workspace Shell & Routing (Estimate: 2 hours)

**Objective**: Set up the basic workspace structure and integrate into the app router.

**Tasks**:
1. Create `src/features/debtTracker/` directory structure.
2. Create `src/features/debtTracker/components/DebtTrackerWorkspace.tsx` with a minimal layout:
   ```tsx
   interface DebtTrackerWorkspaceProps {
     // Empty for now
   }

   export const DebtTrackerWorkspace: React.FC<DebtTrackerWorkspaceProps> = () => {
     return (
       <div className="debt-tracker-workspace">
         <h1>Debt Management Tracker</h1>
         {/* Placeholder sections for header, three lists */}
       </div>
     );
   };

   export default DebtTrackerWorkspace;
   ```
3. Create `src/routes/debtTrackerRoute.tsx` with a lazy-loaded route:
   ```tsx
   import { lazy } from 'react';
   const DebtTrackerWorkspace = lazy(() => 
     import('../features/debtTracker/components/DebtTrackerWorkspace')
   );

   export const debtTrackerRoute = {
     path: '/debt-tracker',
     element: <DebtTrackerWorkspace />,
   };
   ```
4. Register the route in the main app router (e.g., `src/App.tsx` or `src/router.tsx`).

**Validation**:
- Verify the workspace loads at `/debt-tracker` without errors.
- Verify lazy loading works (component loads on route navigation).
- Run `npm start` and navigate to `/debt-tracker` to confirm page renders.

---

### Step 2: Implement Data Model & State Management (Estimate: 4 hours)

**Objective**: Set up Redux state, actions, thunks, and selectors for filter and case data.

**Tasks**:

1. **Create Redux slice** (`src/features/debtTracker/redux/debtTrackerSlice.ts`):
   ```typescript
   import { createSlice, PayloadAction } from '@reduxjs/toolkit';

   interface DebtTrackerState {
     filters: {
       year: number;
       fundingSource: 'all' | 'self' | 'gov' | 'private';
     };
     cases: Case[];
     pickedUpCases: Case[];
     refundCases: Case[];
     notPickedUpCases: Case[];
     loading: boolean;
     error: string | null;
     pickedUpPage: number;
     refundPage: number;
     notPickedUpPage: number;
   }

   const initialState: DebtTrackerState = {
     filters: { year: new Date().getFullYear(), fundingSource: 'all' },
     cases: [],
     pickedUpCases: [],
     refundCases: [],
     notPickedUpCases: [],
     loading: false,
     error: null,
     pickedUpPage: 1,
     refundPage: 1,
     notPickedUpPage: 1,
   };

   const debtTrackerSlice = createSlice({
     name: 'debtTracker',
     initialState,
     reducers: {
       setYearFilter: (state, action: PayloadAction<number>) => {
         state.filters.year = action.payload;
       },
       setFundingFilter: (state, action: PayloadAction<string>) => {
         state.filters.fundingSource = action.payload as any;
       },
       setCases: (state, action: PayloadAction<Case[]>) => {
         state.cases = action.payload;
       },
       setPartitionedCases: (
         state,
         action: PayloadAction<{
           pickedUp: Case[];
           refund: Case[];
           notPickedUp: Case[];
         }>
       ) => {
         state.pickedUpCases = action.payload.pickedUp;
         state.refundCases = action.payload.refund;
         state.notPickedUpCases = action.payload.notPickedUp;
       },
       setLoading: (state, action: PayloadAction<boolean>) => {
         state.loading = action.payload;
       },
       setError: (state, action: PayloadAction<string | null>) => {
         state.error = action.payload;
       },
       setPickedUpPage: (state, action: PayloadAction<number>) => {
         state.pickedUpPage = action.payload;
       },
       setRefundPage: (state, action: PayloadAction<number>) => {
         state.refundPage = action.payload;
       },
       setNotPickedUpPage: (state, action: PayloadAction<number>) => {
         state.notPickedUpPage = action.payload;
       },
     },
   });

   export default debtTrackerSlice.reducer;
   export const debtTrackerActions = debtTrackerSlice.actions;
   ```

2. **Create Redux selectors** (`src/features/debtTracker/redux/debtTrackerSelectors.ts`):
   ```typescript
   import { RootState } from '../../../store'; // Adjust path as needed

   export const selectDebtTrackerState = (state: RootState) =>
     state.debtTracker;

   export const selectFilters = (state: RootState) =>
     state.debtTracker.filters;

   export const selectPickedUpCases = (state: RootState) =>
     state.debtTracker.pickedUpCases;

   export const selectRefundCases = (state: RootState) =>
     state.debtTracker.refundCases;

   export const selectNotPickedUpCases = (state: RootState) =>
     state.debtTracker.notPickedUpCases;

   export const selectLoading = (state: RootState) =>
     state.debtTracker.loading;

   export const selectError = (state: RootState) =>
     state.debtTracker.error;

   export const selectPickedUpPage = (state: RootState) =>
     state.debtTracker.pickedUpPage;

   export const selectRefundPage = (state: RootState) =>
     state.debtTracker.refundPage;

   export const selectNotPickedUpPage = (state: RootState) =>
     state.debtTracker.notPickedUpPage;
   ```

3. **Create async thunks** (`src/features/debtTracker/redux/debtTrackerThunks.ts`):
   ```typescript
   import { createAsyncThunk } from '@reduxjs/toolkit';
   import { fetchCases } from '../services/debtTrackerApi';

   export const fetchCasesThunk = createAsyncThunk(
     'debtTracker/fetchCases',
     async (
       params: { year: number; fundingSource: string },
       { rejectWithValue }
     ) => {
       try {
         const response = await fetchCases(params.year, params.fundingSource);
         return response.data;
       } catch (error: any) {
         return rejectWithValue(error.message);
       }
     }
   );
   ```

4. **Add thunk handlers to the slice** (in `debtTrackerSlice.ts`, add to `extraReducers`):
   ```typescript
   builder
     .addCase(fetchCasesThunk.pending, (state) => {
       state.loading = true;
       state.error = null;
     })
     .addCase(fetchCasesThunk.fulfilled, (state, action) => {
       state.loading = false;
       state.cases = action.payload;
     })
     .addCase(fetchCasesThunk.rejected, (state, action) => {
       state.loading = false;
       state.error = action.payload as string;
     });
   ```

5. **Register the slice in the Redux store** (e.g., `src/store.ts` or equivalent):
   ```typescript
   import debtTrackerReducer from './features/debtTracker/redux/debtTrackerSlice';

   const store = configureStore({
     reducer: {
       debtTracker: debtTrackerReducer,
       // ... other reducers
     },
   });
   ```

**Validation**:
- Redux DevTools should show the `debtTracker` slice with initial state.
- Dispatch `setYearFilter` and `setFundingFilter` actions; verify state updates.
- Verify selectors return correct slices of state.
- No console errors.

---

### Step 3: Implement Case Partitioning & API Service (Estimate: 3 hours)

**Objective**: Create the logic to partition cases into three categories and set up API communication.

**Tasks**:

1. **Create API service** (`src/features/debtTracker/services/debtTrackerApi.ts`):
   ```typescript
   export interface CasesResponse {
     success: boolean;
     data: Case[];
     meta: {
       total: number;
       pageSize: number;
       currentPage: number;
     };
     error?: string;
   }

   export const fetchCases = async (
     year: number,
     fundingSource: string
   ): Promise<CasesResponse> => {
     const params = new URLSearchParams();
     params.append('year', year.toString());
     params.append('funding', fundingSource);

     const response = await fetch(`/api/cases?${params.toString()}`, {
       method: 'GET',
       headers: { 'Content-Type': 'application/json' },
     });

     if (!response.ok) {
       throw new Error(`Failed to fetch cases: ${response.statusText}`);
     }

     return response.json();
   };
   ```

2. **Create partitioning service** (`src/features/debtTracker/services/casePartitionService.ts`):
   ```typescript
   export interface PartitionedCases {
     pickedUp: Case[];
     refund: Case[];
     notPickedUp: Case[];
   }

   export const partitionCases = (cases: Case[]): PartitionedCases => {
     const pickedUp: Case[] = [];
     const refund: Case[] = [];
     const notPickedUp: Case[] = [];

     cases.forEach((caseItem) => {
       if (caseItem.amount < 0) {
         // Credit/refund
         refund.push(caseItem);
       } else if (caseItem.band !== 'None' && caseItem.band) {
         // Picked up (Watch, Elevated, High)
         pickedUp.push(caseItem);
       } else {
         // On-cycle, no action
         notPickedUp.push(caseItem);
       }
     });

     // Sort picked-up by risk score descending
     pickedUp.sort((a, b) => (b.score || 0) - (a.score || 0));

     // Sort refund by amount ascending (most negative = largest credit first)
     refund.sort((a, b) => a.amount - b.amount);

     // Sort not-picked-up by last payment date ascending (oldest first)
     notPickedUp.sort(
       (a, b) =>
         new Date(a.lastPaymentDate || 0).getTime() -
         new Date(b.lastPaymentDate || 0).getTime()
     );

     return { pickedUp, refund, notPickedUp };
   };
   ```

3. **Update thunk to partition and dispatch** (in `debtTrackerThunks.ts`):
   ```typescript
   import { partitionCases } from '../services/casePartitionService';

   export const fetchCasesThunk = createAsyncThunk(
     'debtTracker/fetchCases',
     async (
       params: { year: number; fundingSource: string },
       { dispatch, rejectWithValue }
     ) => {
       try {
         const response = await fetchCases(params.year, params.fundingSource);
         const partitioned = partitionCases(response.data);
         dispatch(debtTrackerActions.setPartitionedCases(partitioned));
         return response.data;
       } catch (error: any) {
         return rejectWithValue(error.message);
       }
     }
   );
   ```

**Validation**:
- Mock the `/api/cases` endpoint with test data.
- Call `partitionCases([...testCases])` and verify correct grouping.
- Verify sorting order: picked-up by score desc, refund by amount asc, not-picked-up by date asc.
- No console errors.

---

### Step 4: Create List Components (Estimate: 8 hours)

**Objective**: Build the three list components with all child components and row displays.

**Tasks**:

1. **Create PickedUpList component** (`src/features/debtTracker/components/PickedUpList/PickedUpList.tsx`):
   ```tsx
   interface PickedUpListProps {
     cases: Case[];
     page: number;
     pageSize?: number;
     onPageChange: (page: number) => void;
     onRowClick: (caseId: string, debtorId: string) => void;
   }

   export const PickedUpList: React.FC<PickedUpListProps> = ({
     cases,
     page,
     pageSize = 25,
     onPageChange,
     onRowClick,
   }) => {
     const startIdx = (page - 1) * pageSize;
     const endIdx = startIdx + pageSize;
     const paginatedCases = cases.slice(startIdx, endIdx);

     return (
       <div className="picked-up-list">
         <div className="list-header">
           <h3>Picked Up for Attention</h3>
           <span className="case-count">{cases.length} cases</span>
         </div>
         <table className="list-table">
           <thead>
             <tr>
               <th>Risk</th>
               <th>Student</th>
               <th>Programme</th>
               <th>Funding</th>
               <th>Signals</th>
               <th>Recommendation</th>
               <th>Amount</th>
               <th>Status</th>
             </tr>
           </thead>
           <tbody>
             {paginatedCases.map((caseItem) => (
               <PickedUpListRow
                 key={caseItem.caseId}
                 caseItem={caseItem}
                 onClick={() => onRowClick(caseItem.caseId, caseItem.debtorId)}
               />
             ))}
           </tbody>
         </table>
         {cases.length > pageSize && (
           <PaginationControl
             totalItems={cases.length}
             currentPage={page}
             pageSize={pageSize}
             onPageChange={onPageChange}
           />
         )}
       </div>
     );
   };
   ```

2. **Create PickedUpListRow component** (`src/features/debtTracker/components/PickedUpList/PickedUpListRow.tsx`):
   ```tsx
   interface PickedUpListRowProps {
     caseItem: Case;
     onClick: () => void;
   }

   export const PickedUpListRow: React.FC<PickedUpListRowProps> = ({
     caseItem,
     onClick,
   }) => {
     return (
       <tr className="list-row picked-up-row" onClick={onClick} role="button">
         <td className="risk-cell">
           <RiskBadge score={caseItem.score} band={caseItem.band} />
         </td>
         <td className="student-cell">
           <StudentInfo name={caseItem.name} debtorId={caseItem.debtorId} />
         </td>
         <td className="programme-cell">{caseItem.programme}</td>
         <td className="funding-cell">
           <FundingPill funding={caseItem.funding} />
         </td>
         <td className="signals-cell">
           <SignalChips signals={caseItem.signals} />
         </td>
         <td className="action-cell">
           <ActionInfo
             recommendation={caseItem.recommendation}
             owningAgent={caseItem.owningAgent}
           />
         </td>
         <td className="amount-cell">
           <AmountDisplay amount={caseItem.amount} />
         </td>
         <td className="status-cell">
           <StatusPill status={caseItem.status} />
         </td>
       </tr>
     );
   };
   ```

3. **Create child components** for each cell type (e.g., `RiskBadge.tsx`, `StudentInfo.tsx`, etc.). Example:
   ```tsx
   // RiskBadge.tsx
   interface RiskBadgeProps {
     score: number;
     band: string;
   }

   export const RiskBadge: React.FC<RiskBadgeProps> = ({ score, band }) => {
     const className = `risk-badge band-${band.toLowerCase()}`;
     return (
       <span className={className} title={`Risk Score: ${score}`}>
         {band} ({score})
       </span>
     );
   };
   ```

4. **Repeat for RefundQueueList and NotPickedUpTable** with similar structure but appropriate columns.

5. **Create styling** (`src/features/debtTracker/styles/lists.module.css`):
   ```css
   .picked-up-list {
     margin: 2rem 0;
     padding: 1rem;
     border: 1px solid #e0e0e0;
     border-radius: 8px;
   }

   .list-header {
     display: flex;
     justify-content: space-between;
     align-items: center;
     margin-bottom: 1rem;
   }

   .list-table {
     width: 100%;
     border-collapse: collapse;
     font-size: 0.9rem;
   }

   .list-table thead th {
     background-color: #f5f5f5;
     padding: 0.75rem;
     text-align: left;
     border-bottom: 2px solid #ddd;
     font-weight: 600;
   }

   .list-row {
     cursor: pointer;
     transition: background-color 0.2s;
   }

   .list-row:hover {
     background-color: #f9f9f9;
   }

   .list-row td {
     padding: 0.75rem;
     border-bottom: 1px solid #f0f0f0;
   }

   .risk-badge {
     display: inline-block;
     padding: 0.25rem 0.75rem;
     border-radius: 12px;
     font-size: 0.85rem;
     font-weight: 600;
     color: white;
   }

   .risk-badge.band-high {
     background-color: #d32f2f;
   }

   .risk-badge.band-elevated {
     background-color: #f57c00;
   }

   .risk-badge.band-watch {
     background-color: #fbc02d;
     color: #333;
   }

   .funding-pill {
     display: inline-block;
     padding: 0.25rem 0.5rem;
     border-radius: 4px;
     font-size: 0.8rem;
     font-weight: 500;
   }

   .funding-pill.self {
     background-color: #e3f2fd;
     color: #1976d2;
   }

   .funding-pill.gov {
     background-color: #f3e5f5;
     color: #7b1fa2;
   }

   .funding-pill.private {
     background-color: #ffe0b2;
     color: #e65100;
   }

   .signal-chip {
     display: inline-block;
     margin: 0.25rem;
     padding: 0.25rem 0.5rem;
     border-radius: 4px;
     font-size: 0.75rem;
   }

   .signal-chip.hot {
     background-color: #ffebee;
     color: #c62828;
   }

   .signal-chip.normal {
     background-color: #f0f0f0;
     color: #555;
   }

   .status-pill {
     display: inline-block;
     padding: 0.25rem 0.5rem;
     border-radius: 4px;
     font-size: 0.8rem;
     font-weight: 500;
   }

   .status-pill.pending {
     background-color: #fff9c4;
     color: #f57f17;
   }

   .status-pill.approved {
     background-color: #c8e6c9;
     color: #2e7d32;
   }

   .status-pill.declined {
     background-color: #ffcdd2;
     color: #c62828;
   }

   .status-pill.amended {
     background-color: #b2dfdb;
     color: #00695c;
   }
   ```

**Validation**:
- Render each list in isolation with mock data.
- Verify row rendering, sorting, and pagination.
- Verify cell alignment and styling.
- Test row click handler (should not yet navigate; wait for Step 7).
- No console errors.

---

### Step 5: Implement Filters & State Synchronization (Estimate: 3 hours)

**Objective**: Wire up filter controls and ensure all three lists update synchronously.

**Tasks**:

1. **Create WorkspaceHeader component** (`src/features/debtTracker/components/WorkspaceHeader.tsx`):
   ```tsx
   interface WorkspaceHeaderProps {
     filters: { year: number; fundingSource: string };
     onYearChange: (year: number) => void;
     onFundingChange: (funding: string) => void;
     kpiData: KPIData; // From Issue #10
   }

   export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
     filters,
     onYearChange,
     onFundingChange,
     kpiData,
   }) => {
     const currentYear = new Date().getFullYear();
     const availableYears = [
       currentYear - 3,
       currentYear - 2,
       currentYear - 1,
       currentYear,
     ];

     return (
       <div className="workspace-header">
         <h2>Debt Management Tracker</h2>
         <div className="filter-controls">
           <select
             value={filters.year}
             onChange={(e) => onYearChange(parseInt(e.target.value))}
           >
             {availableYears.map((year) => (
               <option key={year} value={year}>
                 {year}
               </option>
             ))}
           </select>
           <select
             value={filters.fundingSource}
             onChange={(e) => onFundingChange(e.target.value)}
           >
             <option value="all">All Funding</option>
             <option value="self">Self-Funded</option>
             <option value="gov">Government</option>
             <option value="private">Private</option>
           </select>
         </div>
         <div className="kpi-block">
           <DebtSummaryKPI kpiData={kpiData} />
         </div>
       </div>
     );
   };
   ```

2. **Update DebtTrackerWorkspace** to wire up filters (in `DebtTrackerWorkspace.tsx`):
   ```tsx
   export const DebtTrackerWorkspace: React.FC = () => {
     const dispatch = useDispatch();
     const filters = useSelector(selectFilters);
     const pickedUpCases = useSelector(selectPickedUpCases);
     const refundCases = useSelector(selectRefundCases);
     const notPickedUpCases = useSelector(selectNotPickedUpCases);
     const loading = useSelector(selectLoading);
     const error = useSelector(selectError);
     const [kpiData, setKpiData] = useState<KPIData | null>(null);

     // Fetch cases on mount and when filters change
     useEffect(() => {
       dispatch(
         fetchCasesThunk({
           year: filters.year,
           fundingSource: filters.fundingSource,
         })
       );
     }, [filters.year, filters.fundingSource, dispatch]);

     // Update KPI data when cases change
     useEffect(() => {
       if (!loading && pickedUpCases) {
         const kpi = calculateKPI(pickedUpCases, refundCases, notPickedUpCases);
         setKpiData(kpi);
       }
     }, [pickedUpCases, refundCases, notPickedUpCases, loading]);

     const handleYearChange = (year: number) => {
       dispatch(debtTrackerActions.setYearFilter(year));
     };

     const handleFundingChange = (funding: string) => {
       dispatch(debtTrackerActions.setFundingFilter(funding));
     };

     if (loading) return <div className="loading">Loading...</div>;
     if (error) return <div className="error">Error: {error}</div>;

     return (
       <div className="debt-tracker-workspace">
         <WorkspaceHeader
           filters={filters}
           onYearChange={handleYearChange}
           onFundingChange={handleFundingChange}
           kpiData={kpiData}
         />
         <PickedUpList cases={pickedUpCases} />
         <RefundQueueList cases={refundCases} />
         <NotPickedUpTable cases={notPickedUpCases} />
       </div>
     );
   };
   ```

**Validation**:
- Change year filter; verify all three lists update within 500ms.
- Change funding filter; verify all three lists update within 500ms.
- Verify KPI block updates reflect new totals.
- Check network requests in browser DevTools (should see API call with correct params).
- No console errors.

---

### Step 6: Implement Responsive Behavior (Estimate: 4 hours)

**Objective**: Add CSS media queries and responsive layout collapse.

**Tasks**:

1. **Create responsive styles** (`src/features/debtTracker/styles/responsiveBreakpoints.module.css`):
   ```css
   /* Define breakpoints in CSS variables */
   :root {
     --breakpoint-desktop-xl: 1500px;
     --breakpoint-desktop-l: 1240px;
     --breakpoint-desktop-m: 1040px;
     --breakpoint-tablet: 900px;
     --breakpoint-mobile-l: 820px;
     --breakpoint-mobile-s: 0px;
   }

   /* Desktop XL (1500px+) - Full layout, all fields visible */
   @media (min-width: 1500px) {
     .list-table {
       font-size: 0.9rem;
     }
   }

   /* Desktop L (1240px–1499px) - Compact, text truncation */
   @media (max-width: 1499px) and (min-width: 1240px) {
     .programme-cell {
       max-width: 150px;
       overflow: hidden;
       text-overflow: ellipsis;
       white-space: nowrap;
     }

     .signal-chip {
       font-size: 0.7rem;
     }
   }

   /* Desktop M (1040px–1239px) - Hide 'owning agent', 'programme' in main view */
   @media (max-width: 1239px) and (min-width: 1040px) {
     .programme-cell {
       display: none;
     }

     .action-cell {
       /* Show recommendation, hide agent (in tooltip) */
     }

     .list-table th:nth-child(3),
     .list-table td:nth-child(3) {
       display: none;
     }
   }

   /* Tablet (900px–1039px) - Single-column list, hide signals */
   @media (max-width: 1039px) and (min-width: 900px) {
     .list-table {
       display: block;
       width: 100%;
     }

     .list-table thead {
       display: none;
     }

     .list-row {
       display: grid;
       grid-template-columns: auto 1fr;
       gap: 1rem;
       margin-bottom: 1rem;
       padding: 1rem;
       border: 1px solid #ddd;
       border-radius: 4px;
     }

     .list-row td {
       display: contents;
     }

     .signals-cell {
       display: none;
     }

     .kpi-block {
       display: grid;
       grid-template-columns: 1fr;
     }
   }

   /* Mobile L (820px–899px) - Compact rows, expandable drawer */
   @media (max-width: 899px) and (min-width: 820px) {
     .list-row {
       grid-template-columns: auto 1fr;
       gap: 0.75rem;
       padding: 0.75rem;
     }

     .signals-cell,
     .action-cell {
       display: none;
     }

     .programme-cell {
       display: none;
     }
   }

   /* Mobile S (<820px) - Minimal display, name + ID + amount only */
   @media (max-width: 819px) {
     .list-table {
       display: block;
     }

     .list-table thead {
       display: none;
     }

     .list-row {
       display: block;
       margin-bottom: 0.75rem;
       padding: 0.75rem;
       border: 1px solid #ddd;
       border-radius: 4px;
       background-color: #fafafa;
     }

     .list-row td {
       display: block;
       width: 100%;
       padding: 0.25rem 0;
     }

     .risk-cell {
       font-weight: 600;
       margin-bottom: 0.5rem;
     }

     .student-cell {
       font-weight: 600;
       font-size: 1rem;
     }

     .programme-cell,
     .signals-cell,
     .action-cell {
       display: none;
     }

     .funding-cell::before {
       content: 'Funding: ';
       font-weight: 600;
     }

     .amount-cell::before {
       content: 'Amount: ';
       font-weight: 600;
     }

     .status-cell::before {
       content: 'Status: ';
       font-weight: 600;
     }

     .status-cell {
       margin-top: 0.5rem;
     }
   }
   ```

2. **Create useResponsiveBreakpoint hook** (`src/features/debtTracker/hooks/useResponsiveBreakpoint.ts`):
   ```typescript
   export type Breakpoint =
     | 'desktop-xl'
     | 'desktop-l'
     | 'desktop-m'
     | 'tablet'
     | 'mobile-l'
     | 'mobile-s';

   export const useResponsiveBreakpoint = (): Breakpoint => {
     const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop-xl');

     useEffect(() => {
       const handleResize = () => {
         const width = window.innerWidth;
         if (width >= 1500) setBreakpoint('desktop-xl');
         else if (width >= 1240) setBreakpoint('desktop-l');
         else if (width >= 1040) setBreakpoint('desktop-m');
         else if (width >= 900) setBreakpoint('tablet');
         else if (width >= 820) setBreakpoint('mobile-l');
         else setBreakpoint('mobile-s');
       };

       handleResize(); // Call once on mount
       window.addEventListener('resize', handleResize);
       return () => window.removeEventListener('resize', handleResize);
     }, []);

     return breakpoint;
   };
   ```

**Validation**:
- Open browser DevTools and resize to each breakpoint.
- Verify columns hide/show correctly.
- Verify layout shifts from multi-column to single-column.
- Test on actual mobile device (iOS Safari, Chrome Android) if possible.
- No horizontal scroll on mobile.

---

### Step 7: Integrate KPI Block & Navigation (Estimate: 3 hours)

**Objective**: Import the Debt Summary KPI block (from Issue #10) and wire up row click navigation.

**Tasks**:

1. **Import DebtSummaryKPI** from Issue #10:
   ```tsx
   import { DebtSummaryKPI } from '../../../shared/components/KPIBlock/DebtSummaryKPI';

   interface KPIData {
     totalDebtors: number;
     totalAmount: number;
     criticalCount: number;
     atRiskCount: number;
   }

   const calculateKPI = (
     pickedUp: Case[],
     refund: Case[],
     notPickedUp: Case[]
   ): KPIData => {
     const totalDebtors = pickedUp.length + refund.length + notPickedUp.length;
     const totalAmount = [
       ...pickedUp,
       ...refund,
       ...notPickedUp,
     ].reduce((sum, c) => sum + c.amount, 0);
     const criticalCount = pickedUp.filter(
       (c) => c.band === 'High'
     ).length;
     const atRiskCount = pickedUp.filter(
       (c) => c.band === 'Elevated' || c.band === 'Watch'
     ).length;

     return { totalDebtors, totalAmount, criticalCount, atRiskCount };
   };
   ```

2. **Update WorkspaceHeader** to use the KPI component:
   ```tsx
   <div className="kpi-block">
     <DebtSummaryKPI
       totalDebtors={kpiData?.totalDebtors || 0}
       totalAmount={kpiData?.totalAmount || 0}
       criticalCount={kpiData?.criticalCount || 0}
       atRiskCount={kpiData?.atRiskCount || 0}
     />
   </div>
   ```

3. **Wire up row click navigation** (in list components):
   ```tsx
   import { useNavigate } from 'react-router-dom';

   interface PickedUpListProps {
     cases: Case[];
     onRowClick?: (caseId: string) => void;
   }

   export const PickedUpList: React.FC<PickedUpListProps> = ({ cases }) => {
     const navigate = useNavigate();

     const handleRowClick = (caseItem: Case) => {
       navigate(`/case-management/${caseItem.caseId}`, {
         state: { debtorId: caseItem.debtorId, caseId: caseItem.caseId },
       });
     };

     return (
       <table className="list-table">
         {/* ... */}
         <PickedUpListRow
           key={caseItem.caseId}
           caseItem={caseItem}
           onClick={() => handleRowClick(caseItem)}
         />
       </table>
     );
   };
   ```

**Validation**:
- Verify KPI block displays and updates when filters change.
- Click a row in the picked-up or refund queue list.
- Verify navigation to `/case-management/:caseId` with correct parameters.
- Use browser DevTools to check that `state` object is passed correctly.

---

### Step 8: Add Pagination (Estimate: 2 hours)

**Objective**: Implement pagination logic and controls.

**Tasks**:

1. **Create PaginationControl component** (or use existing from shared):
   ```tsx
   interface PaginationControlProps {
     totalItems: number;
     currentPage: number;
     pageSize: number;
     onPageChange: (page: number) => void;
   }

   export const PaginationControl: React.FC<PaginationControlProps> = ({
     totalItems,
     currentPage,
     pageSize,
     onPageChange,
   }) => {
     const totalPages = Math.ceil(totalItems / pageSize);

     return (
       <div className="pagination-control">
         <button
           onClick={() => onPageChange(currentPage - 1)}
           disabled={currentPage === 1}
         >
           Previous
         </button>
         <span className="page-info">
           Page {currentPage} of {totalPages}
         </span>
         <button
           onClick={() => onPageChange(currentPage + 1)}
           disabled={currentPage === totalPages}
         >
           Next
         </button>
       </div>
     );
   };
   ```

2. **Wire up pagination in DebtTrackerWorkspace**:
   ```tsx
   const pickedUpPage = useSelector(selectPickedUpPage);
   const handlePickedUpPageChange = (page: number) => {
     dispatch(debtTrackerActions.setPickedUpPage(page));
   };

   <PickedUpList
     cases={pickedUpCases}
     page={pickedUpPage}
     onPageChange={handlePickedUpPageChange}
     onRowClick={handleRowClick}
   />
   ```

**Validation**:
- Render a list with > 25 cases.
- Verify pagination controls appear.
- Click "Next" and verify page 2 renders.
- Click "Previous" and verify page 1 renders again.
- Verify correct rows display for each page.

---

### Step 9: Write Unit Tests (Estimate: 6 hours)

**Objective**: Test individual functions, reducers, selectors, and components in isolation.

**Tasks**:

1. **Test Redux reducer** (`debtTrackerSlice.test.ts`):
   ```typescript
   import debtTrackerReducer, { debtTrackerActions } from './debtTrackerSlice';

   describe('debtTrackerSlice', () => {
     it('should set year filter', () => {
       const state = debtTrackerReducer(
         undefined,
         debtTrackerActions.setYearFilter(2023)
       );
       expect(state.filters.year).toBe(2023);
     });

     it('should set funding filter', () => {
       const state = debtTrackerReducer(
         undefined,
         debtTrackerActions.setFundingFilter('gov')
       );
       expect(state.filters.fundingSource).toBe('gov');
     });
   });
   ```

2. **Test case partitioning** (`casePartitionService.test.ts`):
   ```typescript
   import { partitionCases } from './casePartitionService';

   describe('partitionCases', () => {
     it('should partition cases correctly', () => {
       const cases: Case[] = [
         { caseId: '1', band: 'High', amount: 100 },
         { caseId: '2', band: 'None', amount: -50 },
         { caseId: '3', band: 'Watch', amount: 50 },
       ];

       const { pickedUp, refund, notPickedUp } = partitionCases(cases);

       expect(pickedUp).toHaveLength(2);
       expect(refund).toHaveLength(1);
       expect(notPickedUp).toHaveLength(0);
     });
   });
   ```

3. **Test component rendering** (`PickedUpList.test.tsx`):
   ```typescript
   import { render, screen } from '@testing-library/react';
   import { PickedUpList } from './PickedUpList';

   describe('PickedUpList', () => {
     it('should render list with cases', () => {
       const cases: Case[] = [
         {
           caseId: '1',
           name: 'John Doe',
           band: 'High',
           score: 85,
           amount: 1000,
         },
       ];

       render(<PickedUpList cases={cases} page={1} onPageChange={jest.fn()} />);

       expect(screen.getByText('John Doe')).toBeInTheDocument();
       expect(screen.getByText('High (85)')).toBeInTheDocument();
     });
   });
   ```

**Validation**:
- Run `npm test` for debtTracker unit tests.
- Verify all tests pass.
- Verify code coverage > 80%.

---

### Step 10: Write Integration Tests (Estimate: 4 hours)

**Objective**: Test interactions between components and Redux.

**Tasks**:

1. **Test filter propagation** (`DebtTrackerWorkspace.test.tsx`):
   ```typescript
   import { render, screen, fireEvent, waitFor } from '@testing-library/react';
   import { Provider } from 'react-redux';
   import { configureStore } from '@reduxjs/toolkit';
   import { DebtTrackerWorkspace } from './DebtTrackerWorkspace';
   import debtTrackerReducer from '../redux/debtTrackerSlice';

   // Mock API
   jest.mock('../services/debtTrackerApi', () => ({
     fetchCases: jest.fn(async () => ({
       data: [
         { caseId: '1', band: 'High', amount: 100, score: 85 },
         { caseId: '2', band: 'None', amount: -50, score: 0 },
       ],
       meta: { total: 2, pageSize: 25, currentPage: 1 },
     })),
   }));

   describe('DebtTrackerWorkspace Integration', () => {
     it('should update all lists when filter changes', async () => {
       const store = configureStore({
         reducer: { debtTracker: debtTrackerReducer },
       });

       render(
         <Provider store={store}>
           <DebtTrackerWorkspace />
         </Provider>
       );

       // Change year filter
       const yearSelect = screen.getByDisplayValue('2026');
       fireEvent.change(yearSelect, { target: { value: '2025' } });

       // Wait for lists to update
       await waitFor(() => {
         expect(screen.getByText('Picked Up for Attention')).toBeInTheDocument();
       });

       // Verify all three lists are present
       expect(screen.getByText('Refund Queue')).toBeInTheDocument();
       expect(screen.getByText('Not Picked Up')).toBeInTheDocument();
     });
   });
   ```

2. **Test navigation** with a React Router wrapper:
   ```typescript
   it('should navigate to case management when row clicked', async () => {
     const mockNavigate = jest.fn();
     jest.mock('react-router-dom', () => ({
       ...jest.requireActual('react-router-dom'),
       useNavigate: () => mockNavigate,
     }));

     // ... render and click row
     const row = screen.getByRole('button', { name: /john doe/i });
     fireEvent.click(row);

     await waitFor(() => {
       expect(mockNavigate).toHaveBeenCalledWith('/case-management/case1', {
         state: expect.objectContaining({ caseId: 'case1' }),
       });
     });
   });
   ```

**Validation**:
- Run `npm test -- debtTracker` integration tests.
- Verify filter changes trigger API calls and list updates.
- Verify navigation works correctly.

---

### Step 11: Write E2E Tests (Estimate: 4 hours)

**Objective**: Test full user workflows using Cypress or similar.

**Tasks**:

1. **E2E test for workspace load and filter**:
   ```typescript
   describe('Debt Tracker E2E', () => {
     beforeEach(() => {
       cy.visit('/debt-tracker');
     });

     it('should load workspace with initial data', () => {
       cy.get('h2').contains('Debt Management Tracker').should('be.visible');
       cy.get('.picked-up-list').should('be.visible');
       cy.get('.refund-queue-list').should('be.visible');
       cy.get('.not-picked-up-table').should('be.visible');
     });

     it('should update lists when year filter changes', () => {
       // Get initial count
       cy.get('.picked-up-list .list-row').then((rows) => {
         const initialCount = rows.length;

         // Change year filter
         cy.get('select[name="year"]').select('2025');

         // Wait for API call (observe network or data update)
         cy.get('.picked-up-list .list-row').should('have.length', 5); // Assuming filtered result has 5 rows
       });
     });

     it('should navigate to case management when row clicked', () => {
       cy.get('.picked-up-list .list-row').first().click();
       cy.url().should('include', '/case-management/');
     });
   });
   ```

**Validation**:
- Run `npm run cypress` or equivalent E2E test runner.
- Verify all E2E tests pass.
- Smoke test in actual browser (manual verification).

---

### Step 12: Manual Testing & Debugging (Estimate: 3 hours)

**Objective**: Perform final manual verification and fix any issues.

**Tasks**:

1. **Smoke test**:
   - Navigate to `/debt-tracker`.
   - Verify KPI block displays correct totals.
   - Verify all three lists render with data.
   - Change year and funding filters; verify lists update within 500ms.
   - Click a row; verify navigation to Case Management.

2. **Performance check**:
   - Open DevTools Performance tab.
   - Render 100 cases per list.
   - Verify render time < 500ms.
   - If slower, implement virtual scrolling.

3. **Responsive check**:
   - Test at each breakpoint (use DevTools device emulation).
   - Verify no horizontal scroll.
   - Verify columns hide/show correctly.
   - Test on actual mobile device if possible.

4. **Accessibility check**:
   - Run axe DevTools or similar.
   - Fix color contrast issues.
   - Verify keyboard navigation works.
   - Add ARIA labels where needed.

**Validation**:
- All manual tests pass.
- No console errors or warnings.
- Performance acceptable.
- Responsive on all devices.

---

## Dependencies & Assumptions

### Upstream Dependencies

1. **Issue #10 — Debt Summary KPI Block** (must be complete)
   - Assumption: Exported from `src/shared/components/KPIBlock/DebtSummaryKPI.tsx`
   - Assumption: Accepts props: `totalDebtors`, `totalAmount`, `criticalCount`, `atRiskCount`
   - Assumption: Component is filter-aware and can be integrated into this workspace

2. **Issue #12 — Case Management Workspace** (must exist as a navigation target)
   - Assumption: Route exists at `/case-management/:caseId`
   - Assumption: Accepts route state with `caseId` and `debtorId`
   - Assumption: Component properly renders with provided case context

### Backend Dependencies

1. **`/api/cases` endpoint** (must exist and support filtering)
   - Assumption: Endpoint accepts query params `?year={year}&funding={funding}`
   - Assumption: Returns array of `Case` objects matching the spec (Section 3.5)
   - Assumption: Response includes `meta.total`, `meta.pageSize`, `meta.currentPage`

2. **Case Store** (backend data source)
   - Assumption: Includes `caseId`, `debtorId`, `band`, `amount`, `score`, `signals`, etc.
   - Assumption: Properly populated by the Nightly Scoring Job (Section 4)

### Development Assumptions

1. **Redux/Context Setup** (must already be initialized)
   - Assumption: Redux store already configured in `src/store.ts` or equivalent
   - Assumption: `configureStore` from Redux Toolkit available

2. **React Router Setup** (must already be initialized)
   - Assumption: React Router v6+ configured in the app
   - Assumption: Route registration pattern is understood by the team

3. **Testing Setup** (must already be initialized)
   - Assumption: Jest + React Testing Library configured
   - Assumption: Test utilities and mocking patterns available

4. **CSS/Styling** (framework or approach defined)
   - Assumption: CSS Modules or plain CSS available
   - Assumption: No external UI library (Bootstrap, Material-UI) is mandated; however, if one exists in the project, use it for consistency

---

## Technology & Libraries

| Technology | Version | Purpose |
|---|---|---|
| React | 18+ | UI component framework |
| Redux Toolkit | ^1.9.0 | State management (slices, thunks) |
| React-Redux | ^8.0.0 | Redux integration for React |
| React Router | v6+ | Client-side routing |
| Jest | ^28.0 | Unit test runner |
| React Testing Library | ^13.0 | Component testing utilities |
| Cypress | ^12.0 (optional) | E2E testing framework |
| CSS Grid / Flexbox | (native) | Responsive layout |
| TypeScript | ^4.5 (optional) | Type safety |

---

## Risk Mitigation & Validation Steps

### Risk 1: Performance Degradation with Large Datasets

**Mitigation**:
- Implement pagination with default page size of 25 rows.
- Measure render time using DevTools Profiler.
- If render > 500ms with 100 cases, implement React virtualization (react-window).

**Validation**:
- Test with 100 cases per list.
- Monitor render time in DevTools.
- Ensure smooth scrolling and interaction.

### Risk 2: Stale Data After Filter Change

**Mitigation**:
- Ensure filter change action dispatches fetch thunk immediately.
- Add loading state and loading indicator.
- Consider debouncing if filters are user-typed (not applicable here; dropdowns are not typable).

**Validation**:
- Change filter; observe network request in DevTools.
- Verify request includes correct query parameters.
- Verify lists update with new data within 500ms.

### Risk 3: Navigation Context Loss

**Mitigation**:
- Store filter state in Redux (not component state).
- Restore filter state on workspace mount.
- Optionally persist to localStorage/sessionStorage for cross-session persistence.

**Validation**:
- Navigate away and back to `/debt-tracker`.
- Verify filters are preserved.
- Open DevTools Redux extension; verify state is restored.

### Risk 4: Responsive Layout Breakage

**Mitigation**:
- Use mobile-first CSS approach.
- Test at each defined breakpoint.
- Use rem units for font sizes (relative to root font size).
- Test on real devices, not just DevTools emulation.

**Validation**:
- Test at: 1500px, 1240px, 1040px, 900px, 820px, and below.
- Verify no horizontal scroll.
- Verify readability at each breakpoint.
- Test on iOS Safari and Chrome Android.

### Risk 5: API/Backend Unavailable

**Mitigation**:
- Add error boundary or error handling in workspace.
- Display user-friendly error message.
- Implement retry button or refresh option.

**Validation**:
- Mock API to return error response.
- Verify error message displays.
- Verify retry button works (calls fetch again).

---

## Rollback Plan

### If Implementation Fails or Blockers Arise

1. **Identify the blocker** (e.g., API unavailable, performance issue, missing dependency).

2. **Revert recent commits**:
   ```bash
   git log --oneline -10  # Find the commit before the work started
   git reset --hard <commit-hash>  # or git revert if already pushed
   ```

3. **Delete workspace feature directory** (if rollback is needed):
   ```bash
   rm -rf src/features/debtTracker/
   rm -rf src/routes/debtTrackerRoute.tsx
   ```

4. **Remove Redux slice from store**:
   - Edit `src/store.ts` and remove the `debtTracker` reducer registration.

5. **Remove route from app router**:
   - Edit `src/App.tsx` or `src/router.tsx` and remove the `/debt-tracker` route.

6. **Clean up shared component imports** (if any):
   - Remove imports of DebtTrackerWorkspace from navigation/layout components.

7. **Communicate with stakeholders**:
   - Report blocker to project lead.
   - Document root cause and proposed workaround.
   - Estimate revised timeline for retry.

8. **Data cleanup** (if applicable):
   - If test data was written to backend, remove or mark as test.
   - Verify no orphaned records in database.

---

## Estimated Effort & Timeline

| Step | Task | Estimated Hours | Cumulative |
|------|------|---|---|
| 1 | Workspace shell & routing | 2 | 2 |
| 2 | Redux state & actions | 4 | 6 |
| 3 | API service & partitioning | 3 | 9 |
| 4 | List components | 8 | 17 |
| 5 | Filters & synchronization | 3 | 20 |
| 6 | Responsive behavior | 4 | 24 |
| 7 | KPI integration & navigation | 3 | 27 |
| 8 | Pagination | 2 | 29 |
| 9 | Unit tests | 6 | 35 |
| 10 | Integration tests | 4 | 39 |
| 11 | E2E tests | 4 | 43 |
| 12 | Manual testing & debugging | 3 | 46 |
| **Total** | | | **46 hours (~5.75 days for one developer)** |

### Parallelization Opportunities

- Steps 1–3 can be done sequentially by one developer.
- Steps 4–5 can be done in parallel by two developers (one on PickedUp/Refund lists, one on NotPickedUp + filters).
- Steps 9–11 can be done in parallel by a dedicated QA person while development continues.
- Step 12 can overlap with earlier steps (manual smoke tests during development).

### Estimated Timeline (1 developer, full-time)

- **Week 1**: Steps 1–6 (Mon–Wed: 24 hours, Thu–Fri: manual testing + fixes)
- **Week 2**: Steps 7–12 (Mon–Tue: KPI + navigation + pagination, Wed–Fri: tests + debugging)
- **Total**: ~2 weeks, including testing and contingency.

---

## Success Criteria

### Definition of "Done" for Each Step

| Step | Success Criteria |
|---|---|
| 1 | Workspace renders at `/debt-tracker` without errors. Lazy loading works. |
| 2 | Redux DevTools shows `debtTracker` slice with correct initial state. Actions and selectors work. |
| 3 | Cases fetched from `/api/cases` endpoint. Partitioning logic sorts correctly (score desc, amount asc, date asc). |
| 4 | All three lists render with correct columns and styling. Rows are clickable. Pagination controls appear for large datasets. |
| 5 | Changing year or funding filter triggers API call and updates all three lists within 500ms. No console errors. |
| 6 | Workspace is responsive at all breakpoints (1500px, 1240px, 1040px, 900px, 820px, below). No horizontal scroll. |
| 7 | KPI block displays and updates when filters change. Clicking a row navigates to `/case-management/:caseId`. |
| 8 | Pagination controls work correctly (next, previous, disabled states). Correct rows display per page. |
| 9 | Unit tests for reducers, selectors, services, and components all pass. Code coverage > 80%. |
| 10 | Integration tests for filter propagation, KPI update, and navigation all pass. |
| 11 | E2E tests for workspace load, filter, and navigation all pass (manual smoke test also successful). |
| 12 | No console errors or warnings. Performance acceptable (render < 500ms for typical dataset). Mobile responsive. |

### Definition of "Done" for the Entire Feature

- [ ] All 12 steps complete and validated.
- [ ] All unit, integration, and E2E tests passing.
- [ ] Code reviewed and approved by tech lead.
- [ ] Accessibility audit passed (WCAG AA).
- [ ] Performance audit passed (render time < 500ms, Lighthouse score > 80).
- [ ] Product acceptance testing passed by debt officers (or stakeholders).
- [ ] Merged to `main` or `develop` branch.
- [ ] Deployment to staging environment successful.
- [ ] No critical bugs or regressions.

---

## Appendix: Key File Checklist

Below is a checklist of all files to be created, in the order of creation:

```
src/features/debtTracker/
├── components/
│   ├── DebtTrackerWorkspace.tsx ✓
│   ├── WorkspaceHeader.tsx ✓
│   ├── PickedUpList/
│   │   ├── PickedUpList.tsx ✓
│   │   ├── PickedUpListRow.tsx ✓
│   │   ├── RiskBadge.tsx ✓
│   │   ├── StudentInfo.tsx ✓
│   │   ├── FundingPill.tsx ✓
│   │   ├── SignalChips.tsx ✓
│   │   ├── ActionInfo.tsx ✓
│   │   ├── StatusPill.tsx ✓
│   │   └── AmountDisplay.tsx ✓
│   ├── RefundQueueList/
│   │   ├── RefundQueueList.tsx ✓
│   │   ├── RefundQueueListRow.tsx ✓
│   │   └── CreditAmountDisplay.tsx ✓
│   ├── NotPickedUpTable/
│   │   ├── NotPickedUpTable.tsx ✓
│   │   └── NotPickedUpTableRow.tsx ✓
│   ├── FiltersSection.tsx ✓
│   └── PaginationControl.tsx ✓
├── redux/
│   ├── debtTrackerSlice.ts ✓
│   ├── debtTrackerSelectors.ts ✓
│   └── debtTrackerThunks.ts ✓
├── services/
│   ├── debtTrackerApi.ts ✓
│   └── casePartitionService.ts ✓
├── hooks/
│   ├── useDebtTrackerFilters.ts ✓
│   ├── useCases.ts ✓
│   └── useResponsiveBreakpoint.ts ✓
├── styles/
│   ├── debtTrackerWorkspace.module.css ✓
│   ├── lists.module.css ✓
│   ├── responsiveBreakpoints.module.css ✓
│   └── components.module.css ✓
└── __tests__/
    ├── redux/
    │   ├── debtTrackerSlice.test.ts ✓
    │   └── debtTrackerSelectors.test.ts ✓
    ├── services/
    │   ├── debtTrackerApi.test.ts ✓
    │   └── casePartitionService.test.ts ✓
    ├── components/
    │   ├── DebtTrackerWorkspace.test.tsx ✓
    │   ├── PickedUpList.test.tsx ✓
    │   ├── RefundQueueList.test.tsx ✓
    │   ├── NotPickedUpTable.test.tsx ✓
    │   ├── WorkspaceHeader.test.tsx ✓
    │   └── [Other component tests] ✓
    └── hooks/
        ├── useDebtTrackerFilters.test.ts ✓
        └── useCases.test.ts ✓

src/routes/
└── debtTrackerRoute.tsx ✓

src/store.ts
  - Add debtTracker reducer registration ✓

src/App.tsx (or src/router.tsx)
  - Register /debt-tracker route ✓
```

---

**End of Implementation Plan**

---

**Version History**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-09-10 | Initial plan for Issue #11 |

---

*This plan is subject to change based on team feedback, blockers encountered during implementation, and evolving business requirements. All changes will be documented in the Version History section above.*
