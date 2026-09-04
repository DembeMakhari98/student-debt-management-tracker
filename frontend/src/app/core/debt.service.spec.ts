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
