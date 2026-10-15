import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { DebtService } from './core/debt.service';
import { API_BASE } from './core/api';

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

    TestBed.inject(HttpTestingController).expectOne(`${API_BASE}/api/meta`).flush({ autonomyLevel: 2 });
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
    http.expectOne(`${API_BASE}/api/meta`).flush({ autonomyLevel: 2 });

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
    http.expectOne(`${API_BASE}/api/meta`).flush({ autonomyLevel: 2 });
    http.expectOne((r) => r.url.includes('/api/admin/extract/history')).flush([]);

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
