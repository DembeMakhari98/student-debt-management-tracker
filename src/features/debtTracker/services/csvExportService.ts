/**
 * CSV Export Service
 *
 * Handles transformation of debt cases to RFC 4180 CSV format,
 * filename generation, and browser download triggering.
 *
 * References:
 * - SDD_Issue_17_CSV_Export.md (spec)
 * - TECHNICAL_SPECIFICATION.md Section 6.5 (column order)
 */

import { Case } from '../types/debtTrackerTypes';

/**
 * CSV column headers in exact order (20 columns)
 * References SDD Section 4.3 and Tech Spec Section 6.5
 */
const CSV_HEADERS = [
  'Student ID',
  'Name',
  'Programme',
  'Funding',
  'Funding status',
  'Year',
  'Missed instalments',
  'Last payment',
  'Current',
  '30 days',
  '60 days',
  '90 days',
  '120+ days',
  'Balance',
  'Risk score',
  'Band',
  'Picked up by agent',
  'AI recommendation',
  'Status',
  'Policy',
] as const;

/**
 * Funding source enum mapping to display values
 * Per SDD Section 4.3
 */
const FUNDING_ENUM_MAP: Record<string, string> = {
  NSFAS: 'Government (NSFAS)',
  PRIVATE: 'Private Bursary',
  OTHER: 'Self',
};

/**
 * UTF-8 BOM bytes for Excel compatibility
 */
const UTF8_BOM = '﻿';

/**
 * CSV Line ending (RFC 4180)
 */
const CSV_LINE_ENDING = '\r\n';

/**
 * Quote and escape CSV field value
 * Per RFC 4180: quote all fields, escape internal quotes by doubling
 *
 * @param value - Field value (string, number, or null)
 * @returns Quoted and escaped field
 * @internal
 */
function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }

  const stringValue = String(value);
  // Quote all fields and escape internal quotes by doubling
  return `"${stringValue.replace(/"/g, '""')}"`;
}

/**
 * Transform a single case to CSV row
 * Applies field mappings per SDD Section 4.3
 *
 * @param caseItem - Case to transform
 * @returns Array of CSV field values (already quoted and escaped)
 * @internal
 */
function caseToCSVRow(caseItem: Case): string[] {
  const row: string[] = [];

  // 1. Student ID
  row.push(escapeCSVField(caseItem.id));

  // 2. Name
  row.push(escapeCSVField(caseItem.studentName || ''));

  // 3. Programme (not available in Case type; use empty string)
  row.push(escapeCSVField(''));

  // 4. Funding (map enum to display value)
  const fundingDisplay = FUNDING_ENUM_MAP[caseItem.fundingSource] || caseItem.fundingSource;
  row.push(escapeCSVField(fundingDisplay));

  // 5. Funding status (not available in Case type; use empty string)
  row.push(escapeCSVField(''));

  // 6. Year (not available in Case type; use empty string)
  row.push(escapeCSVField(''));

  // 7. Missed instalments (not available; use empty string)
  row.push(escapeCSVField(''));

  // 8. Last payment (use lastContactDate if available, else empty)
  const lastPayment = caseItem.lastContactDate ? caseItem.lastContactDate : '';
  row.push(escapeCSVField(lastPayment));

  // 9-13. Ageing buckets (Current, 30, 60, 90, 120+)
  // Not available in Case type; use empty strings
  row.push(escapeCSVField(''));
  row.push(escapeCSVField(''));
  row.push(escapeCSVField(''));
  row.push(escapeCSVField(''));
  row.push(escapeCSVField(''));

  // 14. Balance (rowTotal)
  // For credit debtors (REFUND_QUEUE), use negative creditAmount
  // For debt cases, use debtAmount
  let balance = caseItem.debtAmount;
  if (caseItem.status === 'REFUND_QUEUE' && caseItem.creditAmount) {
    balance = -caseItem.creditAmount;
  }
  row.push(escapeCSVField(balance.toFixed(2)));

  // 15. Risk score
  // Empty for credit debtors (per SDD Section 5 Edge Cases)
  const riskScore = caseItem.status === 'REFUND_QUEUE' ? '' : String(caseItem.riskScore);
  row.push(escapeCSVField(riskScore));

  // 16. Band
  // Literal "Credit" for refund queue (credit debtors), else risk band
  const band = caseItem.status === 'REFUND_QUEUE' ? 'Credit' : caseItem.riskBand;
  row.push(escapeCSVField(band));

  // 17. Picked up by agent
  // PICKED_UP status indicates picked up
  const pickedUp = caseItem.status === 'PICKED_UP' ? 'Yes' : 'No';
  row.push(escapeCSVField(pickedUp));

  // 18. AI recommendation (use actionTaken if available)
  row.push(escapeCSVField(caseItem.actionTaken || ''));

  // 19. Status
  // Map case status to display value
  const statusMap: Record<string, string> = {
    PICKED_UP: 'Agent acting',
    REFUND_QUEUE: 'Needs approval',
    NOT_PICKED_UP: 'Monitoring',
  };
  row.push(escapeCSVField(statusMap[caseItem.status] || ''));

  // 20. Policy (not available in Case type; use empty string)
  row.push(escapeCSVField(''));

  return row;
}

