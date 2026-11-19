import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE } from '../../core/api';
import { YearlyDebtRow } from '../../core/year-chart-api.service';
import { YearChartComponent } from './year-chart.component';
import { DebtService } from '../../core/debt.service';

const FIXTURE: YearlyDebtRow[] = [
  { year: 2025, byFundingSource: { SELF: 10000, GOV: 20000, PRIVATE: 5000 }, total: 35000 },
  { year: 2026, byFundingSource: { SELF: 80000, GOV: 100000, PRIVATE: 48500 }, total: 228500 },
];

/**
 * Verifies the Home debt-by-year chart reads live data from `GET /api/summary/by-year`
 * (issue #176) rather than the frontend's bundled demo data, which could disagree with the
 * real "Total debt owed to institution" KPI for the current year (FTC-73's defect).
 */
describe('YearChartComponent — live data from GET /api/summary/by-year (issue #176)', () => {
  let component: YearChartComponent;
  let debt: DebtService;
  let fixture: ReturnType<typeof TestBed.createComponent<YearChartComponent>>;
  let httpMock: HttpTestingController;

  function expectRequest() {
    return httpMock.expectOne((r) => r.url === `${API_BASE}/api/summary/by-year`);
  }

  /** DebtService (issue #64) fires its own GET /api/summary on construction and on every
   *  setYear/setFunding/setPortfolioScope call; this chart doesn't read that data, so just drain it. */
  function drainSummaryRequests() {
    httpMock
      .match((r) => r.url === `${API_BASE}/api/summary`)
      .filter((req) => !req.cancelled)
      .forEach((req) => req.flush('ignored', { status: 500, statusText: 'Server Error' }));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [YearChartComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(YearChartComponent);
    component = fixture.componentInstance;
    debt = TestBed.inject(DebtService);
    fixture.detectChanges();
  });

  afterEach(() => {
    drainSummaryRequests();
    httpMock.verify();
  });

  it('requests GET /api/summary/by-year with the current portfolio scope on construction', () => {
    const req = expectRequest();
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('portfolio')).toBe(debt.portfolioScope());
    req.flush(FIXTURE);
  });

  it("renders one bar per year, with segments for the backend's figures, not the bundled demo data", () => {
    expectRequest().flush(FIXTURE);
    fixture.detectChanges();

    expect(component.yearLabels().map((l) => l.text)).toEqual(['2025', '2026']);
    const segmentsFor2026 = component.bars().filter((b) => b.title.startsWith('2026 ·'));
    expect(segmentsFor2026.length).toBe(3);
    // 228500 split 80000/100000/48500 — none of this exists in the bundled demo dataset for 2026.
    expect(segmentsFor2026.some((b) => b.title.includes(`R ${(100000).toLocaleString('en-ZA')}`))).toBeTrue();
    expect(component.totalLabels().find((l) => l.text === 'R229k')).toBeTruthy();
  });

  it('re-fetches when the portfolio scope changes (#224/#176: this page must honor the global scope selector)', () => {
    expectRequest().flush(FIXTURE);

    debt.setPortfolioScope('team');
    fixture.detectChanges();
    const req = expectRequest();
    expect(req.request.params.get('portfolio')).toBe('team');
    req.flush([{ year: 2026, byFundingSource: { SELF: 1000, GOV: 0, PRIVATE: 0 }, total: 1000 }]);

    expect(component.yearLabels().map((l) => l.text)).toEqual(['2026']);
  });

  it('renders no bars while the request is in flight or fails, rather than stale/mock data', () => {
    expectRequest().flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component.yearChartApi.error()).toBeTrue();
    expect(component.bars()).toEqual([]);
    expect(component.yearLabels()).toEqual([]);
  });
});
