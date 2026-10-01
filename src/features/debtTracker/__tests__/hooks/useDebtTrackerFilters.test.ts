/**
 * useDebtTrackerFilters Hook Tests
 *
 * Tests for the filters management hook.
 */

import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useDebtTrackerFilters } from '../../hooks/useDebtTrackerFilters';
import debtTrackerReducer from '../../redux/debtTrackerSlice';
import React from 'react';

/**
 * Create mock Redux store for testing
 */
const createMockStore = () => {
  return configureStore({
    reducer: {
      debtTracker: debtTrackerReducer,
    },
  });
};

/**
 * Wrapper component for hook testing
 */
const createWrapper = () => {
  const store = createMockStore();
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(Provider, { store }, children)
  );
};

describe('useDebtTrackerFilters', () => {
  it('should return filter object and setter functions', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDebtTrackerFilters(), { wrapper });

    // TODO: Assert that hook returns filters object
    // TODO: Assert that hook returns all setter functions
    expect(result.current.filters).toBeDefined();
    expect(result.current.setYearFilter).toBeDefined();
    expect(result.current.setFundingFilter).toBeDefined();
    expect(result.current.setSearchQuery).toBeDefined();
    expect(result.current.resetFilters).toBeDefined();
  });

  it('should update year filter', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDebtTrackerFilters(), { wrapper });

    // TODO: Call setYearFilter with new values
    // TODO: Assert that filters are updated
    act(() => {
      result.current.setYearFilter(2023, 2024);
    });

    expect(result.current.filters.yearFrom).toBe(2023);
    expect(result.current.filters.yearTo).toBe(2024);
  });

  it('should update funding filter', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDebtTrackerFilters(), { wrapper });

    // TODO: Call setFundingFilter
    // TODO: Assert that filter is updated
    act(() => {
      result.current.setFundingFilter('NSFAS');
    });

    expect(result.current.filters.fundingSource).toBe('NSFAS');
  });

  it('should update search query', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDebtTrackerFilters(), { wrapper });

    // TODO: Call setSearchQuery
    // TODO: Assert that search query is updated
    act(() => {
      result.current.setSearchQuery('John Doe');
    });

    expect(result.current.filters.searchQuery).toBe('John Doe');
  });

  it('should reset all filters', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDebtTrackerFilters(), { wrapper });

    // TODO: Set some filters
    act(() => {
      result.current.setYearFilter(2023, 2024);
      result.current.setFundingFilter('NSFAS');
      result.current.setSearchQuery('test');
    });

    // TODO: Reset filters
    // TODO: Assert all filters are reset to initial state
    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.filters.yearFrom).toBeUndefined();
    expect(result.current.filters.yearTo).toBeUndefined();
    expect(result.current.filters.fundingSource).toBe('ALL');
  });

  // TODO: Test memoization of callback functions
  // TODO: Test multiple filter updates in sequence
  // TODO: Test state persistence across re-renders
});
