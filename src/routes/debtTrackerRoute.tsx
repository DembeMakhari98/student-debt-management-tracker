/**
 * Debt Tracker Route Configuration
 *
 * Lazy-loaded route definition for the Debt Management Tracker workspace.
 * Includes error boundary and suspense fallback.
 */

import React, { Suspense } from 'react';
import { RouteObject } from 'react-router-dom';

/**
 * Lazy load the workspace component
 * This ensures the component bundle is only loaded when the route is accessed
 */
const DebtTrackerWorkspace = React.lazy(() =>
  import('../features/debtTracker/components/DebtTrackerWorkspace').then((module) => ({
    default: module.default,
  })),
);

/**
 * Loading fallback component
 */
const LoadingFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontSize: '18px',
      color: '#666',
    }}
  >
    <div>Loading Debt Tracker...</div>
  </div>
);

/**
 * Error boundary component
 * TODO: Replace with actual ErrorBoundary component from project
 */
class DebtTrackerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Debt Tracker Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '20px',
          }}
        >
          <h1>Oops! Something went wrong</h1>
          <p>Failed to load the Debt Tracker workspace.</p>
          <p style={{ color: '#999', fontSize: '14px' }}>
            {this.state.error?.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Debt Tracker Route Definition
 *
 * Route path: /debt-tracker
 * Component: DebtTrackerWorkspace (lazy-loaded)
 * Error boundary: Enabled
 * Suspense: Enabled with loading fallback
 *
 * Usage in router:
 * ```
 * import { debtTrackerRoute } from './routes/debtTrackerRoute';
 *
 * const routes = [
 *   ...otherRoutes,
 *   debtTrackerRoute,
 * ];
 * ```
 */
export const debtTrackerRoute: RouteObject = {
  path: '/debt-tracker',
  element: (
    <DebtTrackerErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <DebtTrackerWorkspace />
      </Suspense>
    </DebtTrackerErrorBoundary>
  ),
};

/**
 * Alternative export for direct component usage
 * Use when already inside error boundary and suspense boundary
 */
export const DebtTrackerWorkspaceRoute: React.FC = () => (
  <DebtTrackerWorkspace />
);

export default debtTrackerRoute;
