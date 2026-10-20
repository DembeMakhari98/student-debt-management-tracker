import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE } from './api';

/**
 * Writes the system-wide agent autonomy level (issue #57). The current level is read via
 * MetaService (`GET /api/meta`, issue #63) rather than fetched separately here.
 */
@Injectable({ providedIn: 'root' })
export class AutonomySettingsService {
  constructor(private http: HttpClient) {}

  /** MANAGER/ADMIN only — the backend 403s anyone else; this is just the client call. */
  updateLevel(level: number): Observable<number> {
    return this.http
      .put<{ level: number }>(`${API_BASE}/api/settings/autonomy`, { level })
      .pipe(map((r) => r.level));
  }
}
