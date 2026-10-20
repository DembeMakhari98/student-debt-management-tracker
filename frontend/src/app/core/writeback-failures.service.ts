import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { API_BASE } from './api';

/** One row from `GET /api/admin/writeback/failures` (backend's WriteBackFailureDto, issue #3). */
export interface WriteBackFailure {
  activityLogEntryId: string;
  debtorKey: string | null;
  text: string | null;
  attemptCount: number;
  lastAttemptedAt: string;
  lastError: string | null;
}

/**
 * Surfaces activity-log entries whose write-back to ITS Integrator has exhausted every retry
 * (issue #3's AC3, admin screen built in issue #69) — MANAGER/ADMIN only, enforced server-side
 * by the same `/api/admin/**` rule as the extract-history endpoint.
 */
@Injectable({ providedIn: 'root' })
export class WriteBackFailuresService {
  readonly failures = signal<WriteBackFailure[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);

  constructor(private http: HttpClient) {}

  refresh(): void {
    this.loading.set(true);
    this.error.set(false);
    this.http
      .get<WriteBackFailure[]>(`${API_BASE}/api/admin/writeback/failures`)
      .pipe(
        tap((data) => this.failures.set(data)),
        catchError(() => {
          this.error.set(true);
          return of(null);
        }),
      )
      .subscribe(() => this.loading.set(false));
  }
}
