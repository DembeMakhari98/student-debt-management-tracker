import { Injectable, WritableSignal, computed, effect, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AsyncSubject, Observable, Subscription, forkJoin } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { DebtService } from './debt.service';
import { DebtorApi, DecisionRequest, EngagementRequest } from './debtor-api';
import { CaseView, FundKey, PortfolioScope } from './models';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';
export type SaveState = 'idle' | 'saving' | 'error';

/**
 * The Tracker worklist and Case Management data, read from `GET /api/debtors` and
 * `GET /api/debtors/{key}` (issues #65, #11, #12), and the officer's decisions written back through
 * `POST /api/debtors/{key}/decision` (issue #66). Reloads whenever the signed-in user, the year
 * filter or the funding filter changes, and drops any in-flight request it supersedes.
 */
@Injectable({ providedIn: 'root' })
export class CaseStore {
  readonly picked = signal<CaseView[]>([]);
  readonly refunds = signal<CaseView[]>([]);
  readonly paying = signal<CaseView[]>([]);
  readonly state = signal<LoadState>('idle');
  /** HTTP status of a failed list load: 403 = view not permitted for this user, 400 = invalid filter, null = no response. */
  readonly listErrorStatus = signal<number | null>(null);
  readonly listErrorMessage = computed(() => {
    switch (this.listErrorStatus()) {
      case 403:
        return "You don't have access to that view of the book. Switch to your own caseload or your team.";
      case 400:
        return 'The server rejected the current filters. Reset the year, funding or portfolio filter and try again.';
      case 401:
        return 'Your session has expired. Sign in again.';
      default:
        return "The server didn't respond. Check your connection and try again.";
    }
  });

  /** Picked-up cases followed by refund cases — the Case Management list. */
  readonly cases = computed<CaseView[]>(() => [...this.picked(), ...this.refunds()]);

  /** Full detail (evidence + activity) for the case the officer has open, keyed by debtor key. */
  readonly detail = signal<CaseView | null>(null);
  readonly detailState = signal<LoadState>('idle');
  /** HTTP status of a failed detail load: 403 = outside the officer's team, 404 = no such case. */
  readonly detailErrorStatus = signal<number | null>(null);

  /** Saving an officer decision (#66). `decisionErrorFor` is the case a failure belongs to. */
  readonly decisionState = signal<SaveState>('idle');
  readonly decisionErrorStatus = signal<number | null>(null);
  readonly decisionErrorFor = signal<string | null>(null);
  readonly decisionErrorMessage = computed(() => {
    switch (this.decisionErrorStatus()) {
      case 403:
        return "This case belongs to another team, so you can't decide it.";
      case 404:
        return 'This case no longer exists.';
      case 401:
        return 'Your session has expired. Sign in again.';
      case 400:
        return 'The server rejected this decision.';
      default:
        return "Couldn't save the decision. Check your connection and try again.";
    }
  });

  /** Recording an engagement action — SMS/WhatsApp/call/hand-over (issue #59, #269). */
  readonly engagementState = signal<SaveState>('idle');
  readonly engagementErrorStatus = signal<number | null>(null);
  readonly engagementErrorFor = signal<string | null>(null);
  readonly engagementErrorMessage = computed(() => {
    switch (this.engagementErrorStatus()) {
      case 409:
        return 'This case is no longer eligible for that action — refresh and try again.';
      case 403:
        return "This case belongs to another team, so you can't act on it.";
      case 404:
        return 'This case no longer exists.';
      case 401:
        return 'Your session has expired. Sign in again.';
      case 400:
        return 'The server rejected that action.';
      default:
        return "Couldn't record that action. Check your connection and try again.";
    }
  });

  private listSub?: Subscription;
  private detailSub?: Subscription;
  private decideSub?: Subscription;
  private engageSub?: Subscription;
  /** Emits the in-flight save's outcome; kept so a sign-out can finish it. */
  private pendingDone?: AsyncSubject<boolean>;
  /** Emits the in-flight engagement's outcome; kept so a sign-out can finish it. */
  private pendingEngagementDone?: AsyncSubject<boolean>;
  /** The case whose detail the officer has open, or null. A save for any other case leaves it alone. */
  private openKey: string | null = null;

  constructor(
    private api: DebtorApi,
    private debt: DebtService,
    private auth: AuthService,
  ) {
    effect(() => {
      const token = this.auth.token();
      const year = this.debt.year();
      const funding = this.debt.funding();
      const portfolio = this.debt.portfolioScope();
      untracked(() => (token ? this.load(year, funding, portfolio) : this.reset()));
    });
  }

  reload(): void {
    this.load(this.debt.year(), this.debt.funding(), this.debt.portfolioScope());
  }

  private load(year: number | 'all', funding: FundKey | 'all', portfolio: PortfolioScope): void {
    this.listSub?.unsubscribe();
    this.state.set('loading');
    this.listErrorStatus.set(null);
    this.listSub = forkJoin({
      picked: this.api.list('picked', year, funding, portfolio),
      refunds: this.api.list('refunds', year, funding, portfolio),
      paying: this.api.list('paying', year, funding, portfolio),
    }).subscribe({
      next: ({ picked, refunds, paying }) => {
        this.picked.set(picked);
        this.refunds.set(refunds);
        this.paying.set(paying);
        this.state.set('ready');
      },
      error: (err: unknown) => {
        this.listErrorStatus.set(err instanceof HttpErrorResponse ? err.status : null);
        this.state.set('error');
      },
    });
  }

