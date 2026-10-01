/**
 * Debt Tracker Redux Selectors
 *
 * Memoized selectors for accessing debt tracker state.
 * Using createSelector for performance optimization.
 */

import { createSelector } from '@reduxjs/toolkit';
import { DebtTrackerState } from '../types/debtTrackerTypes';

/**
 * Root selector for debt tracker state
 */
const selectDebtTrackerState = (state: { debtTracker: DebtTrackerState }): DebtTrackerState =>
  state.debtTracker;

/**
 * Select all raw cases from the API
 */
export const selectCases = createSelector(
  [selectDebtTrackerState],
  (state) => state.cases,
);

/**
 * Select partitioned cases (organized by status)
 */
export const selectPartitionedCases = createSelector(
  [selectDebtTrackerState],
  (state) => state.partitionedCases,
);

/**
 * Select paginated partitioned cases
 */
export const selectPaginatedCases = createSelector(
  [selectDebtTrackerState],
  (state) => state.paginatedCases,
);

/**
 * Select current filters
 */
export const selectFilters = createSelector(
  [selectDebtTrackerState],
  (state) => state.filters,
);

/**
 * Select loading state
 */
export const selectLoading = createSelector(
  [selectDebtTrackerState],
  (state) => state.loading,
);

/**
 * Select error message
 */
export const selectError = createSelector(
  [selectDebtTrackerState],
  (state) => state.error,
);

/**
 * Select fetch status
 */
export const selectFetchStatus = createSelector(
  [selectDebtTrackerState],
  (state) => state.fetchStatus,
);

/**
 * Select pagination info for all partitions
 */
export const selectPagination = createSelector(
  [selectDebtTrackerState],
  (state) => state.pagination,
);

/**
 * Select picked-up cases for current page
 */
export const selectPickedUpCasesByPage = createSelector(
  [selectPaginatedCases],
  (paginatedCases) => paginatedCases?.pickedUp || [],
);

/**
 * Select refund queue cases for current page
 */
export const selectRefundQueueCasesByPage = createSelector(
  [selectPaginatedCases],
  (paginatedCases) => paginatedCases?.refundQueue || [],
);

/**
 * Select not-picked-up cases for current page
 */
export const selectNotPickedUpCasesByPage = createSelector(
  [selectPaginatedCases],
  (paginatedCases) => paginatedCases?.notPickedUp || [],
);

/**
 * Select pagination info for picked-up cases
 */
export const selectPickedUpPagination = createSelector(
  [selectPagination],
  (pagination) => pagination.pickedUp,
);

/**
 * Select pagination info for refund queue cases
 */
export const selectRefundQueuePagination = createSelector(
  [selectPagination],
  (pagination) => pagination.refundQueue,
);

/**
 * Select pagination info for not-picked-up cases
 */
export const selectNotPickedUpPagination = createSelector(
  [selectPagination],
  (pagination) => pagination.notPickedUp,
);

/**
 * Select total count of picked-up cases
 */
export const selectPickedUpCount = createSelector(
  [selectPartitionedCases],
  (partitionedCases) => partitionedCases?.pickedUpCount || 0,
);

/**
 * Select total count of refund queue cases
 */
export const selectRefundQueueCount = createSelector(
  [selectPartitionedCases],
  (partitionedCases) => partitionedCases?.refundQueueCount || 0,
);

/**
 * Select total count of not-picked-up cases
 */
export const selectNotPickedUpCount = createSelector(
  [selectPartitionedCases],
  (partitionedCases) => partitionedCases?.notPickedUpCount || 0,
);

/**
 * Select total count of all cases
 */
export const selectTotalCasesCount = createSelector(
  [selectPartitionedCases],
  (partitionedCases) => partitionedCases?.totalCases || 0,
);

/**
 * Select selected case IDs (for batch operations)
 */
export const selectSelectedCaseIds = createSelector(
  [selectDebtTrackerState],
  (state) => state.selectedCaseIds,
);

/**
 * Select whether any cases are selected
 */
export const selectHasSelectedCases = createSelector(
  [selectSelectedCaseIds],
  (selectedIds) => selectedIds.length > 0,
);

/**
 * Select count of selected cases
 */
export const selectSelectedCasesCount = createSelector(
  [selectSelectedCaseIds],
  (selectedIds) => selectedIds.length,
);

/**
 * Select year filter
 */
export const selectYearFilter = createSelector(
  [selectFilters],
  (filters) => ({
    yearFrom: filters.yearFrom,
    yearTo: filters.yearTo,
  }),
);

/**
 * Select funding source filter
 */
export const selectFundingSourceFilter = createSelector(
  [selectFilters],
  (filters) => filters.fundingSource,
);

/**
 * Select risk band filter
 */
export const selectRiskBandFilter = createSelector(
  [selectFilters],
  (filters) => filters.riskBand,
);

/**
 * Select status filter
 */
export const selectStatusFilter = createSelector(
  [selectFilters],
  (filters) => filters.status,
);

/**
 * Select search query
 */
export const selectSearchQuery = createSelector(
  [selectFilters],
  (filters) => filters.searchQuery,
);

/**
 * Select statistics for dashboard/header
 */
export const selectWorkspaceStats = createSelector(
  [selectPartitionedCases, selectCases],
  (partitionedCases, cases) => {
    if (!partitionedCases) {
      return {
        totalCases: 0,
        pickedUpCount: 0,
        refundQueueCount: 0,
        notPickedUpCount: 0,
        totalDebtAmount: 0,
        criticalRiskCount: 0,
        averageRiskScore: 0,
      };
    }

    const totalDebtAmount = cases.reduce((sum, c) => sum + c.debtAmount, 0);
    const criticalRiskCount = cases.filter((c) => c.riskBand === 'CRITICAL').length;
    const averageRiskScore =
      cases.length > 0 ? cases.reduce((sum, c) => sum + c.riskScore, 0) / cases.length : 0;

    return {
      totalCases: partitionedCases.totalCases,
      pickedUpCount: partitionedCases.pickedUpCount,
      refundQueueCount: partitionedCases.refundQueueCount,
      notPickedUpCount: partitionedCases.notPickedUpCount,
      totalDebtAmount,
      criticalRiskCount,
      averageRiskScore: Math.round(averageRiskScore),
    };
  },
);

/**
 * Select a specific case by ID
 * Returns null if not found
 */
export const selectCaseById = (caseId: string) =>
  createSelector([selectCases], (cases) => cases.find((c) => c.id === caseId) || null);

/**
 * Check if a specific case is selected
 */
export const selectIsCaseSelected = (caseId: string) =>
  createSelector([selectSelectedCaseIds], (selectedIds) => selectedIds.includes(caseId));
