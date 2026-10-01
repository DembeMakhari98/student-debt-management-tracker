import { Component, computed } from '@angular/core';
import { Router } from '@angular/router';
import { DebtService, formatRand } from '../../core/debt.service';
import { AGENTS, FUND } from '../../core/constants';
import { CaseView } from '../../core/models';
import { SummaryCardsComponent } from '../../shared/summary-cards/summary-cards.component';
import { CaseRowComponent } from '../../shared/case-row/case-row.component';

/** The Debt Management Tracker workspace worklist (issue #11). */
@Component({
  selector: 'app-tracker',
  standalone: true,
  imports: [SummaryCardsComponent, CaseRowComponent],
  templateUrl: './tracker.component.html',
})
export class TrackerComponent {
  readonly R = formatRand;
  readonly FUND = FUND;
  readonly AGENTS = AGENTS;

  constructor(
    public debt: DebtService,
    private router: Router,
  ) {}

  readonly pickedCases = computed<CaseView[]>(() => this.debt.pickedRows().map((d) => this.debt.caseOf(d)));
  readonly refundCases = computed<CaseView[]>(() => this.debt.refundRows().map((d) => this.debt.caseOf(d)));
  readonly payingRows = computed(() => this.debt.payingRows());

  statusColor(status: string): string {
    return status === 'Needs approval' ? 'var(--red-text)' : status === 'Agent acting' ? 'var(--ai-mid-blue)' : 'var(--fg-3)';
  }
  statusBg(status: string): string {
    return status === 'Needs approval' ? 'rgba(232,39,39,.07)' : status === 'Agent acting' ? 'rgba(0,102,144,.07)' : 'var(--bg-2)';
  }

  openCase(id: string): void {
    this.debt.setCase(id);
    this.router.navigate(['/cases'], { queryParams: { case: id } });
  }

  isCredit(c: CaseView): boolean {
    return this.debt.owedToStudent(c.d);
  }
  bandColor(c: CaseView): string {
    return this.isCredit(c) ? 'var(--ai-teal)' : this.debt.bandColor(c.band);
  }
}
