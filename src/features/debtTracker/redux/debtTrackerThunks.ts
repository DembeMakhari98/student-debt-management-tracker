/**
 * Debt Tracker Redux Thunks
 *
 * Asynchronous thunks for debt tracker operations.
 * Handles API calls and data partitioning.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';
import { fetchCases } from '../services/debtTrackerApi';
import { partitionCases } from '../services/casePartitionService';
import {
  Case,
  PartitionedCases,
  PaginatedPartitionedCases,
  DebtTrackerFilter,
  PaginationInfo,
} from '../types/debtTrackerTypes';

/**
 * Request payload for fetchCasesThunk
 */
export interface FetchCasesPayload {
  filters: DebtTrackerFilter;
  pageSize?: number;
}

/**
 * Response from fetchCasesThunk
 */
export interface FetchCasesResponse {
  cases: Case[];
  partitionedCases: PartitionedCases;
  paginatedCases: PaginatedPartitionedCases;
}

/**
 * Async thunk for fetching and partitioning cases
 *
 * This thunk:
 * 1. Calls the API to fetch cases based on filters
 * 2. Partitions the cases into three groups (pickedUp, refundQueue, notPickedUp)
 * 3. Applies pagination to each group
 * 4. Returns all data for the Redux store
 *
 * @param payload - Filter criteria and pagination options
 * @returns Promise with cases, partitionedCases, and paginatedCases
 *
 * @example
 * dispatch(fetchCasesThunk({\n *   filters: { fundingSource: 'NSFAS', yearFrom: 2023 },\n *   pageSize: 20\n * }))\n
 */
export const fetchCasesThunk = createAsyncThunk<
  FetchCasesResponse,
  FetchCasesPayload,
  {\n    rejectValue: string;\n  }\n>('debtTracker/fetchCases', async (payload, { rejectWithValue }) => {
  try {
    // Step 1: Fetch cases from API
    const cases = await fetchCases(payload.filters);

    if (!cases || cases.length === 0) {
      // Return empty partitioned structure if no cases found
      const emptyPartitioned: PartitionedCases = {
        pickedUp: [],
        refundQueue: [],
        notPickedUp: [],
        totalCases: 0,
        pickedUpCount: 0,
        refundQueueCount: 0,
        notPickedUpCount: 0,
      };

      const pageSize = payload.pageSize || 20;
      const emptyPaginated: PaginatedPartitionedCases = {
        ...emptyPartitioned,
        pagination: {
          pickedUp: createEmptyPagination(pageSize),
          refundQueue: createEmptyPagination(pageSize),
          notPickedUp: createEmptyPagination(pageSize),
        },
      };

      return {
        cases: [],
        partitionedCases: emptyPartitioned,
        paginatedCases: emptyPaginated,
      };
    }

    // Step 2: Partition cases by status (and sort within each partition)
    const partitionedCases = partitionCases(cases);

    // Step 3: Apply pagination to each partition
    const pageSize = payload.pageSize || 20;
    const paginatedCases = applyPaginationToPartitions(
      partitionedCases,
      pageSize,
    );

    return {
      cases,
      partitionedCases,
      paginatedCases,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch cases';
    return rejectWithValue(errorMessage);
  }\n);

/**
 * Helper function to create empty pagination info
 * @internal
 */
function createEmptyPagination(pageSize: number): PaginationInfo {
  return {
    currentPage: 1,
    pageSize,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

/**
 * Helper function to apply pagination to each partition
 *
 * Calculates pagination info for each status group based on page size.
 * Currently uses page 1 for all partitions (developer can customize).
 *
 * @internal
 */
function applyPaginationToPartitions(
  partitioned: PartitionedCases,
  pageSize: number,
): PaginatedPartitionedCases {
  const pickedUpPagination = calculatePagination(
    partitioned.pickedUpCount,
    1, // currentPage
    pageSize,
  );

  const refundQueuePagination = calculatePagination(
    partitioned.refundQueueCount,
    1, // currentPage
    pageSize,
  );

  const notPickedUpPagination = calculatePagination(
    partitioned.notPickedUpCount,
    1, // currentPage
    pageSize,
  );

  return {
    pickedUp: partitioned.pickedUp.slice(0, pageSize),
    refundQueue: partitioned.refundQueue.slice(0, pageSize),
    notPickedUp: partitioned.notPickedUp.slice(0, pageSize),
    totalCases: partitioned.totalCases,
    pickedUpCount: partitioned.pickedUpCount,
    refundQueueCount: partitioned.refundQueueCount,
    notPickedUpCount: partitioned.notPickedUpCount,
    pagination: {
      pickedUp: pickedUpPagination,
      refundQueue: refundQueuePagination,
      notPickedUp: notPickedUpPagination,
    },
  };
}

/**
 * Calculate pagination info for a given total and page
 * @internal
 */
function calculatePagination(
  totalItems: number,
  currentPage: number,
  pageSize: number,
): PaginationInfo {
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
}
