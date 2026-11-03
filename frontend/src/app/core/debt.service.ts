import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, signal } from '@angular/core';
import { Subscription, catchError, map, of } from 'rxjs';
import { API_BASE } from './api';
import { AGE_BUCKETS, AGENTS, AS_AT, FUND, FUND_RISK, POLICY } from './constants';
import { MetaService } from './meta.service';
import { DEBTORS } from './mock-data';
import { OFFICERS } from './officers';
import {
  ActivityEntry,
  CadenceProgress,
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
} from './models';

/** ZAR formatting matching the prototype's R(n) / R0(n) helpers. */
export function formatRand(n: number): string {
  return 'R ' + Math.round(n).toLocaleString('en-ZA');
}
export function formatRandTight(n: number): string {
  return 'R' + Math.round(n).toLocaleString('en-ZA');
}

/** Used only until GET /api/meta (issue #63) resolves — the real calendar year never needs the network. */
const CAL_YEAR_FALLBACK = new Date().getFullYear();

/** Pulls the file name out of a `Content-Disposition: attachment; filename="..."` header
 *  (issue #68) — the server's own `CsvExportService.fileName()` is the source of truth. */
function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="?([^";]+)"?/.exec(header);
  return match ? match[1] : null;
}

/** The shape of `GET /api/summary`'s response (backend's SummaryDto, issue #64). */
interface SummaryApiResponse {
  registeredStudents: number;
  totalDebt: number;
  debtorCount: number;
  totalCredit: number;
  creditCount: number;
  atRisk90Plus: number;
  atRisk90PlusPct: number;
  averageBalance: number;
}

function toDebtSummary(dto: SummaryApiResponse): DebtSummary {
  return {
    debtorCount: dto.debtorCount,
    creditCount: dto.creditCount,
    totalDebt: dto.totalDebt,
    totalCredit: dto.totalCredit,
    o90: dto.atRisk90Plus,
    registered: dto.registeredStudents,
    o90Pct: dto.atRisk90PlusPct,
    avg: dto.averageBalance,
  };
}

