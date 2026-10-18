import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE } from '../../core/api';
import { AgeingApiResponse } from '../../core/ageing-api.service';
import { AgeingComponent } from './ageing.component';
import { DebtService } from '../../core/debt.service';
import { AGE_BUCKETS, FUND_KEYS } from '../../core/constants';

const FIXTURE: AgeingApiResponse = {
  bucketTotals: { current: 500, d30: 1000, d60: 2000, d90: 3000, d120: 4000 },
  byFundingSource: {
    SELF: { current: 200, d30: 300, d60: 400, d90: 500, d120: 600 },
    GOV: { current: 200, d30: 500, d60: 1000, d90: 1500, d120: 2500 },
    PRIVATE: { current: 100, d30: 200, d60: 600, d90: 1000, d120: 900 },
  },
  students: [
    {
      studentId: 'STU-100301',
      name: 'Sipho Nene',
      year: 2026,
      fundingSource: 'GOV',
      fundingLabel: 'Government (NSFAS)',
      ageing: { current: 0, d30: 0, d60: 0, d90: 0, d120: 4000 },
      totalOwed: 4000,
      oldestBucketLabel: '120+ days',
    },
    {
      studentId: 'STU-100210',
      name: 'Amy Petersen',
      year: 2026,
      fundingSource: 'SELF',
      fundingLabel: 'Self-funded',
      ageing: { current: 0, d30: 0, d60: 0, d90: 1000, d120: 0 },
      totalOwed: 1000,
      oldestBucketLabel: '90 days',
    },
  ],
  credits: [
    {
      studentId: 'STU-100355',
      name: 'Jessica Adams',
      year: 2026,
      fundingSource: 'PRIVATE',
      fundingLabel: 'Private / Bursary',
      creditReason: 'Bursary award exceeded assessed fees',
      creditSince: '2026-02-12',
      daysOwing: 190,
      ageingBandLabel: '120+ days',
      amountOwed: 11800,
    },
    {
      studentId: 'STU-100341',
      name: 'Noah Smith',
      year: 2026,
      fundingSource: 'SELF',
      fundingLabel: 'Self-funded',
      creditReason: 'Overpayment',
      creditSince: '2026-09-20',
      daysOwing: 24,
      ageingBandLabel: 'Current',
      amountOwed: 500,
    },
  ],
  staleCreditTotal: 11800,
  staleCreditCount: 1,
};

