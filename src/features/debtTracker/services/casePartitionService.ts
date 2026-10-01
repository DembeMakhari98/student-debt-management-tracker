/**
 * Case Partitioning Service
 *
 * Handles partitioning and sorting of debt cases into three groups:
 * - Picked Up: Cases actively being managed (sorted by risk score descending)
 * - Refund Queue: Cases with credit to be refunded (sorted by amount ascending)
 * - Not Picked Up: Cases not yet engaged (sorted by date ascending)
 */

import { Case, PartitionedCases } from '../types/debtTrackerTypes';

/**
 * Partition cases into three groups by status and apply sorting
 *
 * Partitioning Logic:
 * 1. PICKED_UP cases are sorted by riskScore descending (highest risk first)
 *    - Ensures high-risk cases are prioritized
 *    - Within same score, order is stable
 *
 * 2. REFUND_QUEUE cases are sorted by creditAmount ascending (smallest first)
 *    - Processes quick wins first (small refunds)
 *    - More efficient workflow
 *
 * 3. NOT_PICKED_UP cases are sorted by createdAt ascending (oldest first)
 *    - Oldest cases are engaged first (FIFO)
 *    - Ensures fair ordering and prevents aging
 *
 * @param cases - Array of Case objects to partition
 * @returns PartitionedCases object with sorted cases grouped by status
 *
 * @example
 * const partitioned = partitionCases(casesArray);
 * console.log(partitioned.pickedUp.length); // 15
 * console.log(partitioned.refundQueue.length); // 8
 * console.log(partitioned.notPickedUp.length); // 42
 */
export function partitionCases(cases: Case[]): PartitionedCases {
  // Initialize empty partitions
  const pickedUp: Case[] = [];
  const refundQueue: Case[] = [];
  const notPickedUp: Case[] = [];

  // Partition cases by status
  for (const caseItem of cases) {
    switch (caseItem.status) {
      case 'PICKED_UP':
        pickedUp.push(caseItem);
        break;
      case 'REFUND_QUEUE':
        refundQueue.push(caseItem);
        break;
      case 'NOT_PICKED_UP':
        notPickedUp.push(caseItem);
        break;
      default:
        // Handle unknown status by defaulting to NOT_PICKED_UP
        console.warn(`Unknown case status: ${caseItem.status}`);
        notPickedUp.push(caseItem);
    }
  }

  // Apply sorting to each partition
  const sortedPickedUp = sortPickedUpCases(pickedUp);
  const sortedRefundQueue = sortRefundQueueCases(refundQueue);
  const sortedNotPickedUp = sortNotPickedUpCases(notPickedUp);

  return {
    pickedUp: sortedPickedUp,
    refundQueue: sortedRefundQueue,
    notPickedUp: sortedNotPickedUp,
    totalCases: cases.length,
    pickedUpCount: sortedPickedUp.length,
    refundQueueCount: sortedRefundQueue.length,
    notPickedUpCount: sortedNotPickedUp.length,
  };
}

/**
 * Sort picked-up cases by risk score (descending)
 *
 * Higher risk scores indicate more urgent cases.
 * This ensures high-priority cases appear first in the list.
 *
 * @internal
 */
function sortPickedUpCases(cases: Case[]): Case[] {
  return [...cases].sort((a, b) => {
    // Primary sort: risk score descending (higher score = higher risk = first)
    if (b.riskScore !== a.riskScore) {
      return b.riskScore - a.riskScore;
    }

    // Secondary sort: by risk band (CRITICAL > HIGH > MEDIUM > LOW)
    const riskBandOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const bandDiff = riskBandOrder[a.riskBand] - riskBandOrder[b.riskBand];
    if (bandDiff !== 0) return bandDiff;

    // Tertiary sort: by creation date ascending (older first)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/**
 * Sort refund queue cases by credit amount (ascending)
 *
 * Smaller refunds are processed first (quick wins).
 * This optimizes workflow by completing transactions faster.
 *
 * @internal
 */
function sortRefundQueueCases(cases: Case[]): Case[] {
  return [...cases].sort((a, b) => {
    // Primary sort: credit amount ascending (smaller first)
    const creditA = a.creditAmount || 0;
    const creditB = b.creditAmount || 0;

    if (creditA !== creditB) {
      return creditA - creditB;
    }

    // Secondary sort: by refund status (PENDING first, then PROCESSED, then FAILED)
    const statusOrder = { PENDING: 0, PROCESSED: 1, FAILED: 2 };
    const statusA = a.refundStatus || 'PENDING';
    const statusB = b.refundStatus || 'PENDING';
    const statusDiff = statusOrder[statusA] - statusOrder[statusB];
    if (statusDiff !== 0) return statusDiff;

    // Tertiary sort: by action date ascending (oldest first)
    return new Date(a.actionDate).getTime() - new Date(b.actionDate).getTime();
  });
}

/**
 * Sort not-picked-up cases by creation date (ascending)
 *
 * Oldest cases are engaged first (FIFO).
 * This ensures fair treatment and prevents cases from aging indefinitely.
 *
 * @internal
 */
function sortNotPickedUpCases(cases: Case[]): Case[] {
  return [...cases].sort((a, b) => {
    // Primary sort: creation date ascending (oldest first - FIFO)
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();

    if (dateA !== dateB) {
      return dateA - dateB;
    }

    // Secondary sort: by risk score descending (higher risk within same date)
    if (b.riskScore !== a.riskScore) {
      return b.riskScore - a.riskScore;
    }

    // Tertiary sort: by debt amount descending (larger debt within same score)
    return b.debtAmount - a.debtAmount;
  });
}

/**
 * Check if a case should be in a specific partition
 *
 * Useful for validation or conditional logic.
 *
 * @internal
 */
export function isInPartition(caseItem: Case, partition: 'pickedUp' | 'refundQueue' | 'notPickedUp'): boolean {
  switch (partition) {
    case 'pickedUp':
      return caseItem.status === 'PICKED_UP';
    case 'refundQueue':
      return caseItem.status === 'REFUND_QUEUE';
    case 'notPickedUp':
      return caseItem.status === 'NOT_PICKED_UP';
    default:
      return false;
  }
}

/**
 * Filter cases within a partition
 *
 * Useful for applying secondary filters within a status group.
 *
 * @example
 * const criticalCases = filterCasesInPartition(
 *   partitioned.pickedUp,
 *   (c) => c.riskBand === 'CRITICAL'
 * );
 *
 * @internal
 */
export function filterCasesInPartition(
  cases: Case[],
  predicate: (caseItem: Case) => boolean,
): Case[] {
  return cases.filter(predicate);
}

/**
 * Get cases within a risk band from a partition
 *
 * Useful for displaying cases by risk level.
 *
 * @internal
 */
export function getCasesByRiskBand(
  cases: Case[],
  riskBand: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
): Case[] {
  return cases.filter((c) => c.riskBand === riskBand);
}

/**
 * Get cases by funding source from a partition
 *
 * @internal
 */
export function getCasesByFundingSource(
  cases: Case[],
  fundingSource: 'NSFAS' | 'PRIVATE' | 'OTHER',
): Case[] {
  return cases.filter((c) => c.fundingSource === fundingSource);
}
