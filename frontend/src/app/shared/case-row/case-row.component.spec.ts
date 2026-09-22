import { TestBed } from '@angular/core/testing';
import { CaseRowComponent } from './case-row.component';
import { CaseView, Debtor } from '../../core/models';

function debtor(overrides: Partial<Debtor> = {}): Debtor {
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
    assignedOfficer: 'nomsa-mahlangu',
    ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 0 },
    ...overrides,
  };
}

function caseView(overrides: Partial<CaseView> = {}): CaseView {
  return {
    d: debtor(),
    score: 62,
    band: 'Elevated',
    debt: 12000,
    credit: 0,
    signals: [],
    rec: { type: 'Payment arrangement', action: 'Propose plan', status: 'Needs approval', rationale: '', terms: [] },
    evidence: [],
    activity: [],
    decision: null,
    ...overrides,
  };
}

describe('CaseRowComponent — decision-aware status (issue #13 AC6)', () => {
  function createWith(c: CaseView) {
    TestBed.configureTestingModule({ imports: [CaseRowComponent] });
    const fixture = TestBed.createComponent(CaseRowComponent);
    fixture.componentInstance.case = c;
    fixture.detectChanges();
    return fixture;
  }

  it('shows the raw recommendation status while the case is undecided', () => {
    const fixture = createWith(caseView());
    expect(fixture.componentInstance.displayStatus).toBe('Needs approval');
    expect(fixture.nativeElement.textContent).toContain('Needs approval');
  });

  it('shows the decision action, not "Needs approval", once the case has been decided', () => {
    const decided = caseView({
      decision: {
        recommendationType: 'Payment arrangement',
        action: 'Approved',
        decidedBy: 'Grace van Rooyen',
        decidedAt: new Date(0).toISOString(),
      },
    });

    const fixture = createWith(decided);
    expect(fixture.componentInstance.displayStatus).toBe('Approved');
    expect(fixture.nativeElement.textContent).not.toContain('Needs approval');
    expect(fixture.nativeElement.textContent).toContain('Approved');
  });
});
