/**
 * WorkspaceHeader Component
 *
 * Header section displaying workspace statistics and controls.
 * Shows summary metrics and refresh button.
 */

import React, { useState } from 'react';
import { WorkspaceHeaderProps } from '../types/debtTrackerTypes';
import styles from '../styles/debtTrackerWorkspace.module.css';

/**
 * Workspace Header Component
 *
 * Displays key statistics and provides refresh functionality.
 *
 * @example
 * <WorkspaceHeader
 *   stats={{
 *     totalCases: 65,
 *     pickedUpCount: 15,
 *     refundQueueCount: 8,
 *     notPickedUpCount: 42,
 *     totalDebtAmount: 125000,
 *     criticalRiskCount: 3,
 *     averageRiskScore: 45,
 *   }}
 *   onRefresh={() => console.log('Refreshing...')}
 * />
 */
const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({ stats, onRefresh }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Handle refresh button click
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!stats) {
    return null;
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        {/* Title */}
        <div className={styles.headerTitle}>
          <h1 className={styles.mainTitle}>Debt Management Tracker</h1>
          <p className={styles.subtitle}>Manage and track student debt cases</p>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          {/* Total Cases */}
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Cases</span>
            <span className={styles.statValue}>{stats.totalCases}</span>
          </div>

          {/* Picked Up */}
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Picked Up</span>
            <span className={styles.statValue}>{stats.pickedUpCount}</span>
          </div>

          {/* Refund Queue */}
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Refund Queue</span>
            <span className={styles.statValue}>{stats.refundQueueCount}</span>
          </div>

          {/* Not Picked Up */}
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Not Picked Up</span>
            <span className={styles.statValue}>{stats.notPickedUpCount}</span>
          </div>

          {/* Total Debt Amount */}
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Debt</span>
            <span className={styles.statValue}>
              {new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR',
                minimumFractionDigits: 0,
              }).format(stats.totalDebtAmount)}
            </span>
          </div>

          {/* Critical Risk Count */}
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Critical Risk</span>
            <span className={`${styles.statValue} ${styles.criticalValue}`}>
              {stats.criticalRiskCount}
            </span>
          </div>

          {/* Average Risk Score */}
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Avg Risk Score</span>
            <span className={styles.statValue}>{stats.averageRiskScore}</span>
          </div>
        </div>

        {/* Controls */}
        <div className={styles.headerControls}>
          <button
            className={styles.refreshButton}
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh data"
          >
            {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default WorkspaceHeader;
