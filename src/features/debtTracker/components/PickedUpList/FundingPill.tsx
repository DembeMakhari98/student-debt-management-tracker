/**
 * FundingPill Component
 *
 * Displays funding source as a pill/badge.
 * Shows NSFAS, PRIVATE, or OTHER.
 */

import React from 'react';
import { FundingPillProps } from '../../types/debtTrackerTypes';
import styles from '../../styles/components.module.css';

/**
 * Funding Pill Component
 *
 * @example
 * <FundingPill fundingSource="NSFAS" />
 */
const FundingPill: React.FC<FundingPillProps> = ({ fundingSource }) => {
  const fundingConfig: Record<string, { label: string; className: string }> = {
    NSFAS: { label: 'NSFAS', className: styles.fundingNsfas },
    PRIVATE: { label: 'Private', className: styles.fundingPrivate },
    OTHER: { label: 'Other', className: styles.fundingOther },
  };

  const config = fundingConfig[fundingSource] || { label: fundingSource, className: '' };

  return (
    <div className={`${styles.fundingPill} ${config.className}`}>
      {config.label}
    </div>
  );
};

export default FundingPill;
