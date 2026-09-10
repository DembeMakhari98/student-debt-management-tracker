/**
 * SignalChips Component
 *
 * Displays signal chips indicating risk signals and contact status.
 * Shows chips for critical flags, overdue items, etc.
 */

import React from 'react';
import { SignalChipsProps } from '../../types/debtTrackerTypes';
import styles from '../../styles/components.module.css';

/**
 * Signal Chips Component
 *
 * @example
 * <SignalChips riskBand="CRITICAL" daysNoContact={30} />
 */
const SignalChips: React.FC<SignalChipsProps> = ({ riskBand, daysNoContact }) => {
  return (
    <div className={styles.signalChips}>
      {/* Risk Band Chip */}
      {riskBand === 'CRITICAL' && (
        <span className={styles.chip} style={{ backgroundColor: '#d32f2f', color: 'white' }}>
          ⚠️ CRITICAL
        </span>
      )}

      {riskBand === 'HIGH' && (
        <span className={styles.chip} style={{ backgroundColor: '#f57c00', color: 'white' }}>
          ⚠️ HIGH
        </span>
      )}

      {/* Days No Contact Chip */}
      {daysNoContact !== undefined && daysNoContact > 30 && (
        <span className={styles.chip} style={{ backgroundColor: '#ff9800', color: 'white' }}>
          📞 {daysNoContact}d no contact
        </span>
      )}

      {/* TODO: Add more signal chips as needed */}
      {/* Examples: Overdue payment, Payment plan violation, etc. */}
    </div>
  );
};

export default SignalChips;
