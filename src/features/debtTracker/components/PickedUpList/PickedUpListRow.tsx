/**
 * PickedUpListRow Component
 *
 * Represents a single row in the picked-up cases list.
 * Displays student info, risk badge, funding, signals, action info, and amount.
 */

import React from 'react';
import { PickedUpListRowProps } from '../../types/debtTrackerTypes';
import RiskBadge from './RiskBadge';
import StudentInfo from './StudentInfo';
import FundingPill from './FundingPill';
import SignalChips from './SignalChips';
import ActionInfo from './ActionInfo';
import AmountDisplay from './AmountDisplay';
import styles from '../../styles/lists.module.css';

/**
 * Picked Up List Row Component
 *
 * @example
 * <PickedUpListRow\n *   case={{\n *     id: '1',\n *     studentName: 'John Doe',\n *     studentEmail: 'john@example.com',\n *     studentPhone: '0123456789',\n *     debtAmount: 50000,\n *     fundingSource: 'NSFAS',\n *     riskBand: 'CRITICAL',\n *     riskScore: 85,\n *     status: 'PICKED_UP',\n *     actionTaken: 'Payment Plan',\n *     actionDate: '2024-01-15',\n *     lastContactDate: '2024-09-10',\n *     createdAt: '2024-01-01',\n *     updatedAt: '2024-09-10',\n *   }}\n *   onSelect={(id) => console.log('Selected', id)}\n *   isSelected={false}\n * />\n */
const PickedUpListRow: React.FC<PickedUpListRowProps> = ({
  case: caseItem,
  onSelect,
  isSelected,
}) => {
  /**
   * Calculate days since last contact
   */
  const getDaysSinceContact = (): number | undefined => {
    if (!caseItem.lastContactDate) return undefined;
    const lastContact = new Date(caseItem.lastContactDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastContact.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysSinceContact = getDaysSinceContact();

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

      {/* Risk Badge */}
      <div className={styles.rowCell}>
        <RiskBadge
          riskBand={caseItem.riskBand}
          riskScore={caseItem.riskScore}
          showScore
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

      {/* Signal Chips */}
      <div className={styles.rowCell}>
        <SignalChips
          riskBand={caseItem.riskBand}
          daysNoContact={daysSinceContact}
        />
      </div>

      {/* Action Info */}
      <div className={styles.rowCell}>
        <ActionInfo
          actionTaken={caseItem.actionTaken}
          actionDate={caseItem.actionDate}
        />
      </div>

      {/* Amount Display */}
      <div className={styles.rowCell}>
        <AmountDisplay
          amount={caseItem.debtAmount}
          label="Debt Amount"
          variant="debt"
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
          title="Edit case"
          onClick={() => {
            // TODO: Open case edit form
          }}
        >
          ✎
        </button>
      </div>
    </div>
  );
};

export default PickedUpListRow;