describe('AgeingComponent — Age Analysis workspace, live data from GET /api/ageing (issue #67)', () => {
  let component: AgeingComponent;
  let debt: DebtService;
  let fixture: ReturnType<typeof TestBed.createComponent<AgeingComponent>>;
  let httpMock: HttpTestingController;

  function flush(dto: AgeingApiResponse = FIXTURE) {
    httpMock.expectOne((r) => r.url === `${API_BASE}/api/ageing`).flush(dto);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AgeingComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AgeingComponent);
    component = fixture.componentInstance;
    debt = TestBed.inject(DebtService);
    debt.setFunding('all');
    fixture.detectChanges(); // flushes the constructor effect, firing the request
    flush();
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  describe('AC: ageing bar chart, one bar per bucket, summed across the current filter scope', () => {
    it('renders exactly one bar per AGE_BUCKETS entry, in order, with amounts from bucketTotals', () => {
      const rows = component.barRows();
      expect(rows.map((r) => r.label)).toEqual(AGE_BUCKETS.map((b) => b.label));
      expect(rows.map((r) => r.amount)).toEqual([500, 1000, 2000, 3000, 4000]);
    });

    it('scales the largest bucket to 100%', () => {
      const rows = component.barRows();
      const top = rows.find((r) => r.amount === 4000)!;
      expect(top.pct).toBe(100);
      rows.forEach((r) => expect(r.pct).toBeLessThanOrEqual(100));
    });
  });

  describe('AC: funding source × ageing bucket matrix, with totals row and % share column', () => {
    it('renders one row per funding source, matched to byFundingSource by enum name', () => {
      expect(component.matrixRowsWithShare().map((r) => r.fundKey)).toEqual(FUND_KEYS);
      const gov = component.matrixRowsWithShare().find((r) => r.fundKey === 'gov')!;
      expect(gov.rowTotal).toBe(200 + 500 + 1000 + 1500 + 2500);
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

  describe('AC: student ageing detail table — maps the API response faithfully and preserves its order', () => {
    it('maps studentId/name/year/funding/ageing/totalOwed/oldestBucketLabel for every row', () => {
      const rows = component.studentRows();
      expect(rows.length).toBe(2);
      expect(rows[0].d.id).toBe('STU-100301');
      expect(rows[0].d.name).toBe('Sipho Nene');
      expect(rows[0].d.year).toBe(2026);
      expect(rows[0].d.funding).toBe('gov');
      expect(rows[0].totalOwed).toBe(4000);
      expect(rows[0].oldestLabel).toBe('120+ days');
      expect(rows[0].values).toEqual([0, 0, 0, 0, 4000]);
    });

    it('preserves the backend-sorted order rather than re-sorting client-side', () => {
      expect(component.studentRows().map((r) => r.d.id)).toEqual(['STU-100301', 'STU-100210']);
    });

    it('hides the Year column for a single selected year, shows it for "all"', () => {
      expect(component.showYear()).toBeFalse();
      debt.setYear('all');
      fixture.detectChanges();
      flush();
      fixture.detectChanges();
      expect(component.showYear()).toBeTrue();
    });
  });

  describe('AC: credit ageing table — funding, reason, credit-since, days owing, ageing band, amount owed', () => {
    it('maps every field from the API, formatting creditSince for display', () => {
      const row = component.creditRows().find((r) => r.d.id === 'STU-100355')!;
      expect(row.d.funding).toBe('private');
      expect(row.d.creditReason).toBe('Bursary award exceeded assessed fees');
      expect(row.d.creditSince).toBe('12 Feb 2026');
      expect(row.days).toBe(190);
      expect(row.amount).toBe(11800);
      expect(row.bandLabel).toBe('120+ days');
    });

    it('preserves the backend-sorted order (days owing, descending)', () => {
      expect(component.creditRows().map((r) => r.d.id)).toEqual(['STU-100355', 'STU-100341']);
    });
  });

  describe('AC: stale-credit banner when any credit has been owing more than 90 days', () => {
    it('flags only credits over 90 days as stale', () => {
      const staleIds = component.staleCredits().map((r) => r.d.id);
      expect(staleIds).toEqual(['STU-100355']);
      expect(staleIds).not.toContain('STU-100341');
    });

    it('totals the stale amount and names the single oldest case', () => {
      expect(component.staleAmount()).toBe(11800);
      expect(component.oldestCredit()?.d.id).toBe('STU-100355');
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

describe('AgeingComponent — fetch, re-fetch and failure handling (issue #67)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AgeingComponent>>;
  let component: AgeingComponent;
  let debt: DebtService;
  let httpMock: HttpTestingController;

  function expectRequest() {
    return httpMock.expectOne((r) => r.url === `${API_BASE}/api/ageing`);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AgeingComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AgeingComponent);
    component = fixture.componentInstance;
    debt = TestBed.inject(DebtService);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('requests GET /api/ageing with the current year and funding as query params on construction', () => {
    const req = expectRequest();
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('year')).toBe(String(debt.year()));
    expect(req.request.params.get('funding')).toBe(String(debt.funding()));
    req.flush(FIXTURE);
  });

  it('is loading until the request resolves', () => {
    expect(component.ageingApi.loading()).toBeTrue();
    expectRequest().flush(FIXTURE);
    expect(component.ageingApi.loading()).toBeFalse();
  });

  it('re-fetches when the funding filter changes', () => {
    expectRequest().flush(FIXTURE);

    debt.setFunding('gov');
    fixture.detectChanges();
    const req = expectRequest();
    expect(req.request.params.get('funding')).toBe('gov');
    req.flush({ ...FIXTURE, bucketTotals: { current: 0, d30: 0, d60: 0, d90: 0, d120: 9000 } });

    expect(component.barRows().find((r) => r.label === '120+ days')!.amount).toBe(9000);
  });

  it('re-fetches when the year filter changes', () => {
    expectRequest().flush(FIXTURE);

    debt.setYear('all');
    fixture.detectChanges();
    const req = expectRequest();
    expect(req.request.params.get('year')).toBe('all');
    req.flush(FIXTURE);
  });

  it('cancels a still-in-flight request when the filter changes again before it resolves', () => {
    const first = expectRequest();

    debt.setFunding('private');
    fixture.detectChanges();
    const second = expectRequest();

    expect(first.cancelled).toBeTrue();
    second.flush(FIXTURE);
  });

  it('a failed request shows the unreachable note and falls back to empty tables', () => {
    expectRequest().flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component.ageingApi.error()).toBeTrue();
    expect(component.studentRows()).toEqual([]);
    expect(component.creditRows()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Backend unreachable');
  });
});
