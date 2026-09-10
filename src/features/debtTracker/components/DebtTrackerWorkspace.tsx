/**
 * DebtTrackerWorkspace Component
 *
 * Main workspace component for the Debt Management Tracker feature.
 * Coordinates all sub-components and manages the overall layout.
 *
 * Renders three main sections:
 * - Header with statistics and controls
 * - Filters section
 * - Three data lists (Picked Up, Refund Queue, Not Picked Up)
 */

import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  selectPickedUpCasesByPage,
  selectRefundQueueCasesByPage,
  selectNotPickedUpCasesByPage,
  selectLoading,
  selectError,
  selectWorkspaceStats,
} from '../redux';
import { useCases, useDebtTrackerFilters, useResponsiveBreakpoint } from '../hooks';
import { DebtTrackerWorkspaceProps } from '../types/debtTrackerTypes';
import WorkspaceHeader from './WorkspaceHeader';
import FiltersSection from './FiltersSection';
import { PickedUpList } from './PickedUpList';
import { RefundQueueList } from './RefundQueueList';
import { NotPickedUpTable } from './NotPickedUpTable';
import styles from '../styles/debtTrackerWorkspace.module.css';

/**
 * Main Debt Tracker Workspace Component
 *
 * @example
 * <DebtTrackerWorkspace initialFilters={{ fundingSource: 'NSFAS' }} />
 */
const DebtTrackerWorkspace: React.FC<DebtTrackerWorkspaceProps> = ({ initialFilters }) => {
  // Fetch cases from Redux/API
  const { loading, error, refetch } = useCases();

  // Get data from Redux
  const pickedUpCases = useSelector(selectPickedUpCasesByPage);
  const refundQueueCases = useSelector(selectRefundQueueCasesByPage);
  const notPickedUpCases = useSelector(selectNotPickedUpCasesByPage);
  const stats = useSelector(selectWorkspaceStats);
  const isLoading = useSelector(selectLoading);

  // Get filter hook
  const { filters } = useDebtTrackerFilters();

  // Get responsive breakpoint
  const { isXs, isSm } = useResponsiveBreakpoint();

  // TODO: Apply initialFilters if provided on component mount

  // Memoize loading state for performance
  const showLoading = useMemo(() => isLoading || loading, [isLoading, loading]);

  return (
    <div className={styles.workspace}>
      {/* Header Section */}
      <WorkspaceHeader stats={stats} onRefresh={refetch} />

      {/* Main Content Container */}
      <div className={styles.mainContent}>
        {/* Filters Section */}
        <div className={styles.filtersContainer}>
          <FiltersSection filters={filters} onFilterChange={() => {}} isLoading={showLoading} />
        </div>

        {/* Error Message */}
        {error && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorIcon}>⚠️</span>
            <span className={styles.errorText}>{error}</span>
            <button className={styles.errorClose} onClick={() => {}}>
              ✕
            </button>
          </div>
        )}

        {/* Lists Container */}
        <div className={styles.listsContainer}>
          {/* Picked Up List */}
          <section className={styles.listSection}>
            <PickedUpList
              cases={pickedUpCases}
              isLoading={showLoading}
              error={error}
              pagination={undefined} // TODO: Connect pagination from Redux
              onPageChange={() => {}}
            />
          </section>

          {/* Refund Queue List */}
          <section className={styles.listSection}>
            <RefundQueueList
              cases={refundQueueCases}
              isLoading={showLoading}
              error={error}
              pagination={undefined} // TODO: Connect pagination from Redux
              onPageChange={() => {}}
            />
          </section>

          {/* Not Picked Up Table */}
          <section className={styles.listSection}>
            <NotPickedUpTable
              cases={notPickedUpCases}
              isLoading={showLoading}
              error={error}
              pagination={undefined} // TODO: Connect pagination from Redux
              onPageChange={() => {}}
            />
          </section>
        </div>
      </div>
    </div>
  );
};

export default DebtTrackerWorkspace;
