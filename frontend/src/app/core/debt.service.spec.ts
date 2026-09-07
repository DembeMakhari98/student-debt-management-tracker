import { TestBed } from '@angular/core/testing';
import { DebtService } from './debt.service';

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
