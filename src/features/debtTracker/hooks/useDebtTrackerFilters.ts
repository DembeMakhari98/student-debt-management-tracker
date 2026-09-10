/**
 * useDebtTrackerFilters Hook
 *
 * Custom hook for managing debt tracker filters and dispatching filter-related actions.
 * Provides convenience methods for updating individual filter fields.
 */

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setYearFilter,
  setFundingFilter,
  setRiskBandFilter,
  setStatusFilter,
  setSearchQuery,
  resetFilters,
  selectFilters,
} from '../redux';
import { DebtTrackerFilter, UseDebtTrackerFiltersReturn } from '../types/debtTrackerTypes';

/**
 * Hook for managing debt tracker filters
 *
 * Provides convenient methods to update filter state and dispatch Redux actions.
 * Automatically memoizes callback functions for performance.
 *
 * @returns Object with current filters and methods to update them
 *
 * @example
 * const { filters, setYearFilter, setFundingFilter, resetFilters } = useDebtTrackerFilters();
 *
 * // Update year filter
 * setYearFilter(2023, 2024);
 *
 * // Update funding source filter
 * setFundingFilter('NSFAS');
 *
 * // Reset all filters
 * resetFilters();
 */
export function useDebtTrackerFilters(): UseDebtTrackerFiltersReturn {
  const dispatch = useDispatch();
  const filters = useSelector(selectFilters);

  /**
   * Update year filter range
   */
  const handleSetYearFilter = useCallback(
    (yearFrom?: number, yearTo?: number) => {
      dispatch(setYearFilter({ yearFrom, yearTo }));
    },
    [dispatch],
  );

  /**
   * Update funding source filter
   */
  const handleSetFundingFilter = useCallback(
    (fundingSource?: string) => {
      dispatch(setFundingFilter(fundingSource));
    },
    [dispatch],
  );

  /**
   * Update risk band filter
   */
  const handleSetRiskBandFilter = useCallback(
    (riskBand?: string) => {
      dispatch(setRiskBandFilter(riskBand));
    },
    [dispatch],
  );

  /**
   * Update search query filter
   */
  const handleSetSearchQuery = useCallback(
    (query: string) => {
      dispatch(setSearchQuery(query));
    },
    [dispatch],
  );

  /**
   * Reset all filters to initial state
   */
  const handleResetFilters = useCallback(() => {
    dispatch(resetFilters());
  }, [dispatch]);

  return {
    filters,
    setYearFilter: handleSetYearFilter,
    setFundingFilter: handleSetFundingFilter,
    setRiskBandFilter: handleSetRiskBandFilter,
    setSearchQuery: handleSetSearchQuery,
    resetFilters: handleResetFilters,
  };
}
