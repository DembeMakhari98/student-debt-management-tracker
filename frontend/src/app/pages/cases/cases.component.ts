import { Component, computed, effect, signal, Signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { CaseStore } from '../../core/case-store.service';
import { DecisionRequest, EngagementChannel, encodeAmendedTerms } from '../../core/debtor-api';
import { DebtService, formatRand, formatRandTight } from '../../core/debt.service';
import { AGE_BUCKETS, AGENTS, FUND, POLICY } from '../../core/constants';
import { CaseView, Term } from '../../core/models';

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

  /** e.g. "17 Nov 2026, 09:42" — the time on a stored activity entry. */
  when(iso: string): string {
    return new Date(iso).toLocaleString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private readonly queryParams: Signal<ParamMap | undefined>;

  constructor(
    public debt: DebtService,
    public store: CaseStore,
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
    // Evidence and the activity feed live on the detail endpoint, so fetch it whenever the open case changes.
    effect(() => {
      const id = this.selectedId();
      untracked(() => this.store.loadDetail(id));
    });
  }

  readonly list = computed<CaseView[]>(() => this.store.cases().map((c) => this.debt.withLocalState(c)));

  private readonly selectedId = computed<string | null>(() => {
    const list = this.list();
    if (!list.length) return null;
    const wanted = this.debt.caseId();
    return (list.find((c) => c.d.id === wanted) ?? list[0]).d.id;
  });

  /** The list entry for the open case, upgraded to the full detail once that has loaded. */
  readonly selected = computed<CaseView | null>(() => {
    const id = this.selectedId();
    const fromList = this.list().find((c) => c.d.id === id) ?? null;
    const detail = this.store.detail();
    return fromList && detail?.d.id === id ? this.debt.withLocalState(detail) : fromList;
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

  /**
   * Saves through the API; the panel closes only once the server has accepted the decision, and only
   * if the officer is still on that case — they may have moved on and opened another case's panel.
   */
  private save(debtorKey: string, request: DecisionRequest): void {
    this.store.decide(debtorKey, request).subscribe((saved) => {
      if (saved && this.selectedId() === debtorKey) this.closeDecisionPanel();
    });
  }

  approve(): void {
    const sel = this.selected();
    if (!sel) return;
    this.save(sel.d.id, { action: 'APPROVE' });
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
    this.save(sel.d.id, { action: 'AMEND', amendedTerms: encodeAmendedTerms(this.amendDraft()) });
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
    this.save(sel.d.id, { action: 'DECLINE', reason });
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
     ENGAGEMENT CHANNELS (issue #14, #59, #268) — every channel, including Hand to
     Adapt Connect, goes through the real engagement API via CaseStore.engage() so
     the action is attributed to the signed-in officer, timestamped, and survives a
     refresh. Gating by autonomy level and recommendation type is still an open
     item (Spec §6.3) — only Hand to Adapt Connect's Registration-hold gate exists.
     ========================================================================= */

  private engage(channel: EngagementChannel): void {
    const sel = this.selected();
    if (!sel) return;
    this.store.engage(sel.d.id, { channel }).subscribe();
  }

  sendSms(): void {
    this.engage('SMS');
  }

  /** Target gateway: Cuedesk API (confirmed by product owner) — not yet integrated server-side. */
  sendWhatsApp(): void {
    this.engage('WHATSAPP');
  }

  logCall(): void {
    this.engage('CALL');
  }

  /** Hand-over is only available once an officer has approved (or amended-and-approved) the case's
   *  Registration hold recommendation — the same rule the server enforces (issue #269, spec rule 7). */
  readonly canHandOver = computed(() => {
    const sel = this.selected();
    return !!sel && sel.rec.type === 'Registration hold'
      && (sel.decision?.action === 'Approved' || sel.decision?.action === 'Amended');
  });

  handOverTooltip(): string {
    return this.canHandOver()
      ? 'Hand this case to Adapt Connect for collections'
      : 'Only available once an officer has approved this case’s Registration hold recommendation';
  }

  handToAdaptConnect(): void {
    if (!this.canHandOver()) return;
    this.engage('HANDOVER');
  }
}
