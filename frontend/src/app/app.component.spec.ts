import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { DebtService } from './core/debt.service';
import { Meta } from './core/models';
import { API_BASE } from './core/api';

function meta(overrides: Partial<Meta> = {}): Meta {
  return {
    years: [2024, 2025, 2026],
    currentCalendarYear: 2026,
    defaultYear: 2026,
    fundingSources: [
      { value: 'SELF', label: 'Self-funded' },
      { value: 'GOV', label: 'Government (NSFAS)' },
      { value: 'PRIVATE', label: 'Private / Bursary' },
    ],
    autonomyLevel: 2,
    autonomyLevels: [
      { name: '1 · Observe', hint: 'Score and report only' },
      { name: '2 · Recommend', hint: 'Human accepts every action' },
      { name: '3 · Act within policy', hint: 'Low-risk actions automatic' },
      { name: '4 · Act and report', hint: 'Full workflow, post-hoc review' },
    ],
    ...overrides,
  };
}

describe('AppComponent — global chrome export button (issue #17)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AppComponent>>;
  let debt: DebtService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });

    fixture = TestBed.createComponent(AppComponent);
    debt = TestBed.inject(DebtService);
    fixture.detectChanges();
  });

  it('calls DebtService.exportCsv() when the Export CSV button is clicked', () => {
    spyOn(debt, 'exportCsv');

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const exportButton = buttons.find((b) => b.textContent?.trim() === 'Export CSV');
    expect(exportButton).toBeTruthy();

    exportButton!.click();

    expect(debt.exportCsv).toHaveBeenCalled();
  });
});

