import { Injectable, computed, signal } from '@angular/core';
import { AGE_BUCKETS, AGENTS, AS_AT, CURRENT_OFFICER, FUND, FUND_RISK, POLICY, REGISTERED } from './constants';
import { DEBTORS, YEARS } from './mock-data';
import { OFFICERS } from './officers';
import {
  ActivityEntry,
  CaseView,
  Debtor,
  Decision,
  DecisionAction,
  DebtSummary,
  FundKey,
  Officer,
  PortfolioScope,
  Recommendation,
  RiskBand,
  Signal as CaseSignal,
  Term,
} from './models';

/** ZAR formatting matching the prototype's R(n) / R0(n) helpers. */
export function formatRand(n: number): string {
  return 'R ' + Math.round(n).toLocaleString('en-ZA');
}
export function formatRandTight(n: number): string {
  return 'R' + Math.round(n).toLocaleString('en-ZA');
}

const CAL_YEAR = new Date().getFullYear();
const LATEST_YEAR = Math.max(...YEARS);
const DEFAULT_YEAR = YEARS.includes(CAL_YEAR) ? CAL_YEAR : LATEST_YEAR;
export const YEAR_SPAN = `${Math.min(...YEARS)}–${LATEST_YEAR}`;

/**
 * Owns the shared filter state (financial year, funding source, autonomy level, selected case)
 * and every derived calculation — a direct port of the prototype's scoring/decision-engine
 * JavaScript, so the numbers on screen are provably identical (issues #4–#8).
 *
 * This reads from a local, in-memory mock dataset (`DEBTORS`) standing in for the nightly
 * extract described in issue #2. Swap `rows()`'s source for an HTTP call to the Spring Boot
 * API once that integration is wired up — nothing else in this service needs to change.
 */
@Injectable({ providedIn: 'root' })
export class DebtService {
  readonly years = YEARS;
  /** Newest year first, as every year `<select>` in the chrome lists them. */
  readonly sortedYears = [...YEARS].sort((a, b) => b - a);
  readonly calendarYear = CAL_YEAR;
  readonly defaultYear = DEFAULT_YEAR;
  readonly yearSpan = YEAR_SPAN;

  readonly year = signal<number | 'all'>(DEFAULT_YEAR);
  readonly funding = signal<FundKey | 'all'>('all');
  readonly caseId = signal<string | null>(null);
  readonly autonomy = signal<number>(2);

  /* =========================================================================
     OFFICER IDENTITY & PORTFOLIO SCOPING (issue #18, POPIA impact assessment §5)
     ========================================================================= */

  readonly currentOfficerId = signal<string>('nomsa-mahlangu');
  readonly portfolioScope = signal<PortfolioScope>('own');

  officerOf(id: string): Officer | undefined {
    return OFFICERS.find((o) => o.id === id);
  }

  readonly currentOfficer = computed<Officer>(() => this.officerOf(this.currentOfficerId())!);

  /** Switching officer always resets to the narrowest scope — no carried-over broad view. */
  setCurrentOfficer(id: string): void {
    this.currentOfficerId.set(id);
    this.portfolioScope.set('own');
  }

  /** Every Level 3 escalation, logged — not tied to any one debtor, so kept separate from
   *  the per-case activity feed (`engagementLog`) below. */
  private readonly portfolioEscalationLog = signal<{ by: string; team: string; at: string }[]>([]);
  readonly portfolioEscalations = this.portfolioEscalationLog.asReadonly();

  /** 'all' (Level 3) is manager-only, per the BA's model — a non-manager request is a no-op. */
  setPortfolioScope(scope: PortfolioScope): void {
    if (scope === 'all' && this.currentOfficer().role !== 'manager') return;
    this.portfolioScope.set(scope);
    if (scope === 'all') {
      const officer = this.currentOfficer();
      this.portfolioEscalationLog.set([
        ...this.portfolioEscalationLog(),
        { by: officer.name, team: officer.team, at: new Date().toISOString() },
      ]);
    }
  }

