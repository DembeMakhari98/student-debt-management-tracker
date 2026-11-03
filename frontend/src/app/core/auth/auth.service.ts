import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, filter, map, of, tap } from 'rxjs';
import { API_BASE } from '../api';
import { AuthUser, LoginResponse, Session } from './auth.models';

const STORAGE_KEY = 'sdt.session';

/**
 * JWT sign-in against the backend. The session survives a page refresh: in localStorage
 * when "Keep me signed in" is ticked, otherwise in sessionStorage (cleared with the tab).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly session = signal<Session | null>(null);
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly user = computed<AuthUser | null>(() => this.session()?.user ?? null);
  readonly token = computed<string | null>(() => this.session()?.token ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly canSeeAdminJobs = computed(() => {
    const role = this.user()?.role;
    return role === 'ADMIN' || role === 'MANAGER';
  });

  /** True while a restored session is being revalidated against GET /api/auth/me on app
   *  start (issue #63). A 401 is handled by authInterceptor, which signs the user out. */
  readonly restoringSession = signal(false);
  /** The revalidation call failed for a reason other than an expired/revoked token (e.g. the
   *  backend was unreachable) — the cached session is kept rather than signing the user out. */
  readonly restoreError = signal(false);

  constructor(
    private http: HttpClient,
    private httpBackend: HttpBackend,
    private router: Router,
  ) {
    const restored = this.readStored();
    if (restored) {
      this.start(restored);
      this.revalidate(restored.token);
    }
  }

  /** Confirms a restored session is still good, and refreshes the cached user from the
   *  backend's record of them rather than trusting what was last persisted (issue #63).
   *  Goes straight to HttpBackend rather than through HttpClient/authInterceptor: this
   *  runs from the constructor, and the interceptor itself injects AuthService — routing
   *  through it here would be a circular dependency on the instance still being built. */
  private revalidate(token: string): void {
    this.restoringSession.set(true);
    this.restoreError.set(false);
    const request = new HttpRequest<void>('GET', `${API_BASE}/api/auth/me`, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
    });
    this.httpBackend
      .handle(request)
      .pipe(
        filter((event): event is HttpResponse<AuthUser> => event instanceof HttpResponse),
        tap((response) => {
          const user = response.body;
          const current = this.session();
          if (current && user) this.session.set({ ...current, user });
        }),
        catchError((err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.logout();
          } else {
            this.restoreError.set(true);
          }
          return of(null);
        }),
      )
      .subscribe(() => this.restoringSession.set(false));
  }

  login(username: string, password: string, remember: boolean): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_BASE}/api/auth/login`, { username: username.trim(), password })
      .pipe(
        tap((response) => {
          this.store(response, remember);
          this.start(response);
        }),
      );
  }

  logout(redirect = true): void {
    this.session.set(null);
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    for (const storage of this.storages()) {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        /* storage unavailable: nothing to clear */
      }
    }
    if (redirect) this.router.navigate(['/login']);
  }

  private start(session: Session): void {
    this.session.set(session);
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    const msLeft = Date.parse(session.expiresAt) - Date.now();
    // setTimeout caps at ~24.8 days; tokens are hours, so this always fits.
    this.expiryTimer = setTimeout(() => this.logout(), Math.max(msLeft, 0));
  }

  private store(session: Session, remember: boolean): void {
    try {
      (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* storage unavailable: the session just won't survive a refresh */
    }
  }

  private readStored(): Session | null {
    for (const storage of this.storages()) {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) continue;
        const session = JSON.parse(raw) as Session;
        if (session?.token && Date.parse(session.expiresAt) > Date.now()) return session;
        storage.removeItem(STORAGE_KEY);
      } catch {
        /* unreadable or blocked storage: treat as signed out */
      }
    }
    return null;
  }

  private storages(): Storage[] {
    try {
      return [localStorage, sessionStorage];
    } catch {
      return [];
    }
  }
}
