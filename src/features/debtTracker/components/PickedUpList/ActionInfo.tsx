/**
 * ActionInfo Component
 *
 * Displays action taken and the date of that action.
 * Shows what action was performed and when.
 */

import React from 'react';
import { ActionInfoProps } from '../../types/debtTrackerTypes';
import styles from '../../styles/components.module.css';

/**
 * Action Info Component
 *
 * @example
 * <ActionInfo
 *   actionTaken="Payment Plan Established"
 *   actionDate="2024-01-15"
 * />
 */
const ActionInfo: React.FC<ActionInfoProps> = ({ actionTaken, actionDate }) => {
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className={styles.actionInfo}>
      <div className={styles.actionTaken}>{actionTaken}</div>
      <div className={styles.actionDate}>{formatDate(actionDate)}</div>
    </div>
  );
};

export default ActionInfo;