/**
 * Generate CSV string from filtered cases
 *
 * Transforms case array to RFC 4180 compliant CSV with:
 * - UTF-8 BOM for Excel compatibility
 * - CRLF line endings
 * - All fields quoted
 * - Proper escaping of commas and quotes
 *
 * @param cases - Array of cases to export
 * @param year - Filter year (for context; not used in transform)
 * @param funding - Filter funding (for context; not used in transform)
 * @returns CSV string with BOM and headers
 *
 * @example
 * const csv = await generateCSVForFilteredCases(cases, '2026', 'gov');
 * // Returns: '﻿"Student ID","Name",...\r\n"STU-001",...\r\n'
 */
export async function generateCSVForFilteredCases(
  cases: Case[],
  year: string,
  funding: string,
): Promise<string> {
  // Start with UTF-8 BOM for Excel compatibility
  let csv = UTF8_BOM;

  // Add header row
  const headerRow = CSV_HEADERS.map((header) => escapeCSVField(header)).join(',');
  csv += headerRow + CSV_LINE_ENDING;

  // Add data rows
  // Performance: for large datasets, process in chunks
  // Current threshold: 10,000 rows (browser safe)
  const CHUNK_SIZE = 10000;

  for (let i = 0; i < cases.length; i += CHUNK_SIZE) {
    const chunk = cases.slice(i, i + CHUNK_SIZE);
    const csvRows = chunk.map((caseItem) => caseToCSVRow(caseItem).join(','));
    csv += csvRows.join(CSV_LINE_ENDING);

    // Add line ending after each chunk (including last)
    if (i + CHUNK_SIZE < cases.length) {
      csv += CSV_LINE_ENDING;
    } else {
      csv += CSV_LINE_ENDING;
    }
  }

  return csv;
}

/**
 * Build CSV filename from filter state
 *
 * Pattern: student-debt-tracker-{year}-{funding}.csv
 *
 * Special cases:
 * - "All years" → "all"
 * - "All funding" → "all"
 * - Spaces replaced with hyphens
 *
 * @param year - Fiscal year or "all" for all years
 * @param funding - Funding source slug or "all" for all funding
 * @returns Filename (e.g., "student-debt-tracker-2026-gov.csv")
 *
 * @example
 * buildCSVFilename('2026', 'gov'); // 'student-debt-tracker-2026-gov.csv'
 * buildCSVFilename('all', 'gov');  // 'student-debt-tracker-all-gov.csv'
 */
export function buildCSVFilename(year: string, funding: string): string {
  // Normalize inputs: convert "All" strings and replace spaces with hyphens
  const normalizedYear = year.toLowerCase().replace(/\s+/g, '-');
  const normalizedFunding = funding.toLowerCase().replace(/\s+/g, '-');

  // Special handling for "all years" and "all funding"
  const yearPart = normalizedYear === 'all-years' || normalizedYear === 'all' ? 'all' : normalizedYear;
  const fundingPart =
    normalizedFunding === 'all-funding' ||
    normalizedFunding === 'all' ||
    normalizedFunding === 'government-(nsfas)' ||
    normalizedFunding === 'government-nsfas'
      ? 'gov'
      : normalizedFunding === 'private-bursary'
        ? 'private'
        : normalizedFunding === 'self'
          ? 'self'
          : normalizedFunding;

  return `student-debt-tracker-${yearPart}-${fundingPart}.csv`;
}

/**
 * Trigger browser download of CSV file
 *
 * Creates a Blob from CSV content and uses URL.createObjectURL
 * to trigger browser download with specified filename.
 *
 * @param csvContent - CSV string (with BOM and CRLF)
 * @param filename - Filename for download (e.g., "student-debt-tracker-2026-gov.csv")
 *
 * @example
 * downloadCSV(csvString, 'student-debt-tracker-2026-gov.csv');
 * // Browser downloads file with given name
 */
export function downloadCSV(csvContent: string, filename: string): void {
  try {
    // Create blob with UTF-8 content type
    // The CSV already contains UTF-8 BOM, so encoding is handled
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Create temporary download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    // Log error for debugging
    console.error('CSV download failed:', error);
    throw new Error(`Failed to download CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
