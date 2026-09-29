/**
 * SignalChips Component
 *
 * Displays signal chips indicating risk signals.
 * Hot signals (urgent flags) use red-tinted styling.
 * Regular signals use gray styling.
 * Implements TECHNICAL_SPECIFICATION.md §4.4
 */

import React from 'react';
import { Signal } from '../../types/debtTrackerTypes';
import { SignalChipsProps } from '../../types/debtTrackerTypes';
import styles from '../../styles/components.module.css';

/**
 * Signal Chips Component
 *
 * Renders an array of signal chips from case scoring.
 * Hot signals (missed instalments, no payment, 90+/120+ days, arrangement defaulted)
 * are styled with red background. Regular signals use gray background.
 *
 * @param signals - Array of Signal objects from generateSignals()
 * @param className - Optional CSS class name for wrapper
 *
 * @example
 * <SignalChips signals={case.signals} />
 * // Renders: [2 missed instalments (red)] [120+ days R5,000 (red)] [NSFAS pending (gray)]
 */
const SignalChips: React.FC<SignalChipsProps> = ({ signals, className }) => {
  return (
    <div className={`${styles.signalChips} ${className || ''}`}>
      {signals.length === 0 ? (
        <span className={styles.noSignals}>No signals</span>
      ) : (
        signals.map((signal, idx) => (
          <span
            key={idx}
            className={`${styles.chip} ${signal.hot ? styles.hot : styles.regular}`}
            title={signal.text}
          >
            {signal.text}
          </span>
        ))
      )}
    </div>
  );
};

export default SignalChips;
