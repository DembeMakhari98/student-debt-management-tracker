import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE } from '../../core/api';
import { WriteBackFailure } from '../../core/writeback-failures.service';
import { WritebacksComponent } from './writebacks.component';

const FAILURES: WriteBackFailure[] = [
  {
    activityLogEntryId: '11111111-1111-1111-1111-111111111111',
    debtorKey: 'STU-100234-2026',
    text: 'Recommendation approved by Nomsa Mahlangu',
    attemptCount: 3,
    lastAttemptedAt: '2026-06-01T08:30:00Z',
    lastError: 'ITS Integrator unreachable',
  },
  {
    activityLogEntryId: '22222222-2222-2222-2222-222222222222',
    debtorKey: null,
    text: null,
    attemptCount: 3,
    lastAttemptedAt: '2026-06-02T10:00:00Z',
    lastError: null,
  },
];

describe('WritebacksComponent — admin screen for write-back failures (issue #69)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<WritebacksComponent>>;
  let httpMock: HttpTestingController;

  function expectRequest() {
    return httpMock.expectOne(`${API_BASE}/api/admin/writeback/failures`);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WritebacksComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WritebacksComponent);
  });

  afterEach(() => httpMock.verify());

  it('requests GET /api/admin/writeback/failures on construction', () => {
    expectRequest().flush([]);
  });

  it('renders one row per failure, with a "—" fallback for null debtorKey/text/lastError', () => {
    expectRequest().flush(FAILURES);
    fixture.detectChanges();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('STU-100234-2026');
    expect(rows[0].textContent).toContain('Recommendation approved by Nomsa Mahlangu');
    expect(rows[0].textContent).toContain('ITS Integrator unreachable');
    expect(rows[1].textContent).toContain('—');
  });

  it('shows the empty state when there are no failures', () => {
    expectRequest().flush([]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No write-back failures');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr').length).toBe(0);
  });

  it('shows the backend-unreachable note when the request fails', () => {
    expectRequest().flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Backend unreachable');
  });

  it('clicking Refresh re-requests the failures list', () => {
    expectRequest().flush(FAILURES);
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    const refreshButton = buttons.find((b) => b.textContent?.trim() === 'Refresh');
    expect(refreshButton).toBeTruthy();
    refreshButton!.click();

    expectRequest().flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No write-back failures');
  });
});
