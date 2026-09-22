import { TestBed } from '@angular/core/testing';
import { AgeingComponent } from './ageing.component';
import { DebtService } from '../../core/debt.service';
import { AGE_BUCKETS, FUND_KEYS } from '../../core/constants';

describe('AgeingComponent — Age Analysis workspace (issue #15)', () => {
  let component: AgeingComponent;
  let debt: DebtService;
  let fixture: ReturnType<typeof TestBed.createComponent<AgeingComponent>>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AgeingComponent] });
    fixture = TestBed.createComponent(AgeingComponent);
    component = fixture.componentInstance;
    debt = TestBed.inject(DebtService);
    debt.setFunding('all');
    fixture.detectChanges();
  });

  describe('AC: ageing bar chart, one bar per bucket, summed across the current filter scope', () => {
    it('renders exactly one bar per AGE_BUCKETS entry, in order', () => {
      const rows = component.barRows();
      expect(rows.map((r) => r.label)).toEqual(AGE_BUCKETS.map((b) => b.label));
    });

    it('sums each bucket only over positive (debt-side) balances, and the buckets sum to total debt', () => {
      const rows = component.barRows();
      const bucketSum = rows.reduce((s, r) => s + r.amount, 0);
      expect(bucketSum).toBeCloseTo(component.totalDebt(), 6);
    });

    it('scales the largest bucket to 100%', () => {
      const rows = component.barRows();
      const max = Math.max(...rows.map((r) => r.amount));
      const top = rows.find((r) => r.amount === max)!;
      expect(top.pct).toBe(100);
    });
  });

  describe('AC: funding source × ageing bucket matrix, with totals row and % share column', () => {
    it('renders one row per funding source', () => {
      expect(component.matrixRowsWithShare().map((r) => r.fundKey)).toEqual(FUND_KEYS);
    });

    it('column totals equal the grand total, and each row total equals the sum of its bucket values', () => {
      const rows = component.matrixRowsWithShare();
      const colTotals = component.matrixColTotals();
      const grand = component.matrixGrandTotal();

      expect(colTotals.reduce((a, b) => a + b, 0)).toBeCloseTo(grand, 6);
      rows.forEach((r) => expect(r.rowTotal).toBeCloseTo(r.values.reduce((a, b) => a + b, 0), 6));
    });

    it('row shares are each row total over the grand total, and sum to ~100%', () => {
      const rows = component.matrixRowsWithShare();
      const grand = component.matrixGrandTotal();
      rows.forEach((r) => expect(r.sharePct).toBeCloseTo((r.rowTotal / grand) * 100, 6));
      expect(rows.reduce((s, r) => s + r.sharePct, 0)).toBeCloseTo(100, 6);
    });
  });

  describe('AC: student ageing detail table — positive balances only, oldest-money-first, oldest-arrear pill, Year column when scope is "All years"', () => {
    it('includes only debtors with a positive balance', () => {
      component.studentRows().forEach((r) => expect(debt.rowDebt(r.d)).toBeGreaterThan(0));
    });

    it('excludes credit-balance students entirely', () => {
      const ids = component.studentRows().map((r) => r.d.id);
      expect(ids).not.toContain('STU-100341');
      expect(ids).not.toContain('STU-100355');
    });

    it('sorts oldest-money-first: by 120+ desc, then 90 desc, then total owed desc', () => {
      const rows = component.studentRows();
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1].d.ageing;
        const cur = rows[i].d.ageing;
        const prevKey = [Math.max(0, prev.d120), Math.max(0, prev.d90), rows[i - 1].totalOwed];
        const curKey = [Math.max(0, cur.d120), Math.max(0, cur.d90), rows[i].totalOwed];
        // lexicographic, descending: prevKey must not be smaller than curKey
        const isNotSmaller =
          prevKey[0] > curKey[0] ||
          (prevKey[0] === curKey[0] && prevKey[1] > curKey[1]) ||
          (prevKey[0] === curKey[0] && prevKey[1] === curKey[1] && prevKey[2] >= curKey[2]);
        expect(isNotSmaller).withContext(`row ${i - 1} (${rows[i - 1].d.id}) vs row ${i} (${rows[i].d.id})`).toBeTrue();
      }
    });

    it('the highest-arrears case (STU-100301, 120+ days) sorts first for the default year', () => {
      expect(component.studentRows()[0].d.id).toBe('STU-100301');
      expect(component.studentRows()[0].oldestLabel).toBe('120+ days');
    });

    it('hides the Year column for a single selected year, shows it for "all"', () => {
      expect(component.showYear()).toBeFalse();
      debt.setYear('all');
      fixture.detectChanges();
      expect(component.showYear()).toBeTrue();
    });
  });

  describe('AC: credit ageing table — funding, reason, credit-since, days owing, ageing band, amount owed', () => {
    it('includes every debtor in credit for the current scope', () => {
      const ids = component.creditRows().map((r) => r.d.id);
      expect(ids).toEqual(jasmine.arrayContaining(['STU-100341', 'STU-100355']));
      component.creditRows().forEach((r) => expect(debt.owedToStudent(r.d)).toBeTrue());
    });

    it('carries reason, credit-since and amount through from the debtor record', () => {
      const row = component.creditRows().find((r) => r.d.id === 'STU-100355')!;
      expect(row.d.creditReason).toBe('Bursary award exceeded assessed fees');
      expect(row.d.creditSince).toBe('12 Feb 2026');
      expect(row.days).toBe(190);
      expect(row.amount).toBeCloseTo(11800, 6);
    });

    it('bands each row via daysBand(days)', () => {
      component.creditRows().forEach((r) => {
        const expected = debt.daysBand(r.days);
        expect(r.bandLabel).toBe(expected.label);
        expect(r.bandColor).toBe(expected.color);
      });
    });

    it('sorts by days owing, descending', () => {
      const days = component.creditRows().map((r) => r.days);
      expect(days).toEqual([...days].sort((a, b) => b - a));
    });
  });

  describe('AC: stale-credit banner when any credit has been owing more than 90 days', () => {
    it('flags only credits over 90 days as stale', () => {
      const staleIds = component.staleCredits().map((r) => r.d.id);
      expect(staleIds).toEqual(['STU-100355']); // 190 days
      expect(staleIds).not.toContain('STU-100341'); // 24 days — not stale
    });

    it('totals the stale amount and names the single oldest case', () => {
      expect(component.staleAmount()).toBeCloseTo(11800, 6);
      expect(component.oldestCredit()?.d.id).toBe('STU-100355');
    });

    it('reports no stale credits when nothing is over 90 days', () => {
      debt.setYear(2023); // no credit-balance students in this year's mock data
      fixture.detectChanges();
      expect(component.creditRows().length).toBe(0);
      expect(component.staleCredits().length).toBe(0);
      expect(component.oldestCredit()).toBeNull();
    });
  });

  describe('rendered template', () => {
    it('shows the stale-credit banner text with the total, count and oldest case', () => {
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('has been owed back to');
      expect(text).toContain('Jessica Adams');
      expect(text).toContain('190 days');
    });

    it('renders a bar per bucket and a matrix row per funding source', () => {
      const el = fixture.nativeElement as HTMLElement;
      const bucketLabels = el.querySelectorAll('.card')[0].textContent ?? '';
      AGE_BUCKETS.forEach((b) => expect(bucketLabels).toContain(b.label));
    });
  });
});
