import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';

export interface JobRunLog {
  id: string;
  jobName: string;
  status: 'SUCCESS' | 'FAILURE';
  startedAt: string;
  finishedAt: string;
  recordsProcessed: number;
  errorMessage: string | null;
}

/**
 * Dev-only default matching the backend's documented port (see ../backend/README.md).
 * This is the app's one real frontend->backend integration point so far (issue #2's
 * nightly extract) — everything else still reads the local mock dataset (see
 * DebtService's doc comment).
 */
const API_BASE = 'http://localhost:8080';

/** Surfaces the nightly extraction job's last run (issue #2) in the chrome. */
@Injectable({ providedIn: 'root' })
export class ExtractStatusService {
  readonly latestRun = signal<JobRunLog | null>(null);
  readonly unreachable = signal(false);
  readonly loading = signal(false);

  constructor(private http: HttpClient) {}

  refresh(): void {
    this.loading.set(true);
    this.http
      .get<JobRunLog[]>(`${API_BASE}/api/admin/extract/history`, { params: { limit: 1 } })
      .pipe(
        tap((runs) => {
          this.latestRun.set(runs[0] ?? null);
          this.unreachable.set(false);
        }),
        catchError(() => {
          this.unreachable.set(true);
          return of(null);
        }),
      )
      .subscribe(() => this.loading.set(false));
  }

  triggerRun(): void {
    this.loading.set(true);
    this.http
      .post<JobRunLog>(`${API_BASE}/api/admin/extract/run`, {})
      .pipe(
        tap((run) => {
          this.latestRun.set(run);
          this.unreachable.set(false);
        }),
        catchError(() => {
          this.unreachable.set(true);
          return of(null);
        }),
      )
      .subscribe(() => this.loading.set(false));
  }
}
