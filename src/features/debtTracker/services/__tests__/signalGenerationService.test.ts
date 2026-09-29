/**
 * Unit Tests: Signal Generation Service
 * Tests for generateSignals() implementation per TECHNICAL_SPECIFICATION.md §4.4
 */

import { generateSignals, DebtorInput } from '../signalGenerationService';
import { Signal } from '../../types/debtTrackerTypes';

describe('signalGenerationService', () => {
  const mockFundingWeights: Record<string, number> = {
    'NSFAS pending': 12,
    'NSFAS declined': 16,
    'Bursary lapsed': 14,
    'Bursary partial': 8,
    'Self-funded': 4,
    'Bursary confirmed': 0,
  };

  const createMockDebtor = (overrides?: Partial<DebtorInput>): DebtorInput => ({
    missed: 0,
    lastPay: new Date('2026-08-15'),
    ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 0 },
    fundStatus: 'Bursary confirmed',
    arrangement: null,
    ...overrides,
  });

  describe('missed instalments signal', () => {
    it('should generate missed instalment signal when missed > 0', () => {
      const debtor = createMockDebtor({ missed: 2 });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text.includes('missed instalment'))).toBe(true);
    });

    it('should mark missed instalment signal as hot', () => {
      const debtor = createMockDebtor({ missed: 1 });
      const signals = generateSignals(debtor, mockFundingWeights);
      const missedSignal = signals.find(s => s.text.includes('missed instalment'));
      expect(missedSignal?.hot).toBe(true);
    });

    it('should pluralize correctly for 1 instalment', () => {
      const debtor = createMockDebtor({ missed: 1 });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals[0].text).toBe('1 missed instalment');
    });

    it('should pluralize correctly for 2+ instalments', () => {
      const debtor = createMockDebtor({ missed: 3 });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals[0].text).toBe('3 missed instalments');
    });

    it('should not generate when missed === 0', () => {
      const debtor = createMockDebtor({ missed: 0 });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text.includes('missed instalment'))).toBe(false);
    });
  });

  describe('last payment signal', () => {
    it('should generate "No payment on record" when lastPay is null', () => {
      const debtor = createMockDebtor({ lastPay: null });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text === 'No payment on record')).toBe(true);
    });

    it('should mark "No payment" as hot', () => {
      const debtor = createMockDebtor({ lastPay: null });
      const signals = generateSignals(debtor, mockFundingWeights);
      const noPaymentSignal = signals.find(s => s.text === 'No payment on record');
      expect(noPaymentSignal?.hot).toBe(true);
    });

    it('should generate "Last paid {date}" when lastPay exists', () => {
      const debtor = createMockDebtor({ lastPay: new Date('2026-08-15') });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text.startsWith('Last paid'))).toBe(true);
    });

    it('should mark "Last paid" as non-hot', () => {
      const debtor = createMockDebtor({ lastPay: new Date('2026-08-15') });
      const signals = generateSignals(debtor, mockFundingWeights);
      const lastPaidSignal = signals.find(s => s.text.startsWith('Last paid'));
      expect(lastPaidSignal?.hot).toBe(false);
    });

    it('should format date correctly (dd MMM)', () => {
      const debtor = createMockDebtor({ lastPay: new Date('2026-08-15') });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text.includes('15 Aug'))).toBe(true);
    });
  });

  describe('ageing bucket signal', () => {
    it('should generate signal for d120 bucket when present', () => {
      const debtor = createMockDebtor({ ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 5000 } });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text.includes('120+ days'))).toBe(true);
    });

    it('should mark d120 as hot', () => {
      const debtor = createMockDebtor({ ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 5000 } });
      const signals = generateSignals(debtor, mockFundingWeights);
      const d120Signal = signals.find(s => s.text.includes('120+ days'));
      expect(d120Signal?.hot).toBe(true);
    });

    it('should generate signal for d90 bucket when d120 is 0', () => {
      const debtor = createMockDebtor({ ageing: { current: 0, d30: 0, d60: 0, d90: 3000, d120: 0 } });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text.includes('90 days'))).toBe(true);
    });

    it('should mark d90 as hot', () => {
      const debtor = createMockDebtor({ ageing: { current: 0, d30: 0, d60: 0, d90: 3000, d120: 0 } });
      const signals = generateSignals(debtor, mockFundingWeights);
      const d90Signal = signals.find(s => s.text.includes('90 days'));
      expect(d90Signal?.hot).toBe(true);
    });

    it('should generate signal for d60 bucket', () => {
      const debtor = createMockDebtor({ ageing: { current: 0, d30: 0, d60: 2000, d90: 0, d120: 0 } });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text.includes('60 days'))).toBe(true);
    });

    it('should mark d60 as non-hot', () => {
      const debtor = createMockDebtor({ ageing: { current: 0, d30: 0, d60: 2000, d90: 0, d120: 0 } });
      const signals = generateSignals(debtor, mockFundingWeights);
      const d60Signal = signals.find(s => s.text.includes('60 days'));
      expect(d60Signal?.hot).toBe(false);
    });

    it('should generate signal for d30 bucket', () => {
      const debtor = createMockDebtor({ ageing: { current: 0, d30: 1000, d60: 0, d90: 0, d120: 0 } });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text.includes('30 days'))).toBe(true);
    });

    it('should mark d30 as non-hot', () => {
      const debtor = createMockDebtor({ ageing: { current: 0, d30: 1000, d60: 0, d90: 0, d120: 0 } });
      const signals = generateSignals(debtor, mockFundingWeights);
      const d30Signal = signals.find(s => s.text.includes('30 days'));
      expect(d30Signal?.hot).toBe(false);
    });

    it('should not generate when all buckets are zero', () => {
      const debtor = createMockDebtor({ ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 0 } });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text.includes('days'))).toBe(false);
    });

    it('should pick oldest non-zero bucket (d120 over others)', () => {
      const debtor = createMockDebtor({ ageing: { current: 100, d30: 100, d60: 100, d90: 100, d120: 100 } });
      const signals = generateSignals(debtor, mockFundingWeights);
      const ageingSignal = signals.find(s => s.text.includes('days'));
      expect(ageingSignal?.text).toContain('120+ days');
    });
  });

  describe('funding status signal', () => {
    it('should generate when risk weight >= 8', () => {
      const debtor = createMockDebtor({ fundStatus: 'Bursary partial' });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text === 'Bursary partial')).toBe(true);
    });

    it('should not generate when risk weight < 8', () => {
      const debtor = createMockDebtor({ fundStatus: 'Self-funded' });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text === 'Self-funded')).toBe(false);
    });

    it('should not generate when fundStatus not in weights table', () => {
      const debtor = createMockDebtor({ fundStatus: 'Unknown Status' });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text === 'Unknown Status')).toBe(false);
    });

    it('should use exact fundStatus text', () => {
      const debtor = createMockDebtor({ fundStatus: 'NSFAS declined' });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text === 'NSFAS declined')).toBe(true);
    });
  });

  describe('arrangement signal', () => {
    it('should generate "Arrangement defaulted" when applicable', () => {
      const debtor = createMockDebtor({ arrangement: 'Defaulted' });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text === 'Arrangement defaulted')).toBe(true);
    });

    it('should mark arrangement defaulted as hot', () => {
      const debtor = createMockDebtor({ arrangement: 'Defaulted' });
      const signals = generateSignals(debtor, mockFundingWeights);
      const arrangementSignal = signals.find(s => s.text === 'Arrangement defaulted');
      expect(arrangementSignal?.hot).toBe(true);
    });

    it('should not generate when arrangement !== "Defaulted"', () => {
      const debtor = createMockDebtor({ arrangement: 'Installment Plan' });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text === 'Arrangement defaulted')).toBe(false);
    });

    it('should not generate when arrangement is null', () => {
      const debtor = createMockDebtor({ arrangement: null });
      const signals = generateSignals(debtor, mockFundingWeights);
      expect(signals.some(s => s.text === 'Arrangement defaulted')).toBe(false);
    });
  });

  describe('signal order', () => {
    it('should generate signals in spec order: missed, payment, ageing, funding, arrangement', () => {
      const debtor = createMockDebtor({
        missed: 2,
        lastPay: null,
        ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 5000 },
        fundStatus: 'NSFAS declined',
        arrangement: 'Defaulted',
      });
      const signals = generateSignals(debtor, mockFundingWeights);

      // Verify order: index 0 = missed, 1 = payment, 2 = ageing, 3 = funding, 4 = arrangement
      expect(signals[0].text).toContain('missed');
      expect(signals[1].text).toContain('No payment');
      expect(signals[2].text).toContain('120+');
      expect(signals[3].text).toContain('NSFAS declined');
      expect(signals[4].text).toContain('Arrangement defaulted');
    });
  });

  describe('currency formatting', () => {
    it('should format currency as ZAR with correct locale', () => {
      const debtor = createMockDebtor({ ageing: { current: 0, d30: 0, d60: 0, d90: 12000, d120: 0 } });
      const signals = generateSignals(debtor, mockFundingWeights);
      const ageingSignal = signals.find(s => s.text.includes('90 days'));
      expect(ageingSignal?.text).toContain('R');
    });
  });
});
