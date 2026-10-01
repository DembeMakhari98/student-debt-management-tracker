/**
 * PickedUpList Component
 *
 * Displays cases that have been picked up and are being actively managed.
 * Cases are sorted by risk score (highest first).
 * Includes pagination support.
 */

import React from 'react';
import { PickedUpListProps } from '../../types/debtTrackerTypes';
import PickedUpListRow from './PickedUpListRow';
import PaginationControl from '../PaginationControl';
import styles from '../../styles/lists.module.css';

/**
 * Picked Up List Component
 *
 * @example
 * <PickedUpList
 *   cases={[
 *     {
 *       id: '1',
 *       studentName: 'John Doe',
 *       studentEmail: 'john@example.com',\n *       studentPhone: '0123456789',\n *       debtAmount: 50000,\n *       fundingSource: 'NSFAS',\n *       riskBand: 'CRITICAL',\n *       riskScore: 85,\n *       status: 'PICKED_UP',\n *       actionTaken: 'Payment Plan Established',\n *       actionDate: '2024-01-15',\n *       lastContactDate: '2024-09-10',\n *       createdAt: '2024-01-01',\n *       updatedAt: '2024-09-10',\n *     },\n *   ]}\n *   isLoading={false}\n *   pagination={{ currentPage: 1, pageSize: 20, totalItems: 15, totalPages: 1, hasNextPage: false, hasPreviousPage: false }}\n *   onPageChange={(page) => console.log('Go to page', page)}\n * />\n */
const PickedUpList: React.FC<PickedUpListProps> = ({
  cases,
  isLoading,
  error,
  pagination,
  onPageChange,
}) => {
  if (error && !isLoading) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>Failed to load picked-up cases: {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.listContainer}>
      {/* List Header */}
      <div className={styles.listHeader}>
        <h2 className={styles.listTitle}>Picked Up Cases</h2>
        <span className={styles.listCount}>{cases?.length || 0} cases</span>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}>Loading...</div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (!cases || cases.length === 0) && (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>No picked-up cases found.</p>
        </div>
      )}

      {/* List Items */}
      {!isLoading && cases && cases.length > 0 && (
        <div className={styles.listContent}>
          <div className={styles.listRows}>
            {cases.map((caseItem) => (
              <PickedUpListRow
                key={caseItem.id}
                case={caseItem}
                onSelect={() => {}} // TODO: Implement case selection
                isSelected={false} // TODO: Connect to selection state
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination && (
            <PaginationControl
              pagination={pagination}
              onPageChange={onPageChange || (() => {})}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default PickedUpList;
