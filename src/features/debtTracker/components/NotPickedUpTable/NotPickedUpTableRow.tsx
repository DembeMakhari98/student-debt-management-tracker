/**
 * NotPickedUpTableRow Component
 *
 * Represents a single row in the not-picked-up table.
 * Displays student info, debt amount, risk, funding, and days waiting.
 */

import React from 'react';
import { NotPickedUpTableRowProps } from '../../types/debtTrackerTypes';
import StudentInfo from '../PickedUpList/StudentInfo';
import FundingPill from '../PickedUpList/FundingPill';
import RiskBadge from '../PickedUpList/RiskBadge';
import AmountDisplay from '../PickedUpList/AmountDisplay';
import styles from '../../styles/lists.module.css';

/**
 * Not Picked Up Table Row Component
 *
 * @example
 * <NotPickedUpTableRow\n *   case={{\n *     id: '3',\n *     studentName: 'Bob Wilson',\n *     studentEmail: 'bob@example.com',\n *     studentPhone: '0555555555',\n *     debtAmount: 25000,\n *     fundingSource: 'PRIVATE',\n *     riskBand: 'MEDIUM',\n *     riskScore: 55,\n *     status: 'NOT_PICKED_UP',\n *     actionTaken: 'Initial outreach pending',\n *     actionDate: '2024-09-10',\n *     lastContactDate: null,\n *     createdAt: '2024-09-01',\n *     updatedAt: '2024-09-10',\n *   }}\n *   onSelect={(id) => console.log('Selected', id)}\n *   isSelected={false}\n * />\n */
const NotPickedUpTableRow: React.FC<NotPickedUpTableRowProps> = ({
  case: caseItem,
  onSelect,
  isSelected,
}) => {
  /**
   * Calculate days waiting since creation
   */
  const getDaysWaiting = (): number => {
    const created = new Date(caseItem.createdAt);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - created.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysWaiting = getDaysWaiting();

  return (
    <div className={`${styles.tableRow} ${isSelected ? styles.selected : ''}`}>
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
      <div className={styles.tableCell}>
        <StudentInfo
          studentName={caseItem.studentName}
          studentEmail={caseItem.studentEmail}
          studentPhone={caseItem.studentPhone}
        />
      </div>

      {/* Contact - Shows last contact or "No contact" */}
      <div className={styles.tableCell}>
        {caseItem.lastContactDate ? (
          <div>
            Last contact:{' '}
            {new Date(caseItem.lastContactDate).toLocaleDateString('en-ZA')}
          </div>
        ) : (
          <div style={{ color: '#d32f2f', fontWeight: 'bold' }}>
            No contact yet
          </div>
        )}
      </div>

      {/* Debt Amount */}
      <div className={styles.tableCell}>
        <AmountDisplay
          amount={caseItem.debtAmount}
          variant="debt"
        />
      </div>

      {/* Risk Badge */}
      <div className={styles.tableCell}>
        <RiskBadge
          riskBand={caseItem.riskBand}
          riskScore={caseItem.riskScore}
          showScore
        />
      </div>

      {/* Funding Pill */}
      <div className={styles.tableCell}>
        <FundingPill fundingSource={caseItem.fundingSource} />
      </div>

      {/* Days Waiting */}
      <div className={styles.tableCell}>
        <div style={{
          fontWeight: daysWaiting > 30 ? 'bold' : 'normal',
          color: daysWaiting > 30 ? '#d32f2f' : 'inherit',
        }}>
          {daysWaiting} days
        </div>
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
          title="Pick up case"
          onClick={() => {
            // TODO: Open case pickup form
          }}
        >
          ✓
        </button>
      </div>
    </div>
  );
};

export default NotPickedUpTableRow;
