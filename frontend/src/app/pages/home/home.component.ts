import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DebtService } from '../../core/debt.service';
import { FundKey } from '../../core/models';
import { SummaryCardsComponent } from '../../shared/summary-cards/summary-cards.component';
import { YearChartComponent } from '../../shared/year-chart/year-chart.component';
import { DonutChartComponent } from '../../shared/donut-chart/donut-chart.component';

interface Workspace {
  path: string;
  label: string;
  blurb: string;
}

const WORKSPACES: Workspace[] = [
  {
    path: 'tracker',
    label: 'Debt Management Tracker',
    blurb:
      'The debt summary for the selected year, and the students the agent has picked up for not paying or missing a payment — scored, with the proposed action on every row.',
  },
  {
    path: 'cases',
    label: 'Case management & AI recommendation',
    blurb:
      'One case per flagged student: the balance, the ageing, why the score moved, the AI recommendation with its rationale, evidence and policy clause, and the decision.',
  },
  {
    path: 'ageing',
    label: 'Age Analysis',
    blurb:
      'Current to 120+ day ageing across the book — by funding source, then student by student, plus the students the institution owes and how long it has been holding their money.',
  },
];

/** The Home workspace — debt summary and charts (issue #10). */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, SummaryCardsComponent, YearChartComponent, DonutChartComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  readonly workspaces = WORKSPACES;

  constructor(public debt: DebtService) {}

  /** Institution-wide counts, deliberately not portfolio-scoped (issue #18 non-goal) —
   *  Home is an aggregate dashboard, not case-level work. */
  readonly picked = computed(() => this.debt.allPickedRows().length);
  readonly paying = computed(() => this.debt.allPayingRows().length);

  onYearChange(value: string): void {
    this.debt.setYear(value === 'all' ? 'all' : Number(value));
  }
  onFundingChange(value: string): void {
    this.debt.setFunding(value as FundKey | 'all');
  }
}
