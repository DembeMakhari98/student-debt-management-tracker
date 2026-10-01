/**
 * StatusPill Component
 *
 * Displays case status as a pill/badge.
 * Shows PICKED_UP, REFUND_QUEUE, or NOT_PICKED_UP with refund status for queue items.
 */

import React from 'react';
import { StatusPillProps } from '../../types/debtTrackerTypes';
import styles from '../../styles/components.module.css';

/**
 * Status Pill Component
 *
 * @example
 * <StatusPill status="PICKED_UP" />
 * <StatusPill status="REFUND_QUEUE" refundStatus="PENDING" />
 */
const StatusPill: React.FC<StatusPillProps> = ({ status, refundStatus }) => {
  const statusConfig: Record<string, { label: string; className: string }> = {
    PICKED_UP: { label: '✓ Picked Up', className: styles.statusPickedUp },
    REFUND_QUEUE: {
      label: `💰 Refund Queue (${refundStatus || 'PENDING'})`,
      className: styles.statusRefund,
    },
    NOT_PICKED_UP: { label: '○ Not Picked Up', className: styles.statusNotPickedUp },
  };

  const config = statusConfig[status] || { label: status, className: '' };

  return (
    <div className={`${styles.statusPill} ${config.className}`}>
      {config.label}
    </div>
  );
};

export default StatusPill;