  /** Pure — safe to call from a computed(). */
  inPortfolio(d: Debtor, officer: Officer, scope: PortfolioScope): boolean {
    if (scope === 'all') return true;
    if (scope === 'team') return this.officerOf(d.assignedOfficer)?.team === officer.team;
    return d.assignedOfficer === officer.id;
  }

  readonly yearLabel = computed(() => (this.year() === 'all' ? `all years (${YEAR_SPAN})` : String(this.year())));
  readonly yearShort = computed(() => (this.year() === 'all' ? 'all years' : String(this.year())));
  readonly scopeLabel = computed(
    () => this.yearShort() + (this.funding() !== 'all' ? ' · ' + FUND[this.funding() as FundKey].label : ''),
  );
  readonly bookLabel = computed(() => (this.year() === 'all' ? 'whole book' : `${this.year()} book`));
  readonly yearPhrase = computed(() =>
    this.year() === 'all' ? `across all ${YEARS.length} years on record` : `for ${this.year()}`,
  );

  setYear(v: number | 'all'): void {
    this.year.set(v);
    this.caseId.set(null);
  }
  setFunding(v: FundKey | 'all'): void {
    this.funding.set(v);
    this.caseId.set(null);
  }
  /** Logs an access entry (issue #18 — every read of a student's financial detail must be
   *  attributable to a logged-in user) when opening a *different* case; re-selecting the
   *  already-open one doesn't re-log. */
  setCase(id: string): void {
    if (id !== this.caseId()) {
      const officer = this.currentOfficer();
      this.logEngagementAction(id, {
        t: `Case detail viewed by ${officer.name}`,
        m: `Access log · ${officer.name} (${officer.team})`,
      });
    }
    this.caseId.set(id);
  }
  setAutonomy(level: number): void {
    this.autonomy.set(level);
  }

  /**
   * Officer-initiated engagement actions (issue #14), keyed by debtor id. Frontend-only
   * and session-lifetime by design — see docs/SDD/issue-14-engagement-channels-panel.spec.md.
   * `caseOf` appends these after the derived activity entries, so the log stays append-only.
   */
  private readonly engagementLog = signal<Map<string, ActivityEntry[]>>(new Map());

  logEngagementAction(debtorId: string, entry: ActivityEntry): void {
    const next = new Map(this.engagementLog());
    next.set(debtorId, [...(next.get(debtorId) ?? []), entry]);
    this.engagementLog.set(next);
  }

  /* =========================================================================
     OFFICER DECISIONS (issue #13) — approve, amend or decline a case's current
     recommendation. Frontend-only and session-lifetime, mirroring the backend's
     OfficerDecision entity (technical spec §3.5): a decision is keyed to the
     recommendation `type` it was made against, so a later re-score into a
     different recommendation reopens the case instead of hiding it forever.
     ========================================================================= */

  private readonly decisions = signal<Map<string, Decision>>(new Map());

  /** The stored decision for this debtor, or null if it's stale against the current recommendation. */
  private decisionOf(d: Debtor, rec: Recommendation): Decision | null {
    const stored = this.decisions().get(d.id);
    return stored && stored.recommendationType === rec.type ? stored : null;
  }

  private decide(
    d: Debtor,
    action: DecisionAction,
    extra: Partial<Pick<Decision, 'amendedTerms' | 'reason'>>,
    actor: string = CURRENT_OFFICER,
    precomputedRec?: Recommendation,
  ): void {
    const rec = precomputedRec ?? this.recommend(d);
    const decision: Decision = {
      recommendationType: rec.type,
      action,
      decidedBy: actor,
      decidedAt: new Date().toISOString(),
      ...extra,
    };
    const next = new Map(this.decisions());
    next.set(d.id, decision);
    this.decisions.set(next);

    const isAuto = actor !== CURRENT_OFFICER;
    const verb = action === 'Approved' ? 'approved' : action === 'Amended' ? 'amended and approved' : 'declined';
    this.logEngagementAction(d.id, {
      t: `Recommendation ${verb} by ${actor}` + (action === 'Declined' ? ` — ${extra.reason}` : ''),
      m: `${isAuto ? 'Auto-decision' : 'Officer decision'} · ${actor}`,
    });
  }

