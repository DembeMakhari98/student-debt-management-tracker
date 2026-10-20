import { Injectable, computed, effect, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, forkJoin } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { DebtService } from './debt.service';
import { DebtorApi } from './debtor-api';
import { CaseView, FundKey, PortfolioScope } from './models';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The Tracker worklist and Case Management data, read from `GET /api/debtors` and
 * `GET /api/debtors/{key}` (issues #65, #11, #12). Reloads whenever the signed-in user, the
 * year filter or the funding filter changes, and drops any in-flight request it supersedes.
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

  private listSub?: Subscription;
  private detailSub?: Subscription;

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
    this.picked.set([]);
    this.refunds.set([]);
    this.paying.set([]);
    this.detail.set(null);
    this.state.set('idle');
    this.listErrorStatus.set(null);
    this.detailState.set('idle');
    this.detailErrorStatus.set(null);
  }

  /** Loads the open case's detail. A stale response for a case the officer has since left is discarded. */
  loadDetail(debtorKey: string | null): void {
    this.detailSub?.unsubscribe();
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
