import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { WriteBackFailure, WriteBackFailuresService } from '../../core/writeback-failures.service';

/** The admin screen for write-back failures (issue #69), surfacing
 *  `GET /api/admin/writeback/failures` (issue #3). Reachable only via `adminGuard`. */
@Component({
  selector: 'app-writebacks',
  standalone: true,
  templateUrl: './writebacks.component.html',
})
export class WritebacksComponent {
  constructor(public api: WriteBackFailuresService) {
    this.api.refresh();
  }

  readonly inFlight = signal<ReadonlySet<string>>(new Set());
  readonly retryMessage = signal<string | null>(null);

  refresh(): void {
    this.api.refresh();
  }

  retry(row: WriteBackFailure): void {
    this.retryMessage.set(null);
    this.inFlight.update((ids) => new Set(ids).add(row.attemptId));
    this.api.retry(row.attemptId).subscribe({
      next: () => {
        this.settle(row);
        this.retryMessage.set('Retry sent — the list has been refreshed.');
        this.api.refresh();
      },
      error: (err: HttpErrorResponse) => {
        this.settle(row);
        if (err.status === 409) {
          this.retryMessage.set('This entry has already synced to ITS Integrator — the list has been refreshed.');
          this.api.refresh();
        } else if (err.status === 404) {
          this.retryMessage.set('That attempt no longer exists — the list has been refreshed.');
          this.api.refresh();
        } else {
          this.retryMessage.set('Retry failed — the backend may be unreachable. Try again.');
        }
      },
    });
  }

  private settle(row: WriteBackFailure): void {
    this.inFlight.update((ids) => {
      const next = new Set(ids);
      next.delete(row.attemptId);
      return next;
    });
  }

  lastAttemptedLabel(iso: string): string {
    return new Date(iso).toLocaleString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
