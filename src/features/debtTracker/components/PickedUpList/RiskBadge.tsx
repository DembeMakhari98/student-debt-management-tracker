/**
 * RiskBadge Component
 *
 * Displays risk band and score as a badge.
 * Color-coded based on risk level.
 */

import React from 'react';
import { RiskBadgeProps, RISK_BANDS } from '../../types/debtTrackerTypes';
import styles from '../../styles/components.module.css';

/**
 * Risk Badge Component
 *
 * @example
 * <RiskBadge riskBand="CRITICAL" riskScore={85} showScore />
 */
const RiskBadge: React.FC<RiskBadgeProps> = ({ riskBand, riskScore, showScore = false }) => {
  const riskInfo = RISK_BANDS[riskBand];

  return (
    <div
      className={styles.riskBadge}
      style={{
        backgroundColor: riskInfo.color,
      }}
      title={`${riskInfo.label} Risk (Score: ${riskScore})`}
    >
      <span className={styles.riskBadgeLabel}>{riskInfo.label}</span>
      {showScore && <span className={styles.riskBadgeScore}>{riskScore}</span>}
    </div>
  );
};

export default RiskBadge;
