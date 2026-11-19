import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE } from '../../core/api';
import { DebtService, formatRand } from '../../core/debt.service';
import { YearChartApiService, YearlyDebtRow } from '../../core/year-chart-api.service';
import { DonutChartComponent } from './donut-chart.component';

const FIXTURE: YearlyDebtRow[] = [
  { year: 2025, byFundingSource: { SELF: 10000, GOV: 20000, PRIVATE: 5000 }, total: 35000 },
  { year: 2026, byFundingSource: { SELF: 80000, GOV: 100000, PRIVATE: 48500 }, total: 228500 },
];

/**
 * FTC-74 (issue #177): the Home funding-mix donut must add up to the "Total debt owed to
 * institution" KPI. It used to be built from the frontend's bundled demo data, so on real data it
 * disagreed (R 491 800 against R 554 900). It now reads `GET /api/summary/by-year` (issue #176),
 * whose per-year total is the KPI's own rule: positive balances only, in the caller's portfolio.
 */
describe('DonutChartComponent — funding mix from live data (FTC-74 #177)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<DonutChartComponent>>;
  let component: DonutChartComponent;
  let debt: DebtService;
  let yearChartApi: YearChartApiService;
  let httpMock: HttpTestingController;

  const byYearRequests = () => httpMock.match((r) => r.url === `${API_BASE}/api/summary/by-year`);

  /** DebtService (issue #64) fires its own GET /api/summary on construction and on every
   *  setYear/setFunding call. The donut doesn't read it, so just drain it. */
  function drainSummaryRequests(): void {
    httpMock
      .match((r) => r.url === `${API_BASE}/api/summary`)
      .filter((req) => !req.cancelled)
      .forEach((req) => req.flush('ignored', { status: 500, statusText: 'Server Error' }));
  }

  /** What `<app-year-chart>` does on the Home page: ask for the data, then the server answers. */
  function load(rows: YearlyDebtRow[]): void {
    yearChartApi.refresh('all');
    const [req] = byYearRequests();
    req.flush(rows);
    fixture.detectChanges();
  }

  function legendRows(): { amount: number; percent: number }[] {
    const cells = Array.from(fixture.nativeElement.querySelectorAll('.legend .mono') as NodeListOf<HTMLElement>);
    return cells.map((c) => {
      const [amount, percent] = (c.textContent ?? '').split('·');
      return { amount: Number(amount.replace(/[^\d]/g, '')), percent: parseFloat(percent.replace('%', '')) };
    });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DonutChartComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DonutChartComponent);
    component = fixture.componentInstance;
    debt = TestBed.inject(DebtService);
    yearChartApi = TestBed.inject(YearChartApiService);
    debt.setYear('all');
    fixture.detectChanges();
  });

  afterEach(() => {
    drainSummaryRequests();
    httpMock.verify();
  });

  it('AC3 — for All years, the total is the sum of the live per-year totals, not the bundled demo data', () => {
    load(FIXTURE);
    expect(component.total()).toBe(35000 + 228500);
    expect(component.centerLabel()).toBe(formatRand(263500));
  });

  it('AC1 and AC2 — one segment per funding source with its amount and percentage', () => {
    load(FIXTURE);
    expect(component.slices().length).toBe(3);
    const rows = legendRows();
    expect(rows.map((r) => r.amount)).toEqual([90000, 120000, 53500]); // self, gov, private across both years
    expect(rows.map((r) => r.percent)).toEqual([34.2, 45.5, 20.3]);
  });

  it('AC3 — the segment amounts add up to the total, and the percentages add up to 100', () => {
    load(FIXTURE);
    const rows = legendRows();
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(component.total());
    expect(Math.round(rows.reduce((s, r) => s + r.percent, 0) * 10) / 10).toBeCloseTo(100, 0);
  });

  it('AC3 — for each year, the total equals that year\'s total from the endpoint (the KPI\'s own rule)', () => {
    load(FIXTURE);
    for (const row of FIXTURE) {
      debt.setYear(row.year);
      fixture.detectChanges();
      expect(component.total()).withContext(`year ${row.year}`).toBe(row.total);
    }
  });

  it('a funding filter leaves one ring segment, and only that source\'s debt', () => {
    load(FIXTURE);
    debt.setFunding('gov');
    fixture.detectChanges();
    expect(component.total()).toBe(20000 + 100000);
    expect(component.slices().length).toBe(1);
  });

  it('shows "No debt" when the selected year has no rows', () => {
    load(FIXTURE);
    debt.setYear(2020);
    fixture.detectChanges();
    expect(component.total()).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('No debt');
  });

  it('shows a loading message while the data is on its way', () => {
    yearChartApi.refresh('all');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading the funding mix');
    byYearRequests().forEach((r) => r.flush(FIXTURE));
  });

  it('shows an error message, not an empty donut, if the data cannot be loaded', () => {
    yearChartApi.refresh('all');
    const [req] = byYearRequests();
    req.flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load the funding mix");
    expect(fixture.nativeElement.textContent).not.toContain('No debt');
  });
});
