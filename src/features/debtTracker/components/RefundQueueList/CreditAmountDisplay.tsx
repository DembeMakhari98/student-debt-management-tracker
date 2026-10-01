/**
 * CreditAmountDisplay Component
 *
 * Displays credit amount for refund queue items.
 * Shows refund status (PENDING, PROCESSED, FAILED).
 */

import React from 'react';
import { CreditAmountDisplayProps } from '../../types/debtTrackerTypes';
import styles from '../../styles/components.module.css';

/**
 * Credit Amount Display Component
 *
 * @example
 * <CreditAmountDisplay creditAmount={3500} refundStatus="PENDING" />
 */
const CreditAmountDisplay: React.FC<CreditAmountDisplayProps> = ({
  creditAmount,
  refundStatus = 'PENDING',
}) => {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const statusConfig: Record<string, { className: string; icon: string }> = {
    PENDING: {
      className: styles.creditStatusPending,
      icon: '⏳',
    },
    PROCESSED: {
      className: styles.creditStatusProcessed,
      icon: '✓',
    },
    FAILED: {
      className: styles.creditStatusFailed,
      icon: '✕',
    },
  };

  const config = statusConfig[refundStatus] || statusConfig.PENDING;

  return (
    <div className={`${styles.creditAmountDisplay} ${config.className}`}>
      <div className={styles.creditStatusIcon}>{config.icon}</div>
      <div className={styles.creditAmount}>{formatCurrency(creditAmount)}</div>
      <div className={styles.creditStatus}>{refundStatus}</div>
    </div>
  );
};

export default CreditAmountDisplay;