describe('AppComponent — signed-in user (JWT login)', () => {
  const STORAGE_KEY = 'sdt.session';

  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('shows the signed-in user instead of an officer switcher and scopes the portfolio to them', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: 't',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: { username: 'anele.dube', displayName: 'Anele Dube', role: 'OFFICER', team: 'Team B', officerKey: 'anele-dube' },
      }),
    );
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('select[aria-label="Signed in as"]')).toBeNull();
    expect(el.querySelector('.who')!.textContent).toContain('Anele Dube');
    expect(el.querySelector('.who')!.textContent).toContain('Student debt officer · Team B');
    expect(el.querySelector('.sign-out')).toBeTruthy();
    expect(TestBed.inject(DebtService).currentOfficerId()).toBe('anele-dube');

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_BASE}/api/auth/me`).flush({ username: 'anele.dube', displayName: 'Anele Dube', role: 'OFFICER', team: 'Team B', officerKey: 'anele-dube' });
    http.expectOne(`${API_BASE}/api/meta`).flush({ autonomyLevel: 2 });
  });
});

describe('AppComponent — autonomy dropdown gating (issue #57)', () => {
  const STORAGE_KEY = 'sdt.session';
  let http: HttpTestingController;

  function signInAs(role: 'OFFICER' | 'MANAGER'): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: 't',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: {
          username: role === 'MANAGER' ? 'grace.vanrooyen' : 'anele.dube',
          displayName: role === 'MANAGER' ? 'Grace van Rooyen' : 'Anele Dube',
          role,
          team: role === 'MANAGER' ? 'Team C' : 'Team B',
          officerKey: role === 'MANAGER' ? 'grace-van-rooyen' : 'anele-dube',
        },
      }),
    );
  }

  /** The shell's CaseStore loads the worklist as soon as a user is signed in; these tests don't care about it. */
  function flushWorklist(): void {
    http.match((r) => r.url.startsWith(`${API_BASE}/api/debtors`)).forEach((r) => r.flush([]));
  }

  afterEach(() => {
    http.verify();
    localStorage.removeItem(STORAGE_KEY);
  });

  function autonomySelect(fixture: ReturnType<typeof TestBed.createComponent<AppComponent>>): HTMLSelectElement {
    return fixture.nativeElement.querySelector('select[aria-label="Agent autonomy"]');
  }

  it('disables the select for an officer, who cannot change it', () => {
    signInAs('OFFICER');
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    http.expectOne(`${API_BASE}/api/auth/me`).flush({ username: 'anele.dube', displayName: 'Anele Dube', role: 'OFFICER', team: 'Team B', officerKey: 'anele-dube' });
    http.expectOne(`${API_BASE}/api/meta`).flush(meta({ autonomyLevel: 2 }));
    flushWorklist();
    http.expectOne((r) => r.url === `${API_BASE}/api/summary`).flush({
      registeredStudents: 0, totalDebt: 0, debtorCount: 0, totalCredit: 0, creditCount: 0,
      atRisk90Plus: 0, atRisk90PlusPct: 0, averageBalance: 0,
    });

    expect(autonomySelect(fixture).disabled).toBeTrue();
  });

  it('enables the select for a manager and persists a change via PUT /api/settings/autonomy', () => {
    signInAs('MANAGER');
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    http.expectOne(`${API_BASE}/api/auth/me`).flush({ username: 'grace.vanrooyen', displayName: 'Grace van Rooyen', role: 'MANAGER', team: 'Team C', officerKey: 'grace-van-rooyen' });
    http.expectOne(`${API_BASE}/api/meta`).flush(meta({ autonomyLevel: 2 }));
    http.expectOne((r) => r.url.includes('/api/admin/extract/history')).flush([]);
    flushWorklist();
    http.expectOne((r) => r.url === `${API_BASE}/api/summary`).flush({
      registeredStudents: 0, totalDebt: 0, debtorCount: 0, totalCredit: 0, creditCount: 0,
      atRisk90Plus: 0, atRisk90PlusPct: 0, averageBalance: 0,
    });
    fixture.detectChanges();

    const select = autonomySelect(fixture);
    expect(select.disabled).toBeFalse();

    select.value = '3';
    select.dispatchEvent(new Event('change'));

    const req = http.expectOne(`${API_BASE}/api/settings/autonomy`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ level: 3 });
    req.flush({ level: 3 });

    expect(TestBed.inject(DebtService).autonomy()).toBe(3);
  });
});

describe('AppComponent — reference data from GET /api/meta (issue #63)', () => {
  const STORAGE_KEY = 'sdt.session';
  let http: HttpTestingController;

  function signIn(): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: 't',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: { username: 'grace.vanrooyen', displayName: 'Grace van Rooyen', role: 'MANAGER', team: 'Team C', officerKey: 'grace-van-rooyen' },
      }),
    );
  }

  function create(): ReturnType<typeof TestBed.createComponent<AppComponent>> {
    signIn();
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    http.expectOne(`${API_BASE}/api/auth/me`).flush({ username: 'grace.vanrooyen', displayName: 'Grace van Rooyen', role: 'MANAGER', team: 'Team C', officerKey: 'grace-van-rooyen' });
    return fixture;
  }

  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('shows a loading placeholder while GET /api/meta is in flight', () => {
    const fixture = create();
    expect(fixture.nativeElement.textContent).toContain('Loading filters…');
  });

  it('renders the funding-source and autonomy-level options once meta loads', () => {
    const fixture = create();
    http.expectOne(`${API_BASE}/api/meta`).flush(meta());
    http.expectOne((r) => r.url.includes('/api/admin/extract/history')).flush([]);
    http.expectOne((r) => r.url === `${API_BASE}/api/summary`).flush({
      registeredStudents: 0, totalDebt: 0, debtorCount: 0, totalCredit: 0, creditCount: 0,
      atRisk90Plus: 0, atRisk90PlusPct: 0, averageBalance: 0,
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const fundSel = el.querySelector<HTMLSelectElement>('#fundSel')!;
    expect(Array.from(fundSel.options).map((o) => o.textContent?.trim())).toEqual([
      'All funding types',
      'Self-funded',
      'Government (NSFAS)',
      'Private / Bursary',
    ]);

    const autonomySel = el.querySelector<HTMLSelectElement>('select[aria-label="Agent autonomy"]')!;
    expect(autonomySel.options.length).toBe(4);
    expect(autonomySel.options[0].textContent).toContain('1 · Observe');

    expect(el.textContent).not.toContain('Loading filters…');
  });

  it('shows a retry control when GET /api/meta fails, and recovers once retried', () => {
    const fixture = create();
    http.expectOne(`${API_BASE}/api/meta`).flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain("Couldn't load filter options.");
    const retry = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Retry')!;
    expect(retry).toBeTruthy();

    retry.click();
    http.expectOne(`${API_BASE}/api/meta`).flush(meta());
    http.expectOne((r) => r.url.includes('/api/admin/extract/history')).flush([]);
    http.expectOne((r) => r.url === `${API_BASE}/api/summary`).flush({
      registeredStudents: 0, totalDebt: 0, debtorCount: 0, totalCredit: 0, creditCount: 0,
      atRisk90Plus: 0, atRisk90PlusPct: 0, averageBalance: 0,
    });
    fixture.detectChanges();

    expect(el.textContent).not.toContain("Couldn't load filter options.");
  });
});
