# Setup Instructions — Integrating Debt Tracker Template into ITS Integrator

This guide walks through integrating the generated Debt Management Tracker workspace template into your ITS Integrator codebase.

**Estimated Time:** 30-45 minutes  
**Prerequisites:**
- Node.js 16+ and npm 8+
- ITS Integrator codebase cloned and ready
- React 18+, Redux Toolkit, React Router v6+ already installed
- Jest and React Testing Library configured

---

## Phase 1: Pre-Integration Checklist

Before you begin, verify your project has:

```bash
# Check Node version
node --version  # Should be 16+ or 18+
npm --version   # Should be 8+

# Check ITS Integrator project structure
ls src/          # Should show existing features, layout, hooks, etc.
ls package.json  # Should exist

# Check Redux is configured
grep -l "configureStore" src/**/*.ts  # Should find Redux store config
```

### Dependency Check

Verify these packages are installed:

```bash
grep -E '"react"|"redux"|"react-redux"|"@reduxjs/toolkit"|"react-router-dom"' package.json
```

**Required versions:**
```json
{
  "react": "^18.0.0",
  "redux": "^4.2.0",
  "react-redux": "^8.0.0",
  "@reduxjs/toolkit": "^1.9.0",
  "react-router-dom": "^6.0.0"
}
```

If missing, install:
```bash
npm install react@18 react-redux@8 @reduxjs/toolkit@1.9 react-router-dom@6
npm install --save-dev @types/react@18 @types/react-dom@18
```

---

## Phase 2: File Structure Setup

### Step 1: Create Feature Directory

```bash
# From ITS Integrator root
mkdir -p src/features/debtTracker/{components,redux,services,hooks,styles,types,__tests__}
mkdir -p src/features/debtTracker/{components/PickedUpList,components/RefundQueueList,components/NotPickedUpTable}
mkdir -p src/features/debtTracker/__tests__/{redux,services,components,hooks}
mkdir -p src/routes
```

### Step 2: Copy Template Files

Copy all files from the template into the corresponding directories:

```bash
# Assuming template is in /path/to/template
cp -r /path/to/template/src/features/debtTracker/* src/features/debtTracker/
cp /path/to/template/src/routes/debtTrackerRoute.tsx src/routes/
```

Or manually copy each group:
- Types: `types/debtTrackerTypes.ts`
- Redux: `redux/*.ts`
- Services: `services/*.ts`
- Hooks: `hooks/*.ts`
- Components: `components/**/*.tsx`
- Styles: `styles/*.css`
- Tests: `__tests__/**/*.test.ts(x)`
- Routes: `routes/debtTrackerRoute.tsx`

### Step 3: Verify Structure

```bash
find src/features/debtTracker -type f | wc -l
# Should show 40+ files
```

---

## Phase 3: Redux Store Integration

### Step 1: Open Your Redux Store Configuration

```bash
# Typically one of:
cat src/store.ts
cat src/redux/store.ts
cat src/app/store.ts
```

### Step 2: Import Debt Tracker Reducer

Find where other feature reducers are imported and add:

```typescript
// src/store.ts (or your store config)

import { configureStore } from '@reduxjs/toolkit';
import debtTrackerReducer from './features/debtTracker/redux/debtTrackerSlice';

// ... other imports
```

### Step 3: Register Debt Tracker in Store

In your `configureStore` call, add to the reducer object:

```typescript
const store = configureStore({
  reducer: {
    // ... existing reducers
    debtTracker: debtTrackerReducer,  // ← Add this line
  },
});
```

### Step 4: Export Redux Types (for TypeScript)

Add these exports to your store file:

```typescript
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

Update the import path in `src/features/debtTracker/redux/debtTrackerSelectors.ts`:

```typescript
// Change this line:
import { RootState } from '../../../store';  // Adjust path as needed
```

### Step 5: Verify Redux Setup

```bash
npm start
# Open browser DevTools → Redux tab (if Redux DevTools Extension installed)
# Should see 'debtTracker' slice in the state tree
```

---

## Phase 4: Route Integration

### Step 1: Open Your Router Configuration

```bash
# Typically one of:
cat src/App.tsx
cat src/routes/index.ts
cat src/router.ts
```

### Step 2: Import the Debt Tracker Route

```typescript
// src/App.tsx or src/router.ts

