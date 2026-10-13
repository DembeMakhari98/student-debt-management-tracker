/**
 * Unit Tests: Evidence Generation Service
 * Tests for generateEvidence() implementation per TECHNICAL_SPECIFICATION.md §4.5
 */

import { generateEvidence } from '../evidenceGenerationService';
import { Evidence } from '../../types/debtTrackerTypes';
import { DebtorInput } from '../signalGenerationService';

describe('evidenceGenerationService', () => {
  const createMockDebtor = (overrides?: Partial<DebtorInput & { year: number }>) => ({
    missed: 0,
    lastPay: null,
    ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 0 },
    fundStatus: 'Bursary confirmed',
    arrangement: null,
    year: 2026,
    ...overrides,
  });

  describe('ageing evidence', () => {
    it('should generate ageing · 120+ days when d120 > 0', () => {
      const debtor = createMockDebtor({ ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 5000 } });
      const evidence = generateEvidence(debtor);
      expect(evidence[0]).toBe('Ageing · 120+ days');
    });

    it('should generate ageing · 90 days when d90 > 0 and d120 === 0', () => {
      const debtor = createMockDebtor({ ageing: { current: 0, d30: 0, d60: 0, d90: 3000, d120: 0 } });
      const evidence = generateEvidence(debtor);
      expect(evidence[0]).toBe('Ageing · 90 days');
    });

    it('should use "Current" label when all buckets zero', () => {
      const debtor = createMockDebtor({ ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 0 } });
      const evidence = generateEvidence(debtor);
      expect(evidence[0]).toBe('Ageing · Current');
    });

    it('should always include ageing evidence as first item', () => {
      const debtor = createMockDebtor({});
      const evidence = generateEvidence(debtor);
      expect(evidence.length).toBeGreaterThan(0);
      expect(evidence[0]).toMatch(/Ageing · /);
    });
  });

  describe('payment history evidence', () => {
    it('should generate payment history with correct year range', () => {
      const debtor = createMockDebtor({ year: 2026 });
      const evidence = generateEvidence(debtor);
      expect(evidence[1]).toBe('Payment history 2025–2026');
    });

    it('should format as {year-1}–{year}', () => {
      const debtor = createMockDebtor({ year: 2023 });
      const evidence = generateEvidence(debtor);
      expect(evidence[1]).toBe('Payment history 2022–2023');
    });

    it('should always include payment history', () => {
      const debtor = createMockDebtor({});
      const evidence = generateEvidence(debtor);
      expect(evidence.some(e => e.startsWith('Payment history'))).toBe(true);
    });
  });

  describe('funding evidence', () => {
    it('should include funding status when present', () => {
      const debtor = createMockDebtor({ fundStatus: 'NSFAS pending' });
      const evidence = generateEvidence(debtor);
      expect(evidence.some(e => e === 'Funding · NSFAS pending')).toBe(true);
    });

    it('should skip when fundStatus is null', () => {
      const debtor = createMockDebtor({ fundStatus: null as any });
      const evidence = generateEvidence(debtor);
      expect(evidence.some(e => e.startsWith('Funding ·'))).toBe(false);
    });

    it('should skip when fundStatus is empty string', () => {
      const debtor = createMockDebtor({ fundStatus: '' });
      const evidence = generateEvidence(debtor);
      expect(evidence.some(e => e.startsWith('Funding ·'))).toBe(false);
    });

    it('should skip when fundStatus is whitespace only', () => {
      const debtor = createMockDebtor({ fundStatus: '   ' });
      const evidence = generateEvidence(debtor);
      expect(evidence.some(e => e.startsWith('Funding ·'))).toBe(false);
    });
  });

  describe('arrangement evidence', () => {
    it('should include arrangement when present', () => {
      const debtor = createMockDebtor({ arrangement: 'Payment Plan' });
      const evidence = generateEvidence(debtor);
      expect(evidence.some(e => e === 'Arrangement · Payment Plan')).toBe(true);
    });

    it('should skip when arrangement is null', () => {
      const debtor = createMockDebtor({ arrangement: null });
      const evidence = generateEvidence(debtor);
      expect(evidence.some(e => e.startsWith('Arrangement ·'))).toBe(false);
    });
  });

  describe('evidence order', () => {
    it('should maintain order: ageing, payment history, funding, arrangement', () => {
      const debtor = createMockDebtor({
        year: 2026,
        ageing: { current: 0, d30: 0, d60: 100, d90: 0, d120: 0 },
        fundStatus: 'NSFAS pending',
        arrangement: 'Installment',
      });
      const evidence = generateEvidence(debtor);

      expect(evidence[0]).toMatch(/Ageing · /);
      expect(evidence[1]).toMatch(/Payment history /);
      expect(evidence[2]).toMatch(/Funding · /);
      expect(evidence[3]).toMatch(/Arrangement · /);
    });
  });

  describe('edge cases', () => {
    it('should handle debtor with minimal data', () => {
      const debtor = createMockDebtor({
        ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 0 },
        fundStatus: '',
        arrangement: null,
      });
      const evidence = generateEvidence(debtor);
      expect(evidence.length).toBe(2); // Ageing + Payment history only
    });

    it('should handle debtor with all fields', () => {
      const debtor = createMockDebtor({
        ageing: { current: 1000, d30: 1000, d60: 1000, d90: 1000, d120: 1000 },
        fundStatus: 'NSFAS declined',
        arrangement: 'Defaulted',
      });
      const evidence = generateEvidence(debtor);
      expect(evidence.length).toBe(4); // Ageing, Payment history, Funding, Arrangement
    });
  });
});