  /* =========================================================================
     AUTONOMY-LEVEL GATING (issue #8, technical spec §5.10) — whether the system
     is allowed to resolve a recommendation itself, and the explicit "scoring
     run" that acts on that. Kept out of any computed()/caseOf() read path:
     Angular forbids writing signals during a computed's evaluation, and the
     ticket's own "takes effect from the next scoring run" wording calls for a
     discrete, explicitly-invoked pass rather than continuous reactivity.
     ========================================================================= */

  private static readonly HARD_MANUAL_TYPES = new Set(['Refund', 'Registration hold']);

  /** Pure — safe to call from anywhere, including a computed(). */
  autoEligible(rec: Recommendation, level: number): boolean {
    if (DebtService.HARD_MANUAL_TYPES.has(rec.type)) return false;
    if (rec.status === 'Monitoring') return false;
    if (level >= 4) return true;
    if (level === 3) return rec.status === 'Agent acting';
    return false;
  }

  /** Same case-selection rule as pickedRows()/refundRows() (picked-up or in-credit), but over
   *  the full dataset rather than caseRows() — a scoring run must not silently skip cases
   *  outside whatever year/funding filter the officer currently has selected in the UI. */
  private allCases(): Debtor[] {
    return DEBTORS.filter((d) => this.pickedUp(d) || this.owedToStudent(d));
  }

  /** Auto-resolves every not-yet-decided, eligible case at the current autonomy level. */
  runAutonomousExecution(): void {
    const level = this.autonomy();
    for (const d of this.allCases()) {
      const rec = this.recommend(d);
      if (this.decisionOf(d, rec)) continue;
      if (!this.autoEligible(rec, level)) continue;
      this.decide(d, 'Approved', {}, `Autonomous Agent (Level ${level})`, rec);
    }
  }

  /** Approves the case's current recommendation as-is (subject to the hard-rule autonomy gating
   *  in technical spec §5.10: Registration hold and Refund always require this explicit click). */
  approveCase(d: Debtor): void {
    this.decide(d, 'Approved', {});
  }

  /** Officer-modified terms (e.g. instalment amount/count) approved in place of the AI's proposal. */
  amendCase(d: Debtor, amendedTerms: Term[]): void {
    this.decide(d, 'Amended', { amendedTerms });
  }

  /** Requires documented reasoning — the case remains unactioned. */
  declineCase(d: Debtor, reason: string): void {
    this.decide(d, 'Declined', { reason });
  }

  /* =========================================================================
     DERIVED SELECTORS — recomputed whenever year/funding change.
     ========================================================================= */

  readonly rows = computed<Debtor[]>(() => {
    const year = this.year();
    const funding = this.funding();
    return DEBTORS.filter((d) => (year === 'all' || d.year === year) && (funding === 'all' || d.funding === funding));
  });

  /** Institution-wide, deliberately NOT portfolio-scoped (issue #18 non-goal) — Home's
   *  aggregate dashboard KPIs are the only intended consumers. Everything else (Tracker,
   *  Cases, CSV export) must use the scoped `pickedRows`/`refundRows`/`payingRows` below. */
  readonly allPickedRows = computed<Debtor[]>(() =>
    this.rows()
      .filter((d) => this.pickedUp(d))
      .sort((a, b) => this.riskScore(b) - this.riskScore(a)),
  );
  readonly allRefundRows = computed<Debtor[]>(() =>
    this.rows()
      .filter((d) => this.owedToStudent(d))
      .sort((a, b) => this.rowTotal(a) - this.rowTotal(b)),
  );
  readonly allPayingRows = computed<Debtor[]>(() =>
    this.rows().filter((d) => this.rowDebt(d) > 0 && !this.pickedUp(d)),
  );

