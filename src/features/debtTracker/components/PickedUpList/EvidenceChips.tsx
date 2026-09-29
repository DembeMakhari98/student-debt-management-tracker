/**
 * EvidenceChips Component
 *
 * Displays evidence reference chips citing data sources.
 * Implements TECHNICAL_SPECIFICATION.md §4.5
 */

import React from 'react';
import { Evidence, EvidenceChipsProps } from '../../types/debtTrackerTypes';
import styles from '../../styles/components.module.css';

/**
 * Evidence Chips Component
 *
 * Renders read-only evidence chips sourced from multiple systems:
 * - Ageing: oldest overdue bucket
 * - Payment history: year range
 * - Funding: funding status
 * - Arrangement: prior arrangement if exists
 *
 * @param evidence - Array of Evidence strings from generateEvidence()
 * @param className - Optional CSS class name for wrapper
 *
 * @example
 * <EvidenceChips evidence={case.evidence} />
 * // Renders: [Ageing · 120+ days] [Payment history 2025–2026] [Funding · NSFAS pending]
 */
const EvidenceChips: React.FC<EvidenceChipsProps> = ({ evidence, className }) => {
  return (
    <div className={`${styles.evidenceChips} ${className || ''}`}>
      {evidence.length === 0 ? (
        <span className={styles.noEvidence}>No evidence</span>
      ) : (
        evidence.map((item, idx) => (
          <span
            key={idx}
            className={`${styles.chip} ${styles.evidence}`}
            title={item}
          >
            {item}
          </span>
        ))
      )}
    </div>
  );
};

export default EvidenceChips;
