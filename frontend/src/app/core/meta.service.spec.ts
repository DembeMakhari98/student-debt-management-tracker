import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE } from './api';
import { Meta } from './models';
import { MetaService } from './meta.service';

function meta(overrides: Partial<Meta> = {}): Meta {
  return {
    years: [2024, 2025, 2026],
    currentCalendarYear: 2026,
    defaultYear: 2026,
    fundingSources: [
      { value: 'SELF', label: 'Self-funded' },
      { value: 'GOV', label: 'Government (NSFAS)' },
      { value: 'PRIVATE', label: 'Private / Bursary' },
    ],
    autonomyLevel: 2,
    autonomyLevels: [{ name: '1 · Observe', hint: 'Score and report only' }],
    ...overrides,
  };
}

describe('MetaService (issue #63)', () => {
  let service: MetaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MetaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts with no reference data loaded', () => {
    expect(service.meta()).toBeNull();
    expect(service.loading()).toBeFalse();
    expect(service.error()).toBeFalse();
  });

  it('refresh() loads GET /api/meta and exposes it, tracking loading state', () => {
    service.refresh();
    expect(service.loading()).toBeTrue();

    const req = http.expectOne(`${API_BASE}/api/meta`);
    expect(req.request.method).toBe('GET');
    req.flush(meta());

    expect(service.loading()).toBeFalse();
    expect(service.error()).toBeFalse();
    expect(service.meta()).toEqual(meta());
  });

  it('sets error() on failure and keeps the previous meta unset', () => {
    service.refresh();
    http.expectOne(`${API_BASE}/api/meta`).flush('boom', { status: 500, statusText: 'Server Error' });

    expect(service.loading()).toBeFalse();
    expect(service.error()).toBeTrue();
    expect(service.meta()).toBeNull();
  });

  it('a later successful refresh clears a previous error', () => {
    service.refresh();
    http.expectOne(`${API_BASE}/api/meta`).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(service.error()).toBeTrue();

    service.refresh();
    http.expectOne(`${API_BASE}/api/meta`).flush(meta());

    expect(service.error()).toBeFalse();
    expect(service.meta()).toEqual(meta());
  });
});
