# Code Template Structure - Issue #11 Debt Management Tracker Workspace

This document describes the complete starter code template generated for the Debt Management Tracker workspace. All 40+ files follow TypeScript best practices with Redux Toolkit, React 18+, and CSS Modules.

## Directory Structure

```
src/features/debtTracker/
├── types/
│   └── debtTrackerTypes.ts                    [All TypeScript interfaces and types]
│
├── redux/
│   ├── debtTrackerSlice.ts                    [Redux slice with 20+ actions]
│   ├── debtTrackerSelectors.ts                [25+ memoized selectors]
│   ├── debtTrackerThunks.ts                   [Async thunks for API calls]
│   └── index.ts                               [Clean exports]
│
├── services/
│   ├── debtTrackerApi.ts                      [API layer with fetch, create, update, export]
│   ├── casePartitionService.ts                [Partitioning & sorting logic]
│   └── index.ts                               [Clean exports]
│
├── hooks/
│   ├── useDebtTrackerFilters.ts               [Filter state management]
│   ├── useCases.ts                            [Data fetching & loading]
│   ├── useResponsiveBreakpoint.ts             [Viewport breakpoint detection]
│   └── index.ts                               [Clean exports]
│
├── components/
│   ├── DebtTrackerWorkspace.tsx               [Root container component]
│   ├── WorkspaceHeader.tsx                    [Header with filters & KPI]
│   ├── FiltersSection.tsx                     [Year & funding filters]
│   ├── PaginationControl.tsx                  [Pagination controls]
│   │
│   ├── PickedUpList/
│   │   ├── index.ts
│   │   ├── PickedUpList.tsx                   [Main list container]
│   │   ├── PickedUpListRow.tsx                [Individual row]
│   │   ├── RiskBadge.tsx                      [Risk score + band display]
│   │   ├── StudentInfo.tsx                    [Name, ID, programme]
│   │   ├── FundingPill.tsx                    [Funding source badge]
│   │   ├── SignalChips.tsx                    [Risk signal flags]
│   │   ├── ActionInfo.tsx                     [Recommendation + agent]
│   │   ├── StatusPill.tsx                     [Case status badge]
│   │   └── AmountDisplay.tsx                  [Amount owed display]
│   │
│   ├── RefundQueueList/
│   │   ├── index.ts
│   │   ├── RefundQueueList.tsx                [Main refund list]
│   │   ├── RefundQueueListRow.tsx             [Individual refund row]
│   │   └── CreditAmountDisplay.tsx            [Credit amount display]
│   │
│   ├── NotPickedUpTable/
│   │   ├── index.ts
│   │   ├── NotPickedUpTable.tsx               [Not-picked-up table]
│   │   └── NotPickedUpTableRow.tsx            [Table row component]
│   │
│   └── index.ts                               [Component exports]
│
├── styles/
│   ├── variables.css                          [50+ CSS custom properties]
│   ├── debtTrackerWorkspace.module.css        [Workspace layout & breakpoints]
│   ├── lists.module.css                       [List & table styles]
│   ├── components.module.css                  [Badge, pill, chip styles]
│   └── responsiveBreakpoints.module.css       [All 6 breakpoint definitions]
│
└── __tests__/
    ├── redux/
    │   ├── debtTrackerSlice.test.ts           [Redux reducer tests]
    │   └── debtTrackerSelectors.test.ts       [Selector tests]
    │
    ├── services/
    │   ├── debtTrackerApi.test.ts             [API integration tests]
    │   └── casePartitionService.test.ts       [Partitioning tests]
    │
    ├── components/
    │   ├── DebtTrackerWorkspace.test.tsx      [Workspace integration test]
    │   ├── PickedUpList.test.tsx              [List component tests]
    │   ├── RefundQueueList.test.tsx           [Refund list tests]
    │   ├── NotPickedUpTable.test.tsx          [Table tests]
    │   ├── WorkspaceHeader.test.tsx           [Header tests]
    │   └── PickedUpListRow.test.tsx           [Row rendering tests]
    │
    └── hooks/
        ├── useDebtTrackerFilters.test.ts      [Hook tests]
        └── useCases.test.ts                   [Data fetching tests]

src/routes/
└── debtTrackerRoute.tsx                       [Lazy-loaded route definition]

docs/
├── SETUP_INSTRUCTIONS.md                      [Integration guide (400+ lines)]
└── TROUBLESHOOTING.md                         [Debugging guide (600+ lines)]
```

## File Statistics

| Category | File Count | Total Lines | Purpose |
|----------|-----------|-------------|---------|
| Types | 1 | ~200 | TypeScript interfaces |
| Redux | 3 | ~600 | State management |
| Services | 2 | ~400 | API & logic |
| Hooks | 3 | ~300 | Custom React hooks |
| Components | 20+ | ~2000+ | UI components |
| Styles | 4 | ~1500+ | CSS Modules |
| Tests | 8 | ~1200+ | Test stubs |
| Routes | 1 | ~50 | Route definition |
| Docs | 2 | ~1000+ | Setup & troubleshooting |
| **TOTAL** | **40+** | **~7250+** | **Complete template** |