  private reset(): void {
    this.listSub?.unsubscribe();
    this.detailSub?.unsubscribe();
    // A save still in flight belongs to the previous user: drop its response so it cannot repopulate
    // the lists or the detail after sign-out, and tell the page it did not save.
    this.decideSub?.unsubscribe();
    this.finishDecision(false);
    this.engageSub?.unsubscribe();
    this.finishEngagement(false);
    this.openKey = null;
    this.picked.set([]);
    this.refunds.set([]);
    this.paying.set([]);
    this.detail.set(null);
    this.state.set('idle');
    this.listErrorStatus.set(null);
    this.detailState.set('idle');
    this.detailErrorStatus.set(null);
    this.decisionState.set('idle');
    this.decisionErrorStatus.set(null);
    this.decisionErrorFor.set(null);
    this.engagementState.set('idle');
    this.engagementErrorStatus.set(null);
    this.engagementErrorFor.set(null);
  }

  /**
   * Saves an officer decision and, on success, refreshes the case from the server's response. The
   * returned observable emits `true` once saved and `false` if it failed, was refused because one is
   * already in flight, or was abandoned by a sign-out, so the page can close its panel only on
   * success. The request is owned by the store, so leaving the page mid-save does not cancel it.
   */
  decide(debtorKey: string, request: DecisionRequest): Observable<boolean> {
    if (this.decisionState() === 'saving') {
      const refused = new AsyncSubject<boolean>();
      refused.next(false);
      refused.complete();
      return refused.asObservable();
    }
    const done = new AsyncSubject<boolean>();
    this.pendingDone = done;
    this.decisionState.set('saving');
    this.decisionErrorStatus.set(null);
    this.decisionErrorFor.set(null);
    this.decideSub = this.api.decide(debtorKey, request).subscribe({
      next: (view) => {
        this.applyDetail(view);
        this.debt.recordServerDecision(view.d.id, view.decision);
        this.decisionState.set('idle');
        this.finishDecision(true);
      },
      error: (err: unknown) => {
        this.decisionErrorStatus.set(err instanceof HttpErrorResponse ? err.status : null);
        this.decisionErrorFor.set(debtorKey);
        this.decisionState.set('error');
        this.finishDecision(false);
      },
    });
    return done.asObservable();
  }

  private finishDecision(saved: boolean): void {
    const done = this.pendingDone;
    this.pendingDone = undefined;
    done?.next(saved);
    done?.complete();
  }

  /**
   * Records an engagement action (SMS/WhatsApp/call/hand-over) and, on success, replaces the case's
   * activity log with the server's refreshed copy — same in-flight/sign-out guards as {@link decide}.
   */
  engage(debtorKey: string, request: EngagementRequest): Observable<boolean> {
    if (this.engagementState() === 'saving') {
      const refused = new AsyncSubject<boolean>();
      refused.next(false);
      refused.complete();
      return refused.asObservable();
    }
    const done = new AsyncSubject<boolean>();
    this.pendingEngagementDone = done;
    this.engagementState.set('saving');
    this.engagementErrorStatus.set(null);
    this.engagementErrorFor.set(null);
    this.engageSub = this.api.engage(debtorKey, request).subscribe({
      next: (activity) => {
        this.applyActivity(debtorKey, activity);
        this.engagementState.set('idle');
        this.finishEngagement(true);
      },
      error: (err: unknown) => {
        this.engagementErrorStatus.set(err instanceof HttpErrorResponse ? err.status : null);
        this.engagementErrorFor.set(debtorKey);
        this.engagementState.set('error');
        this.finishEngagement(false);
      },
    });
    return done.asObservable();
  }

  private finishEngagement(saved: boolean): void {
    const done = this.pendingEngagementDone;
    this.pendingEngagementDone = undefined;
    done?.next(saved);
    done?.complete();
  }

  private applyActivity(debtorKey: string, activity: CaseView['activity']): void {
    const swap = (list: WritableSignal<CaseView[]>) =>
      list.update((rows) => rows.map((r) => (r.d.id === debtorKey ? { ...r, activity } : r)));
    swap(this.picked);
    swap(this.refunds);
    swap(this.paying);
    if (this.openKey !== debtorKey) return;
    const current = this.detail();
    if (current) this.detail.set({ ...current, activity });
  }

  /**
   * Puts a refreshed case into whichever list holds it, keeping list order, and into the open detail
   * — but only if that is the case the officer still has open. A save for case A must not replace,
   * or cancel the load of, the detail of case B that they have since moved to.
   */
  private applyDetail(view: CaseView): void {
    const swap = (list: WritableSignal<CaseView[]>) =>
      list.update((rows) => rows.map((r) => (r.d.id === view.d.id ? view : r)));
    swap(this.picked);
    swap(this.refunds);
    swap(this.paying);
    if (this.openKey !== view.d.id) return;
    this.detailSub?.unsubscribe();
    this.detail.set(view);
    this.detailState.set('ready');
    this.detailErrorStatus.set(null);
  }

  /** Loads the open case's detail. A stale response for a case the officer has since left is discarded. */
  loadDetail(debtorKey: string | null): void {
    this.detailSub?.unsubscribe();
    this.openKey = debtorKey;
    if (!debtorKey) {
      this.detail.set(null);
      this.detailState.set('idle');
      return;
    }
    if (this.detail()?.d.id !== debtorKey) this.detail.set(null);
    this.detailState.set('loading');
    this.detailErrorStatus.set(null);
    this.detailSub = this.api.detail(debtorKey).subscribe({
      next: (view) => {
        this.detail.set(view);
        this.detailState.set('ready');
      },
      error: (err: unknown) => {
        this.detailErrorStatus.set(err instanceof HttpErrorResponse ? err.status : null);
        this.detailState.set('error');
      },
    });
  }
}
