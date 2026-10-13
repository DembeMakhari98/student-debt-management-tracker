import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent) },
      { path: 'tracker', loadComponent: () => import('./pages/tracker/tracker.component').then((m) => m.TrackerComponent) },
      {
        path: 'cases',
        loadComponent: () => import('./pages/cases/cases.component').then((m) => m.CasesComponent),
      },
      { path: 'ageing', loadComponent: () => import('./pages/ageing/ageing.component').then((m) => m.AgeingComponent) },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
