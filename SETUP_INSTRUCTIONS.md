# Debt Tracker Integration Setup Instructions

This document guides you through integrating the Debt Tracker template into the ITS Integrator project.

## Overview

The Debt Tracker is a complete React/Redux/TypeScript feature for managing student debt cases. This template includes:
- 40+ production-ready files
- Full Redux state management with TypeScript types
- Responsive CSS modules with 6 breakpoints
- Comprehensive test stubs
- API integration layer
- Custom React hooks

## Prerequisites

- Node.js 14+ and npm/yarn
- React 18+
- Redux Toolkit installed
- React Router v6+
- TypeScript 4.5+

## Installation Steps

### 1. Copy Files to Project

```bash
# From the project root:
cp -r src/features/debtTracker/ /path/to/ITS/src/features/
cp src/routes/debtTrackerRoute.tsx /path/to/ITS/src/routes/
```

### 2. Update package.json Dependencies

Ensure these are installed:

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-redux": "^8.0.0",
    "redux": "^4.2.0",
    "@reduxjs/toolkit": "^1.9.0",
    "react-router-dom": "^6.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^13.0.0",
    "@testing-library/jest-dom": "^5.16.0",
    "@types/jest": "^28.0.0",
    "jest": "^28.0.0",
    "typescript": "^4.5.0"
  }
}
```

Install missing dependencies:
```bash
npm install
```

### 3. Configure Redux Store

Update your Redux store configuration to include the debt tracker reducer:

**File: `src/store/configureStore.ts`** (or similar)

```typescript
import { configureStore } from '@reduxjs/toolkit';
import debtTrackerReducer from '../features/debtTracker/redux/debtTrackerSlice';

