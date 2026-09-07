import { TestBed } from '@angular/core/testing';
import { DebtService, formatRand } from './debt.service';
import { Debtor } from './models';

function debtor(overrides: Partial<Debtor>): Debtor {
  return {
    id: 'STU-TEST',
    name: 'Test Student',
    funding: 'self',
    year: 2026,
    prog: 'Test Programme',
    fundStatus: 'Self-funded',
    missed: 0,
    lastPay: '01 Jan 2026',
    arrangement: null,
    ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 0 },
    ...overrides,
  };
}

describe('DebtService — decision engine (issue #7)', () => {
  let service: DebtService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DebtService);
  });

  it('Rule 1 — account in credit recommends a Refund', () => {
    const rec = service.recommend(debtor({ ageing: { current: -4200, d30: 0, d60: 0, d90: 0, d120: 0 } }));
    expect(rec.type).toBe('Refund');
    expect(rec.status).toBe('Needs approval');
    expect(rec.terms.find((t) => t.k === 'Refund')?.v).toBe(formatRand(4200));
  });

  it('Rule 2 — defaulted arrangement with no payment on record recommends a Registration hold', () => {
    const rec = service.recommend(debtor({ arrangement: 'Defaulted', lastPay: null, missed: 4 }));
    expect(rec.type).toBe('Registration hold');
    expect(rec.status).toBe('Needs approval');
    expect(rec.terms.find((t) => t.k === 'Hand-over')?.v).toBe('Adapt Connect');
  });

  it('Rule 3 — lapsed/declined funding recommends a Hardship fund referral', () => {
    const rec = service.recommend(
      debtor({ fundStatus: 'NSFAS lapsed', ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 20000 } })
    );
    expect(rec.type).toBe('Hardship fund');
    expect(rec.status).toBe('Needs approval');
    // debt * 0.4 = 8000, capped at 6000
    expect(rec.terms.find((t) => t.k === 'Award sought')?.v).toBe(formatRand(6000));
  });

  it('Rule 3 — hardship award is uncapped below the R6,000 ceiling', () => {
    const rec = service.recommend(
      debtor({ fundStatus: 'NSFAS declined', ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 5000 } })
    );
    // debt * 0.4 = 2000, below the cap
    expect(rec.terms.find((t) => t.k === 'Award sought')?.v).toBe(formatRand(2000));
  });

  it('Rule 4 — funding pending with 2+ missed instalments recommends a Holding arrangement', () => {
    const rec = service.recommend(
      debtor({ fundStatus: 'NSFAS pending', missed: 2, ageing: { current: 12000, d30: 0, d60: 0, d90: 0, d120: 0 } })
    );
    expect(rec.type).toBe('Payment arrangement');
    expect(rec.action).toBe('Holding arrangement, 4 instalments');
    expect(rec.status).toBe('Needs approval');
  });

  it('Rule 5 — funding pending with fewer than 2 missed recommends a Funding chase', () => {
    const rec = service.recommend(
      debtor({ fundStatus: 'NSFAS pending', missed: 1, ageing: { current: 12000, d30: 0, d60: 0, d90: 0, d120: 0 } })
    );
    expect(rec.type).toBe('Funding chase');
    expect(rec.status).toBe('Agent acting');
  });

  it('Rule 6 — 2+ missed instalments (non-pending, non-lapsed) recommends a Payment arrangement', () => {
    const rec = service.recommend(
      debtor({ fundStatus: 'Self-funded', missed: 2, ageing: { current: 12000, d30: 0, d60: 0, d90: 0, d120: 0 } })
    );
    expect(rec.type).toBe('Payment arrangement');
    expect(rec.action).toBe('Payment arrangement, 4 instalments');
    expect(rec.status).toBe('Needs approval');
  });

  it('Rule 7 — exactly 1 missed instalment recommends a Reminder cadence', () => {
    const rec = service.recommend(debtor({ fundStatus: 'Self-funded', missed: 1 }));
    expect(rec.type).toBe('Reminder cadence');
    expect(rec.status).toBe('Agent acting');
  });

  it('Rule 8 — current with no missed instalments falls back to Monitor only', () => {
    const rec = service.recommend(debtor({ fundStatus: 'Self-funded', missed: 0 }));
    expect(rec.type).toBe('Monitor');
    expect(rec.status).toBe('Monitoring');
  });

  it('rule order — pending funding with 2+ missed hits Rule 4, not Rule 6', () => {
    // Would also satisfy Rule 6's "missed >= 2" on its own; pending status must win first.
    const rec = service.recommend(
      debtor({ fundStatus: 'NSFAS pending', missed: 3, ageing: { current: 15000, d30: 0, d60: 0, d90: 0, d120: 0 } })
    );
    expect(rec.action).toBe('Holding arrangement, 4 instalments');
  });

  it('instalment count bands — <=5000, <=15000, <=30000, >30000 map to 3/4/6/8', () => {
    const cases: [number, number][] = [
      [5000, 3],
      [15000, 4],
      [30000, 6],
      [30001, 8],
    ];
    for (const [debt, n] of cases) {
      const rec = service.recommend(
        debtor({ fundStatus: 'Self-funded', missed: 2, ageing: { current: debt, d30: 0, d60: 0, d90: 0, d120: 0 } })
      );
      expect(rec.action).toBe(`Payment arrangement, ${n} instalments`);
    }
  });

  it('recommendation shape includes type, action, status, rationale and terms', () => {
    const rec = service.recommend(debtor({}));
    expect(rec.type).toBeTruthy();
    expect(rec.action).toBeTruthy();
    expect(rec.status).toBeTruthy();
    expect(rec.rationale).toBeTruthy();
    expect(Array.isArray(rec.terms)).toBeTrue();
    expect(rec.terms.length).toBeGreaterThan(0);
  });
});

describe('DebtService — engagement log (issue #14)', () => {
  let service: DebtService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DebtService);
  });

  function firstDebtorId(): string {
    const rows = service.caseRows();
    expect(rows.length).toBeGreaterThan(0);
    return rows[0].id;
  }

  it('appends a logged engagement action to that debtor\'s case activity', () => {
    const id = firstDebtorId();
    const before = service.caseOf(service.caseRows()[0]).activity.length;

    service.logEngagementAction(id, { t: 'SMS sent to student', m: 'Engagement Agent · Officer action' });

    const after = service.caseOf(service.caseRows()[0]).activity;
    expect(after.length).toBe(before + 1);
    expect(after[after.length - 1]).toEqual({ t: 'SMS sent to student', m: 'Engagement Agent · Officer action' });
  });

  it('preserves append order across multiple engagement actions (append-only)', () => {
    const id = firstDebtorId();

    service.logEngagementAction(id, { t: 'SMS sent to student', m: 'Engagement Agent · Officer action' });
    service.logEngagementAction(id, { t: 'Call logged with student', m: 'Engagement Agent · Officer action' });

    const activity = service.caseOf(service.caseRows()[0]).activity;
    const tail = activity.slice(-2).map((e) => e.t);
    expect(tail).toEqual(['SMS sent to student', 'Call logged with student']);
  });

  it('does not leak engagement entries between different debtors', () => {
    const rows = service.caseRows();
    expect(rows.length).toBeGreaterThan(1);
    const [a, b] = rows;

    service.logEngagementAction(a.id, { t: 'SMS sent to student', m: 'Engagement Agent · Officer action' });

    const bActivity = service.caseOf(b).activity;
    expect(bActivity.some((e) => e.t === 'SMS sent to student')).toBeFalse();
  });
});
