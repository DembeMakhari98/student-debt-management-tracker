/**
 * Export Button Component
 *
 * Renders export to CSV button with loading state and error handling.
 * Integrated into WorkspaceHeader for global access.
 *
 * Features:
 * - Disabled when no cases to export
 * - Shows loading state during CSV generation
 * - Error handling with user feedback
 * - Respects current filter state (year, funding)
 */

import React, { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Case, DebtTrackerFilter } from '../types/debtTrackerTypes';
import { selectFilters } from '../redux/debtTrackerSelectors';
import { generateCSVForFilteredCases, buildCSVFilename, downloadCSV } from '../services/csvExportService';

/**
 * Props for ExportButton component
 */
export interface ExportButtonProps {
  /** Array of cases to export (filtered) */
  cases: Case[];
  /** Optional CSS class name for styling */
  className?: string;
}

/**
 * Export Button Component
 *
 * Renders a button that triggers CSV export of filtered cases.
 * Handles loading state, error reporting, and file download.
 *
 * The button is disabled when there are no cases to export.
 * During export, it shows a loading indicator.
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * <ExportButton cases={filteredCases} className="header-button" />
 */
const ExportButton: React.FC<ExportButtonProps> = ({ cases, className = '' }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useDispatch();
  const filters = useSelector(selectFilters);

  /**
   * Handle export button click
   * Generates CSV from filtered cases and triggers download
   */
  const handleExport = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Get year and funding from filters
      // Fallback to "all" if not specified
      const year = filters.yearFrom ? String(filters.yearFrom) : 'all';
      const fundingSource = filters.fundingSource || 'all';

      // Generate CSV content
      const csvContent = await generateCSVForFilteredCases(cases, year, fundingSource);

      // Build filename from filters
      const filename = buildCSVFilename(year, fundingSource);

      // Trigger browser download
      downloadCSV(csvContent, filename);

      // Optional: Log success for analytics
      console.log(`CSV exported successfully: ${filename} (${cases.length} cases)`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export CSV';
      setError(errorMessage);
      console.error('CSV export error:', err);

      // Show user-friendly error message
      // In production, this could be a toast notification
      alert(`Export failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [cases, filters, dispatch]);

  // Disable button when no cases to export
  const isDisabled = cases.length === 0 || isLoading;

  return (
    <div className={`export-button-container ${className || ''}`}>
      <button
        className={`export-button ${isLoading ? 'loading' : ''} ${isDisabled ? 'disabled' : ''}`}
        onClick={handleExport}
        disabled={isDisabled}
        title={cases.length === 0 ? 'No cases to export' : 'Export filtered data to CSV'}
        aria-label="Export to CSV"
      >
        {isLoading ? (
          <>
            <span className="export-icon loading-icon">⏳</span>
            <span className="export-text">Exporting...</span>
          </>
        ) : (
          <>
            <span className="export-icon">⬇️</span>
            <span className="export-text">Export to CSV</span>
          </>
        )}
      </button>

      {/* Error message display */}
      {error && (
        <div className="export-error-message" role="alert">
          {error}
        </div>
      )}

      {/* Inline styles for component (can be moved to CSS module) */}
      <style>{`
        .export-button-container {
          display: inline-block;
          position: relative;
        }

        .export-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          background-color: #f5f5f5;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #333;
          transition: all 0.2s ease;
        }

        .export-button:hover:not(:disabled) {
          background-color: #efefef;
          border-color: #999;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .export-button:active:not(:disabled) {
          background-color: #e9e9e9;
        }

        .export-button.disabled,
        .export-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .export-button.loading {
          opacity: 0.8;
        }

        .export-icon {
          font-size: 16px;
          display: inline-block;
        }

        .export-icon.loading-icon {
          animation: spin 1s linear infinite;
        }

        .export-text {
          white-space: nowrap;
        }

        .export-error-message {
          color: #d32f2f;
          font-size: 12px;
          margin-top: 4px;
          padding: 4px 8px;
          background-color: #ffebee;
          border-radius: 3px;
          border-left: 3px solid #d32f2f;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .export-button {
            padding: 6px 10px;
            font-size: 13px;
          }

          .export-icon {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
};

export default ExportButton;
