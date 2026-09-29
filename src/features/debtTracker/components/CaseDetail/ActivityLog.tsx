/**
 * ActivityLog Component
 *
 * Displays activity log entries, newest first.
 * Implements TECHNICAL_SPECIFICATION.md §4.6
 */

import React from 'react';
import { ActivityEntry, ActivityLogProps } from '../../types/debtTrackerTypes';
import styles from '../../styles/components.module.css';

/**
 * Activity Log Component
 *
 * Renders append-only activity log entries from case scoring and officer actions.
 * Entries include scoring results, funding status, missed instalments,
 * last receipt, and prior arrangements.
 *
 * Sorted newest-first by timestamp.
 * Each entry shows source attribution (e.g., "Risk Sentinel", "Assurance Agent").
 *
 * @param activity - Array of ActivityEntry from appendActivityLog()
 * @param className - Optional CSS class name for wrapper
 *
 * @example
 * <ActivityLog activity={case.activity} />
 * // Renders:
 * // [Risk Sentinel] 09:15 — Risk scored 67 and banded High
 * // [Assurance Agent] 08:50 — 2 instalment(s) flagged unpaid
 * // [Funding Broker] 08:45 — Funding status read as NSFAS pending
 */
const ActivityLog: React.FC<ActivityLogProps> = ({ activity, className }) => {
  // Sort newest first (should already be sorted by service, but ensure here)
  const sorted = [...activity].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  const formatTime = (date: Date): string => {
    return date.toLocaleString('en-ZA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`${styles.activityLog} ${className || ''}`}>
      <h3 className={styles.activityTitle}>Activity Log</h3>
      {sorted.length === 0 ? (
        <p className={styles.noActivity}>No activity recorded</p>
      ) : (
        <div className={styles.activityList}>
          {sorted.map((entry, idx) => (
            <div key={idx} className={styles.activityEntry}>
              <div className={styles.entryMeta}>
                <span className={styles.sourceBadge}>{entry.source}</span>
                <span className={styles.timestamp}>{formatTime(entry.timestamp)}</span>
              </div>
              <p className={styles.entryText}>{entry.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityLog;