## Key Features

### 1. Redux State Management
- **Slice**: 20+ actions for filter changes, loading states, pagination
- **Selectors**: 25+ memoized selectors with `createSelector`
- **Thunks**: Async data fetching with error handling
- **Types**: Full TypeScript coverage for all Redux entities

### 2. Components
All components include:
- ✓ TypeScript prop interfaces
- ✓ JSDoc documentation with examples
- ✓ CSS Module imports
- ✓ Accessibility attributes (aria-*, role)
- ✓ Error boundaries where needed
- ✓ Loading and error states

### 3. Responsive Design (6 Breakpoints)
```css
/* Variables */
--breakpoint-xxl: 1500px;  /* Desktop XL: full layout */
--breakpoint-xl: 1240px;   /* Desktop L: compact layout */
--breakpoint-lg: 1040px;   /* Desktop M: single column */
--breakpoint-md: 900px;    /* Tablet: stack KPI */
--breakpoint-sm: 820px;    /* Mobile L: expandable rows */
--breakpoint-xs: <820px;   /* Mobile S: minimal view */
```

### 4. Sorting Logic
- **Picked-up list**: Risk score descending (highest risk first)
- **Refund queue**: Amount ascending (largest credit first)
- **Not picked up**: Last payment date ascending (oldest dormant first)

### 5. Test Structure
All test files include:
- ✓ Jest describe/it structure
- ✓ Mock Redux store setup
- ✓ Mock API responses
- ✓ TODO comments explaining what to test
- ✓ Example assertions

## How to Use This Template

### Step 1: Copy Files to ITS Integrator
```bash
# In your ITS Integrator project root:
cp -r /path/to/template/src/features/debtTracker ./src/features/
cp /path/to/template/src/routes/debtTrackerRoute.tsx ./src/routes/
```

### Step 2: Follow Setup Instructions
See `SETUP_INSTRUCTIONS.md` for:
- Redux store integration
- Route registration
- API endpoint configuration
- Dependency installation
- Environment variables

### Step 3: Implement Business Logic
Each file has TODO comments indicating where to:
- Fill in actual API responses
- Implement filter logic
- Add styling
- Complete test implementations

### Step 4: Run Tests
```bash
npm test -- src/features/debtTracker
```

### Step 5: Start Development Server
```bash
npm start
# Navigate to /debt-tracker
```

## Development Guidelines

### TypeScript
- All props are fully typed
- Redux state is fully typed
- No `any` types (unless explicitly needed)
- Use `ReturnType<typeof reducer>` for state type inference

### Components
- Use functional components with hooks
- Keep components small and focused
- Extract complex logic to custom hooks
- Use CSS Modules for scoping

### Redux
- Use Redux Toolkit for slice definitions
- Use `createSelector` for memoized selectors
- Use `createAsyncThunk` for async operations
- Keep side effects in thunks, not reducers

### Styling
- Use CSS custom properties (variables) for theming
- Mobile-first responsive approach
- BEM-like naming convention (kebab-case)
- Test at all 6 breakpoints

### Testing
- Unit tests for reducers and selectors
- Integration tests for filter propagation
- E2E tests for user workflows
- Aim for >80% code coverage

## Common Tasks

### Add a New Filter
1. Add action to slice: `setMyFilter: (state, action) => { state.filters.myFilter = action.payload }`
2. Add selector: `export const selectMyFilter = (state: RootState) => state.debtTracker.filters.myFilter`
3. Use in component: `const myFilter = useSelector(selectMyFilter)`

### Modify Component Styling
1. Edit the corresponding CSS Module in `styles/`
2. Update className in component
3. Test at all 6 responsive breakpoints

### Add API Endpoint
1. Add function to `debtTrackerApi.ts`
2. Create thunk in `debtTrackerThunks.ts`
3. Add handler to `debtTrackerSlice.ts` extraReducers
4. Add selector in `debtTrackerSelectors.ts`

### Write a Test
1. Create `.test.ts` or `.test.tsx` file
2. Import testing utilities
3. Follow existing test patterns
4. Replace TODO comments with real assertions

## Support

For integration issues, refer to:
- **SETUP_INSTRUCTIONS.md** - Step-by-step setup
- **TROUBLESHOOTING.md** - Common errors and solutions
- **Technical Specification** - Section 6.2 for requirements
- **Implementation Plan** - Issue #11 for architecture

---

**Generated:** 2026-09-10  
**Status:** Complete, ready for integration  
**Test Coverage:** Stubs included, 80%+ target  
**Responsive Design:** 6 breakpoints defined  
**Total Lines of Code:** 7250+  
