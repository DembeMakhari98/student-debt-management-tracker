# Debt Tracker Troubleshooting Guide

This guide covers common issues when integrating and using the Debt Tracker template.

## Table of Contents

1. [Build & Setup Issues](#build--setup-issues)
2. [Redux State Issues](#redux-state-issues)
3. [API & Data Loading Issues](#api--data-loading-issues)
4. [Component & UI Issues](#component--ui-issues)
5. [Style & Responsive Design Issues](#style--responsive-design-issues)
6. [Performance Issues](#performance-issues)
7. [Testing Issues](#testing-issues)

---

## Build & Setup Issues

### Issue: "Module not found" errors

**Symptoms:**
```
Cannot find module '../features/debtTracker/...'
Module resolution failed
```

**Cause:** Incorrect file paths or missing files

**Solutions:**

1. **Verify file paths are relative to current file:**
   ```typescript
   // In: src/features/debtTracker/components/DebtTrackerWorkspace.tsx
   // ✓ Correct
   import { useCases } from '../hooks/useCases';
   
   // ✗ Wrong (missing ../)
   import { useCases } from 'hooks/useCases';
   ```

2. **Check that all files are copied:**
   ```bash
   # List all Debt Tracker files
   find src/features/debtTracker -type f | sort
   
   # Should include:
   # - types/debtTrackerTypes.ts
   # - redux/debtTrackerSlice.ts
   # - services/debtTrackerApi.ts
   # - components/**/*.tsx
   # - styles/**/*.css
   # - etc.
   ```

3. **Check tsconfig.json paths (if using path aliases):**
   ```json
   {
     "compilerOptions": {
       "baseUrl": "src",
       "paths": {
         "@features/*": ["features/*"],
         "@hooks/*": ["features/*/hooks/*"]
       }
     }
   }
   ```

### Issue: CSS Modules not working

**Symptoms:**
```
CSS class names show as undefined
Styles not applied to elements
```

**Cause:** CSS Modules not configured in bundler

**Solutions:**

1. **Webpack configuration:**
   ```javascript
   // webpack.config.js
   {
     test: /\.module\.css$/,
     use: [
       'style-loader',
       {
         loader: 'css-loader',
         options: {
           modules: {
             localIdentName: '[path][name]__[local]--[hash:base64:5]',
           },
         },
       },
     ],
   }
   ```

2. **Vite configuration:**
   ```javascript
   // vite.config.js
   export default {
     css: {
       modules: {
         localsConvention: 'camelCase',
       },
     },
   }
   ```

3. **Import verification:**
   ```typescript
   // ✓ Correct
   import styles from './myComponent.module.css';
   <div className={styles.container} />
   
   // ✗ Wrong
   import './myComponent.module.css';
   <div className="container" />
   ```

### Issue: TypeScript compilation errors

**Symptoms:**
```
Type '...' is not assignable to type '...'
Cannot find type definition for module
```

**Solutions:**

1. **Ensure strict mode is consistent:**
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true
     }
   }
   ```

2. **Rebuild type definitions:**
   ```bash
   npm run build
   # or
   tsc --noEmit
   ```

3. **Check type imports in test files:**
   ```typescript
   // ✓ Correct for type-only imports
   import type { Case, DebtTrackerState } from '../types';
   
   // Can also use
   import { type Case } from '../types';
   ```

---

## Redux State Issues

### Issue: Redux DevTools not showing state

**Symptoms:**
```
Redux DevTools extension shows "no store"
Cannot debug Redux state
```

**Solutions:**

1. **Install and enable Redux DevTools extension:**
   ```typescript
   // src/store/configureStore.ts
   import { composeWithDevTools } from 'redux-devtools-extension';
   
   export const store = configureStore({
     reducer: { /* ... */ },
     // This works with Redux DevTools automatically
   });
   ```

2. **Check store is properly provided:**
   ```typescript
   // src/main.tsx or src/App.tsx
   import { Provider } from 'react-redux';
   import { store } from './store/configureStore';
   
   <Provider store={store}>
     <App />
   </Provider>
   ```

### Issue: Selectors returning undefined

**Symptoms:**
```
useSelector returns undefined
Cases array is empty
Stats show 0 for all values
```

**Causes:**

1. **Selector can't find state path:**
   ```typescript
   // ✗ Wrong - path is debtTracker, not debtTrackerSlice
   const selectDebtTrackerState = (state) => state.debtTrackerSlice;
   
   // ✓ Correct
   const selectDebtTrackerState = (state) => state.debtTracker;
   ```

2. **State not initialized:**
   ```typescript
   // Check in Redux DevTools or:
   console.log(store.getState());
   // Should show: { debtTracker: { cases: [], ...} }
   ```

**Solutions:**

1. **Debug selector:**
   ```typescript
   // Add logging
   export const selectCases = createSelector(
     [selectDebtTrackerState],
     (state) => {
       console.log('selectDebtTrackerState:', state);
       console.log('cases:', state?.cases);
       return state?.cases || [];
     },
   );
   ```

2. **Verify Redux DevTools state:**
   - Open browser DevTools (F12)
   - Go to Redux tab
   - Click "State" to see full state tree
   - Verify `debtTracker` object exists

### Issue: Actions not dispatching

**Symptoms:**
```
Redux state doesn't change after dispatch
useSelector always returns same value
```

**Solutions:**

1. **Verify action is being dispatched:**
   ```typescript
   const dispatch = useDispatch();
   
   // Add logging
   const handleFilter = (filter) => {
     console.log('Dispatching filter:', filter);
     dispatch(setYearFilter(filter));
   };
   ```

2. **Check in Redux DevTools:**
   - Open Redux DevTools
   - Click "Action" tab
   - Should see action when dispatched
   - Check action payload is correct

3. **Verify reducer is handling action:**
   ```typescript
   // In debtTrackerSlice.ts
   reducers: {
     setYearFilter: (state, action) => {
       console.log('setYearFilter reducer called with:', action.payload);
       state.filters.yearFrom = action.payload.yearFrom;
       state.filters.yearTo = action.payload.yearTo;
     },
   }
   ```

---

## API & Data Loading Issues

### Issue: API calls failing with 404 or 500

**Symptoms:**
```
Error: Failed to fetch cases
API Error: 404 Not Found
API Error: 500 Internal Server Error
```

**Solutions:**

1. **Check API base URL:**
   ```typescript
   // src/features/debtTracker/services/debtTrackerApi.ts
   console.log('API_BASE_URL:', API_BASE_URL);
   console.log('Full URL:', `${DEBT_TRACKER_ENDPOINT}/cases`);
   
   // Should output:
   // API_BASE_URL: https://your-api.com/api
   // Full URL: https://your-api.com/api/debt-tracker/cases
   ```

2. **Verify endpoint exists:**
   ```bash
   # Test API endpoint
   curl -X GET "https://your-api.com/api/debt-tracker/cases" \
     -H "Content-Type: application/json"
   ```

3. **Check CORS configuration:**
   ```typescript
   // If using localhost development:
   // Backend should allow CORS from localhost:3000
   // In response headers, check:
   // Access-Control-Allow-Origin: http://localhost:3000
   ```

4. **Verify request format:**
   ```typescript
   // Check browser DevTools Network tab
   // Click on request to see:
   // - URL (check query params)
   // - Headers (check Content-Type)
   // - Response (check for error message)
   ```

### Issue: Cases not displaying after API call

**Symptoms:**
```
API returns 200 OK but no cases shown
Empty list even with data
Loading indicator stays on
```

**Solutions:**

1. **Check API response format:**
   ```typescript
   // src/features/debtTracker/services/debtTrackerApi.ts
   // Verify transformation matches actual response:
   const cases: Case[] = data.data.map((apiCase: any) => ({
     // Each field must match API response
     id: apiCase.id, // Not apiCase.caseId!
     studentName: apiCase.studentName,
     // etc.
   }));
   
   // Add logging to debug:
   console.log('Raw API response:', data);
   console.log('Transformed cases:', cases);
   ```

2. **Check case status values:**
   ```typescript
   // Status must be exactly: 'PICKED_UP', 'REFUND_QUEUE', or 'NOT_PICKED_UP'
   // If API returns different values, transform them:
   status: apiCase.caseStatus?.toUpperCase() || 'NOT_PICKED_UP',
   ```

3. **Verify partitioning:**
   ```typescript
   // Cases won't display if they don't partition correctly
   // Check partitionCases function:
   const partitioned = partitionCases(cases);
   console.log('Partitioned:', partitioned);
   // Should show cases in one of three groups
   ```

### Issue: CORS errors

**Symptoms:**
```
Access to XMLHttpRequest has been blocked by CORS policy
No 'Access-Control-Allow-Origin' header
```

**Solutions:**

1. **Backend CORS configuration needed:**
   ```javascript
   // Express backend example
   const cors = require('cors');
   app.use(cors({
     origin: ['http://localhost:3000', 'https://yourdomain.com'],
     credentials: true,
   }));
   ```

2. **Add credentials to fetch:**
   ```typescript
   // src/features/debtTracker/services/debtTrackerApi.ts
   const response = await fetch(url, {
     method: 'GET',
     headers: { 'Content-Type': 'application/json' },
     credentials: 'include', // Send cookies if needed
   });
   ```

3. **Check console for exact error:**
   - Open DevTools (F12)
   - Check Console tab for full error message
   - Note which origin is being blocked

---

## Component & UI Issues

### Issue: Components not rendering

**Symptoms:**
```
White/blank screen
No error in console
Components don't appear
```

**Solutions:**

1. **Check component imports:**
   ```typescript
   // ✓ Correct
   import { DebtTrackerWorkspace } from '../components';
   
   // ✗ Check if default export
   import DebtTrackerWorkspace from '../components/DebtTrackerWorkspace';
   ```

2. **Verify Redux provider wraps app:**
   ```typescript
   // In root component (App.tsx or main.tsx)
   <Provider store={store}>
     {/* All child components here */}
     <BrowserRouter>
       <Routes>
         <Route path="/debt-tracker" element={<DebtTrackerWorkspace />} />
       </Routes>
     </BrowserRouter>
   </Provider>
   ```

3. **Check error boundary:**
   - Open DevTools console
   - Look for React errors
   - Error boundary will show error message if component crashes

### Issue: Buttons/interactivity not working

**Symptoms:**
```
Click events don't trigger
Filters don't update when clicked
Buttons appear disabled
```

**Solutions:**

1. **Check onClick handlers:**
   ```typescript
   // ✓ Correct - function reference
   <button onClick={handleClick}>Click</button>
   
   // ✗ Wrong - function called immediately
   <button onClick={handleClick()}>Click</button>
   
   // ✓ Arrow function if need params
   <button onClick={() => handleClick(param)}>Click</button>
   ```

2. **Check event delegation:**
   ```typescript
   // If using event.target, verify:
   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     console.log('Event:', e);
     console.log('Value:', e.target.value);
     if (e.target.value) {
       // Handle change
     }
   };
   ```

3. **Check disabled state:**
   ```typescript
   // Verify buttons aren't accidentally disabled
   <button disabled={isLoading}>
     {isLoading ? 'Loading...' : 'Click me'}
   </button>
   ```

### Issue: Form inputs not updating

**Symptoms:**
```
Text input doesn't show typed text
Search filter doesn't work
Input values don't change
```

**Solutions:**

1. **Check controlled component setup:**
   ```typescript
   // ✓ Correct - controlled input
   const [value, setValue] = useState('');
   <input
     value={value}
     onChange={(e) => setValue(e.target.value)}
   />
   
   // ✗ Wrong - uncontrolled without onChange
   <input value={value} />
   ```

2. **Check event handler:**
   ```typescript
   const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     console.log('New value:', e.target.value);
     dispatch(setSearchQuery(e.target.value));
   };
   ```

3. **Verify state updates:**
   - Add console.log in handler
   - Check Redux DevTools for action dispatch
   - Verify selector returns updated value

---

## Style & Responsive Design Issues

### Issue: Styles not applying

**Symptoms:**
```
Elements have no styling
CSS module classes undefined
Colors/fonts not showing
```

**Solutions:**

1. **Verify CSS module import:**
   ```typescript
   // ✓ Correct
   import styles from '../styles/component.module.css';
   <div className={styles.container} />
   
   // Check in console:
   console.log('Styles object:', styles);
   // Should print: { container: "component__container--a1b2c" }
   ```

2. **Check class name exists in CSS:**
   ```css
   /* component.module.css */
   .container {
     display: flex;
     padding: 10px;
   }
   ```

3. **Verify CSS is imported/bundled:**
   ```bash
   # In DevTools, check Applied Styles
   # Right-click element > Inspect
   # Look for CSS rule source (should show .module.css file)
   ```

### Issue: Layout not responsive

**Symptoms:**
```
Layout breaks at certain screen sizes
Elements don't resize correctly
Mobile layout looks bad
```

**Solutions:**

1. **Test at breakpoints:**
   ```
   Open DevTools (F12)
   Toggle device toolbar (Ctrl+Shift+M)
   Test at: 820px, 900px, 1040px, 1240px, 1500px
   ```

2. **Check media queries:**
   ```css
   /* Verify media query is correct */
   @media (max-width: 1239px) {
     /* Tablet styles */
   }
   ```

3. **Check CSS variable fallbacks:**
   ```css
   /* If variable not defined, use fallback */
   .container {
     padding: var(--spacing-lg, 16px);
   }
   ```

4. **Debug with browser:**
   ```javascript
   // In console
   window.innerWidth  // Current viewport width
   getComputedStyle(element).padding  // Applied styles
   ```

### Issue: Mobile view too cramped

**Symptoms:**
```
Mobile layout squished
Text too small
Buttons hard to click
```

**Solutions:**

1. **Check viewport meta tag:**
   ```html
   <!-- In public/index.html -->
   <meta name="viewport" content="width=device-width, initial-scale=1" />
   ```

2. **Adjust mobile breakpoint styles:**
   ```css
   @media (max-width: 819px) {
     .listRow {
       padding: var(--spacing-lg);  /* Increase padding */
     }
     
     .actionButton {
       width: 40px;  /* Increase from 32px */
       height: 40px;
     }
   }
   ```

3. **Test touch interactions:**
   - Use DevTools mobile emulation
   - Touch target should be at least 44x44px (accessibility standard)

---

## Performance Issues

### Issue: Slow data loading

**Symptoms:**
```
Cases take long time to load
UI feels sluggish
Large lists cause lag
```

**Solutions:**

1. **Check API response size:**
   ```bash
   # Open DevTools Network tab
   # Check response size (should ideally be <1MB)
   # If large, ask backend to add pagination
   ```

2. **Implement pagination:**
   ```typescript
   // fetchCases already supports pagination
   const pageSize = 20;
   await fetchCases({
     ...filters,
     page: 1,
     pageSize,
   });
   ```

3. **Use React.memo for lists:**
   ```typescript
   // Prevent unnecessary re-renders of list items
   const PickedUpListRow = React.memo(({ case: caseItem }) => {
     return /* JSX */;
   });
   ```

### Issue: Excessive re-renders

**Symptoms:**
```
Components re-render too often
Console shows many render logs
Performance degrades with more data
```

**Solutions:**

1. **Use Redux selectors (they memoize):**
   ```typescript
   // ✓ Good - uses createSelector
   const cases = useSelector(selectPickedUpCasesByPage);
   
   // ✗ Bad - new array every render
   const cases = useSelector(state => state.debtTracker.cases);
   ```

2. **Check component dependencies:**
   ```typescript
   // ✓ Memoize callbacks
   const handleClick = useCallback(() => {
     // handler
   }, [/* dependencies */]);
   
   // ✗ New function every render
   const handleClick = () => {
     // handler
   };
   ```

3. **Use React DevTools Profiler:**
   - Open DevTools > Profiler tab
   - Record interactions
   - Identify components with excessive renders

### Issue: Bundle size too large

**Symptoms:**
```
Application loads slowly
Webpack warning about large bundle
Slow initial page load
```

**Solutions:**

1. **Verify lazy loading:**
   ```typescript
   // DebtTrackerWorkspace should be lazy-loaded
   const DebtTrackerWorkspace = React.lazy(() =>
     import('../features/debtTracker/components/DebtTrackerWorkspace')
   );
   ```

2. **Check for unused imports:**
   ```bash
   npm install -g webpack-bundle-analyzer
   webpack-bundle-analyzer dist/main.js
   ```

---

## Testing Issues

### Issue: Tests failing with Redux errors

**Symptoms:**
```
Error: could not find react-redux context
Redux store not available in tests
useSelector fails in test
```

**Solutions:**

1. **Wrap component with Provider in tests:**
   ```typescript
   import { Provider } from 'react-redux';
   import { configureStore } from '@reduxjs/toolkit';
   import debtTrackerReducer from '../redux/debtTrackerSlice';
   
   const mockStore = configureStore({
     reducer: { debtTracker: debtTrackerReducer },
   });
   
   render(
     <Provider store={mockStore}>
       <DebtTrackerWorkspace />
     </Provider>
   );
   ```

2. **Use test helper:**
   ```typescript
   // Create reusable test wrapper
   const renderWithRedux = (component) => {
     const store = configureStore({
       reducer: { debtTracker: debtTrackerReducer },
     });
     return render(<Provider store={store}>{component}</Provider>);
   };
   
   // Use in tests
   renderWithRedux(<DebtTrackerWorkspace />);
   ```

### Issue: Async tests timing out

**Symptoms:**
```
Test timeout after 5000ms
waitFor never resolves
Promises not resolving
```

**Solutions:**

1. **Mock fetch properly:**
   ```typescript
   global.fetch = jest.fn(() =>
     Promise.resolve({
       ok: true,
       json: () => Promise.resolve({ data: [] }),
     })
   );
   ```

2. **Use proper async/await:**
   ```typescript
   it('should load data', async () => {
     renderWithRedux(<DebtTrackerWorkspace />);
     
     await waitFor(() => {
       expect(screen.getByText(/Cases/i)).toBeInTheDocument();
     }, { timeout: 3000 });
   });
   ```

3. **Clear mocks between tests:**
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks();
   });
   ```

---

## Quick Debugging Checklist

Before reporting issues, check:

- [ ] All files copied correctly
- [ ] npm install completed
- [ ] Redux store includes debtTracker reducer
- [ ] App wrapped with Redux Provider
- [ ] Route registered in router
- [ ] API base URL configured
- [ ] Environment variables set (.env file)
- [ ] Browser console has no errors
- [ ] Redux DevTools shows debtTracker state
- [ ] CSS modules bundler configured

---

## Getting More Help

If issues persist:

1. **Check Redux DevTools** - verify state shape
2. **Check Network tab** - verify API calls
3. **Check Console** - look for error messages
4. **Check Browser DevTools** - inspect element styles
5. **Add logging** - console.log at key points
6. **Review SETUP_INSTRUCTIONS.md** - verify all steps completed

See related files:
- `SETUP_INSTRUCTIONS.md` - Setup & integration
- Type definitions: `src/features/debtTracker/types/debtTrackerTypes.ts`
- Redux: `src/features/debtTracker/redux/`
- Components: `src/features/debtTracker/components/`