  /** Scoped to the current officer's portfolio (issue #18) — Tracker (#11) and Cases (#12). */
  readonly pickedRows = computed<Debtor[]>(() =>
    this.allPickedRows().filter((d) => this.inPortfolio(d, this.currentOfficer(), this.portfolioScope())),
  );
  readonly refundRows = computed<Debtor[]>(() =>
    this.allRefundRows().filter((d) => this.inPortfolio(d, this.currentOfficer(), this.portfolioScope())),
  );
  readonly payingRows = computed<Debtor[]>(() =>
    this.allPayingRows().filter((d) => this.inPortfolio(d, this.currentOfficer(), this.portfolioScope())),
  );

  readonly caseRows = computed<Debtor[]>(() => [...this.pickedRows(), ...this.refundRows()]);

  readonly summary = computed<DebtSummary>(() => {
    const rs = this.rows();
    const debtors = rs.filter((d) => this.rowTotal(d) > 0);
    const credits = rs.filter((d) => this.owedToStudent(d));
    const totalDebt = debtors.reduce((s, d) => s + this.rowTotal(d), 0);
    const totalCredit = Math.abs(credits.reduce((s, d) => s + this.rowTotal(d), 0));
    const o90 = rs.reduce((s, d) => s + this.over90(d), 0);
    const year = this.year();
    const registered = year === 'all' ? YEARS.reduce((s, y) => s + (REGISTERED[y] || 0), 0) : REGISTERED[year] || 0;
    return {
      debtors,
      credits,
      totalDebt,
      totalCredit,
      o90,
      registered,
      o90Pct: totalDebt ? (o90 / totalDebt) * 100 : 0,
      avg: debtors.length ? totalDebt / debtors.length : 0,
    };
  });

  /* =========================================================================
     PURE MATH — one row's derived numbers (technical spec §3.3/§4).
     ========================================================================= */

  rowTotal(d: Debtor): number {
    return AGE_BUCKETS.reduce((s, b) => s + d.ageing[b.key], 0);
  }
  rowDebt(d: Debtor): number {
    return AGE_BUCKETS.reduce((s, b) => s + Math.max(0, d.ageing[b.key]), 0);
  }
  arrears(d: Debtor): number {
    return Math.max(0, d.ageing.d30) + Math.max(0, d.ageing.d60) + Math.max(0, d.ageing.d90) + Math.max(0, d.ageing.d120);
  }
  over90(d: Debtor): number {
    return Math.max(0, d.ageing.d90) + Math.max(0, d.ageing.d120);
  }
  owedToStudent(d: Debtor): boolean {
    return this.rowTotal(d) < 0;
  }

  /** "Picked up" rule (business case §3.3): owes money AND missed/arrears/funding-risk >= 8. */
  pickedUp(d: Debtor): boolean {
    if (this.rowDebt(d) <= 0) return false;
    return (d.missed || 0) > 0 || this.arrears(d) > 0 || (FUND_RISK[d.fundStatus] || 0) >= 8;
  }

  /** The oldest bucket a student's own (positive) balance has reached. */
  oldestBucket(d: Debtor) {
    for (let i = AGE_BUCKETS.length - 1; i >= 0; i--) {
      if (Math.max(0, d.ageing[AGE_BUCKETS[i].key]) > 0) return AGE_BUCKETS[i];
    }
    return AGE_BUCKETS[0];
  }

  /** Which ageing band a number of days outstanding falls in — credits age exactly like debt does. */
  daysBand(days: number) {
    const i = days > 120 ? 4 : days > 90 ? 3 : days > 60 ? 2 : days > 30 ? 1 : 0;
    return AGE_BUCKETS[i];
  }

