import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DebtService, formatRand } from '../../core/debt.service';
import { AGENTS, FUND } from '../../core/constants';
import { CaseView } from '../../core/models';

/** One worklist row — shared by the picked-up list and the refund queue (issue #11). */
@Component({
  selector: 'app-case-row',
  standalone: true,
  templateUrl: './case-row.component.html',
})
export class CaseRowComponent {
  @Input({ required: true }) case!: CaseView;
  @Output() open = new EventEmitter<string>();

  readonly R = formatRand;
  readonly FUND = FUND;
  readonly AGENTS = AGENTS;

  constructor(public debt: DebtService) {}

  get isCredit(): boolean {
    return this.debt.owedToStudent(this.case.d);
  }
  get badgeColor(): string {
    return this.isCredit ? 'var(--ai-teal)' : this.debt.bandColor(this.case.band);
  }
  /** Once an officer (or the autonomy agent) has decided this case, the row must reflect that
   *  decision rather than the now-stale raw recommendation status (#13 AC6). */
  get displayStatus(): string {
    return this.case.decision?.action ?? this.case.rec.status;
  }
  statusColor(status: string): string {
    if (this.case.decision) return 'var(--ai-teal)';
    return status === 'Needs approval' ? 'var(--red-text)' : status === 'Agent acting' ? 'var(--ai-mid-blue)' : 'var(--fg-3)';
  }
  statusBg(status: string): string {
    if (this.case.decision) return 'rgba(0,168,150,.08)';
    return status === 'Needs approval' ? 'rgba(232,39,39,.07)' : status === 'Agent acting' ? 'rgba(0,102,144,.07)' : 'var(--bg-2)';
  }
}
