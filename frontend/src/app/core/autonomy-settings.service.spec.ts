import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE } from './api';
import { AutonomySettingsService } from './autonomy-settings.service';

describe('AutonomySettingsService (issue #57)', () => {
  let service: AutonomySettingsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AutonomySettingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('fetchLevel() reads autonomyLevel off GET /api/meta', () => {
    let result: number | undefined;
    service.fetchLevel().subscribe((level) => (result = level));

    const req = http.expectOne(`${API_BASE}/api/meta`);
    expect(req.request.method).toBe('GET');
    req.flush({ autonomyLevel: 3, years: [], currentCalendarYear: 2026, defaultYear: 2026, fundingSources: [], autonomyLevels: [] });

    expect(result).toBe(3);
  });

  it('updateLevel() PUTs the level and resolves with the persisted value', () => {
    let result: number | undefined;
    service.updateLevel(4).subscribe((level) => (result = level));

    const req = http.expectOne(`${API_BASE}/api/settings/autonomy`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ level: 4 });
    req.flush({ level: 4 });

    expect(result).toBe(4);
  });
});