  riskScore(d: Debtor): number {
    if (this.rowDebt(d) <= 0) return 0;
    let s = 0;
    if (d.ageing.d120 > 0) s += 18 + Math.min(12, d.ageing.d120 / 4000);
    if (d.ageing.d90 > 0) s += 14;
    if (d.ageing.d60 > 0) s += 8;
    if (d.ageing.d30 > 0) s += 5;
    s += Math.min(22, (d.missed || 0) * 7);
    s += FUND_RISK[d.fundStatus] || 0;
    if (d.arrangement === 'Defaulted') s += 10;
    if (!d.lastPay) s += 8;
    return Math.max(1, Math.min(99, Math.round(s)));
  }

  bandOf(score: number): RiskBand {
    return score >= 70 ? 'High' : score >= 45 ? 'Elevated' : 'Watch';
  }

  bandColor(band: RiskBand): string {
    return band === 'High' ? 'var(--ai-red)' : band === 'Elevated' ? 'var(--ai-honey)' : 'var(--ai-mid-blue)';
  }

  private instalments(debt: number): number {
    return debt <= 5000 ? 3 : debt <= 15000 ? 4 : debt <= 30000 ? 6 : 8;
  }

  signalsOf(d: Debtor): CaseSignal[] {
    const out: CaseSignal[] = [];
    if ((d.missed || 0) > 0) out.push({ t: `${d.missed} missed instalment${d.missed > 1 ? 's' : ''}`, hot: true });
    if (!d.lastPay) out.push({ t: 'No payment on record', hot: true });
    else out.push({ t: `Last paid ${d.lastPay}`, hot: false });
    if (d.ageing.d120 > 0) out.push({ t: `120+ days ${formatRandTight(d.ageing.d120)}`, hot: true });
    else if (d.ageing.d90 > 0) out.push({ t: `90 days ${formatRandTight(d.ageing.d90)}`, hot: true });
    else if (this.arrears(d) > 0) out.push({ t: `In arrears ${formatRandTight(this.arrears(d))}`, hot: false });
    if ((FUND_RISK[d.fundStatus] || 0) >= 8) out.push({ t: d.fundStatus, hot: false });
    if (d.arrangement === 'Defaulted') out.push({ t: 'Arrangement defaulted', hot: true });
    return out;
  }

