/**
 * Debt Tracker Redux Slice
 *
 * Manages the complete state for the Debt Management Tracker workspace using Redux Toolkit.
 * Includes reducers for filters, pagination, and async operations.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  DebtTrackerState,
  DebtTrackerFilter,
  Case,
  PartitionedCases,
  PaginatedPartitionedCases,
} from '../types/debtTrackerTypes';
import { fetchCasesThunk } from './debtTrackerThunks';

/**
 * Initial state for the debt tracker
 */
const initialState: DebtTrackerState = {
  cases: [],
  partitionedCases: null,
  paginatedCases: null,
  filters: {
    fundingSource: 'ALL',
    riskBand: 'ALL',
    status: 'ALL',
    searchQuery: '',
  },
  pagination: {
    pickedUp: {
      currentPage: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    refundQueue: {
      currentPage: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    notPickedUp: {
      currentPage: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  },
  loading: false,
  error: null,
  fetchStatus: 'idle',
  selectedCaseIds: [],
};

/**
 * Debt Tracker Redux Slice
 * Handles all state mutations for the debt tracker feature
 */
const debtTrackerSlice = createSlice({
  name: 'debtTracker',
  initialState,
  reducers: {
    /**
     * Set year filter range
     */
    setYearFilter: (state, action: PayloadAction<{ yearFrom?: number; yearTo?: number }>) => {
      state.filters.yearFrom = action.payload.yearFrom;
      state.filters.yearTo = action.payload.yearTo;
    },

    /**
     * Set funding source filter
     */
    setFundingFilter: (state, action: PayloadAction<string | undefined>) => {
      state.filters.fundingSource = action.payload || 'ALL';
    },

    /**
     * Set risk band filter
     */
    setRiskBandFilter: (state, action: PayloadAction<string | undefined>) => {
      state.filters.riskBand = action.payload || 'ALL';
    },

    /**
     * Set status filter (PICKED_UP, REFUND_QUEUE, NOT_PICKED_UP, or ALL)
     */
    setStatusFilter: (state, action: PayloadAction<string | undefined>) => {
      state.filters.status = action.payload || 'ALL';
    },

    /**
     * Set search query for student name/ID search
     */
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.filters.searchQuery = action.payload;
    },

    /**
     * Reset all filters to initial state
     */
    resetFilters: (state) => {
      state.filters = initialState.filters;
      state.pagination = initialState.pagination;
    },

    /**
     * Set the raw cases array (usually from API)
     */
    setCases: (state, action: PayloadAction<Case[]>) => {
      state.cases = action.payload;
    },

    /**
     * Set partitioned cases (organized by status)
     */
    setPartitionedCases: (state, action: PayloadAction<PartitionedCases>) => {
      state.partitionedCases = action.payload;
    },

    /**
     * Set paginated partitioned cases with pagination info
     */
    setPaginatedCases: (state, action: PayloadAction<PaginatedPartitionedCases>) => {
      state.paginatedCases = action.payload;
      state.pagination = action.payload.pagination;
    },

    /**
     * Update pagination for picked-up list
     */
    setPickedUpPage: (state, action: PayloadAction<number>) => {
      state.pagination.pickedUp.currentPage = action.payload;
    },

    /**
     * Update pagination for refund queue list
     */
    setRefundQueuePage: (state, action: PayloadAction<number>) => {
      state.pagination.refundQueue.currentPage = action.payload;
    },

    /**
     * Update pagination for not-picked-up list
     */
    setNotPickedUpPage: (state, action: PayloadAction<number>) => {
      state.pagination.notPickedUp.currentPage = action.payload;
    },

    /**
     * Set loading state
     */
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    /**
     * Set error message
     */
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    /**
     * Clear error message
     */
    clearError: (state) => {
      state.error = null;
    },

    /**
     * Toggle case selection for batch operations
     */
    toggleCaseSelection: (state, action: PayloadAction<string>) => {
      const caseId = action.payload;
      const index = state.selectedCaseIds.indexOf(caseId);
      if (index > -1) {
        state.selectedCaseIds.splice(index, 1);
      } else {
        state.selectedCaseIds.push(caseId);
      }
    },

    /**
     * Select all cases in a specific partition
     */
    selectAllCases: (state, action: PayloadAction<'pickedUp' | 'refundQueue' | 'notPickedUp'>) => {
      const partition = action.payload;
      if (state.partitionedCases) {
        const caseIds = state.partitionedCases[partition].map((c) => c.id);
        state.selectedCaseIds = Array.from(new Set([...state.selectedCaseIds, ...caseIds]));
      }
    },

    /**
     * Clear all selections
     */
    clearSelection: (state) => {
      state.selectedCaseIds = [];
    },
  },
  extraReducers: (builder) => {
    /**
     * Handle fetchCasesThunk lifecycle
     */
    builder
      .addCase(fetchCasesThunk.pending, (state) => {
        state.loading = true;
        state.fetchStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchCasesThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.fetchStatus = 'succeeded';
        state.cases = action.payload.cases;
        state.partitionedCases = action.payload.partitionedCases;
        state.paginatedCases = action.payload.paginatedCases;
        state.pagination = action.payload.paginatedCases.pagination;
      })
      .addCase(fetchCasesThunk.rejected, (state, action) => {
        state.loading = false;
        state.fetchStatus = 'failed';
        state.error = action.payload || 'Failed to fetch cases';
      });
  },
});

export const {
  setYearFilter,
  setFundingFilter,
  setRiskBandFilter,
  setStatusFilter,
  setSearchQuery,
  resetFilters,
  setCases,
  setPartitionedCases,
  setPaginatedCases,
  setPickedUpPage,
  setRefundQueuePage,
  setNotPickedUpPage,
  setLoading,
  setError,
  clearError,
  toggleCaseSelection,
  selectAllCases,
  clearSelection,
} = debtTrackerSlice.actions;

export default debtTrackerSlice.reducer;
