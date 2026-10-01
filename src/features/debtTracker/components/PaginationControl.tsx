/**
 * PaginationControl Component
 *
 * Handles pagination navigation for lists.
 * Displays current page info and provides previous/next buttons.
 */

import React from 'react';
import { PaginationControlProps } from '../types/debtTrackerTypes';
import styles from '../styles/lists.module.css';

/**
 * Pagination Control Component
 *
 * @example
 * <PaginationControl
 *   pagination={{
 *     currentPage: 2,
 *     pageSize: 20,
 *     totalItems: 65,
 *     totalPages: 4,
 *     hasNextPage: true,
 *     hasPreviousPage: true,
 *   }}
 *   onPageChange={(page) => console.log('Go to page', page)}\n *   variant="default"\n * />\n */
const PaginationControl: React.FC<PaginationControlProps> = ({
  pagination,
  onPageChange,
  variant = 'default',
}) => {
  const {
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    totalItems,
    pageSize,
  } = pagination;

  /**
   * Handle previous button click
   */
  const handlePrevious = () => {
    if (hasPreviousPage) {
      onPageChange(currentPage - 1);
    }
  };

  /**
   * Handle next button click
   */
  const handleNext = () => {
    if (hasNextPage) {
      onPageChange(currentPage + 1);
    }
  };

  /**
   * Handle page number click
   */
  const handlePageNumber = (page: number) => {
    onPageChange(page);
  };

  // Calculate start and end item numbers for display
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (variant === 'compact') {
    return (
      <div className={styles.paginationCompact}>
        <button
          onClick={handlePrevious}
          disabled={!hasPreviousPage}
          className={styles.paginationButton}
          title="Previous page"
        >
          ← Previous
        </button>

        <span className={styles.paginationInfo}>
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={handleNext}
          disabled={!hasNextPage}
          className={styles.paginationButton}
          title="Next page"
        >
          Next →
        </button>
      </div>
    );
  }

  return (
    <div className={styles.paginationContainer}>
      <div className={styles.paginationInfo}>
        Showing {startItem} to {endItem} of {totalItems} items
      </div>

      <div className={styles.paginationControls}>
        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          disabled={!hasPreviousPage}
          className={styles.paginationButton}
          title="Previous page"
        >
          ← Previous
        </button>

        {/* Page Numbers */}
        <div className={styles.pageNumbers}>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            // TODO: Implement smarter page number display for large page counts
            // Currently shows up to 5 pages. For more pages, show: 1 ... X Y Z ... Total
            return (
              <button
                key={i + 1}
                onClick={() => handlePageNumber(i + 1)}
                className={`${styles.pageNumber} ${
                  currentPage === i + 1 ? styles.active : ''
                }`}
                disabled={totalPages === 1}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={!hasNextPage}
          className={styles.paginationButton}
          title="Next page"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default PaginationControl;
