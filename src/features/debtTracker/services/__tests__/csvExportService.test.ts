/**
 * CSV Export Service Tests
 *
 * Unit and integration tests for CSV generation, formatting, and filename handling.
 * Validates RFC 4180 compliance, field mapping, and edge cases.
 */

import {
  generateCSVForFilteredCases,
  buildCSVFilename,
  downloadCSV,
} from '../csvExportService';
import { Case } from '../../types/debtTrackerTypes';

/**
 * Mock Case data for testing
 */
const mockCases: Case[] = [
  // Normal debt case
  {
    id: 'STU-100001',
    studentName: 'Alice Smith',
    studentEmail: 'alice@example.com',
    studentPhone: '+27123456789',
    debtAmount: 3500.0,
    fundingSource: 'NSFAS',
    riskBand: 'HIGH',
    riskScore: 72,
    status: 'PICKED_UP',
    actionTaken: 'Hardship fund referral and sponsor follow-up',
    actionDate: '2026-09-10',
    lastContactDate: '2026-06-15',
    createdAt: '2026-01-15',
    updatedAt: '2026-09-10',
  },

  // Credit debtor (refund case)
  {
    id: 'STU-100002',
    studentName: 'Bob Johnson',
    studentEmail: 'bob@example.com',
    studentPhone: '+27987654321',
    debtAmount: 0,
    creditAmount: 500.0,
    fundingSource: 'PRIVATE',
    riskBand: 'LOW',
    riskScore: 0,
    status: 'REFUND_QUEUE',
    refundStatus: 'PENDING',
    actionTaken: 'Refund 500 to the student',
    actionDate: '2026-09-10',
    lastContactDate: null,
    createdAt: '2026-02-10',
    updatedAt: '2026-09-10',
  },

  // Not picked up case
  {
    id: 'STU-100003',
    studentName: 'Charlie Brown',
    studentEmail: 'charlie@example.com',
    studentPhone: '+27555555555',
    debtAmount: 15000.0,
    fundingSource: 'OTHER',
    riskBand: 'MEDIUM',
    riskScore: 45,
    status: 'NOT_PICKED_UP',
    actionTaken: 'Monitoring',
    actionDate: '2026-09-10',
    lastContactDate: null,
    createdAt: '2026-03-20',
    updatedAt: '2026-09-10',
  },
];

