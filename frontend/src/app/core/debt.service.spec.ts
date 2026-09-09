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
    // missed === 1 would also satisfy Rule 7's condition on its own; pending status must win
    // first (this fixture doubles as the Rule 5-vs-Rule 7 order proof).
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

  it('rule order — a credit account hits Rule 1 regardless of other conditions', () => {
    // Also independently satisfies Rule 2 (defaulted, no payment), Rule 3 (lapsed funding),
    // and Rule 6 (missed >= 2) — Rule 1 (credit) must win over all of them.
    const rec = service.recommend(
      debtor({
        ageing: { current: -4200, d30: 0, d60: 0, d90: 0, d120: 0 },
        arrangement: 'Defaulted',
        lastPay: null,
        fundStatus: 'NSFAS lapsed',
        missed: 5,
      })
    );
    expect(rec.type).toBe('Refund');
  });

  it('rule order — defaulted with no payment hits Rule 2, not Rule 3 or Rule 6', () => {
    // Also independently satisfies Rule 3 (lapsed funding) and Rule 6 (missed >= 2) —
    // Rule 2 (registration hold) must win over both.
    const rec = service.recommend(
      debtor({ arrangement: 'Defaulted', lastPay: null, fundStatus: 'NSFAS lapsed', missed: 5 })
    );
    expect(rec.type).toBe('Registration hold');
  });

  it('rule order — lapsed funding hits Rule 3, not Rule 6', () => {
    // missed === 2 would also independently satisfy Rule 6 — Rule 3 (hardship fund) must win.
    const rec = service.recommend(
      debtor({ fundStatus: 'NSFAS declined', missed: 2, ageing: { current: 10000, d30: 0, d60: 0, d90: 0, d120: 0 } })
    );
    expect(rec.type).toBe('Hardship fund');
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

describe('DebtService — autonomy gating (issue #8)', () => {
  let service: DebtService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DebtService);
  });

  // One fixture per rule, matching the fixtures proven in the issue #7 describe above.
  const RULE_FIXTURES: [string, Partial<Debtor>][] = [
    ['Refund', { ageing: { current: -4200, d30: 0, d60: 0, d90: 0, d120: 0 } }],
    ['Registration hold', { arrangement: 'Defaulted', lastPay: null, missed: 4 }],
    ['Hardship fund', { fundStatus: 'NSFAS lapsed', ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 20000 } }],
    [
      'Holding arrangement',
      { fundStatus: 'NSFAS pending', missed: 2, ageing: { current: 12000, d30: 0, d60: 0, d90: 0, d120: 0 } },
    ],
    [
      'Funding chase',
      { fundStatus: 'NSFAS pending', missed: 1, ageing: { current: 12000, d30: 0, d60: 0, d90: 0, d120: 0 } },
    ],
    [
      'Payment arrangement',
      { fundStatus: 'Self-funded', missed: 2, ageing: { current: 12000, d30: 0, d60: 0, d90: 0, d120: 0 } },
    ],
    ['Reminder cadence', { fundStatus: 'Self-funded', missed: 1 }],
    ['Monitor', { fundStatus: 'Self-funded', missed: 0 }],
  ];

  it('autoEligible — truth table across all 8 rules × levels 1-4', () => {
    for (const [label, overrides] of RULE_FIXTURES) {
      const rec = service.recommend(debtor(overrides));
      const isHardManual = rec.type === 'Refund' || rec.type === 'Registration hold';
      const isAgentActing = rec.status === 'Agent acting';
      const isMonitoring = rec.status === 'Monitoring';

      expect(service.autoEligible(rec, 1)).withContext(`${label} @ level 1`).toBeFalse();
      expect(service.autoEligible(rec, 2)).withContext(`${label} @ level 2`).toBeFalse();
      expect(service.autoEligible(rec, 3)).withContext(`${label} @ level 3`).toBe(!isHardManual && isAgentActing);
      expect(service.autoEligible(rec, 4)).withContext(`${label} @ level 4`).toBe(!isHardManual && !isMonitoring);
    }
  });

  it('autoEligible — hard rule blocks Refund and Registration hold at every level, including 4', () => {
    const refund = service.recommend(debtor({ ageing: { current: -4200, d30: 0, d60: 0, d90: 0, d120: 0 } }));
    const hold = service.recommend(debtor({ arrangement: 'Defaulted', lastPay: null, missed: 4 }));

    for (const level of [1, 2, 3, 4]) {
      expect(service.autoEligible(refund, level)).withContext(`Refund @ level ${level}`).toBeFalse();
      expect(service.autoEligible(hold, level)).withContext(`Registration hold @ level ${level}`).toBeFalse();
    }
  });

  it('runAutonomousExecution() at level 1 or 2 decides nothing across the real dataset', () => {
    for (const level of [1, 2]) {
      service.setAutonomy(level);
      service.runAutonomousExecution();
      for (const d of service.caseRows()) {
        expect(service.caseOf(d).decision).withContext(`level ${level}, ${d.id}`).toBeNull();
      }
    }
  });

  it('runAutonomousExecution() at level 4 decides exactly the eligible cases and stamps the autonomous actor', () => {
    service.setAutonomy(4);
    service.runAutonomousExecution();

    let sawAutoDecision = false;
    for (const d of service.caseRows()) {
      const c = service.caseOf(d);
      const eligible = service.autoEligible(c.rec, 4);
      if (eligible) {
        sawAutoDecision = true;
        expect(c.decision).withContext(d.id).not.toBeNull();
        expect(c.decision!.decidedBy).toContain('Autonomous Agent');
        expect(c.decision!.action).toBe('Approved');
      } else {
        expect(c.decision).withContext(d.id).toBeNull();
      }
    }
    // Sanity: the mock dataset actually exercises at least one eligible case at level 4.
    expect(sawAutoDecision).toBeTrue();
  });

  it('does not overwrite a case a human officer already decided', () => {
    const c = service.caseOf(service.caseRows()[0]);
    service.approveCase(c.d);

    service.setAutonomy(4);
    service.runAutonomousExecution();

    const after = service.caseOf(c.d);
    expect(after.decision!.decidedBy).not.toContain('Autonomous Agent');
  });

  it('runAutonomousExecution() is not limited to the officer\'s currently selected year filter', () => {
    // The officer is viewing only 2026 (a realistic default) when the run happens.
    service.setYear(2026);
    const inViewIds = new Set(service.caseRows().map((d) => d.id));

    service.setYear('all');
    const outsideViewEligible = service
      .caseRows()
      .filter((d) => !inViewIds.has(d.id) && service.autoEligible(service.caseOf(d).rec, 4));
    expect(outsideViewEligible.length).toBeGreaterThan(0); // sanity: other years have eligible cases too

    service.setYear(2026); // back to the officer's narrow view before the run
    service.setAutonomy(4);
    service.runAutonomousExecution();

    service.setYear('all');
    for (const d of outsideViewEligible) {
      expect(service.caseOf(d).decision).withContext(`${d.id} (year ${d.year}, outside the 2026 view)`).not.toBeNull();
    }
  });

  it('level-change invariant: a later run at a higher level leaves an earlier run\'s decisions untouched', () => {
    service.setAutonomy(3);
    service.runAutonomousExecution();
    const level3Decided = service.caseRows().filter((d) => service.caseOf(d).decision).map((d) => d.id);
    expect(level3Decided.length).toBeGreaterThan(0);

    service.setAutonomy(4);
    service.runAutonomousExecution();

    for (const id of level3Decided) {
      const d = service.caseRows().find((x) => x.id === id)!;
      expect(service.caseOf(d).decision!.decidedBy).toContain('Level 3');
    }
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

describe('DebtService — officer decisions (issue #13)', () => {
  let service: DebtService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DebtService);
  });

  function firstCase() {
    const rows = service.caseRows();
    expect(rows.length).toBeGreaterThan(0);
    return service.caseOf(rows[0]);
  }

  it('caseOf() has no decision and needsApproval reflects the raw recommendation before any decision', () => {
    const c = firstCase();
    expect(c.decision).toBeNull();
    expect(service.needsApproval(c)).toBe(c.rec.status === 'Needs approval');
  });

  it('approveCase() records an Approved decision and logs an activity entry naming the officer', () => {
    const c = firstCase();
    service.approveCase(c.d);

    const after = service.caseOf(c.d);
    expect(after.decision).not.toBeNull();
    expect(after.decision!.action).toBe('Approved');
    expect(after.decision!.recommendationType).toBe(c.rec.type);
    expect(after.activity[after.activity.length - 1].t).toContain('approved by');
    expect(service.needsApproval(after)).toBeFalse();
  });

  it('amendCase() stores the amended terms and they are distinct from the original recommendation terms', () => {
    const c = firstCase();
    const amended = [{ k: 'Instalments', v: '6 × R 1,200' }];
    service.amendCase(c.d, amended);

    const after = service.caseOf(c.d);
    expect(after.decision!.action).toBe('Amended');
    expect(after.decision!.amendedTerms).toEqual(amended);
    expect(after.activity[after.activity.length - 1].t).toContain('amended and approved by');
  });

  it('declineCase() requires a reason to be stored and documents it on the decision and activity log', () => {
    const c = firstCase();
    service.declineCase(c.d, 'Student already on a verbal arrangement with the faculty');

    const after = service.caseOf(c.d);
    expect(after.decision!.action).toBe('Declined');
    expect(after.decision!.reason).toBe('Student already on a verbal arrangement with the faculty');
    expect(after.activity[after.activity.length - 1].t).toContain('declined by');
    expect(after.activity[after.activity.length - 1].t).toContain('Student already on a verbal arrangement');
  });

  it('does not leak a decision between different debtors', () => {
    const rows = service.caseRows();
    expect(rows.length).toBeGreaterThan(1);
    const [a, b] = rows;

    service.approveCase(a);

    expect(service.caseOf(b).decision).toBeNull();
  });
});
