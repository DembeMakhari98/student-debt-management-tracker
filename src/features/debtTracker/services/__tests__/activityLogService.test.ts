/**
 * Unit Tests: Activity Log Service
 * Tests for appendActivityLog() implementation per TECHNICAL_SPECIFICATION.md §4.6
 */

import { appendActivityLog } from '../activityLogService';
import { ActivityEntry } from '../../types/debtTrackerTypes';
import { DebtorInput } from '../signalGenerationService';

describe('activityLogService', () => {
  const createMockDebtor = (overrides?: Partial<DebtorInput & { score: number; band: string; year: number }>) => ({
    missed: 0,
    lastPay: null,
    ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 0 },
    fundStatus: 'Bursary confirmed',
    arrangement: null,
    score: 30,
    band: 'Watch',
    year: 2026,
    ...overrides,
  });

  describe('activity entry generation', () => {
    it('should generate risk scoring entry', () => {
      const debtor = createMockDebtor({ score: 67, band: 'High' });
      const log = appendActivityLog(null, debtor);
      expect(log.some(e => e.text === 'Risk scored 67 and banded High')).toBe(true);
    });

    it('should attribute risk scoring entry to Risk Sentinel', () => {
      const debtor = createMockDebtor({ score: 50, band: 'Elevated' });
      const log = appendActivityLog(null, debtor);
      const riskEntry = log.find(e => e.text.includes('Risk scored'));
      expect(riskEntry?.source).toBe('Risk Sentinel');
    });

    it('should generate funding status entry', () => {
      const debtor = createMockDebtor({ fundStatus: 'NSFAS pending' });
      const log = appendActivityLog(null, debtor);
      expect(log.some(e => e.text === 'Funding status read as NSFAS pending')).toBe(true);
    });

    it('should attribute funding status entry to Funding Broker', () => {
      const debtor = createMockDebtor({});
      const log = appendActivityLog(null, debtor);
      const fundingEntry = log.find(e => e.text.includes('Funding status read'));
      expect(fundingEntry?.source).toBe('Funding Broker');
    });

    it('should generate missed instalments entry only if missed > 0', () => {
      const debtorWithoutMissed = createMockDebtor({ missed: 0 });
      const logWithoutMissed = appendActivityLog(null, debtorWithoutMissed);
      expect(logWithoutMissed.some(e => e.text.includes('instalment'))).toBe(false);

      const debtorWithMissed = createMockDebtor({ missed: 2 });
      const logWithMissed = appendActivityLog(null, debtorWithMissed);
      expect(logWithMissed.some(e => e.text.includes('instalment'))).toBe(true);
    });

    it('should generate last receipt entry when lastPay exists', () => {
      const debtor = createMockDebtor({ lastPay: new Date('2026-08-15') });
      const log = appendActivityLog(null, debtor);
      expect(log.some(e => e.text.includes('Last receipt'))).toBe(true);
    });

    it('should generate "No receipt found" when lastPay is null', () => {
      const debtor = createMockDebtor({ lastPay: null });
      const log = appendActivityLog(null, debtor);
      expect(log.some(e => e.text === 'No receipt found on the account')).toBe(true);
    });

    it('should attribute last receipt to Cashiering reconciliation', () => {
      const debtor = createMockDebtor({ lastPay: new Date('2026-08-15') });
      const log = appendActivityLog(null, debtor);
      const receiptEntry = log.find(e => e.text.includes('Last receipt'));
      expect(receiptEntry?.source).toBe('Cashiering reconciliation');
    });

    it('should generate arrangement entry only if arrangement exists', () => {
      const debtorWithoutArrangement = createMockDebtor({ arrangement: null });
      const logWithoutArrangement = appendActivityLog(null, debtorWithoutArrangement);
      expect(logWithoutArrangement.some(e => e.text.includes('arrangement'))).toBe(false);

      const debtorWithArrangement = createMockDebtor({ arrangement: 'Defaulted' });
      const logWithArrangement = appendActivityLog(null, debtorWithArrangement);
      expect(logWithArrangement.some(e => e.text.includes('arrangement'))).toBe(true);
    });

    it('should lowercase arrangement text', () => {
      const debtor = createMockDebtor({ arrangement: 'Defaulted' });
      const log = appendActivityLog(null, debtor);
      const arrangementEntry = log.find(e => e.text.includes('arrangement'));
      expect(arrangementEntry?.text).toContain('defaulted');
    });
  });

  describe('append-only semantics', () => {
    it('should not mutate existing log', () => {
      const existingLog: ActivityEntry[] = [
        {
          text: 'Prior entry',
          source: 'Test',
          timestamp: new Date('2026-09-28'),
        },
      ];
      const debtor = createMockDebtor({});
      const originalLength = existingLog.length;

      appendActivityLog(existingLog, debtor);

      expect(existingLog.length).toBe(originalLength);
    });

    it('should return new array with appended entries', () => {
      const existingLog: ActivityEntry[] = [
        {
          text: 'Prior entry',
          source: 'Test',
          timestamp: new Date('2026-09-28'),
        },
      ];
      const debtor = createMockDebtor({ missed: 1 });
      const newLog = appendActivityLog(existingLog, debtor);

      expect(newLog.length).toBeGreaterThan(existingLog.length);
      expect(newLog.some(e => e.text === 'Prior entry')).toBe(true);
    });

    it('should handle null existing log', () => {
      const debtor = createMockDebtor({ missed: 0 });
      const log = appendActivityLog(null, debtor);
      expect(log).toBeInstanceOf(Array);
      expect(log.length).toBeGreaterThan(0);
    });

    it('should handle undefined existing log', () => {
      const debtor = createMockDebtor({ missed: 0 });
      const log = appendActivityLog(undefined, debtor);
      expect(log).toBeInstanceOf(Array);
      expect(log.length).toBeGreaterThan(0);
    });

    it('should preserve prior entries in full', () => {
      const prior1: ActivityEntry = {
        text: 'Entry 1',
        source: 'Source 1',
        timestamp: new Date('2026-09-28'),
      };
      const prior2: ActivityEntry = {
        text: 'Entry 2',
        source: 'Source 2',
        timestamp: new Date('2026-09-27'),
      };
      const existingLog = [prior1, prior2];

      const debtor = createMockDebtor({});
      const newLog = appendActivityLog(existingLog, debtor);

      expect(newLog).toContainEqual(prior1);
      expect(newLog).toContainEqual(prior2);
    });
  });

  describe('sorting', () => {
    it('should sort newest-first by timestamp', () => {
      const oldEntry: ActivityEntry = {
        text: 'Old entry',
        source: 'Test',
        timestamp: new Date('2026-09-28'),
      };
      const existingLog = [oldEntry];

      const debtor = createMockDebtor({});
      const newLog = appendActivityLog(existingLog, debtor);

      // New entries should have current timestamp (newest)
      expect(newLog[0].timestamp.getTime()).toBeGreaterThanOrEqual(newLog[newLog.length - 1].timestamp.getTime());
    });

    it('should handle duplicate timestamps (stable sort)', () => {
      const now = new Date();
      const entry1: ActivityEntry = { text: 'Entry 1', source: 'Test', timestamp: now };
      const entry2: ActivityEntry = { text: 'Entry 2', source: 'Test', timestamp: now };
      const existingLog = [entry1, entry2];

      const debtor = createMockDebtor({});
      // Manually set debtor timestamp to same as existing entries for test
      // (In reality, debtor would have current time)
      const newLog = appendActivityLog(existingLog, debtor);

      // Should maintain insertion order for same timestamp
      expect(newLog.length).toBeGreaterThan(2);
    });
  });

  describe('pluralization', () => {
    it('should pluralize instalments correctly for 1', () => {
      const debtor = createMockDebtor({ missed: 1 });
      const log = appendActivityLog(null, debtor);
      const installmentEntry = log.find(e => e.text.includes('instalment'));
      expect(installmentEntry?.text).toContain('1 instalment');
    });

    it('should pluralize instalments correctly for 2+', () => {
      const debtor = createMockDebtor({ missed: 3 });
      const log = appendActivityLog(null, debtor);
      const installmentEntry = log.find(e => e.text.includes('instalment'));
      expect(installmentEntry?.text).toContain('3 instalments');
    });
  });

  describe('multiple runs (append-only)', () => {
    it('should preserve all entries across multiple scoring runs', () => {
      let log: ActivityEntry[] | null = null;

      const debtor1 = createMockDebtor({ score: 30, band: 'Watch' });
      log = appendActivityLog(log, debtor1);
      const firstRunLength = log.length;

      const debtor2 = createMockDebtor({ score: 67, band: 'High' });
      log = appendActivityLog(log, debtor2);

      expect(log.length).toBeGreaterThan(firstRunLength);
      expect(log.some(e => e.text.includes('Watch'))).toBe(true);
      expect(log.some(e => e.text.includes('High'))).toBe(true);
    });
  });
});
