import { Component, computed, effect } from '@angular/core';
import { DebtService, formatRand } from '../../core/debt.service';
import { AgeingApiService } from '../../core/ageing-api.service';
import { AGE_BUCKETS, FUND, FUND_KEYS } from '../../core/constants';
import { FundKey } from '../../core/models';

interface BarRow {
  label: string;
  color: string;
  amount: number;
  pct: number;
}
interface MatrixRow {
  fundKey: FundKey;
  values: number[];
  rowTotal: number;
  sharePct: number;
}
/** The subset of a debtor the Age Analysis tables render — built from the API's
 *  AgeingResponseDto rows rather than the full mock Debtor shape. */
interface AgeingRowStudent {
  id: string;
  name: string;
  year: number;
  funding: FundKey;
  creditReason?: string | null;
  creditSince?: string | null;
}
interface StudentRow {
  d: AgeingRowStudent;
  values: number[];
  totalOwed: number;
  oldestLabel: string;
  oldestColor: string;
}
interface CreditRow {
  d: AgeingRowStudent;
  days: number;
  bandLabel: string;
  bandColor: string;
  amount: number;
  pct: number;
}

/** Backend's FundingSource enum name ("SELF"/"GOV"/"PRIVATE") to the frontend's FundKey. */
function fundKeyOf(fundingSource: string): FundKey {
  return fundingSource.toLowerCase() as FundKey;
}

/** ISO date (e.g. "2026-02-12") to the prior mock data's display format ("12 Feb 2026"). */
function formatCreditSince(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** The Age Analysis workspace (issue #15), rendering GET /api/ageing's response (issue #67). */
@Component({
  selector: 'app-ageing',
  standalone: true,
  templateUrl: './ageing.component.html',
})
export class AgeingComponent {
  readonly R = formatRand;
  readonly buckets = AGE_BUCKETS;
  readonly fundKeys = FUND_KEYS;
  readonly FUND = FUND;

  constructor(
    public debt: DebtService,
    public ageingApi: AgeingApiService,
  ) {
    // The year/funding filter lives in the global chrome, not on this page — react to it
    // changing for as long as this component is alive.
    effect(() => {
      this.ageingApi.refresh(this.debt.year(), this.debt.funding());
    });
  }

  private readonly data = computed(() => this.ageingApi.data());

  readonly totalDebt = computed(() => {
    const bt = this.data()?.bucketTotals;
    return bt ? AGE_BUCKETS.reduce((s, b) => s + bt[b.key], 0) : 0;
  });
  readonly o90Total = computed(() => {
    const bt = this.data()?.bucketTotals;
    return bt ? bt.d90 + bt.d120 : 0;
  });
  readonly o90Pct = computed(() => (this.totalDebt() ? (this.o90Total() / this.totalDebt()) * 100 : 0));
  readonly creditCount = computed(() => this.data()?.credits.length ?? 0);

  readonly barRows = computed<BarRow[]>(() => {
    const bt = this.data()?.bucketTotals;
    const totals = AGE_BUCKETS.map((b) => bt?.[b.key] ?? 0);
    const max = Math.max(1, ...totals);
    return AGE_BUCKETS.map((b, i) => ({ label: b.label, color: b.color, amount: totals[i], pct: (totals[i] / max) * 100 }));
  });

  readonly matrixRows = computed<MatrixRow[]>(() => {
    const byFund = this.data()?.byFundingSource ?? {};
    return FUND_KEYS.map((f) => {
      const bucket = byFund[f.toUpperCase()];
      const values = AGE_BUCKETS.map((b) => bucket?.[b.key] ?? 0);
      const rowTotal = values.reduce((a, b) => a + b, 0);
      return { fundKey: f, values, rowTotal, sharePct: 0 };
    });
  });

  readonly matrixColTotals = computed<number[]>(() => {
    const rows = this.matrixRows();
    return AGE_BUCKETS.map((_, i) => rows.reduce((s, r) => s + r.values[i], 0));
  });

  readonly matrixGrandTotal = computed(() => this.matrixColTotals().reduce((a, b) => a + b, 0));

  readonly matrixRowsWithShare = computed<MatrixRow[]>(() => {
    const grand = this.matrixGrandTotal();
    return this.matrixRows().map((r) => ({ ...r, sharePct: grand ? (r.rowTotal / grand) * 100 : 0 }));
  });

  /** Order is the backend's (oldest-money-first) — preserved as given, not re-sorted. */
  readonly studentRows = computed<StudentRow[]>(() => {
    const students = this.data()?.students ?? [];
    return students.map((s) => {
      const values = AGE_BUCKETS.map((b) => s.ageing[b.key]);
      const oldest = AGE_BUCKETS.find((b) => b.label === s.oldestBucketLabel) ?? AGE_BUCKETS[0];
      return {
        d: { id: s.studentId, name: s.name, year: s.year, funding: fundKeyOf(s.fundingSource) },
        values,
        totalOwed: s.totalOwed,
        oldestLabel: s.oldestBucketLabel,
        oldestColor: oldest.color,
      };
    });
  });

  readonly studentColTotals = computed<number[]>(() => {
    const rows = this.studentRows();
    return AGE_BUCKETS.map((_, i) => rows.reduce((s, r) => s + r.values[i], 0));
  });
  readonly studentGrandTotal = computed(() => this.studentColTotals().reduce((a, b) => a + b, 0));

  /** Order is the backend's (oldest-first by days owing) — preserved as given. */
  private readonly creditRowsBase = computed(() => {
    const credits = this.data()?.credits ?? [];
    return credits.map((c) => {
      const band = AGE_BUCKETS.find((b) => b.label === c.ageingBandLabel) ?? AGE_BUCKETS[0];
      return {
        d: {
          id: c.studentId,
          name: c.name,
          year: c.year,
          funding: fundKeyOf(c.fundingSource),
          creditReason: c.creditReason,
          creditSince: formatCreditSince(c.creditSince),
        },
        days: c.daysOwing,
        bandLabel: c.ageingBandLabel,
        bandColor: band.color,
        amount: c.amountOwed,
      };
    });
  });

  readonly maxCreditDays = computed(() => Math.max(120, ...this.creditRowsBase().map((r) => r.days)));

  readonly creditRows = computed<CreditRow[]>(() => {
    const max = this.maxCreditDays();
    return this.creditRowsBase().map((r) => ({ ...r, pct: Math.min(100, (r.days / max) * 100) }));
  });
  readonly creditTotal = computed(() => this.creditRows().reduce((s, r) => s + r.amount, 0));
  readonly staleCredits = computed(() => this.creditRows().filter((r) => r.days > 90));
  readonly staleAmount = computed(() => this.staleCredits().reduce((s, r) => s + r.amount, 0));
  readonly oldestCredit = computed(() => this.creditRows()[0] ?? null);

  readonly showYear = computed(() => this.debt.year() === 'all');
}
