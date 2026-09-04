import { Component, computed } from '@angular/core';
import { DebtService } from '../../core/debt.service';
import { FUND, FUND_KEYS } from '../../core/constants';
import { DEBTORS, YEARS } from '../../core/mock-data';
import { FundKey } from '../../core/models';

interface Bar {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  opacity: number;
  title: string;
}
interface TextLabel {
  x: number;
  y: number;
  text: string;
  bold: boolean;
  muted: boolean;
  anchor: 'start' | 'middle' | 'end';
}
interface GridLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const W = 720;
const H = 300;
const PAD_L = 64;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 42;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

/** Total debt to the institution per year, stacked by funding source (issue #10). */
@Component({
  selector: 'app-year-chart',
  standalone: true,
  templateUrl: './year-chart.component.html',
})
export class YearChartComponent {
  readonly viewBox = `0 0 ${W} ${H}`;

  constructor(public debt: DebtService) {}

  private readonly perYear = computed(() =>
    YEARS.map((y) => {
      const totals: Record<FundKey, number> = { self: 0, gov: 0, private: 0 };
      DEBTORS.filter((d) => d.year === y).forEach((d) => {
        totals[d.funding] += this.debt.rowDebt(d);
      });
      return { y, ...totals, total: totals['self'] + totals['gov'] + totals['private'] };
    }),
  );

  private readonly niceMax = computed(() => Math.ceil(Math.max(1, ...this.perYear().map((p) => p.total)) / 50000) * 50000);

  readonly gridLines = computed<{ line: GridLine; label: TextLabel }[]>(() => {
    const niceMax = this.niceMax();
    const out: { line: GridLine; label: TextLabel }[] = [];
    for (let i = 0; i <= 4; i++) {
      const val = (niceMax / 4) * i;
      const yy = PAD_T + PLOT_H - (val / niceMax) * PLOT_H;
      out.push({
        line: { x1: PAD_L, y1: yy, x2: W - PAD_R, y2: yy },
        label: { x: PAD_L - 8, y: yy + 4, text: `R${val / 1000}k`, bold: false, muted: false, anchor: 'end' },
      });
    }
    return out;
  });

  readonly highlight = computed<HighlightRect | null>(() => {
    const perYear = this.perYear();
    const gap = PLOT_W / perYear.length;
    const i = perYear.findIndex((p) => p.y === this.debt.year());
    if (i < 0) return null;
    const cx = PAD_L + gap * i + gap / 2;
    return { x: cx - gap / 2 + 4, y: PAD_T, width: gap - 8, height: PLOT_H };
  });

  readonly bars = computed<Bar[]>(() => {
    const perYear = this.perYear();
    const niceMax = this.niceMax();
    const gap = PLOT_W / perYear.length;
    const bw = gap * 0.55;
    const funding = this.debt.funding();
    const out: Bar[] = [];
    perYear.forEach((p, i) => {
      const cx = PAD_L + gap * i + gap / 2;
      let yc = PAD_T + PLOT_H;
      FUND_KEYS.forEach((f) => {
        const h = (p[f] / niceMax) * PLOT_H;
        if (h <= 0) return;
        const opacity = funding === 'all' || funding === f ? 1 : 0.22;
        out.push({
          x: cx - bw / 2,
          y: yc - h,
          width: bw,
          height: h,
          fill: FUND[f].color,
          opacity,
          title: `${p.y} · ${FUND[f].label}: R ${Math.round(p[f]).toLocaleString('en-ZA')}`,
        });
        yc -= h;
      });
    });
    return out;
  });

  readonly totalLabels = computed<TextLabel[]>(() => {
    const perYear = this.perYear();
    const niceMax = this.niceMax();
    const gap = PLOT_W / perYear.length;
    return perYear
      .filter((p) => p.total > 0)
      .map((p) => {
        const i = perYear.indexOf(p);
        const cx = PAD_L + gap * i + gap / 2;
        const height = (p.total / niceMax) * PLOT_H;
        const yc = PAD_T + PLOT_H - height;
        return { x: cx, y: yc - 8, text: 'R' + Math.round(p.total / 1000) + 'k', bold: true, muted: false, anchor: 'middle' as const };
      });
  });

  readonly yearLabels = computed<TextLabel[]>(() => {
    const perYear = this.perYear();
    const gap = PLOT_W / perYear.length;
    return perYear.map((p, i) => {
      const cx = PAD_L + gap * i + gap / 2;
      const on = p.y === this.debt.year();
      return { x: cx, y: H - 16, text: String(p.y), bold: on, muted: !on, anchor: 'middle' as const };
    });
  });
}
