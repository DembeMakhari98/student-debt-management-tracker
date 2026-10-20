import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TrackerComponent } from './tracker.component';
import { CaseStore } from '../../core/case-store.service';
import { DebtService } from '../../core/debt.service';
import { mockApi, mockApiProviders, resetMockApi } from '../../testing/mock-api';

describe('TrackerComponent — Debt Management Tracker workspace (issues #11, #65)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TrackerComponent>>;
  let component: TrackerComponent;
  let debt: DebtService;
  let store: CaseStore;
  let navigate: jasmine.Spy;

  /** Lets the store's reload effect run, then renders. */
  function settle(): void {
    TestBed.flushEffects();
    fixture.detectChanges();
  }

  beforeEach(() => {
    resetMockApi();
    navigate = jasmine.createSpy('navigate');
    TestBed.configureTestingModule({
      imports: [TrackerComponent],
      providers: [{ provide: Router, useValue: { navigate } }, ...mockApiProviders()],
    });

    fixture = TestBed.createComponent(TrackerComponent);
    component = fixture.componentInstance;
    debt = TestBed.inject(DebtService);
    store = TestBed.inject(CaseStore);
    settle();
  });

  it('#65 AC1 — loads the picked-up, refund and paying lists from GET /api/debtors, one call per scope', () => {
    const scopes = mockApi.listCalls.map((q) => new URLSearchParams(q).get('scope')).sort();
    expect(scopes).toEqual(['paying', 'picked', 'refunds']);
    expect(store.state()).toBe('ready');
    expect(component.pickedCases().length).toBeGreaterThan(0);
  });

  it('renders the picked-up list sorted by risk score descending', () => {
    const scores = component.pickedCases().map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    const rendered = fixture.nativeElement.querySelectorAll('app-case-row');
    expect(rendered.length).toBe(component.pickedCases().length + component.refundCases().length);
  });

  it('renders the refund queue separately, largest-credit-first', () => {
    const credits = component.refundCases().map((c) => c.credit);
    expect(credits.length).toBeGreaterThan(0);
    expect(credits).toEqual([...credits].sort((a, b) => b - a));
  });

  it('reuses the debt summary KPI block from #10', () => {
    expect(fixture.nativeElement.querySelector('app-summary-cards')).toBeTruthy();
  });

  it('renders the "not picked up" table read-only with the required columns and no interactive controls', () => {
    expect(component.payingCases().length).withContext('mock data must contain at least one non-picked-up debtor').toBeGreaterThan(0);
    const table: HTMLTableElement = fixture.nativeElement.querySelector('table');
    expect(table).toBeTruthy();
    const headers = Array.from(table.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Student', 'Funding', 'Funding status', 'Last payment', 'Current balance']);
    expect(table.querySelectorAll('button, a').length).toBe(0);
    expect(table.querySelectorAll('tbody tr').length).toBe(component.payingCases().length);
  });

  it('re-queries the API with the new year when the year filter changes', () => {
    mockApi.listCalls = [];
    debt.setYear('all');
    settle();

    expect(mockApi.listCalls.length).toBe(3);
    expect(mockApi.listCalls.every((q) => new URLSearchParams(q).get('year') === 'all')).toBeTrue();
    const rendered = fixture.nativeElement.querySelectorAll('app-case-row');
    expect(rendered.length).toBe(component.pickedCases().length + component.refundCases().length);
  });

  it('re-queries the API with the funding source, and only that funding source comes back', () => {
    mockApi.listCalls = [];
    debt.setFunding('gov');
    settle();

    expect(mockApi.listCalls.every((q) => new URLSearchParams(q).get('funding') === 'gov')).toBeTrue();
    const all = [...component.pickedCases(), ...component.refundCases(), ...component.payingCases()];
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((c) => c.d.funding === 'gov')).toBeTrue();
  });

  it('clicking a row navigates to Case Management with the correct case query param (issue #12)', () => {
    const all = [...component.pickedCases(), ...component.refundCases()];
    const targetId = all[0].d.id;

    component.openCase(targetId);

    expect(navigate).toHaveBeenCalledWith(['/cases'], { queryParams: { case: targetId } });
    expect(debt.caseId()).toBe(targetId);
  });

  it('#65 / #55 — sends the portfolio scope with every list call, defaulting to own', () => {
    expect(mockApi.listCalls.length).toBe(3);
    expect(mockApi.listCalls.every((q) => new URLSearchParams(q).get('portfolio') === 'own')).toBeTrue();
  });

  it('#65 / #55 — re-queries when the portfolio scope changes, and the new scope reaches the server', () => {
    mockApi.listCalls = [];
    debt.setPortfolioScope('team');
    settle();

    expect(mockApi.listCalls.length).toBe(3);
    expect(mockApi.listCalls.every((q) => new URLSearchParams(q).get('portfolio') === 'team')).toBeTrue();
  });

  it('#55 — a manager moving to the whole book asks for portfolio=all', () => {
    debt.setCurrentOfficer('grace-van-rooyen');
    mockApi.listCalls = [];
    debt.setPortfolioScope('all');
    settle();

    expect(mockApi.listCalls.every((q) => new URLSearchParams(q).get('portfolio') === 'all')).toBeTrue();
  });

  it('#55 — shows the error state (not a blank list) if the server refuses the scope with 403', () => {
    mockApi.enforcePortfolio = true;
    store.reload();
    // An officer cannot reach 'all' through the UI; force the refusal path the server would take.
    (debt as unknown as { portfolioScope: { set(v: string): void } }).portfolioScope.set('all');
    settle();

    expect(store.state()).toBe('error');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('#55 — maps the owning officer from the row onto the case', () => {
    expect(component.pickedCases().every((c) => typeof c.d.assignedOfficer === 'string')).toBeTrue();
    expect(component.pickedCases().some((c) => c.d.assignedOfficer !== '')).toBeTrue();
  });

  it('#65 AC4 — shows a loading state before the lists arrive', () => {
    store.state.set('loading');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading cases');
    expect(fixture.nativeElement.querySelectorAll('app-case-row').length).toBe(0);
  });

  it('#65 AC4 — shows an error with a working Retry when the API is down', () => {
    mockApi.failList = true;
    store.reload();
    fixture.detectChanges();

    expect(store.state()).toBe('error');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain("Couldn't load the cases");

    mockApi.failList = false;
    (fixture.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(store.state()).toBe('ready');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(component.pickedCases().length).toBeGreaterThan(0);
  });

  it('#65 AC4 — shows the empty message when the server returns no picked-up cases', () => {
    store.picked.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No student in this selection has missed a payment');
  });
});
