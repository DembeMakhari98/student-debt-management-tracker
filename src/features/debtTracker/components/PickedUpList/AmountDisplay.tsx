/**
 * AmountDisplay Component
 *
 * Displays amount with currency formatting.
 * Supports debt and credit variants with appropriate styling.
 */

import React from 'react';
import { AmountDisplayProps } from '../../types/debtTrackerTypes';
import styles from '../../styles/components.module.css';

/**
 * Amount Display Component
 *
 * @example
 * <AmountDisplay amount={50000} label="Debt Amount" variant="debt" />
 * <AmountDisplay amount={5000} variant="credit" />
 */
const AmountDisplay: React.FC<AmountDisplayProps> = ({
  amount,
  label,
  variant = 'debt',
}) => {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const variantClass = variant === 'debt' ? styles.amountDebt : styles.amountCredit;

  return (
    <div className={`${styles.amountDisplay} ${variantClass}`}>
      {label && <div className={styles.amountLabel}>{label}</div>}
      <div className={styles.amountValue}>{formatCurrency(amount)}</div>
    </div>
  );
};

export default AmountDisplay;
