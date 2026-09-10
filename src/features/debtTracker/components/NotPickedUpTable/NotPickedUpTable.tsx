/**
 * NotPickedUpTable Component
 *
 * Displays cases that have not yet been picked up (engaged).
 * Cases are sorted by creation date (oldest first - FIFO).
 * Includes pagination support.
 */

import React from 'react';
import { NotPickedUpTableProps } from '../../types/debtTrackerTypes';
import NotPickedUpTableRow from './NotPickedUpTableRow';
import PaginationControl from '../PaginationControl';
import styles from '../../styles/lists.module.css';

/**
 * Not Picked Up Table Component
 *
 * @example
 * <NotPickedUpTable\n *   cases={[\n *     {\n *       id: '3',\n *       studentName: 'Bob Wilson',\n *       studentEmail: 'bob@example.com',\n *       studentPhone: '0555555555',\n *       debtAmount: 25000,\n *       fundingSource: 'PRIVATE',\n *       riskBand: 'MEDIUM',\n *       riskScore: 55,\n *       status: 'NOT_PICKED_UP',\n *       actionTaken: 'Initial outreach pending',\n *       actionDate: '2024-09-10',\n *       lastContactDate: null,\n *       createdAt: '2024-09-01',\n *       updatedAt: '2024-09-10',\n *     },\n *   ]}\n *   isLoading={false}\n *   pagination={{ currentPage: 1, pageSize: 20, totalItems: 42, totalPages: 3, hasNextPage: true, hasPreviousPage: false }}\n *   onPageChange={(page) => console.log('Go to page', page)}\n * />\n */
const NotPickedUpTable: React.FC<NotPickedUpTableProps> = ({
  cases,
  isLoading,
  error,
  pagination,
  onPageChange,
}) => {
  if (error && !isLoading) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>Failed to load not-picked-up cases: {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.listContainer}>
      {/* List Header */}
      <div className={styles.listHeader}>
        <h2 className={styles.listTitle}>Not Picked Up</h2>
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
          <p className={styles.emptyStateText}>No not-picked-up cases found.</p>
        </div>
      )}

      {/* List Items */}
      {!isLoading && cases && cases.length > 0 && (
        <div className={styles.listContent}>
          <div className={styles.tableHeader}>
            <div className={styles.tableHeaderCell}>Student</div>
            <div className={styles.tableHeaderCell}>Contact</div>
            <div className={styles.tableHeaderCell}>Debt Amount</div>
            <div className={styles.tableHeaderCell}>Risk</div>
            <div className={styles.tableHeaderCell}>Funding</div>
            <div className={styles.tableHeaderCell}>Days Waiting</div>
            <div className={styles.tableHeaderCell}>Actions</div>
          </div>

          <div className={styles.listRows}>
            {cases.map((caseItem) => (
              <NotPickedUpTableRow
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

export default NotPickedUpTable;
