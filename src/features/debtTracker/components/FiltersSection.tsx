/**
 * FiltersSection Component
 *
 * Provides filtering UI for the debt tracker workspace.
 * Allows users to filter by year, funding source, risk band, and search.
 */

import React, { useState } from 'react';
import { FiltersSectionProps } from '../types/debtTrackerTypes';
import styles from '../styles/debtTrackerWorkspace.module.css';

/**
 * Filters Section Component
 *
 * @example
 * <FiltersSection
 *   filters={{ fundingSource: 'NSFAS', yearFrom: 2023 }}
 *   onFilterChange={(newFilters) => console.log('Filters changed', newFilters)}
 *   isLoading={false}
 * />
 */
const FiltersSection: React.FC<FiltersSectionProps> = ({
  filters,
  onFilterChange,
  isLoading = false,
}) => {
  const [yearFrom, setYearFrom] = useState(filters.yearFrom || 2023);
  const [yearTo, setYearTo] = useState(filters.yearTo || new Date().getFullYear());
  const [fundingSource, setFundingSource] = useState(filters.fundingSource || 'ALL');
  const [searchQuery, setSearchQuery] = useState(filters.searchQuery || '');

  /**
   * Handle filter changes
   */
  const handleApplyFilters = () => {
    onFilterChange({
      yearFrom,
      yearTo,
      fundingSource: fundingSource === 'ALL' ? undefined : fundingSource,
      searchQuery,
    });
  };

  /**
   * Reset all filters
   */
  const handleResetFilters = () => {
    setYearFrom(2023);
    setYearTo(new Date().getFullYear());
    setFundingSource('ALL');
    setSearchQuery('');
    onFilterChange({});
  };

  return (
    <section className={styles.filtersSection}>
      <div className={styles.filterContainer}>
        {/* Year Filter */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Year Range</label>
          <div className={styles.filterInputGroup}>
            <input
              type="number"
              min="2000"
              max={new Date().getFullYear()}
              value={yearFrom}
              onChange={(e) => setYearFrom(parseInt(e.target.value))}
              className={styles.filterInput}
              placeholder="From"
              disabled={isLoading}
            />
            <span className={styles.filterSeparator}>to</span>
            <input
              type="number"
              min="2000"
              max={new Date().getFullYear()}
              value={yearTo}
              onChange={(e) => setYearTo(parseInt(e.target.value))}
              className={styles.filterInput}
              placeholder="To"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Funding Source Filter */}
        <div className={styles.filterGroup}>
          <label htmlFor="fundingFilter" className={styles.filterLabel}>
            Funding Source
          </label>
          <select
            id="fundingFilter"
            value={fundingSource}
            onChange={(e) => setFundingSource(e.target.value)}
            className={styles.filterSelect}
            disabled={isLoading}
          >
            <option value="ALL">All Sources</option>
            <option value="NSFAS">NSFAS</option>
            <option value="PRIVATE">Private</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* Search Filter */}
        <div className={styles.filterGroup}>
          <label htmlFor="searchFilter" className={styles.filterLabel}>
            Search
          </label>
          <input
            id="searchFilter"
            type="text"
            placeholder="Student name or ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.filterInput}
            disabled={isLoading}
          />
        </div>

        {/* TODO: Add Risk Band filter */}
        {/* TODO: Add Status filter */}

        {/* Action Buttons */}
        <div className={styles.filterActions}>
          <button
            className={styles.filterButton}
            onClick={handleApplyFilters}
            disabled={isLoading}
          >
            {isLoading ? 'Applying...' : 'Apply Filters'}
          </button>
          <button
            className={styles.filterButtonSecondary}
            onClick={handleResetFilters}
            disabled={isLoading}
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  );
};

export default FiltersSection;
