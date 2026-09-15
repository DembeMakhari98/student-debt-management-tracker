import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DebtService } from './core/debt.service';
import { LEVELS } from './core/constants';
import { OFFICERS } from './core/officers';
import { FundKey, PortfolioScope } from './core/models';

interface TabDef {
  path: string;
  label: string;
  badge: () => string;
}

/** The global chrome — brand bar, tab strip and shared filters (issue #16). */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly levels = LEVELS;
  readonly officers = OFFICERS;

  readonly tabs: TabDef[] = [
    { path: 'home', label: 'Home', badge: () => '' },
    { path: 'tracker', label: 'Debt Management Tracker', badge: () => String(this.debt.pickedRows().length) },
    {
      path: 'cases',
      label: 'Case management & AI recommendation',
      badge: () => String(this.debt.caseRows().filter((d) => this.debt.needsApproval(this.debt.caseOf(d))).length),
    },
    { path: 'ageing', label: 'Age Analysis', badge: () => '' },
  ];

  constructor(public debt: DebtService) {}

  onYearChange(value: string): void {
    this.debt.setYear(value === 'all' ? 'all' : Number(value));
  }
  onFundingChange(value: string): void {
    this.debt.setFunding(value as FundKey | 'all');
  }
  onAutonomyChange(value: string): void {
    this.debt.setAutonomy(Number(value));
  }
  onOfficerChange(value: string): void {
    this.debt.setCurrentOfficer(value);
  }
  onScopeChange(value: string): void {
    this.debt.setPortfolioScope(value as PortfolioScope);
  }
  initialsOf(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  }
  export(): void {
    this.debt.exportCsv();
  }
}