export const store = configureStore({
  reducer: {
    // ... other reducers
    debtTracker: debtTrackerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 4. Register Route

Update your main routes file to include the debt tracker route:

**File: `src/routes/index.tsx`** (or similar)

```typescript
import { debtTrackerRoute } from './debtTrackerRoute';

export const routes = [
  // ... existing routes
  debtTrackerRoute,
  // ... other routes
];
```

Or if using array-based routing:

```typescript
import { debtTrackerRoute } from './debtTrackerRoute';

const routes = [
  // ... existing routes
  debtTrackerRoute,
];

// Use in RouterProvider or BrowserRouter
```

### 5. Wrap App with Redux Provider

Ensure your app is wrapped with the Redux Provider:

**File: `src/main.tsx`** or **`src/App.tsx`**

```typescript
import { Provider } from 'react-redux';
import { store } from './store/configureStore';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { routes } from './routes';

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}

export default App;
```

### 6. Update API Base URL

Configure the API endpoint for your environment:

**File: `src/features/debtTracker/services/debtTrackerApi.ts`**

Update the `API_BASE_URL`:

```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-api.com/api';
```

Or use environment variables:

**.env**
```
REACT_APP_API_URL=https://your-api.com/api
REACT_APP_NSFAS_ENDPOINT=/debt-tracker
```

### 7. Implement API Response Transformation

The `fetchCases` function includes a placeholder transformation. Update it to match your actual API response format:

**File: `src/features/debtTracker/services/debtTrackerApi.ts`**

In the `fetchCases` function, update the response mapping:

```typescript
// TODO: Update this transformation based on actual API response format
const cases: Case[] = data.data.map((apiCase: any) => ({
  id: apiCase.id || apiCase.caseId,
  studentName: apiCase.studentName,
  // ... map other fields
}));
```

### 8. Import CSS Variables (Optional)

If you have global CSS, import the variables file:

**File: `src/styles/global.css`** (or similar)

```css
@import '../features/debtTracker/styles/variables.css';
```

### 9. Run Tests

First, replace test stubs with actual test implementations:

```bash
npm test -- debtTracker
```

All test files are located in `src/features/debtTracker/__tests__/`

## Integration Checklist

- [ ] Files copied to project
- [ ] Dependencies installed
- [ ] Redux store configured
- [ ] Route registered
- [ ] App wrapped with Redux Provider
- [ ] API base URL configured
- [ ] API response transformation implemented
- [ ] CSS variables imported (if using global styles)
- [ ] Tests updated with implementation details
- [ ] Environment variables set
- [ ] Application starts without errors
- [ ] Debt Tracker route accessible at `/debt-tracker`
- [ ] Data loads from API
- [ ] Filters work correctly
- [ ] Lists display correctly at all breakpoints

## Development Workflow

### Adding Features

1. **Add types** in `src/features/debtTracker/types/debtTrackerTypes.ts`
2. **Create Redux actions** in `src/features/debtTracker/redux/debtTrackerSlice.ts`
3. **Add selectors** in `src/features/debtTracker/redux/debtTrackerSelectors.ts`
4. **Create components** in `src/features/debtTracker/components/`
5. **Write tests** in `src/features/debtTracker/__tests__/`
6. **Update styles** in `src/features/debtTracker/styles/`

### Modifying Components

Each component has a prop interface and JSDoc example. Update these when changing:

```typescript
export interface MyComponentProps {
  // Add/update props here
}

/**
 * Component description
 *
 * @example
 * <MyComponent prop1="value" prop2={123} />
 */
```

### Adding API Endpoints

Add new functions to `src/features/debtTracker/services/debtTrackerApi.ts`:

```typescript
export async function myNewFunction(param: string): Promise<ResponseType> {
  const response = await fetch(`${DEBT_TRACKER_ENDPOINT}/endpoint`, {
    // ... fetch config
  });
  // ... error handling and transformation
}
```

## Troubleshooting

### Issue: Module not found errors

**Solution:** Ensure file paths are relative to the project structure:
```typescript
// Correct
import { fetchCases } from '../services/debtTrackerApi';

// Incorrect
import { fetchCases } from './debtTrackerApi';
```

### Issue: Redux store errors

**Solution:** Verify the Redux store is configured correctly:
```typescript
// Check that debtTracker reducer is in configureStore
console.log(store.getState()); // Should have debtTracker property
```

### Issue: CSS not loading

**Solution:** Ensure CSS modules are enabled in your webpack/vite config:
```javascript
// webpack.config.js
modules: {
  localIdentName: '[path][name]__[local]--[hash:base64:5]',
}
```

### Issue: API calls failing

**Solution:** Check CORS and API configuration:
```typescript
// src/features/debtTracker/services/debtTrackerApi.ts
// Verify API_BASE_URL matches your backend
// Check browser console for network errors
// Verify authentication headers if needed
```

### Issue: Tests failing

**Solution:** Most tests include TODO comments. Complete test implementations:
```typescript
// Before
// TODO: Assert that result is correct
expect(result).toBeDefined();

// After
expect(result).toEqual(expectedValue);
```

## Performance Optimization

### 1. Code Splitting

The route is already lazy-loaded:
```typescript
const DebtTrackerWorkspace = React.lazy(() =>
  import('../features/debtTracker/components/DebtTrackerWorkspace')
);
```

### 2. Memoization

Use Redux selectors (they use `createSelector` for memoization):
```typescript
// Good - memoized
const stats = useSelector(selectWorkspaceStats);

// Avoid - creates new object every render
const stats = useSelector(state => ({
  total: state.debtTracker.cases.length
}));
```

### 3. CSS Optimization

CSS modules are scoped automatically. For production:
```bash
npm run build  # Minifies CSS modules
```

## Responsive Design

The template includes 6 responsive breakpoints:
- **xxl**: 1500px+ (Wide desktop)
- **xl**: 1240-1499px (Desktop)
- **lg**: 1040-1239px (Large tablet)
- **md**: 900-1039px (Tablet)
- **sm**: 820-899px (Small tablet)
- **xs**: <820px (Mobile)

Test at each breakpoint:
```bash
# Chrome DevTools
F12 → Toggle device toolbar (Ctrl+Shift+M)
```

## Next Steps

1. **Implement API endpoints** if not already available
2. **Update test cases** with your business logic
3. **Customize styling** to match your brand
4. **Add additional filters** as needed
5. **Implement batch operations** (currently stubbed)
6. **Add case detail modal** (reference in ActionInfo component)
7. **Add case edit form** (reference in PickedUpListRow component)

## Support & Questions

Refer to these files for implementation details:
- **Types**: `src/features/debtTracker/types/debtTrackerTypes.ts`
- **Redux**: `src/features/debtTracker/redux/`
- **Components**: `src/features/debtTracker/components/`
- **Tests**: `src/features/debtTracker/__tests__/`
- **Styles**: `src/features/debtTracker/styles/`

See `TROUBLESHOOTING.md` for common issues and solutions.
