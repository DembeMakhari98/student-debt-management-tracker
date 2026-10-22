import { Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { CaseStore } from './core/case-store.service';
import { DebtService } from './core/debt.service';
import { ExtractStatusService } from './core/extract-status.service';
import { AutonomySettingsService } from './core/autonomy-settings.service';
import { MetaService } from './core/meta.service';
import { AuthService } from './core/auth/auth.service';
import { officerFor, roleLabel } from './core/auth/auth.models';
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
  readonly metaService = inject(MetaService);
  /** Autonomy level choices for the chrome's dropdown (issue #63) — empty until GET /api/meta loads. */
  readonly levels = computed(() => this.metaService.meta()?.autonomyLevels ?? []);
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
    { path: 'tracker', label: 'Debt Management Tracker', badge: () => String(this.store.picked().length) },
    {
      path: 'cases',
      label: 'Case management & AI recommendation',
      badge: () => String(this.store.cases().filter((c) => this.debt.needsApproval(this.debt.withLocalState(c))).length),
    },
    { path: 'ageing', label: 'Age Analysis', badge: () => '' },
  ];

  /** Guards the sign-in effect below against re-running merely because AuthService's startup
   *  GET /api/auth/me check (issue #63) replaced auth.user() with a new-but-equal object. */
  private signedInAs: string | null = null;

  constructor(
    public debt: DebtService,
    public store: CaseStore,
    public extractStatus: ExtractStatusService,
    public autonomySettings: AutonomySettingsService,
    public auth: AuthService,
  ) {
    // Portfolio scoping and the access log act as whoever is signed in.
    effect(() => {
      const user = this.auth.user();
      if (!user) {
        this.signedInAs = null;
        return;
      }
      if (user.username === this.signedInAs) return;
      this.signedInAs = user.username;
      untracked(() => {
        this.debt.signInAs(officerFor(user));
        // An admin has no caseload of their own; start them on the whole book.
        if (user.role === 'ADMIN') this.debt.setPortfolioScope('all');
        // The extract history is an admin endpoint: only ask when the user may see it.
        if (this.auth.canSeeAdminJobs()) this.extractStatus.refresh();
        // Years, funding sources, autonomy levels/current level — all one call (issue #63).
        this.metaService.refresh();
      });
    });

    // Everyone may see the persisted autonomy level; only managers/admins may change it (issue #57).
    effect(() => {
      const meta = this.metaService.meta();
      if (!meta) return;
      untracked(() => this.debt.setAutonomy(meta.autonomyLevel));
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
