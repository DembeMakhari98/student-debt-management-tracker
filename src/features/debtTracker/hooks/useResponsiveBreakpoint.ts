/**
 * useResponsiveBreakpoint Hook
 *
 * Custom hook for tracking viewport width and determining current responsive breakpoint.
 * Automatically updates on window resize events.
 */

import { useState, useEffect } from 'react';
import { BREAKPOINTS, Breakpoint, UseResponsiveBreakpointReturn } from '../types/debtTrackerTypes';

/**
 * Determine current breakpoint based on window width
 *
 * @internal
 */
function getCurrentBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINTS.sm) return 'xs';
  if (width < BREAKPOINTS.md) return 'sm';
  if (width < BREAKPOINTS.lg) return 'md';
  if (width < BREAKPOINTS.xl) return 'lg';
  if (width < BREAKPOINTS.xxl) return 'xl';
  return 'xxl';
}

/**
 * Hook for responsive breakpoint detection
 *
 * Tracks viewport width and provides current breakpoint.
 * Useful for conditional rendering or responsive behavior.
 * Automatically updates on window resize with debouncing.
 *
 * @returns Object with current breakpoint and convenience flags
 *
 * @example
 * const { breakpoint, isXl, width } = useResponsiveBreakpoint();
 *
 * if (isXl) {
 *   return <DesktopLayout />;
 * }
 *
 * return <MobileLayout />;
 */
export function useResponsiveBreakpoint(): UseResponsiveBreakpointReturn {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('lg');
  const [width, setWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1240,
  );

  useEffect(() => {
    // Get initial width
    if (typeof window !== 'undefined') {
      setWidth(window.innerWidth);
      setBreakpoint(getCurrentBreakpoint(window.innerWidth));
    }

    // Debounce timer for resize events
    let resizeTimer: NodeJS.Timeout;

    /**
     * Handle window resize
     */
    const handleResize = () => {
      clearTimeout(resizeTimer);

      resizeTimer = setTimeout(() => {
        const newWidth = window.innerWidth;
        setWidth(newWidth);
        setBreakpoint(getCurrentBreakpoint(newWidth));
      }, 150); // 150ms debounce
    };

    // Add resize listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  // Create convenience boolean flags for each breakpoint
  const isXs = breakpoint === 'xs';
  const isSm = breakpoint === 'sm';
  const isMd = breakpoint === 'md';
  const isLg = breakpoint === 'lg';
  const isXl = breakpoint === 'xl';
  const isXxl = breakpoint === 'xxl';

  return {
    breakpoint,
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    isXxl,
    width,
  };
}

/**
 * Hook for checking if viewport width exceeds a minimum
 *
 * Convenience hook for common min-width checks.
 *
 * @example
 * const isDesktop = useMinWidth(1240);
 *
 * @internal
 */
export function useMinWidth(minWidth: number): boolean {
  const { width } = useResponsiveBreakpoint();
  return width >= minWidth;
}

/**
 * Hook for checking if viewport width is below a maximum
 *
 * Convenience hook for common max-width checks.
 *
 * @example
 * const isMobile = useMaxWidth(820);
 *
 * @internal
 */
export function useMaxWidth(maxWidth: number): boolean {
  const { width } = useResponsiveBreakpoint();
  return width < maxWidth;
}
