/**
 * useCases Hook
 *
 * Custom hook for fetching and managing debt cases.
 * Handles loading, error states, and provides refetch capability.
 */

import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchCasesThunk,
  selectCases,
  selectPartitionedCases,
  selectLoading,
  selectError,
  selectFilters,
} from '../redux';
import { Case, PartitionedCases, UseCasesReturn } from '../types/debtTrackerTypes';

/**
 * Hook for fetching and managing debt cases
 *
 * Automatically fetches cases when filters change.
 * Manages loading and error states.
 * Provides a refetch function for manual data refresh.
 *
 * @returns Object with cases, loading state, error, and refetch function
 *
 * @example
 * const { cases, partitionedCases, loading, error, refetch } = useCases();
 *
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error}</div>;
 *
 * return (
 *   <div>
 *     <button onClick={refetch}>Refresh</button>
 *     <PickedUpList cases={partitionedCases?.pickedUp} />
 *   </div>
 * );
 */
export function useCases(): UseCasesReturn {
  const dispatch = useDispatch();
  const cases = useSelector(selectCases);
  const partitionedCases = useSelector(selectPartitionedCases);
  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);
  const filters = useSelector(selectFilters);

  /**
   * Fetch cases with current filters
   */
  const fetchData = useCallback(async () => {
    try {
      // Dispatch the async thunk with current filters
      await dispatch(
        fetchCasesThunk({
          filters,
          pageSize: 20, // TODO: Make this configurable
        }) as any,
      ).unwrap();
    } catch (err) {
      // Error is handled by Redux thunk
      console.error('Failed to fetch cases:', err);
    }
  }, [dispatch, filters]);

  /**
   * Fetch data on mount and when filters change
   */
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Manual refetch function
   */
  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    cases,
    partitionedCases,
    loading,
    error,
    refetch,
  };
}
