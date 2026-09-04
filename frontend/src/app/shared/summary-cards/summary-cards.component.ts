import { Component, computed } from '@angular/core';
import { DebtService, formatRand } from '../../core/debt.service';
import { BLUSH, MID, NAVY, RED_TEXT, TEAL } from '../../core/constants';

interface KpiCard {
  k: string;
  dot: string;
  v: string;
  n: string;
}

/** The 5 KPI cards shared by Home and the Tracker (issue #10). */
@Component({
  selector: 'app-summary-cards',
  standalone: true,
  templateUrl: './summary-cards.component.html',
})
export class SummaryCardsComponent {
  constructor(public debt: DebtService) {}

  readonly cards = computed<KpiCard[]>(() => {
    const s = this.debt.summary();
    const N = (n: number) => Math.round(n).toLocaleString('en-ZA');
    const year = this.debt.year();
    const calYear = this.debt.calendarYear;
    return [
      {
        k: 'Registered students',
        dot: NAVY,
        v: N(s.registered),
        n:
          year === 'all'
            ? `registrations across ${this.debt.yearSpan}`
            : `enrolled in ${year}${year === calYear ? ' · current year' : ''}`,
      },
      { k: 'Total debt owed to institution', dot: RED_TEXT, v: formatRand(s.totalDebt), n: `${s.debtors.length} debtor(s) · ${this.debt.yearShort()}` },
      { k: 'Owed to students (credits)', dot: TEAL, v: formatRand(s.totalCredit), n: `${s.credits.length} student(s) with credit balances` },
      { k: 'At risk (90+ days)', dot: BLUSH, v: formatRand(s.o90), n: `${s.o90Pct.toFixed(1)}% of outstanding debt` },
      { k: 'Average balance per debtor', dot: MID, v: formatRand(s.avg), n: `across ${s.debtors.length} debtor(s)` },
    ];
  });
}
