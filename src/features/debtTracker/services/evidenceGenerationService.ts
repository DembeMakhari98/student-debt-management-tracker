/**
 * Evidence Generation Service
 *
 * Generates evidence reference chips citing data sources.
 * Implements TECHNICAL_SPECIFICATION.md §4.5 exactly.
 */

import { Evidence } from '../types/debtTrackerTypes';
import { DebtorInput } from './signalGenerationService';

/**
 * Generate evidence chips for a debtor, citing data sources.
 * Evidence is generated in spec order: ageing, payment history, funding, arrangement.
 *
 * @param debtor - The scored debtor record
 * @returns Array of Evidence strings in spec order (§4.5)
 *
 * @example
 * const evidence = generateEvidence(debtor);
 * // Returns: ["Ageing · 120+ days", "Payment history 2025–2026", "Funding · NSFAS pending"]
 */
export function generateEvidence(debtor: DebtorInput & { year: number }): Evidence[] {
  const evidence: Evidence[] = [];

  // 1. Ageing evidence — §4.5 rule 1
  const oldestBucket = findOldestBucket(debtor.ageing);
  const ageingLabel = oldestBucket ? getBucketLabel(oldestBucket.bucket) : 'Current';
  evidence.push(`Ageing · ${ageingLabel}`);

  // 2. Payment history year range — §4.5 rule 2
  evidence.push(`Payment history ${debtor.year - 1}–${debtor.year}`);

  // 3. Funding status (if exists) — §4.5 rule 3
  if (debtor.fundStatus && debtor.fundStatus.trim()) {
    evidence.push(`Funding · ${debtor.fundStatus}`);
  }

  // 4. Arrangement (if exists) — §4.5 rule 4
  if (debtor.arrangement) {
    evidence.push(`Arrangement · ${debtor.arrangement}`);
  }

  return evidence;
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
