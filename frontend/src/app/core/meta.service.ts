import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { API_BASE } from './api';
import { Meta } from './models';

/**
 * Reference data for the global chrome's filters (issue #63) — years, the default year,
 * funding sources and autonomy levels, previously hardcoded in core/constants.ts and derived
 * from core/mock-data.ts. Mirrors ExtractStatusService's loading/error shape.
 */
@Injectable({ providedIn: 'root' })
export class MetaService {
  readonly meta = signal<Meta | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  constructor(private http: HttpClient) {}

  refresh(): void {
    this.loading.set(true);
    this.error.set(false);
    this.http
      .get<Meta>(`${API_BASE}/api/meta`)
      .pipe(
        tap((meta) => this.meta.set(meta)),
        catchError(() => {
          this.error.set(true);
          return of(null);
        }),
      )
      .subscribe(() => this.loading.set(false));
  }
}
