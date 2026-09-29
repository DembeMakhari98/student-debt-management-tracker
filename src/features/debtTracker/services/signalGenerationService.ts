/**
 * Signal Generation Service
 *
 * Generates risk signal chips for a debtor based on risk indicators.
 * Implements TECHNICAL_SPECIFICATION.md §4.4 exactly.
 */

import { Signal } from '../types/debtTrackerTypes';

/**
 * Represents debtor data required for signal generation
 */
export interface DebtorInput {
  missed: number;
  lastPay: Date | null;
  ageing: { current: number; d30: number; d60: number; d90: number; d120: number };
  fundStatus: string;
  arrangement: string | null;
}

/**
 * Generate signal chips for a debtor based on risk indicators.
 * Signals are generated in spec order: missed, payment, ageing, funding, arrangement.
 *
 * @param debtor - The scored debtor record
 * @param fundingRiskWeights - Funding status to risk weight lookup table
 * @returns Array of Signal objects in spec order (§4.4)
 *
 * @example
 * const signals = generateSignals(debtor, { 'NSFAS pending': 12, 'NSFAS declined': 16 });
 * // Returns: [{ text: "2 missed instalments", hot: true }, { text: "120+ days R 5,000", hot: true }, ...]
 */
export function generateSignals(
  debtor: DebtorInput,
  fundingRiskWeights: Record<string, number>
): Signal[] {
  const signals: Signal[] = [];

  // 1. Missed instalments signal (hot) — §4.4 rule 1
  if (debtor.missed > 0) {
    signals.push({
      text: `${debtor.missed} missed instalment${debtor.missed > 1 ? 's' : ''}`,
      hot: true,
    });
  }

  // 2. Last payment signal — §4.4 rule 2
  if (debtor.lastPay === null) {
    signals.push({
      text: 'No payment on record',
      hot: true,
    });
  } else {
    signals.push({
      text: `Last paid ${formatDate(debtor.lastPay)}`,
      hot: false,
    });
  }

  // 3. Oldest overdue bucket signal — §4.4 rule 3
  const oldestBucket = findOldestBucket(debtor.ageing);
  if (oldestBucket) {
    const { bucket, amount } = oldestBucket;
    const isHot = bucket === 'd120' || bucket === 'd90';
    const bucketLabel = getBucketLabel(bucket);
    signals.push({
      text: `${bucketLabel} ${formatCurrency(amount)}`,
      hot: isHot,
    });
  }

  // 4. Funding status signal (if risk weight >= 8) — §4.4 rule 4
  const fundingWeight = fundingRiskWeights[debtor.fundStatus] || 0;
  if (fundingWeight >= 8) {
    signals.push({
      text: debtor.fundStatus,
      hot: false,
    });
  }

  // 5. Arrangement defaulted signal (hot) — §4.4 rule 5
  if (debtor.arrangement === 'Defaulted') {
    signals.push({
      text: 'Arrangement defaulted',
      hot: true,
    });
  }

  return signals;
}

/**
 * Find the oldest (highest denomination) ageing bucket with a positive amount.
 * Walk from d120 → d90 → d60 → d30 → current, return first non-zero.
 *
 * @internal
 */
function findOldestBucket(
  ageing: DebtorInput['ageing']
): { bucket: string; amount: number } | null {
  if (ageing.d120 > 0) return { bucket: 'd120', amount: ageing.d120 };
  if (ageing.d90 > 0) return { bucket: 'd90', amount: ageing.d90 };
  if (ageing.d60 > 0) return { bucket: 'd60', amount: ageing.d60 };
  if (ageing.d30 > 0) return { bucket: 'd30', amount: ageing.d30 };
  if (ageing.current > 0) return { bucket: 'current', amount: ageing.current };
  return null;
}

/**
 * Get human-readable label for ageing bucket.
 *
 * @internal
 */
function getBucketLabel(bucket: string): string {
  switch (bucket) {
    case 'd120':
      return '120+ days';
    case 'd90':
      return '90 days';
    case 'd60':
      return '60 days';
    case 'd30':
      return '30 days';
    case 'current':
      return 'Current';
    default:
      return 'Unknown';
  }
}

/**
 * Format date as "dd MMM" (e.g., "15 Aug").
 *
 * @internal
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

/**
 * Format currency as ZAR (e.g., "R 12,000.00").
 *
 * @internal
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(amount);
}
