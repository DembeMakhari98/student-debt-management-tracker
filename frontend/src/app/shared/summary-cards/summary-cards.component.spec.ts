import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE } from '../../core/api';
import { DebtService, formatRand } from '../../core/debt.service';
import { SummaryCardsComponent } from './summary-cards.component';

/** The worked example from issue #64's own acceptance criteria. */
const SEEDED_2026_SUMMARY = {
  registeredStudents: 4812,
  totalDebt: 165400,
  debtorCount: 37,
  totalCredit: 4200,
  creditCount: 2,
  atRisk90Plus: 58000,
  atRisk90PlusPct: 35.06,
  averageBalance: 4470.27,
};

describe('SummaryCardsComponent — live figures from GET /api/summary (issue #64)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<SummaryCardsComponent>>;
  let httpMock: HttpTestingController;

  function flushSummary(dto = SEEDED_2026_SUMMARY) {
    const req = httpMock.expectOne((r) => r.url === `${API_BASE}/api/summary`);
    req.flush(dto);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SummaryCardsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SummaryCardsComponent);
  });

  afterEach(() => httpMock.verify());

  it('renders the 5 KPI cards from the backend response, matching the seeded-data example in the ticket', () => {
    flushSummary();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain((4812).toLocaleString('en-ZA')); // registered students
    expect(text).toContain(formatRand(165400)); // total debt
    expect(text).toContain(formatRand(4200)); // owed to students
    expect(text).toContain(formatRand(58000)); // at risk 90+
    expect(text).toContain('35.1%'); // atRisk90PlusPct, toFixed(1)
    expect(text).toContain(formatRand(4470.27)); // average balance
    expect(text).toContain('37 debtor(s)');
    expect(text).toContain('2 student(s) with credit balances');
  });

  it('re-fetches and re-renders when the selected year or funding source changes', () => {
    flushSummary();
    fixture.detectChanges();

    const debt = TestBed.inject(DebtService);
    debt.setFunding('gov');
    flushSummary({ ...SEEDED_2026_SUMMARY, totalDebt: 90000 });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(formatRand(90000));
  });

  it('shows a backend-unreachable note and falls back to zeroed cards when the request fails', () => {
    const req = httpMock.expectOne((r) => r.url === `${API_BASE}/api/summary`);
    req.flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Backend unreachable');
    expect(text).toContain(formatRand(0));
  });
});
