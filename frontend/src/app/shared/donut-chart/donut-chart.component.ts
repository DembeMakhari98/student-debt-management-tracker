import { Component, computed } from '@angular/core';
import { DebtService, formatRand } from '../../core/debt.service';
import { FUND, FUND_KEYS } from '../../core/constants';
import { FundKey } from '../../core/models';

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

  constructor(public debt: DebtService) {}

  private readonly totals = computed<Record<FundKey, number>>(() => {
    const t: Record<FundKey, number> = { self: 0, gov: 0, private: 0 };
    this.debt
      .rows()
      .filter((d) => this.debt.rowDebt(d) > 0)
      .forEach((d) => {
        t[d.funding] += this.debt.rowDebt(d);
      });
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
