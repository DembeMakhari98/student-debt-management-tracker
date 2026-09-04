import { Component, computed } from '@angular/core';
import { DebtService, formatRand } from '../../core/debt.service';
import { AGE_BUCKETS, FUND, FUND_KEYS } from '../../core/constants';
import { Debtor, FundKey } from '../../core/models';

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
interface StudentRow {
  d: Debtor;
  values: number[];
  totalOwed: number;
  oldestLabel: string;
  oldestColor: string;
}
interface CreditRow {
  d: Debtor;
  days: number;
  bandLabel: string;
  bandColor: string;
  amount: number;
  pct: number;
}

/** The Age Analysis workspace (issue #15). */
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

  constructor(public debt: DebtService) {}

  readonly o90Total = computed(() => this.debt.rows().reduce((s, d) => s + this.debt.over90(d), 0));
  readonly totalDebt = computed(() => this.debt.rows().reduce((s, d) => s + this.debt.rowDebt(d), 0));
  readonly o90Pct = computed(() => (this.totalDebt() ? (this.o90Total() / this.totalDebt()) * 100 : 0));
  readonly creditCount = computed(() => this.debt.rows().filter((d) => this.debt.owedToStudent(d)).length);

  readonly barRows = computed<BarRow[]>(() => {
    const rs = this.debt.rows();
    const totals = AGE_BUCKETS.map((b) => rs.reduce((s, d) => s + Math.max(0, d.ageing[b.key]), 0));
    const max = Math.max(1, ...totals);
    return AGE_BUCKETS.map((b, i) => ({ label: b.label, color: b.color, amount: totals[i], pct: (totals[i] / max) * 100 }));
  });

  readonly matrixRows = computed<MatrixRow[]>(() => {
    const rs = this.debt.rows();
    return FUND_KEYS.map((f) => {
      const values = AGE_BUCKETS.map((b) => rs.filter((d) => d.funding === f).reduce((s, d) => s + Math.max(0, d.ageing[b.key]), 0));
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

  readonly studentRows = computed<StudentRow[]>(() => {
    const rs = this.debt
      .rows()
      .filter((d) => this.debt.rowDebt(d) > 0)
      .sort(
        (a, b) =>
          Math.max(0, b.ageing.d120) - Math.max(0, a.ageing.d120) ||
          Math.max(0, b.ageing.d90) - Math.max(0, a.ageing.d90) ||
          this.debt.rowDebt(b) - this.debt.rowDebt(a),
      );
    return rs.map((d) => {
      const values = AGE_BUCKETS.map((b) => Math.max(0, d.ageing[b.key]));
      const oldest = this.debt.oldestBucket(d);
      return { d, values, totalOwed: this.debt.rowDebt(d), oldestLabel: oldest.label, oldestColor: oldest.color };
    });
  });

  readonly studentColTotals = computed<number[]>(() => {
    const rows = this.studentRows();
    return AGE_BUCKETS.map((_, i) => rows.reduce((s, r) => s + r.values[i], 0));
  });
  readonly studentGrandTotal = computed(() => this.studentColTotals().reduce((a, b) => a + b, 0));

  private readonly creditRowsBase = computed(() => {
    const rs = this.debt
      .rows()
      .filter((d) => this.debt.owedToStudent(d))
      .sort((a, b) => (b.creditDays || 0) - (a.creditDays || 0));
    return rs.map((d) => {
      const days = d.creditDays || 0;
      const band = this.debt.daysBand(days);
      return { d, days, bandLabel: band.label, bandColor: band.color, amount: Math.abs(this.debt.rowTotal(d)) };
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
