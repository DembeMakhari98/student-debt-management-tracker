import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE } from './api';
import { WriteBackFailure, WriteBackFailuresService } from './writeback-failures.service';

const FAILURE: WriteBackFailure = {
  activityLogEntryId: '11111111-1111-1111-1111-111111111111',
  debtorKey: 'STU-100234-2026',
  text: 'Recommendation approved by Nomsa Mahlangu',
  attemptCount: 3,
  lastAttemptedAt: '2026-06-01T00:00:00Z',
  lastError: 'ITS Integrator unreachable',
};

describe('WriteBackFailuresService — GET /api/admin/writeback/failures (issue #69)', () => {
  let service: WriteBackFailuresService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(WriteBackFailuresService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts with an empty list and is not loading until refresh() is called', () => {
    expect(service.failures()).toEqual([]);
    expect(service.loading()).toBeFalse();
  });

  it('refresh() requests GET /api/admin/writeback/failures and is loading until it resolves', () => {
    service.refresh();
    expect(service.loading()).toBeTrue();

    const req = httpMock.expectOne(`${API_BASE}/api/admin/writeback/failures`);
    expect(req.request.method).toBe('GET');
    req.flush([FAILURE]);

    expect(service.loading()).toBeFalse();
  });

  it('maps every field from the response onto the failures signal, field-for-field', () => {
    service.refresh();
    httpMock.expectOne(`${API_BASE}/api/admin/writeback/failures`).flush([FAILURE]);

    expect(service.failures()).toEqual([FAILURE]);
    expect(service.error()).toBeFalse();
  });

  it('sets error() and leaves failures() unchanged when the request fails', () => {
    service.refresh();
    httpMock.expectOne(`${API_BASE}/api/admin/writeback/failures`).flush('boom', { status: 500, statusText: 'Server Error' });

    expect(service.error()).toBeTrue();
    expect(service.failures()).toEqual([]);
    expect(service.loading()).toBeFalse();
  });

  it('clears a previous error on a subsequent successful refresh()', () => {
    service.refresh();
    httpMock.expectOne(`${API_BASE}/api/admin/writeback/failures`).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(service.error()).toBeTrue();

    service.refresh();
    httpMock.expectOne(`${API_BASE}/api/admin/writeback/failures`).flush([FAILURE]);

    expect(service.error()).toBeFalse();
    expect(service.failures()).toEqual([FAILURE]);
  });
});
