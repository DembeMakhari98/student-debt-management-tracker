/**
 * RefundQueueListRow Component
 *
 * Represents a single row in the refund queue list.
 * Displays student info, credit amount, refund status, and actions.
 */

import React from 'react';
import { RefundQueueListRowProps } from '../../types/debtTrackerTypes';
import StudentInfo from '../PickedUpList/StudentInfo';
import FundingPill from '../PickedUpList/FundingPill';
import StatusPill from '../PickedUpList/StatusPill';
import CreditAmountDisplay from './CreditAmountDisplay';
import ActionInfo from '../PickedUpList/ActionInfo';
import styles from '../../styles/lists.module.css';

/**
 * Refund Queue List Row Component
 *
 * @example
 * <RefundQueueListRow\n *   case={{\n *     id: '2',\n *     studentName: 'Jane Smith',\n *     studentEmail: 'jane@example.com',\n *     studentPhone: '0987654321',\n *     debtAmount: 0,\n *     creditAmount: 3500,\n *     fundingSource: 'NSFAS',\n *     riskBand: 'LOW',\n *     riskScore: 15,\n *     status: 'REFUND_QUEUE',\n *     refundStatus: 'PENDING',\n *     actionTaken: 'Credit processed',\n *     actionDate: '2024-09-01',\n *     lastContactDate: null,\n *     createdAt: '2024-08-15',\n *     updatedAt: '2024-09-10',\n *   }}\n *   onSelect={(id) => console.log('Selected', id)}\n *   isSelected={false}\n * />\n */
const RefundQueueListRow: React.FC<RefundQueueListRowProps> = ({
  case: caseItem,
  onSelect,
  isSelected,
}) => {
  return (
    <div className={`${styles.listRow} ${isSelected ? styles.selected : ''}`}>
      {/* Checkbox */}
      <div className={styles.rowCheckbox}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect?.(caseItem.id)}
          aria-label={`Select case ${caseItem.id}`}
        />
      </div>

      {/* Student Info */}
      <div className={styles.rowCell}>
        <StudentInfo
          studentName={caseItem.studentName}
          studentEmail={caseItem.studentEmail}
          studentPhone={caseItem.studentPhone}
        />
      </div>

      {/* Funding Pill */}
      <div className={styles.rowCell}>
        <FundingPill fundingSource={caseItem.fundingSource} />
      </div>

      {/* Status Pill */}
      <div className={styles.rowCell}>
        <StatusPill
          status={caseItem.status}
          refundStatus={caseItem.refundStatus}
        />
      </div>

      {/* Credit Amount Display */}
      <div className={styles.rowCell}>
        <CreditAmountDisplay
          creditAmount={caseItem.creditAmount || 0}
          refundStatus={caseItem.refundStatus}
        />
      </div>

      {/* Action Info */}
      <div className={styles.rowCell}>
        <ActionInfo
          actionTaken={caseItem.actionTaken}
          actionDate={caseItem.actionDate}
        />
      </div>

      {/* Actions */}
      <div className={styles.rowActions}>
        <button
          className={styles.actionButton}
          title="View details"
          onClick={() => {
            // TODO: Open case details modal/view
          }}
        >
          📋
        </button>
        <button
          className={styles.actionButton}
          title="Process refund"
          onClick={() => {
            // TODO: Open refund processing dialog
          }}
        >
          💰
        </button>
      </div>
    </div>
  );
};

export default RefundQueueListRow;
