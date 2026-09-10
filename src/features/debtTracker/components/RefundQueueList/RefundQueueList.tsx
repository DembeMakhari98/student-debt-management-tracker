/**
 * RefundQueueList Component
 *
 * Displays cases waiting for refund processing.
 * Cases are sorted by credit amount (smallest first).
 * Includes pagination support.
 */

import React from 'react';
import { RefundQueueListProps } from '../../types/debtTrackerTypes';
import RefundQueueListRow from './RefundQueueListRow';
import PaginationControl from '../PaginationControl';
import styles from '../../styles/lists.module.css';

/**
 * Refund Queue List Component
 *
 * @example
 * <RefundQueueList
 *   cases={[\n *     {\n *       id: '2',\n *       studentName: 'Jane Smith',\n *       studentEmail: 'jane@example.com',\n *       studentPhone: '0987654321',\n *       debtAmount: 0,\n *       creditAmount: 3500,\n *       fundingSource: 'NSFAS',\n *       riskBand: 'LOW',\n *       riskScore: 15,\n *       status: 'REFUND_QUEUE',\n *       refundStatus: 'PENDING',\n *       actionTaken: 'Credit processed',\n *       actionDate: '2024-09-01',\n *       lastContactDate: null,\n *       createdAt: '2024-08-15',\n *       updatedAt: '2024-09-10',\n *     },\n *   ]}\n *   isLoading={false}\n *   pagination={{ currentPage: 1, pageSize: 20, totalItems: 8, totalPages: 1, hasNextPage: false, hasPreviousPage: false }}\n *   onPageChange={(page) => console.log('Go to page', page)}\n * />\n */
const RefundQueueList: React.FC<RefundQueueListProps> = ({
  cases,
  isLoading,
  error,
  pagination,
  onPageChange,
}) => {
  if (error && !isLoading) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>Failed to load refund queue: {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.listContainer}>
      {/* List Header */}
      <div className={styles.listHeader}>
        <h2 className={styles.listTitle}>Refund Queue</h2>
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
          <p className={styles.emptyStateText}>No refund queue cases found.</p>
        </div>
      )}

      {/* List Items */}
      {!isLoading && cases && cases.length > 0 && (
        <div className={styles.listContent}>
          <div className={styles.listRows}>
            {cases.map((caseItem) => (
              <RefundQueueListRow
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

export default RefundQueueList;
