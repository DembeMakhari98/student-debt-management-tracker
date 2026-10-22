import { Component } from '@angular/core';
import { WriteBackFailuresService } from '../../core/writeback-failures.service';

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

  refresh(): void {
    this.api.refresh();
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