const EMPTY_SUMMARY: DebtSummary = {
  debtorCount: 0,
  creditCount: 0,
  totalDebt: 0,
  totalCredit: 0,
  o90: 0,
  registered: 0,
  o90Pct: 0,
  avg: 0,
};

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
  /** Financial years on record, the current calendar year, the default year to open on and
   *  the funding-source options — all come from GET /api/meta (issue #63) once MetaService
   *  loads it, rather than core/mock-data.ts. Empty/fallback values are shown until then. */
  get years(): number[] {
    return this.metaService.meta()?.years ?? [];
  }
  /** Newest year first, as every year `<select>` in the chrome lists them. */
  get sortedYears(): number[] {
    return [...this.years].sort((a, b) => b - a);
  }
  get calendarYear(): number {
    return this.metaService.meta()?.currentCalendarYear ?? CAL_YEAR_FALLBACK;
  }
  get defaultYear(): number {
    return this.metaService.meta()?.defaultYear ?? this.calendarYear;
  }
  get yearSpan(): string {
    const years = this.years;
    return years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '';
  }
  /** `{key, label}` for the funding-source filter `<select>`, keyed to match FundKey. */
  get fundingOptions(): { key: FundKey; label: string }[] {
    return (this.metaService.meta()?.fundingSources ?? []).map((f) => ({
      key: f.value.toLowerCase() as FundKey,
      label: f.label,
    }));
  }

  readonly year = signal<number | 'all'>(CAL_YEAR_FALLBACK);
  readonly funding = signal<FundKey | 'all'>('all');
  readonly caseId = signal<string | null>(null);
  readonly autonomy = signal<number>(2);

  private yearSnappedToMetaDefault = false;

  constructor(
    private http: HttpClient,
    private metaService: MetaService,
  ) {
    this.refreshSummary();
    // Once reference data arrives, open on the server's default year (issue #63) — but only
    // the first time, so a year the officer has since picked is never overridden.
    effect(() => {
      const meta = this.metaService.meta();
      if (typeof meta?.defaultYear !== 'number' || this.yearSnappedToMetaDefault) return;
      this.yearSnappedToMetaDefault = true;
      if (this.year() !== meta.defaultYear) this.setYear(meta.defaultYear);
    });
  }

  /* =========================================================================
     OFFICER IDENTITY & PORTFOLIO SCOPING (issue #18, POPIA impact assessment §5)
     ========================================================================= */

  /** The officer portfolio scoping acts as — set from the signed-in user (see AppComponent). */
  private readonly actingOfficer = signal<Officer>(OFFICERS[0]);
  readonly currentOfficer = this.actingOfficer.asReadonly();
  readonly currentOfficerId = computed(() => this.actingOfficer().id);
  readonly portfolioScope = signal<PortfolioScope>('own');

  officerOf(id: string): Officer | undefined {
    return OFFICERS.find((o) => o.id === id);
  }

  /** Switching officer always resets to the narrowest scope — no carried-over broad view. */
  setCurrentOfficer(id: string): void {
    const officer = this.officerOf(id);
    if (officer) this.signInAs(officer);
  }

  /** Acts as the signed-in user, who may not be on the case-assignment roster (e.g. an admin). */
  signInAs(officer: Officer): void {
    this.actingOfficer.set(officer);
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

  readonly yearLabel = computed(() => (this.year() === 'all' ? `all years (${this.yearSpan})` : String(this.year())));
  readonly yearShort = computed(() => (this.year() === 'all' ? 'all years' : String(this.year())));
  readonly scopeLabel = computed(
    () => this.yearShort() + (this.funding() !== 'all' ? ' · ' + FUND[this.funding() as FundKey].label : ''),
  );
  readonly bookLabel = computed(() => (this.year() === 'all' ? 'whole book' : `${this.year()} book`));
  readonly yearPhrase = computed(() =>
    this.year() === 'all' ? `across all ${this.years.length} years on record` : `for ${this.year()}`,
  );

  setYear(v: number | 'all'): void {
    this.year.set(v);
    this.caseId.set(null);
    this.refreshSummary();
  }
  setFunding(v: FundKey | 'all'): void {
    this.funding.set(v);
    this.caseId.set(null);
    this.refreshSummary();
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
     OFFICER DECISIONS (issues #13, #66) — a case's current recommendation is
     approved, amended or declined. Manual decisions are saved through the API
     (`CaseStore.decide`); this map holds session-lifetime copies of those plus the
     in-browser autonomous run's decisions, mirroring the backend's OfficerDecision
     entity (technical spec §3.5): a decision is keyed to the recommendation `type`
     it was made against, so a later re-score into a different recommendation
     reopens the case instead of hiding it forever.
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
    actor: string = this.currentOfficer().name,
    precomputedRec?: Recommendation,
    isAuto = false,
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
      this.decide(d, 'Approved', {}, `Autonomous Agent (Level ${level})`, rec, true);
    }
  }

  /**
   * Remembers a decision the server has saved (issue #66), so the case counts as decided here too —
   * in particular `runAutonomousExecution()` leaves it alone. An officer's manual Approve / Amend /
   * Decline is written through `CaseStore.decide()`; the server records the activity entry, so
   * nothing is logged locally.
   */
  recordServerDecision(debtorId: string, decision: Decision | null): void {
    if (!decision) return;
    const next = new Map(this.decisions());
    next.set(debtorId, decision);
    this.decisions.set(next);
  }

  /* =========================================================================
     REMINDER CADENCE DISPATCH (issue #9, technical spec §5.7 rule 7) — the
     Notification Dispatcher: SMS day 1, WhatsApp day 5, officer call day 10 for
     every "Reminder cadence" case, gated by the same autoEligible() as #8. No
     live SMS/WhatsApp gateway is confirmed yet (open item 11 — WhatsApp is
     Cuedesk per #14, SMS still unconfirmed), so each step is simulated the
     same way #14's manual engagement buttons are: an activity-log entry, not
     a real provider call.
     ========================================================================= */

  private static readonly STEP_1_DUE_DAY = 1;
  private static readonly STEP_2_DUE_DAY = 5;
  private static readonly STEP_3_DUE_DAY = 10;

  /** Frontend-only and session-lifetime, same lifecycle as `engagementLog`/`decisions`. */
  private readonly cadenceProgressLog = signal<Map<string, CadenceProgress>>(new Map());
  readonly cadenceProgress = this.cadenceProgressLog.asReadonly();

  private daysSince(startedAt: string, now: Date): number {
    return Math.floor((now.getTime() - new Date(startedAt).getTime()) / (24 * 60 * 60 * 1000));
  }

  /**
   * Runs the cadence for every case the decision engine currently recommends a "Reminder
   * cadence" for. A case that resolves (paid up) or escalates to a different rule has its
   * progress cleared, so a later relapse into a fresh "1 missed instalment" case restarts the
   * clock rather than resuming a stale one. `now` is injectable for deterministic tests.
   */
  runReminderCadence(now: Date = new Date()): void {
    const level = this.autonomy();
    const next = new Map(this.cadenceProgressLog());

    for (const d of this.allCases()) {
      const rec = this.recommend(d);
      const existing = next.get(d.id);

      if (rec.type !== 'Reminder cadence') {
        if (existing) next.delete(d.id);
        continue;
      }

      const progress: CadenceProgress = existing ?? { startedAt: now.toISOString() };
      next.set(d.id, progress);

      if (!this.autoEligible(rec, level)) continue; // Queued for approval — clock runs, nothing dispatched.

      const daysSinceStart = this.daysSince(progress.startedAt, now);
      if (!progress.step1SentAt && daysSinceStart >= DebtService.STEP_1_DUE_DAY) {
        progress.step1SentAt = now.toISOString();
        this.logEngagementAction(d.id, {
          t: 'SMS reminder sent (step 1 of 3, day 1)',
          m: 'Engagement Agent · Reminder cadence',
        });
      }
      if (!progress.step2SentAt && daysSinceStart >= DebtService.STEP_2_DUE_DAY) {
        progress.step2SentAt = now.toISOString();
        this.logEngagementAction(d.id, {
          t: 'WhatsApp reminder sent (step 2 of 3, day 5)',
          m: 'Engagement Agent · Reminder cadence',
        });
      }
      if (!progress.step3SentAt && daysSinceStart >= DebtService.STEP_3_DUE_DAY) {
        progress.step3SentAt = now.toISOString();
        this.logEngagementAction(d.id, {
          t: 'Officer call task created (step 3 of 3, day 10)',
          m: 'Engagement Agent · Reminder cadence',
        });
      }
    }
    this.cadenceProgressLog.set(next);
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

  /**
   * The 5 KPI cards' figures (issue #64) — fetched live from `GET /api/summary`
   * rather than derived from the local mock dataset, so Home (and the Tracker,
   * which shares `<app-summary-cards>`) shows the institution's real numbers.
   */
  private readonly summaryData = signal<DebtSummary | null>(null);
  private readonly summaryLoadingFlag = signal(false);
  private readonly summaryErrorFlag = signal(false);
  private summarySub?: Subscription;

  readonly summaryLoading = this.summaryLoadingFlag.asReadonly();
  readonly summaryError = this.summaryErrorFlag.asReadonly();
  readonly summary = computed<DebtSummary>(() => this.summaryData() ?? EMPTY_SUMMARY);

  /** Re-fetches the KPI summary for the current `year`/`funding`, dropping any still-in-flight
   *  previous request (same effect as `switchMap`, called explicitly from `setYear`/`setFunding`
   *  rather than wired up reactively — keeps the fetch synchronous and easy to test). */
  private refreshSummary(): void {
    this.summarySub?.unsubscribe();
    this.summaryLoadingFlag.set(true);
    this.summaryErrorFlag.set(false);
    this.summarySub = this.http
      .get<SummaryApiResponse>(`${API_BASE}/api/summary`, {
        params: { year: String(this.year()), funding: String(this.funding()) },
      })
      .pipe(
        map((dto) => toDebtSummary(dto)),
        catchError(() => {
          this.summaryErrorFlag.set(true);
          return of(null);
        }),
      )
      .subscribe((data) => {
        this.summaryLoadingFlag.set(false);
        if (data) this.summaryData.set(data);
      });
  }

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
      /* activityOf() + engagementLog are built oldest-first (nightly run, then same-day
         officer/agent actions); reverse for display so the panel reads newest-first (#12). */
      activity: [...this.activityOf(d), ...(this.engagementLog().get(d.id) ?? [])].reverse(),
      decision: this.decisionOf(d, rec),
    };
  }

  /**
   * Layers this session's not-yet-persisted officer decision (#13) and engagement entries (#14)
   * over a case read from the API, which does not know about them until #66 / #59 land. A decision
   * the server already holds wins.
   */
  withLocalState(c: CaseView): CaseView {
    const local = this.engagementLog().get(c.d.id) ?? [];
    return {
      ...c,
      decision: c.decision ?? this.decisionOf(c.d, c.rec),
      activity: local.length ? [...[...local].reverse(), ...c.activity] : c.activity,
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
     CSV EXPORT — the tracker's own view of the book (issue #17), downloaded
     from the backend's own export rather than built in the browser (issue #68).
     ========================================================================= */
  exportCsv(): void {
    this.http
      .get(`${API_BASE}/api/debtors/export`, {
        params: { year: String(this.year()), funding: String(this.funding()) },
        responseType: 'text',
        observe: 'response',
      })
      .subscribe({
        next: (response) => {
          const fileName =
            filenameFromContentDisposition(response.headers.get('content-disposition')) ??
            `student-debt-tracker-${this.year()}-${this.funding()}.csv`;
          const blob = new Blob([response.body ?? ''], { type: 'text/csv' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(a.href);
        },
        error: () => console.error('CSV export failed: could not reach the backend.'),
      });
  }
}