  /** The AI recommendation, derived from the same facts (business case §3.4, issue #7). */
  recommend(d: Debtor): Recommendation {
    const debt = this.rowDebt(d);
    const credit = Math.abs(Math.min(0, this.rowTotal(d)));
    const fs = d.fundStatus;
    const miss = d.missed || 0;

    if (this.owedToStudent(d)) {
      return {
        type: 'Refund',
        action: `Refund ${formatRand(credit)} to the student`,
        status: 'Needs approval',
        rationale: `The account is in credit by ${formatRand(credit)} after ${fs.toLowerCase()}. Holding a student credit past the term end is a compliance finding, and the banking detail on file is verified, so the agent has prepared the payment for release.`,
        terms: [
          { k: 'Refund', v: formatRand(credit) },
          { k: 'Method', v: 'EFT, verified account' },
          { k: 'Turnaround', v: '5 working days' },
        ],
      };
    }

    if (d.arrangement === 'Defaulted' && !d.lastPay) {
      return {
        type: 'Registration hold',
        action: 'Registration hold and hand-over',
        status: 'Needs approval',
        rationale: `A prior arrangement defaulted, there is no payment on record and funding reads ${fs.toLowerCase()}. Every agent channel has been tried without engagement, so escalation is the remaining option on ${formatRand(debt)}.`,
        terms: [
          { k: 'Hold', v: 'Registration' },
          { k: 'Hand-over', v: 'Adapt Connect' },
          { k: 'Review', v: 'On first contact' },
        ],
      };
    }

    if (/lapsed|declined/i.test(fs)) {
      return {
        type: 'Hardship fund',
        action: 'Hardship fund referral and sponsor follow-up',
        status: 'Needs approval',
        rationale: `Funding reads ${fs.toLowerCase()}, which removed cover the student had budgeted against — the shortfall is not conduct. A partial hardship award bridges the term while the agent re-tests eligibility on ${formatRand(debt)} outstanding.`,
        terms: [
          { k: 'Award sought', v: formatRand(Math.min(debt * 0.4, 6000)) },
          { k: 'Bridge', v: 'One semester' },
          { k: 'Re-test', v: 'Next funding window' },
        ],
      };
    }

    if (/pending/i.test(fs) && miss >= 2) {
      const n = this.instalments(debt);
      return {
        type: 'Payment arrangement',
        action: `Holding arrangement, ${n} instalments`,
        status: 'Needs approval',
        rationale: `${miss} instalments are unpaid and NSFAS has not resolved, so the balance cannot be settled in one payment. A ${n}-instalment holding arrangement at ${formatRand(debt / n)} per month keeps registration intact while the funding outcome is chased.`,
        terms: [
          { k: 'Instalments', v: `${n} × ${formatRand(debt / n)}` },
          { k: 'Hold on registration', v: 'Suspended' },
          { k: 'Falls away if', v: 'NSFAS approves' },
        ],
      };
    }

    if (/pending/i.test(fs)) {
      return {
        type: 'Funding chase',
        action: 'Chase funding verification, suspend hold',
        status: 'Agent acting',
        rationale: `The student is current apart from ${formatRand(this.arrears(d) || debt)} sitting behind an unresolved NSFAS application. Chasing the outstanding documents is cheaper than collections, so the agent is working the funding route first.`,
        terms: [
          { k: 'Outstanding', v: 'Supporting documents' },
          { k: 'Reminders', v: 'SMS and WhatsApp' },
          { k: 'Hold', v: 'Suspended pending outcome' },
        ],
      };
    }

    if (miss >= 2) {
      const n = this.instalments(debt);
      return {
        type: 'Payment arrangement',
        action: `Payment arrangement, ${n} instalments`,
        status: 'Needs approval',
        rationale: `${miss} instalments are unpaid on ${formatRand(debt)}, but the student has paid before (last receipt ${d.lastPay}). An arrangement at ${formatRand(debt / n)} per month recovers more over twelve months than a registration hold, which historically converts to withdrawal in 41 percent of comparable cases.`,
        terms: [
          { k: 'Instalments', v: `${n} × ${formatRand(debt / n)}` },
          { k: 'First debit', v: '22nd of next month' },
          { k: 'Hold on registration', v: 'Suspended' },
        ],
      };
    }

    if (miss === 1) {
      return {
        type: 'Reminder cadence',
        action: 'Reminder cadence, no hold',
        status: 'Agent acting',
        rationale: `One instalment was missed on ${formatRand(debt)} against an otherwise clean record. A three-step SMS and WhatsApp cadence resolves this pattern without a human in 8 of 10 comparable cases, so no hold is proposed.`,
        terms: [
          { k: 'Step 1', v: 'SMS, day 1' },
          { k: 'Step 2', v: 'WhatsApp, day 5' },
          { k: 'Step 3', v: 'Officer call, day 10' },
        ],
      };
    }

    return {
      type: 'Monitor',
      action: 'Monitor only',
      status: 'Monitoring',
      rationale:
        'The account is current and payments are arriving on cycle. The agent keeps scoring nightly and will raise a case the moment a payment is missed.',
      terms: [
        { k: 'Action', v: 'None required' },
        { k: 'Re-score', v: 'Nightly' },
      ],
    };
  }