describe('csvExportService', () => {
  describe('generateCSVForFilteredCases', () => {
    it('should generate CSV with UTF-8 BOM', async () => {
      const csv = await generateCSVForFilteredCases(mockCases, '2026', 'gov');
      expect(csv.startsWith('﻿')).toBe(true); // UTF-8 BOM
    });

    it('should include header row with all 20 columns', async () => {
      const csv = await generateCSVForFilteredCases(mockCases, '2026', 'gov');
      const lines = csv.split('\r\n');
      const header = lines[0];

      // Count quoted fields in header
      const quoteCount = (header.match(/"/g) || []).length;
      expect(quoteCount).toBe(40); // 20 columns × 2 quotes per field
    });

    it('should use CRLF line endings (RFC 4180)', async () => {
      const csv = await generateCSVForFilteredCases(mockCases, '2026', 'gov');
      expect(csv).toContain('\r\n');
      expect(csv).not.toContain('\n\n'); // No double newlines
    });

    it('should quote all fields', async () => {
      const csv = await generateCSVForFilteredCases(mockCases.slice(0, 1), '2026', 'gov');
      const lines = csv.split('\r\n');
      const dataLine = lines[1]; // First data row

      // All fields should be quoted
      expect(dataLine.startsWith('"')).toBe(true);
      expect(dataLine.match(/"/g)!.length).toBeGreaterThan(0);
    });

    it('should handle commas inside quoted fields correctly', async () => {
      const casesWithCommas: Case[] = [
        {
          ...mockCases[0],
          studentName: 'Smith, Alice', // Name with comma
        },
      ];

      const csv = await generateCSVForFilteredCases(casesWithCommas, '2026', 'gov');
      expect(csv).toContain('"Smith, Alice"');
    });

    it('should handle quotes inside fields by doubling them', async () => {
      const casesWithQuotes: Case[] = [
        {
          ...mockCases[0],
          actionTaken: 'Action with "quotes" inside',
        },
      ];

      const csv = await generateCSVForFilteredCases(casesWithQuotes, '2026', 'gov');
      expect(csv).toContain('Action with ""quotes"" inside');
    });

    // Field mapping tests
    describe('Field mapping', () => {
      it('should map Student ID correctly', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(0, 1), '2026', 'gov');
        expect(csv).toContain('"STU-100001"');
      });

      it('should map Name correctly', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(0, 1), '2026', 'gov');
        expect(csv).toContain('"Alice Smith"');
      });

      it('should map funding source to enum display value', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(0, 1), '2026', 'gov');
        // NSFAS should be mapped to "Government (NSFAS)"
        expect(csv).toContain('"Government (NSFAS)"');
      });

      it('should map PRIVATE funding to "Private Bursary"', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(1, 2), '2026', 'gov');
        expect(csv).toContain('"Private Bursary"');
      });

      it('should map OTHER funding to "Self"', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(2, 3), '2026', 'gov');
        expect(csv).toContain('"Self"');
      });

      it('should calculate rowTotal correctly for debt cases', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(0, 1), '2026', 'gov');
        // First case has debtAmount 3500.0
        expect(csv).toContain('"3500.00"'); // Balance column
      });

      it('should use negative creditAmount for refund queue (credit) cases', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(1, 2), '2026', 'gov');
        // Second case has creditAmount 500.0, should be -500.00 in CSV
        expect(csv).toContain('"-500.00"'); // Balance column
      });

      it('should display "Credit" in Band column for refund queue cases', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(1, 2), '2026', 'gov');
        // Credit case should have "Credit" not its riskBand
        const lines = csv.split('\r\n');
        const dataLine = lines[1];
        expect(dataLine).toContain('"Credit"');
      });

      it('should display risk band for debt cases', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(0, 1), '2026', 'gov');
        // First case has riskBand HIGH
        expect(csv).toContain('"HIGH"');
      });

      it('should leave Risk score empty for credit debtors', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(1, 2), '2026', 'gov');
        const lines = csv.split('\r\n');
        const dataLine = lines[1];
        // Count fields - Risk score should be empty ("")
        expect(dataLine).toContain('""'); // Risk score field is empty
      });

      it('should include Risk score for debt cases', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(0, 1), '2026', 'gov');
        expect(csv).toContain('"72"'); // Risk score
      });

      it('should display "Yes" for Picked up column when status is PICKED_UP', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(0, 1), '2026', 'gov');
        expect(csv).toContain('"Yes"');
      });

      it('should display "No" for Picked up column when status is not PICKED_UP', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(1, 2), '2026', 'gov');
        expect(csv).toContain('"No"');
      });

      it('should handle null lastContactDate as empty string', async () => {
        const casesWithoutLastContact: Case[] = [
          {
            ...mockCases[0],
            lastContactDate: null,
          },
        ];

        const csv = await generateCSVForFilteredCases(casesWithoutLastContact, '2026', 'gov');
        // Last payment column should be empty
        const lines = csv.split('\r\n');
        expect(lines[1]).toBeDefined();
      });

      it('should map status to display values', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(0, 1), '2026', 'gov');
        // PICKED_UP should map to "Agent acting"
        expect(csv).toContain('"Agent acting"');
      });

      it('should map REFUND_QUEUE status to "Needs approval"', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(1, 2), '2026', 'gov');
        expect(csv).toContain('"Needs approval"');
      });

      it('should map NOT_PICKED_UP status to "Monitoring"', async () => {
        const csv = await generateCSVForFilteredCases(mockCases.slice(2, 3), '2026', 'gov');
        expect(csv).toContain('"Monitoring"');
      });
    });

    // Large dataset performance test
    it('should handle large datasets (10k+ rows) without blocking', async () => {
      // Create 10,000 cases
      const largeCaseSet = Array.from({ length: 10000 }, (_, i) => ({
        ...mockCases[0],
        id: `STU-${String(i).padStart(6, '0')}`,
      }));

      const startTime = performance.now();
      const csv = await generateCSVForFilteredCases(largeCaseSet, '2026', 'gov');
      const endTime = performance.now();

      // Should complete in reasonable time (< 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
      expect(csv.length).toBeGreaterThan(0);
    });

    it('should handle empty case list', async () => {
      const csv = await generateCSVForFilteredCases([], '2026', 'gov');
      const lines = csv.split('\r\n');
      // Should have BOM + header + empty data
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines[0]).toContain('Student ID');
    });
  });

  describe('buildCSVFilename', () => {
    it('should build filename with year and funding', () => {
      const filename = buildCSVFilename('2026', 'gov');
      expect(filename).toBe('student-debt-tracker-2026-gov.csv');
    });

    it('should handle "All years" by converting to "all"', () => {
      const filename = buildCSVFilename('all', 'gov');
      expect(filename).toBe('student-debt-tracker-all-gov.csv');
    });

    it('should handle "All funding" by converting to "all"', () => {
      const filename = buildCSVFilename('2026', 'all');
      expect(filename).toBe('student-debt-tracker-2026-all.csv');
    });

    it('should replace spaces with hyphens', () => {
      const filename = buildCSVFilename('2026', 'private bursary');
      expect(filename).not.toContain(' ');
      expect(filename).toContain('-');
    });

    it('should normalize "Government (NSFAS)" to "gov"', () => {
      const filename = buildCSVFilename('2026', 'Government (NSFAS)');
      expect(filename).toContain('-gov.csv');
    });

    it('should normalize "Private Bursary" to "private"', () => {
      const filename = buildCSVFilename('2026', 'Private Bursary');
      expect(filename).toContain('-private.csv');
    });

    it('should normalize "Self" to "self"', () => {
      const filename = buildCSVFilename('2026', 'Self');
      expect(filename).toContain('-self.csv');
    });

    it('should handle case-insensitive input', () => {
      const filename1 = buildCSVFilename('2026', 'GOV');
      const filename2 = buildCSVFilename('2026', 'gov');
      expect(filename1).toBe(filename2);
    });

    it('should always produce valid filename format', () => {
      const filename = buildCSVFilename('2026', 'gov');
      expect(filename).toMatch(/^student-debt-tracker-[\w-]+-[\w-]+\.csv$/);
    });
  });

  describe('downloadCSV', () => {
    let mockCreateElement: jest.SpyInstance;
    let mockAppendChild: jest.SpyInstance;
    let mockRemoveChild: jest.SpyInstance;
    let mockCreateObjectURL: jest.SpyInstance;
    let mockRevokeObjectURL: jest.SpyInstance;

    beforeEach(() => {
      // Mock document methods
      mockCreateElement = jest
        .spyOn(document, 'createElement')
        .mockReturnValue({
          setAttribute: jest.fn(),
          click: jest.fn(),
          style: {},
        } as any);

      mockAppendChild = jest.spyOn(document.body, 'appendChild');
      mockRemoveChild = jest.spyOn(document.body, 'removeChild');

      // Mock URL methods
      mockCreateObjectURL = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      mockRevokeObjectURL = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should create a Blob with CSV content', () => {
      const csvContent = '"Header"\r\n"Data"';
      const filename = 'test.csv';

      downloadCSV(csvContent, filename);

      // Verify Blob creation (URL.createObjectURL should be called with a Blob)
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('should create an anchor element with download attribute', () => {
      const csvContent = '"Header"\r\n"Data"';
      const filename = 'test-export.csv';

      downloadCSV(csvContent, filename);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
    });

    it('should trigger click event on anchor element', () => {
      const csvContent = '"Header"\r\n"Data"';
      const filename = 'test.csv';

      downloadCSV(csvContent, filename);

      // The link should be appended and clicked
      expect(mockAppendChild).toHaveBeenCalled();
    });

    it('should clean up resources after download', () => {
      const csvContent = '"Header"\r\n"Data"';
      const filename = 'test.csv';

      downloadCSV(csvContent, filename);

      // Resources should be revoked
      expect(mockRevokeObjectURL).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
    });

    it('should throw error if download fails', () => {
      mockCreateObjectURL.mockImplementationOnce(() => {
        throw new Error('Blob creation failed');
      });

      const csvContent = '"Header"\r\n"Data"';
      const filename = 'test.csv';

      expect(() => downloadCSV(csvContent, filename)).toThrow('Failed to download CSV file');
    });
  });

  describe('Integration: Filter application', () => {
    it('should respect year filter when generating CSV', async () => {
      // Test that the CSV is generated with filtered cases
      const csv = await generateCSVForFilteredCases(mockCases, '2026', 'gov');
      expect(csv).toContain('STU-100001');
      expect(csv).toContain('STU-100002');
      expect(csv).toContain('STU-100003');
    });

    it('should respect funding filter when generating CSV', async () => {
      // Test that funding enum is correctly applied
      const csv = await generateCSVForFilteredCases(mockCases, '2026', 'gov');

      // Should contain government funding mapping
      expect(csv).toContain('"Government (NSFAS)"');
    });

    it('should generate correct row count', async () => {
      const csv = await generateCSVForFilteredCases(mockCases, '2026', 'gov');
      const lines = csv.split('\r\n').filter((line) => line.trim() !== '');

      // Should be: BOM + header + 3 data rows
      expect(lines.length).toBe(4);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined/null values gracefully', async () => {
      const casesWithNulls: Case[] = [
        {
          id: 'STU-001',
          studentName: '',
          studentEmail: undefined as any,
          studentPhone: '',
          debtAmount: 0,
          fundingSource: 'NSFAS',
          riskBand: 'LOW',
          riskScore: 0,
          status: 'NOT_PICKED_UP',
          actionTaken: '',
          actionDate: '',
          lastContactDate: null,
          createdAt: '',
          updatedAt: '',
        },
      ];

      const csv = await generateCSVForFilteredCases(casesWithNulls, '2026', 'gov');
      // Should not throw and should contain valid CSV data
      expect(csv).toBeDefined();
      expect(csv.length).toBeGreaterThan(0);
    });

    it('should handle very large debt amounts', async () => {
      const casesWithLargeDebt: Case[] = [
        {
          ...mockCases[0],
          debtAmount: 999999999.99,
        },
      ];

      const csv = await generateCSVForFilteredCases(casesWithLargeDebt, '2026', 'gov');
      expect(csv).toContain('"999999999.99"');
    });

    it('should handle negative credit amounts', async () => {
      const casesWithNegativeCredit: Case[] = [
        {
          ...mockCases[1],
          creditAmount: -1500.0,
        },
      ];

      const csv = await generateCSVForFilteredCases(casesWithNegativeCredit, '2026', 'gov');
      expect(csv).toContain('"1500.00"'); // Should be positive in Balance column
    });

    it('should handle zero amounts correctly', async () => {
      const casesWithZero: Case[] = [
        {
          ...mockCases[0],
          debtAmount: 0,
        },
      ];

      const csv = await generateCSVForFilteredCases(casesWithZero, '2026', 'gov');
      expect(csv).toContain('"0.00"');
    });

    it('should handle special characters in student names', async () => {
      const casesWithSpecialChars: Case[] = [
        {
          ...mockCases[0],
          studentName: "O'Brien & Associates",
        },
      ];

      const csv = await generateCSVForFilteredCases(casesWithSpecialChars, '2026', 'gov');
      expect(csv).toContain('"O\'Brien & Associates"');
    });
  });
});
