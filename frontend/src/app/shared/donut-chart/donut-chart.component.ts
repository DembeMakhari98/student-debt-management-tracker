import { Component, computed } from '@angular/core';
import { DebtService, formatRand } from '../../core/debt.service';
import { FUND, FUND_KEYS } from '../../core/constants';
import { FundKey } from '../../core/models';
import { YearChartApiService } from '../../core/year-chart-api.service';

interface Slice {
  color: string;
  dasharray: string;
  dashoffset: number;
  title: string;
}
interface LegendRow {
  color: string;
  label: string;
  text: string;
}

const CX = 110;
const CY = 110;
const R = 78;
const SW = 28;
const C = 2 * Math.PI * R;

/** Funding mix of the current book (issue #10). */
@Component({
  selector: 'app-donut-chart',
  standalone: true,
  templateUrl: './donut-chart.component.html',
})
export class DonutChartComponent {
  readonly cx = CX;
  readonly cy = CY;
  readonly r = R;
  readonly sw = SW;

  constructor(
    public debt: DebtService,
    private yearChartApi: YearChartApiService,
  ) {}

  /**
   * The donut reads the same live data as the Home debt-by-year chart, `GET /api/summary/by-year`
   * (issue #176), instead of the frontend's bundled demo data (issue #177 / FTC-74). That endpoint
   * counts exactly what the "Total debt owed to institution" KPI counts (positive balances only,
   * in the caller's portfolio), split per financial year and funding source, so the donut's total
   * always equals the KPI for the same year and funding filter.
   *
   * It does not fetch by itself: `<app-year-chart>` on the same Home page triggers the (shared,
   * portfolio-scoped) request, and this component renders whatever that service holds.
   */
  /** True whenever a request is in flight, even if an earlier answer is still held: that answer may
   *  be another scope's or another user's, and must not be shown beside the new KPI cards. */
  readonly loading = computed(() => this.yearChartApi.loading());
  readonly failed = computed(() => this.yearChartApi.error());

  private readonly totals = computed<Record<FundKey, number>>(() => {
    const t: Record<FundKey, number> = { self: 0, gov: 0, private: 0 };
    const year = this.debt.year();
    const funding = this.debt.funding();
    for (const row of this.yearChartApi.data()) {
      if (year !== 'all' && row.year !== year) continue;
      for (const f of FUND_KEYS) {
        if (funding !== 'all' && funding !== f) continue;
        t[f] += row.byFundingSource[f.toUpperCase()] ?? 0;
      }
    }
    return t;
  });

  readonly total = computed(() => {
    const t = this.totals();
    return t.self + t.gov + t.private;
  });

  readonly centerLabel = computed(() => formatRand(this.total()));

  readonly slices = computed<Slice[]>(() => {
    const t = this.totals();
    const total = this.total();
    if (total <= 0) return [];
    let off = 0;
    const out: Slice[] = [];
    FUND_KEYS.forEach((f) => {
      const frac = t[f] / total;
      if (frac <= 0) return;
      const len = frac * C;
      out.push({
        color: FUND[f].color,
        dasharray: `${len} ${C - len}`,
        dashoffset: -off,
        title: `${FUND[f].label}: ${formatRand(t[f])} (${(frac * 100).toFixed(1)}%)`,
      });
      off += len;
    });
    return out;
  });

  readonly legend = computed<LegendRow[]>(() => {
    const t = this.totals();
    const total = this.total();
    return FUND_KEYS.map((f) => ({
      color: FUND[f].color,
      label: FUND[f].label,
      text: total ? `${formatRand(t[f])} · ${((t[f] / total) * 100).toFixed(1)}%` : formatRand(0),
    }));
  });
}
