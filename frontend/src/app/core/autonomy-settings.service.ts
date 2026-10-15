import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE } from './api';

/**
 * Reads and writes the system-wide agent autonomy level (issue #57). Mirrors
 * ExtractStatusService's shape — the app's other direct-HTTP integration point;
 * everything else still reads DebtService's local mock dataset.
 */
@Injectable({ providedIn: 'root' })
export class AutonomySettingsService {
  constructor(private http: HttpClient) {}

  /** The level currently persisted on the backend, visible to any signed-in user. */
  fetchLevel(): Observable<number> {
    return this.http.get<{ autonomyLevel: number }>(`${API_BASE}/api/meta`).pipe(map((m) => m.autonomyLevel));
  }

  /** MANAGER/ADMIN only — the backend 403s anyone else; this is just the client call. */
  updateLevel(level: number): Observable<number> {
    return this.http
      .put<{ level: number }>(`${API_BASE}/api/settings/autonomy`, { level })
      .pipe(map((r) => r.level));
  }
}
