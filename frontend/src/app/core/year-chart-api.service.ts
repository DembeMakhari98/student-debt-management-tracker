import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Subscription, catchError, of } from 'rxjs';
import { API_BASE } from './api';
import { PortfolioScope } from './models';

export interface YearlyDebtRow {
  year: number;
  byFundingSource: Record<string, number>;
  total: number;
}

/**
 * Fetches the Home debt-by-year chart's data (issue #176): one row per financial year, split by
 * funding source, scoped to the caller's portfolio — replaces the chart's prior use of the
 * frontend's bundled demo data (`core/mock-data.ts`), which could disagree with the real KPIs.
 */
@Injectable({ providedIn: 'root' })
export class YearChartApiService {
  private readonly dataSig = signal<YearlyDebtRow[]>([]);
  private readonly loadingSig = signal(false);
  private readonly errorSig = signal(false);
  private sub?: Subscription;

  readonly data = this.dataSig.asReadonly();
  readonly loading = this.loadingSig.asReadonly();
  readonly error = this.errorSig.asReadonly();

  constructor(private http: HttpClient) {}

  refresh(portfolio: PortfolioScope): void {
    this.sub?.unsubscribe();
    this.loadingSig.set(true);
    this.errorSig.set(false);
    this.sub = this.http
      .get<YearlyDebtRow[]>(`${API_BASE}/api/summary/by-year`, { params: { portfolio } })
      .pipe(
        catchError(() => {
          this.errorSig.set(true);
          return of([] as YearlyDebtRow[]);
        }),
      )
      .subscribe((data) => {
        this.loadingSig.set(false);
        this.dataSig.set(data);
      });
  }
}
