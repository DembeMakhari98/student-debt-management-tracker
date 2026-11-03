import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { API_BASE } from '../api';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { LoginResponse } from './auth.models';

const STORAGE_KEY = 'sdt.session';

function response(overrides: Partial<LoginResponse> = {}): LoginResponse {
  return {
    token: 'header.payload.signature',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: { username: 'grace.vanrooyen', displayName: 'Grace van Rooyen', role: 'MANAGER', team: 'Team C', officerKey: 'grace-van-rooyen' },
    ...overrides,
  };
}

describe('AuthService (JWT login)', () => {
  let http: HttpTestingController;

  function setup(): AuthService {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  /** Flushes the GET /api/auth/me revalidation call every restored-session startup issues (issue #63). */
  function flushMe(user = response().user, status = 200): void {
    const req = http.expectOne(`${API_BASE}/api/auth/me`);
    expect(req.request.method).toBe('GET');
    if (status === 200) req.flush(user);
    else req.flush({ message: 'Unauthorized' }, { status, statusText: 'Unauthorized' });
  }

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  });

  it('starts signed out', () => {
    const auth = setup();
    expect(auth.isAuthenticated()).toBeFalse();
    expect(auth.user()).toBeNull();
  });

  it('posts trimmed credentials and stores the session on success', () => {
    const auth = setup();
    auth.login('  grace.vanrooyen ', 'Debt@2026!', true).subscribe();

    const req = http.expectOne(`${API_BASE}/api/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'grace.vanrooyen', password: 'Debt@2026!' });
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush(response());

    expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.user()?.role).toBe('MANAGER');
    expect(auth.canSeeAdminJobs()).toBeTrue();
    expect(localStorage.getItem(STORAGE_KEY)).toContain('header.payload.signature');
  });

  it('keeps the session only for the tab when "Keep me signed in" is off', () => {
    const auth = setup();
    auth.login('grace.vanrooyen', 'Debt@2026!', false).subscribe();
    http.expectOne(`${API_BASE}/api/auth/login`).flush(response());

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toContain('header.payload.signature');
  });

  it('stays signed out when the backend rejects the credentials', () => {
    const auth = setup();
    let failed = false;
    auth.login('grace.vanrooyen', 'wrong', true).subscribe({ error: () => (failed = true) });
    http.expectOne(`${API_BASE}/api/auth/login`).flush({ message: 'Incorrect username or password' }, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBeTrue();
    expect(auth.isAuthenticated()).toBeFalse();
  });

  it('restores a stored, unexpired session on startup', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response()));
    const auth = setup();
    expect(auth.user()?.displayName).toBe('Grace van Rooyen');
    expect(auth.restoringSession()).toBeTrue();

    flushMe();
    expect(auth.restoringSession()).toBeFalse();
  });

  it('refreshes the user from GET /api/auth/me on startup', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response()));
    const auth = setup();

    flushMe({ username: 'grace.vanrooyen', displayName: 'Grace van Rooyen', role: 'ADMIN', team: null, officerKey: null });

    expect(auth.user()?.role).toBe('ADMIN');
    expect(auth.canSeeAdminJobs()).toBeTrue();
    expect(auth.restoreError()).toBeFalse();
  });

  it('signs out via the interceptor when GET /api/auth/me returns 401 on startup', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response()));
    const auth = setup();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    flushMe(undefined, 401);

    expect(auth.isAuthenticated()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('keeps the cached session and sets restoreError() when the startup check cannot reach the backend', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response()));
    const auth = setup();

    const req = http.expectOne(`${API_BASE}/api/auth/me`);
    req.error(new ProgressEvent('error'), { status: 0 });

    expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.user()?.displayName).toBe('Grace van Rooyen');
    expect(auth.restoreError()).toBeTrue();
    expect(auth.restoringSession()).toBeFalse();
  });

  it('discards an expired stored session', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response({ expiresAt: new Date(Date.now() - 1000).toISOString() })));
    const auth = setup();
    expect(auth.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('attaches the bearer token to API calls', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response()));
    setup();
    flushMe();
    TestBed.inject(HttpClient).get(`${API_BASE}/api/debtors`).subscribe();

    const req = http.expectOne(`${API_BASE}/api/debtors`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer header.payload.signature');
    req.flush([]);
  });

  it('does not send the token to other hosts', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response()));
    setup();
    flushMe();
    TestBed.inject(HttpClient).get('https://example.org/data').subscribe();

    const req = http.expectOne('https://example.org/data');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('signs out and returns to /login when an authenticated call gets a 401', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response()));
    const auth = setup();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    flushMe();

    TestBed.inject(HttpClient).get(`${API_BASE}/api/debtors`).subscribe({ error: () => undefined });
    http.expectOne(`${API_BASE}/api/debtors`).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
