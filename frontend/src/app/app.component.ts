import { Component, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { DebtService } from './core/debt.service';
import { ExtractStatusService } from './core/extract-status.service';
import { AutonomySettingsService } from './core/autonomy-settings.service';
import { AuthService } from './core/auth/auth.service';
import { officerFor, roleLabel } from './core/auth/auth.models';
import { LEVELS } from './core/constants';
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
  private readonly router = inject(Router);
  readonly levels = LEVELS;
  readonly roleLabel = roleLabel;

  /** The workspace chrome is hidden on the sign-in screen. */
  readonly onLoginPage = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.startsWith('/login')),
    ),
    { initialValue: this.router.url.startsWith('/login') },
  );

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

  constructor(
    public debt: DebtService,
    public extractStatus: ExtractStatusService,
    public autonomySettings: AutonomySettingsService,
    public auth: AuthService,
  ) {
    // Portfolio scoping and the access log act as whoever is signed in.
    effect(() => {
      const user = this.auth.user();
      if (!user) return;
      untracked(() => {
        this.debt.signInAs(officerFor(user));
        // An admin has no caseload of their own; start them on the whole book.
        if (user.role === 'ADMIN') this.debt.setPortfolioScope('all');
        // The extract history is an admin endpoint: only ask when the user may see it.
        if (this.auth.canSeeAdminJobs()) this.extractStatus.refresh();
        // Everyone may see the persisted autonomy level; only managers/admins may change it (issue #57).
        this.autonomySettings.fetchLevel().subscribe((level) => this.debt.setAutonomy(level));
      });
    });
  }

  signOut(): void {
    this.auth.logout();
  }

  runExtract(): void {
    this.extractStatus.triggerRun();
  }

  onYearChange(value: string): void {
    this.debt.setYear(value === 'all' ? 'all' : Number(value));
  }
  onFundingChange(value: string): void {
    this.debt.setFunding(value as FundKey | 'all');
  }
  /** Backend-gated to managers/admins (403 otherwise); `[disabled]` on the <select> keeps an
   *  officer from ever triggering this, but the role check below is belt-and-braces, not the
   *  real boundary — see docs/SDD/issue-57-autonomy-level-write-endpoint.spec.md. */
  onAutonomyChange(value: string): void {
    if (!this.auth.canSeeAdminJobs()) return;
    const level = Number(value);
    this.autonomySettings.updateLevel(level).subscribe((persisted) => this.debt.setAutonomy(persisted));
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