import { debtTrackerRoute } from './routes/debtTrackerRoute';
```

### Step 3: Add Route to Your Route Array/Config

If you use an array of routes:

```typescript
const routes = [
  // ... existing routes
  debtTrackerRoute,  // ← Add this
];
```

If you use JSX routing:

```typescript
<Routes>
  {/* ... existing routes */}
  <Route path={debtTrackerRoute.path} element={debtTrackerRoute.element} />
</Routes>
```

### Step 4: Add Navigation Link (Optional)

In your main navigation/header component:

```typescript
import { Link } from 'react-router-dom';

export const MainNav = () => (
  <nav>
    {/* ... other links */}
    <Link to="/debt-tracker">Debt Management Tracker</Link>
  </nav>
);
```

### Step 5: Test Route Navigation

```bash
npm start
# Navigate to http://localhost:3000/debt-tracker
# Should see workspace load (or loading state)
```

---

## Phase 5: API Configuration

### Step 1: Identify Your API Base URL

In `src/features/debtTracker/services/debtTrackerApi.ts`, update:

```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const fetchCases = async (year: number, fundingSource: string): Promise<CasesResponse> => {
  const params = new URLSearchParams();
  params.append('year', year.toString());
  params.append('funding', fundingSource);

  const response = await fetch(`${API_BASE_URL}/api/cases?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  // ... rest of function
};
```

### Step 2: Set Environment Variables

Create or update `.env.local`:

```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_ENV=development
```

Or for production:

```env
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_ENV=production
```

### Step 3: Verify API Connectivity

```bash
npm start
# Open DevTools → Network tab
# Navigate to /debt-tracker
# Should see GET request to /api/cases
# Check response in Network tab
```

### Step 4: Handle API Response Format

If your actual API response differs from the template expectations, update `debtTrackerTypes.ts` and the transform logic in `debtTrackerApi.ts`.

Expected response format:

```json
{
  "success": true,
  "data": [
    {
      "caseId": "case_123",
      "debtorId": "S00123456",
      "name": "Jane Doe",
      "programme": "BSc Computer Science",
      "funding": "gov",
      "fundingStatus": "Active",
      "amount": 2500,
      "score": 75,
      "band": "High",
      "signals": [
        { "signal": "no_payment_6mo", "severity": "hot" }
      ],
      "recommendation": "Payment plan review",
      "owningAgent": "Alice Smith",
      "status": "Pending",
      "lastPaymentDate": "2024-08-15"
    }
  ],
  "meta": {
    "total": 150,
    "pageSize": 25,
    "currentPage": 1
  }
}
```

---

## Phase 6: KPI Block Integration (Dependency on Issue #10)

### Step 1: Verify KPI Block Component Exists

The workspace imports the KPI block from Issue #10. Verify it's available:

```bash
find src -name "*KPI*" -o -name "*Summary*" | grep -i debt
# Should find the KPI component from Issue #10
```

### Step 2: Update Import Path (if needed)

In `src/features/debtTracker/components/WorkspaceHeader.tsx`:

```typescript
// Update this import to match your project structure
import { DebtSummaryKPI } from '../../../shared/components/KPIBlock'; // Adjust path
```

### Step 3: Verify KPI Props

Ensure the KPI component accepts:
- `year: number`
- `fundingSource: string`
- Re-renders when filters change

---

## Phase 7: Case Management Integration (Dependency on Issue #12)

### Step 1: Verify Case Management Workspace Exists

The Debt Tracker navigates to Case Management when a row is clicked:

```bash
find src -type f -name "*Case*Management*" | head -5
# Should find Case Management component
```

### Step 2: Update Navigation Route (if needed)

In `src/features/debtTracker/components/PickedUpListRow.tsx`:

```typescript
const handleRowClick = (caseId: string) => {
  navigate(`/case-management/${caseId}`, { state: { debtorId } });
};
```

Verify the Case Management route exists at `/case-management/:caseId`.

---

## Phase 8: Testing Setup

### Step 1: Verify Test Configuration

```bash
cat jest.config.js
# Should have React Testing Library configured
```

### Step 2: Run Template Tests

```bash
npm test -- src/features/debtTracker --coverage
# Should show test stubs running (many will have TODO assertions)
```

### Step 3: Implement Test Logic

Replace TODO comments in test files with actual assertions:

Example in `redux/debtTrackerSlice.test.ts`:

```typescript
describe('debtTrackerSlice', () => {
  it('should set year filter', () => {
    const action = setYearFilter(2024);
    const newState = debtTrackerReducer(initialState, action);
    // TODO: Assert that newState.filters.year === 2024
    expect(newState.filters.year).toBe(2024);  // ← Replace TODO
  });
});
```

---

## Phase 9: Styling Customization

### Step 1: Update CSS Variables

In `src/features/debtTracker/styles/variables.css`, customize:

```css
:root {
  /* Colors */
  --color-primary: #007bff;      /* Your primary color */
  --color-danger: #dc3545;        /* Your danger color */
  --color-success: #28a745;       /* Your success color */
  
  /* Spacing */
  --spacing-unit: 8px;
  --spacing-sm: calc(var(--spacing-unit) * 1);
  --spacing-md: calc(var(--spacing-unit) * 2);
  
  /* Fonts */
  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto';
  --font-size-base: 14px;
  --font-size-lg: 16px;
}
```

### Step 2: Test Responsive Breakpoints

Open DevTools and test at each breakpoint:
- 1500px (Desktop XL)
- 1240px (Desktop L)
- 1040px (Desktop M)
- 900px (Tablet)
- 820px (Mobile L)
- <820px (Mobile S)

```bash
# DevTools → Toggle device toolbar (Ctrl+Shift+M)
# Resize and verify layout at each breakpoint
```

---

## Phase 10: Environment Variables

### Development

Create `.env.local`:

```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_DEBUG=true
```

### Production

Update `.env.production`:

```env
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_DEBUG=false
```

---

## Verification Checklist

Before marking integration complete, verify:

- [ ] `npm install` runs without errors
- [ ] Redux store includes `debtTracker` reducer
- [ ] Route `/debt-tracker` loads without errors
- [ ] Navigation link appears in main menu
- [ ] API fetch request appears in DevTools Network tab
- [ ] KPI block from Issue #10 displays correctly
- [ ] List rows are clickable and navigate to Case Management
- [ ] Filters (year, funding) work and update lists
- [ ] Responsive design works at all 6 breakpoints
- [ ] `npm test` runs test suite
- [ ] `npm start` launches dev server without warnings
- [ ] No console errors in DevTools

---

## Troubleshooting

For common issues, see `TROUBLESHOOTING.md`:

### Issue: "Cannot find module 'src/store'"
**Solution:** Update import paths in `debtTrackerSelectors.ts` to match your project structure.

### Issue: "Redux slice not appearing in DevTools"
**Solution:** Verify slice is registered in store.ts and Redux DevTools Extension is installed.

### Issue: "API requests fail with CORS error"
**Solution:** Configure CORS on backend or use proxy in `package.json`.

### Issue: "Layout breaks on mobile"
**Solution:** Test at exact breakpoint widths (820px, 900px, 1040px, etc.) and verify CSS media queries.

---

## Next Steps

1. **Complete test implementations** - Replace TODO comments in test files
2. **Customize styling** - Update colors, fonts, spacing in variables.css
3. **Integrate with existing UI kit** - Match project design system
4. **Deploy to staging** - Test in realistic environment
5. **Conduct user acceptance testing** - Debt officers validate functionality
6. **Move to production** - Deploy to live environment

---

**Integration Time:** ~45 minutes  
**Testing Time:** ~2 hours  
**Total Implementation:** ~5.75 days (one developer)  

For detailed architecture and testing strategy, see the Implementation Plan document.

---

*Last updated: 2026-09-10*  
*Related issues: #10 (KPI block), #12 (Case Management)*
