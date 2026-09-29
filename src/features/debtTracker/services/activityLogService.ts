/**
 * Activity Log Service
 *
 * Manages activity log generation and append-only semantics.
 * Implements TECHNICAL_SPECIFICATION.md §4.6 exactly.
 */

import { ActivityEntry } from '../types/debtTrackerTypes';
import { DebtorInput } from './signalGenerationService';

/**
 * Extended debtor interface for activity log generation
 */
interface DebtorWithScore extends DebtorInput {
  score: number;
  band: string; // e.g., "High", "Elevated", "Watch", "Credit"
  year: number;
}

/**
 * Append new activity entries to an existing log after a scoring run.
 * Maintains append-only semantics (never overwrites).
 * Entries are sorted newest-first by timestamp.
 *
 * @param existingLog - Prior activity entries (may be null or undefined)
 * @param debtor - The freshly scored debtor record with score and band
 * @returns New activity array with appended entries, sorted newest-first
 *
 * @example
 * const log = appendActivityLog(null, debtor);
 * // Returns array of 5 activity entries with sources: Risk Sentinel, Funding Broker, etc.
 *
 * Implements append-only semantics:
 * - New entries are added to the log
 * - Prior entries are never deleted or modified
 * - Newest entries appear first
 */
export function appendActivityLog(
  existingLog: ActivityEntry[] | null | undefined,
  debtor: DebtorWithScore
): ActivityEntry[] {
  const newEntries: ActivityEntry[] = [];
  const now = new Date();

  // 1. Risk scoring entry (always) — §4.6 rule 1
  newEntries.push({
    text: `Risk scored ${debtor.score} and banded ${debtor.band}`,
    source: 'Risk Sentinel',
    timestamp: now,
  });

  // 2. Funding status entry (always) — §4.6 rule 2
  newEntries.push({
    text: `Funding status read as ${debtor.fundStatus}`,
    source: 'Funding Broker',
    timestamp: now,
  });

  // 3. Missed instalments entry (only if missed > 0) — §4.6 rule 3
  if (debtor.missed > 0) {
    newEntries.push({
      text: `${debtor.missed} instalment${debtor.missed > 1 ? 's' : ''}(s) flagged unpaid`,
      source: 'Assurance Agent',
      timestamp: now,
    });
  }

  // 4. Last receipt entry (always) — §4.6 rule 4
  if (debtor.lastPay) {
    newEntries.push({
      text: `Last receipt ${formatDate(debtor.lastPay)} confirmed`,
      source: 'Cashiering reconciliation',
      timestamp: now,
    });
  } else {
    newEntries.push({
      text: 'No receipt found on the account',
      source: 'Cashiering reconciliation',
      timestamp: now,
    });
  }

  // 5. Prior arrangement entry (only if arrangement exists) — §4.6 rule 5
  if (debtor.arrangement) {
    newEntries.push({
      text: `Prior arrangement ${debtor.arrangement.toLowerCase()}`,
      source: 'Assurance Agent',
      timestamp: now,
    });
  }

  // Append to existing log (immutable — never mutate existingLog)
  const allEntries = [...(existingLog || []), ...newEntries];

  // Sort newest-first by timestamp (stable sort for same timestamp)
  return allEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Format date as "dd MMM" (e.g., "15 Aug").
 *
 * @internal
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}
