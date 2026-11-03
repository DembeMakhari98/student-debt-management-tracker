import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './auth.guard';
import { UserRole } from './auth.models';

const STORAGE_KEY = 'sdt.session';

describe('auth guards', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/cases' } as RouterStateSnapshot;

  function setup(signedIn: boolean, role: UserRole = 'OFFICER'): void {
    if (signedIn) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          token: 't',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          user: { username: 'anele.dube', displayName: 'Anele Dube', role, team: 'Team B', officerKey: 'anele-dube' },
        }),
      );
    }
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  }

  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('authGuard sends a signed-out visitor to /login with a return URL', () => {
    setup(false);
    const result = TestBed.runInInjectionContext(() => authGuard(route, state)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fcases');
  });

  it('authGuard lets a signed-in user through', () => {
    setup(true);
    expect(TestBed.runInInjectionContext(() => authGuard(route, state))).toBeTrue();
  });

  it('guestGuard sends a signed-in user from /login to /home', () => {
    setup(true);
    const result = TestBed.runInInjectionContext(() => guestGuard(route, state)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/home');
  });

  it('guestGuard shows /login to a signed-out visitor', () => {
    setup(false);
    expect(TestBed.runInInjectionContext(() => guestGuard(route, state))).toBeTrue();
  });

  it('adminGuard bounces an OFFICER to /home (issue #69)', () => {
    setup(true, 'OFFICER');
    const result = TestBed.runInInjectionContext(() => adminGuard(route, state)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/home');
  });

  it('adminGuard lets a MANAGER through (issue #69)', () => {
    setup(true, 'MANAGER');
    expect(TestBed.runInInjectionContext(() => adminGuard(route, state))).toBeTrue();
  });

  it('adminGuard lets an ADMIN through (issue #69)', () => {
    setup(true, 'ADMIN');
    expect(TestBed.runInInjectionContext(() => adminGuard(route, state))).toBeTrue();
  });
});
