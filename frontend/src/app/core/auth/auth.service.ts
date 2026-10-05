import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
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

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    const restored = this.readStored();
    if (restored) this.start(restored);
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
