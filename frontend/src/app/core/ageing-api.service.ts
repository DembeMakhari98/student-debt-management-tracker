import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Subscription, catchError, of } from 'rxjs';
import { API_BASE } from './api';
import { Ageing, FundKey } from './models';

export interface AgeingStudentRow {
  studentId: string;
  name: string;
  year: number;
  fundingSource: string;
  fundingLabel: string;
  ageing: Ageing;
  totalOwed: number;
  oldestBucketLabel: string;
}

export interface AgeingCreditRow {
  studentId: string;
  name: string;
  year: number;
  fundingSource: string;
  fundingLabel: string;
  creditReason: string | null;
  creditSince: string | null;
  daysOwing: number;
  ageingBandLabel: string;
  amountOwed: number;
}

/** The shape of `GET /api/ageing`'s response (backend's AgeingResponseDto, issue #67). */
export interface AgeingApiResponse {
  bucketTotals: Ageing;
  byFundingSource: Record<string, Ageing>;
  students: AgeingStudentRow[];
  credits: AgeingCreditRow[];
  staleCreditTotal: number;
  staleCreditCount: number;
}

/**
 * Fetches the Age Analysis workspace's data (issue #67), mirroring DebtService's
 * summary-fetch pattern from #64: `refresh()` cancels any still-in-flight previous
 * request before issuing the new one, so a rapid filter change can't resolve out of order.
 */
@Injectable({ providedIn: 'root' })
export class AgeingApiService {
  private readonly dataSig = signal<AgeingApiResponse | null>(null);
  private readonly loadingSig = signal(false);
  private readonly errorSig = signal(false);
  private sub?: Subscription;

  readonly data = this.dataSig.asReadonly();
  readonly loading = this.loadingSig.asReadonly();
  readonly error = this.errorSig.asReadonly();

  constructor(private http: HttpClient) {}

  refresh(year: number | 'all', funding: FundKey | 'all'): void {
    this.sub?.unsubscribe();
    this.loadingSig.set(true);
    this.errorSig.set(false);
    this.sub = this.http
      .get<AgeingApiResponse>(`${API_BASE}/api/ageing`, {
        params: { year: String(year), funding: String(funding) },
      })
      .pipe(
        catchError(() => {
          this.errorSig.set(true);
          return of(null);
        }),
      )
      .subscribe((data) => {
        this.loadingSig.set(false);
        if (data) this.dataSig.set(data);
      });
  }
}
