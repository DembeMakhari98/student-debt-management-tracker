import { Component, computed, effect, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { DebtService, formatRand, formatRandTight } from '../../core/debt.service';
import { AGE_BUCKETS, AGENTS, FUND, POLICY } from '../../core/constants';
import { ActivityEntry, CaseView, Term } from '../../core/models';

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
      if (id) {
        this.debt.setCase(id);
        this.closeDecisionPanel();
      }
    });
  }

  readonly list = computed<CaseView[]>(() => this.debt.caseRows().map((d) => this.debt.caseOf(d)));

  readonly selected = computed<CaseView | null>(() => {
    const list = this.list();
    if (!list.length) return null;
    const wanted = this.debt.caseId();
    return list.find((c) => c.d.id === wanted) ?? list[0];
  });

  readonly needingApproval = computed(() => this.list().filter((c) => this.debt.needsApproval(c)).length);

  readonly buckets = computed(() => {
    const sel = this.selected();
    if (!sel) return [];
    const withAmounts = AGE_BUCKETS.map((b) => ({ ...b, amt: Math.max(0, sel.d.ageing[b.key]) }));
    const max = Math.max(1, ...withAmounts.map((b) => b.amt));
    return withAmounts.map((b) => ({ ...b, pct: (b.amt / max) * 100 }));
  });

  selectCase(id: string): void {
    this.debt.setCase(id);
    this.closeDecisionPanel();
    this.router.navigate([], { relativeTo: this.route, queryParams: { case: id }, queryParamsHandling: 'merge' });
  }

  isCredit(c: CaseView): boolean {
    return this.debt.owedToStudent(c.d);
  }
  bandColor(c: CaseView): string {
    return this.isCredit(c) ? 'var(--ai-teal)' : this.debt.bandColor(c.band);
  }
  /** The pill shown for a case — its officer decision once resolved, otherwise the AI status. */
  displayStatus(c: CaseView): string {
    return c.decision?.action ?? c.rec.status;
  }
  /** Distinguishes an autonomy-level auto-decision (issue #8) from a human officer's, so the
   *  audit trail never misrepresents which one made the call. */
  decisionLabel(c: CaseView): string {
    return c.decision?.decidedBy.startsWith('Autonomous Agent') ? 'Auto-decision' : 'Officer decision';
  }
  statusColor(status: string): string {
    return status === 'Needs approval' || status === 'Declined'
      ? 'var(--red-text)'
      : status === 'Agent acting'
        ? 'var(--ai-mid-blue)'
        : status === 'Approved' || status === 'Amended'
          ? 'var(--teal-text)'
          : 'var(--fg-3)';
  }
  statusBg(status: string): string {
    return status === 'Needs approval' || status === 'Declined'
      ? 'rgba(232,39,39,.07)'
      : status === 'Agent acting'
        ? 'rgba(0,102,144,.07)'
        : status === 'Approved' || status === 'Amended'
          ? 'rgba(0,159,176,.08)'
          : 'var(--bg-2)';
  }

  /* =========================================================================
     OFFICER DECISION (issue #13) — approve, amend or decline the selected
     case's current recommendation. `panel` drives which inline editor (if any)
     is open under the recommendation card.
     ========================================================================= */

  readonly panel = signal<'none' | 'amend' | 'decline'>('none');
  readonly amendDraft = signal<Term[]>([]);
  readonly declineReason = signal('');

  closeDecisionPanel(): void {
    this.panel.set('none');
  }

  approve(): void {
    const sel = this.selected();
    if (!sel) return;
    this.debt.approveCase(sel.d);
    this.closeDecisionPanel();
  }

  openAmend(): void {
    const sel = this.selected();
    if (!sel) return;
    this.amendDraft.set(sel.rec.terms.map((t) => ({ ...t })));
    this.panel.set('amend');
  }

  updateAmendTerm(index: number, value: string): void {
    this.amendDraft.update((terms) => terms.map((t, i) => (i === index ? { ...t, v: value } : t)));
  }

  saveAmend(): void {
    const sel = this.selected();
    if (!sel) return;
    this.debt.amendCase(sel.d, this.amendDraft());
    this.closeDecisionPanel();
  }

  openDecline(): void {
    this.declineReason.set('');
    this.panel.set('decline');
  }

  updateDeclineReason(value: string): void {
    this.declineReason.set(value);
  }

  confirmDecline(): void {
    const sel = this.selected();
    const reason = this.declineReason().trim();
    if (!sel || !reason) return;
    this.debt.declineCase(sel.d, reason);
    this.closeDecisionPanel();
  }

  /** The terms to display — the officer's amended figures once amended, otherwise the AI's proposal. */
  displayTerms(c: CaseView): Term[] {
    return c.decision?.action === 'Amended' && c.decision.amendedTerms ? c.decision.amendedTerms : c.rec.terms;
  }

  decidedAtLabel(c: CaseView): string {
    if (!c.decision) return '';
    return new Date(c.decision.decidedAt).toLocaleString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /* =========================================================================
     ENGAGEMENT CHANNELS (issue #14) — frontend-only, session-lifetime activity
     entries. No real SMS/WhatsApp/Adapt Connect dispatch — see
     docs/SDD/issue-14-engagement-channels-panel.spec.md.
     ========================================================================= */

  private logEngagement(entry: ActivityEntry): void {
    const sel = this.selected();
    if (!sel) return;
    this.debt.logEngagementAction(sel.d.id, entry);
  }

  sendSms(): void {
    this.logEngagement({ t: 'SMS sent to student', m: 'Engagement Agent · Officer action' });
  }

  /** Target gateway: Cuedesk API (confirmed by product owner) — not yet integrated. */
  sendWhatsApp(): void {
    this.logEngagement({ t: 'WhatsApp message sent to student', m: 'Engagement Agent · Officer action' });
  }

  logCall(): void {
    this.logEngagement({ t: 'Call logged with student', m: 'Engagement Agent · Officer action' });
  }

  /** No-op: button is disabled pending the Adapt Connect hand-off interface (issue #14). */
  handToAdaptConnect(): void {}
}
