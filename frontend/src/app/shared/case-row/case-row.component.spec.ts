import { TestBed } from '@angular/core/testing';
import { CaseRowComponent } from './case-row.component';
import { CaseView } from '../../core/models';

function makeCase(overrides: Partial<CaseView> = {}): CaseView {
  return {
    d: {
      id: 'STU-001',
      name: 'Thabo Nkosi',
      funding: 'gov',
      year: 2025,
      prog: 'BSc Computer Science',
      fundStatus: 'Confirmed',
      missed: 2,
      lastPay: '2025-04-01',
      arrangement: null,
      ageing: { current: 0, d30: 1000, d60: 0, d90: 0, d120: 0 },
    },
    score: 62,
    band: 'Elevated',
    debt: 1000,
    credit: 0,
    signals: [{ t: '2 missed instalments', hot: true }],
    rec: {
      type: 'Payment arrangement',
      action: 'Payment arrangement, 4 instalments',
      status: 'Needs approval',
      rationale: 'test',
      terms: [],
    },
    evidence: [],
    activity: [],
    ...overrides,
  };
}

describe('CaseRowComponent — Tracker worklist row (issue #11)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CaseRowComponent] });
  });

  function mount(caseView: CaseView) {
    const fixture = TestBed.createComponent(CaseRowComponent);
    fixture.componentInstance.case = caseView;
    fixture.detectChanges();
    return fixture;
  }

  it('renders name, ID, programme, funding pill, signal chips, recommended action and owning agent', () => {
    const fixture = mount(makeCase());
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Thabo Nkosi');
    expect(text).toContain('STU-001');
    expect(text).toContain('BSc Computer Science');
    expect(text).toContain('Government (NSFAS)');
    expect(text).toContain('2 missed instalments');
    expect(text).toContain('Payment arrangement, 4 instalments');
    expect(text).toContain('Intervention Planner');
  });

  it('renders the amount and status', () => {
    const fixture = mount(makeCase());
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('R 1');
    expect(text).toContain('Needs approval');
  });

  it('renders the numeric risk score and band for a debt case', () => {
    const fixture = mount(makeCase());
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('62');
    expect(text).toContain('Elevated');
  });

  it('emits open with the debtor id when the row is clicked (link into the case)', () => {
    const fixture = mount(makeCase());
    let emitted: string | undefined;
    fixture.componentInstance.open.subscribe((id: string) => (emitted = id));

    (fixture.nativeElement.querySelector('.qrow') as HTMLElement).click();

    expect(emitted).toBe('STU-001');
  });

  it('renders the "↩" / Credit badge instead of a score/band for a refund case', () => {
    const fixture = mount(
      makeCase({
        d: {
          id: 'STU-002',
          name: 'Lindiwe Dube',
          funding: 'self',
          year: 2025,
          prog: 'BCom Accounting',
          fundStatus: 'Overpaid',
          missed: 0,
          lastPay: '2025-05-01',
          arrangement: null,
          ageing: { current: -500, d30: 0, d60: 0, d90: 0, d120: 0 },
        },
        debt: 0,
        credit: 500,
      }),
    );
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('↩');
    expect(text).toContain('Credit');
    expect(text).not.toContain('Elevated');
  });
});
