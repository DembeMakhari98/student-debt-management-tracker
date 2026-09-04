import { Component, computed, effect, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { DebtService, formatRand, formatRandTight } from '../../core/debt.service';
import { AGE_BUCKETS, AGENTS, FUND, POLICY } from '../../core/constants';
import { CaseView } from '../../core/models';

/** Case management & AI recommendation — case list + full case detail (issue #12, #13). */
@Component({
  selector: 'app-cases',
  standalone: true,
  templateUrl: './cases.component.html',
})
export class CasesComponent {
  readonly R = formatRand;
  readonly R0 = formatRandTight;
  readonly FUND = FUND;
  readonly AGENTS = AGENTS;
  readonly POLICY = POLICY;
  readonly AGE_BUCKETS = AGE_BUCKETS;

  private readonly queryParams: Signal<ParamMap | undefined>;

  constructor(
    public debt: DebtService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.queryParams = toSignal(this.route.queryParamMap, { requireSync: false });
    // Deep-link support: /cases?case=STU-100234 opens straight to that case.
    effect(() => {
      const id = this.queryParams()?.get('case');
      if (id) this.debt.setCase(id);
    });
  }

  readonly list = computed<CaseView[]>(() => this.debt.caseRows().map((d) => this.debt.caseOf(d)));

  readonly selected = computed<CaseView | null>(() => {
    const list = this.list();
    if (!list.length) return null;
    const wanted = this.debt.caseId();
    return list.find((c) => c.d.id === wanted) ?? list[0];
  });

  readonly needingApproval = computed(() => this.list().filter((c) => c.rec.status === 'Needs approval').length);

  readonly buckets = computed(() => {
    const sel = this.selected();
    if (!sel) return [];
    const withAmounts = AGE_BUCKETS.map((b) => ({ ...b, amt: Math.max(0, sel.d.ageing[b.key]) }));
    const max = Math.max(1, ...withAmounts.map((b) => b.amt));
    return withAmounts.map((b) => ({ ...b, pct: (b.amt / max) * 100 }));
  });

  selectCase(id: string): void {
    this.debt.setCase(id);
    this.router.navigate([], { relativeTo: this.route, queryParams: { case: id }, queryParamsHandling: 'merge' });
  }

  isCredit(c: CaseView): boolean {
    return this.debt.owedToStudent(c.d);
  }
  bandColor(c: CaseView): string {
    return this.isCredit(c) ? 'var(--ai-teal)' : this.debt.bandColor(c.band);
  }
  statusColor(status: string): string {
    return status === 'Needs approval' ? 'var(--red-text)' : status === 'Agent acting' ? 'var(--ai-mid-blue)' : 'var(--fg-3)';
  }
  statusBg(status: string): string {
    return status === 'Needs approval' ? 'rgba(232,39,39,.07)' : status === 'Agent acting' ? 'rgba(0,102,144,.07)' : 'var(--bg-2)';
  }
}