  evidenceOf(d: Debtor): string[] {
    const e: string[] = [];
    const oldest = d.ageing.d120 > 0 ? '120+ days' : d.ageing.d90 > 0 ? '90 days' : d.ageing.d60 > 0 ? '60 days' : d.ageing.d30 > 0 ? '30 days' : 'Current';
    e.push(`Ageing · ${oldest}`);
    e.push(`Payment history ${d.year - 1}–${d.year}`);
    e.push(`Funding · ${d.fundStatus}`);
    if (d.arrangement) e.push(`Arrangement · ${d.arrangement}`);
    return e;
  }

  activityOf(d: Debtor): ActivityEntry[] {
    const a: ActivityEntry[] = [];
    a.push({ t: `Risk scored ${this.riskScore(d)} and banded ${this.bandOf(this.riskScore(d))}`, m: 'Risk Sentinel · overnight run' });
    a.push({ t: `Funding status read as ${d.fundStatus}`, m: 'Funding Broker · Student Funding' });
    if ((d.missed || 0) > 0) a.push({ t: `${d.missed} instalment${d.missed > 1 ? 's' : ''} flagged unpaid`, m: 'Assurance Agent · Debtors' });
    a.push({ t: d.lastPay ? `Last receipt ${d.lastPay} confirmed` : 'No receipt found on the account', m: 'Cashiering reconciliation' });
    if (d.arrangement) a.push({ t: `Prior arrangement ${d.arrangement.toLowerCase()}`, m: 'Assurance Agent' });
    return a;
  }

  caseOf(d: Debtor): CaseView {
    const sc = this.riskScore(d);
    const rec = this.recommend(d);
    return {
      d,
      score: sc,
      band: this.bandOf(sc),
      debt: this.rowDebt(d),
      credit: Math.abs(Math.min(0, this.rowTotal(d))),
      signals: this.signalsOf(d),
      rec,
      evidence: this.evidenceOf(d),
      activity: [...this.activityOf(d), ...(this.engagementLog().get(d.id) ?? [])],
      decision: this.decisionOf(d, rec),
    };
  }

  /** Still awaiting a human call — used to badge the Cases tab and the "N awaiting a decision" copy. */
  needsApproval(c: CaseView): boolean {
    return c.rec.status === 'Needs approval' && !c.decision;
  }

  policyClauseOf(recType: string): string {
    return POLICY[recType] ?? '';
  }
  agentOf(recType: string): string {
    return AGENTS[recType] ?? '';
  }

  readonly asAt = AS_AT;

  /* =========================================================================
     CSV EXPORT — the tracker's own view of the book (issue #17).
     ========================================================================= */
  exportCsv(): void {
    const head = [
      'Student ID', 'Name', 'Programme', 'Funding', 'Funding status', 'Year', 'Missed instalments', 'Last payment',
      'Current', '30 days', '60 days', '90 days', '120+ days', 'Balance', 'Risk score', 'Band', 'Picked up by agent',
      'AI recommendation', 'Status', 'Policy',
    ];
    const lines = [head.join(',')];
    // Scoped (issue #18) — CSV export lists named, identifiable students, so it must
    // respect the officer's portfolio the same way Tracker/Cases do, not the whole book.
    this.rows()
      .filter((d) => this.inPortfolio(d, this.currentOfficer(), this.portfolioScope()))
      .forEach((d) => {
        const c = this.caseOf(d);
        lines.push(
          [
            d.id, `"${d.name}"`, `"${d.prog}"`, FUND[d.funding].label, d.fundStatus, d.year,
            d.missed || 0, d.lastPay || 'none', d.ageing.current, d.ageing.d30, d.ageing.d60, d.ageing.d90, d.ageing.d120,
            this.rowTotal(d), c.score, this.owedToStudent(d) ? 'Credit' : c.band, this.pickedUp(d) ? 'Yes' : 'No',
            `"${c.rec.action}"`, c.rec.status, this.policyClauseOf(c.rec.type),
          ].join(','),
        );
      });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `student-debt-tracker-${this.year()}-${this.funding()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }
}
