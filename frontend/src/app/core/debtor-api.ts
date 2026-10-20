import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from './api';
import { ActivityEntry, CaseView, Debtor, Decision, DecisionAction, FundKey, PortfolioScope, RiskBand, Term } from './models';

/* Wire shapes — mirror backend dto/DebtorRowDto, CaseDetailDto and friends (issues #11, #12). */

export interface AgeingDto {
  current: number;
  d30: number;
  d60: number;
  d90: number;
  d120: number;
}

export interface SignalDto {
  text: string;
  hot: boolean;
}

export interface TermDto {
  key: string;
  value: string;
}

export interface RecommendationDto {
  type: string;
  action: string;
  status: string;
  rationale: string;
  agent: string;
  policyClause: string;
  terms: TermDto[];
}

export interface DecisionDto {
  action: string;
  /** Free text on the wire; a JSON array of {key, value} when written by the decision endpoint. */
  amendedTerms: string | null;
  reason: string | null;
  decidedBy: string;
  decidedAt: string;
}

export interface DebtorRowDto {
  debtorKey: string;
  studentId: string;
  name: string;
  year: number;
  programme: string;
  fundingSource: string;
  fundingLabel: string;
  fundingStatus: string;
  missedInstalments: number;
  lastPaymentDate: string | null;
  arrangementStatus: string | null;
  ageing: AgeingDto;
  balance: number;
  debt: number;
  credit: number;
  owedToStudent: boolean;
  pickedUp: boolean;
  riskScore: number;
  riskBand: string;
  /** The owning officer's key (issue #55); null while the case is unassigned. */
  assignedOfficer: string | null;
  signals: SignalDto[];
  recommendation: RecommendationDto;
  lastDecision: DecisionDto | null;
}

export interface ActivityEntryDto {
  text: string;
  source: string;
  createdAt: string | null;
}

export interface CaseDetailDto {
  debtor: DebtorRowDto;
  evidence: string[];
  activity: ActivityEntryDto[];
  lastDecision: DecisionDto | null;
}

/** `cases` is picked-up + refunds, in that order — the Case Management list. */
export type DebtorScope = 'picked' | 'refunds' | 'paying' | 'cases';

/**
 * Body of `POST /api/debtors/{key}/decision` (backend DecisionRequestDto, issue #13). `decidedBy` is
 * deliberately absent: the server attributes the decision to the signed-in user and ignores any
 * client-supplied value.
 */
export type DecisionVerb = 'APPROVE' | 'AMEND' | 'DECLINE';

export interface DecisionRequest {
  action: DecisionVerb;
  /** Required by the server for AMEND — a JSON array of `{key, value}`, see `encodeAmendedTerms`. */
  amendedTerms?: string;
  /** Required by the server for DECLINE. */
  reason?: string;
}

/** The inverse of `parseAmendedTerms`: the officer's edited terms as the wire string. */
export function encodeAmendedTerms(terms: Term[]): string {
  return JSON.stringify(terms.map((t) => ({ key: t.k, value: t.v })));
}

/* Mapping into the view models the pages already render. */

const ACTIONS: Record<string, DecisionAction> = {
  APPROVE: 'Approved',
  APPROVED: 'Approved',
  AMEND: 'Amended',
  AMENDED: 'Amended',
  DECLINE: 'Declined',
  DECLINED: 'Declined',
};

/** Amended terms arrive as a JSON string. Anything unparseable is kept as one "Amended" term, never dropped. */
export function parseAmendedTerms(raw: string | null): Term[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((t) => ({
        k: String((t as Record<string, unknown>)['key'] ?? (t as Record<string, unknown>)['k'] ?? ''),
        v: String((t as Record<string, unknown>)['value'] ?? (t as Record<string, unknown>)['v'] ?? ''),
      }));
    }
  } catch {
    /* fall through to the plain-text form */
  }
  return [{ k: 'Amended', v: raw }];
}

export function toDecision(dto: DecisionDto | null, recommendationType: string): Decision | null {
  if (!dto) return null;
  const action = ACTIONS[dto.action.toUpperCase()];
  if (!action) return null;
  return {
    recommendationType,
    action,
    amendedTerms: action === 'Amended' ? parseAmendedTerms(dto.amendedTerms) : undefined,
    reason: dto.reason ?? undefined,
    decidedBy: dto.decidedBy,
    decidedAt: dto.decidedAt,
  };
}

export function toDebtor(row: DebtorRowDto): Debtor {
  return {
    id: row.debtorKey,
    name: row.name,
    funding: row.fundingSource.toLowerCase() as FundKey,
    year: row.year,
    prog: row.programme,
    fundStatus: row.fundingStatus,
    missed: row.missedInstalments,
    lastPay: row.lastPaymentDate,
    arrangement: row.arrangementStatus,
    ageing: { ...row.ageing },
    assignedOfficer: row.assignedOfficer ?? '',
  };
}

export function toCaseView(row: DebtorRowDto, evidence: string[] = [], activity: ActivityEntry[] = []): CaseView {
  const rec = row.recommendation;
  return {
    d: toDebtor(row),
    score: row.riskScore,
    band: row.riskBand as RiskBand,
    debt: row.debt,
    credit: row.credit,
    signals: row.signals.map((s) => ({ t: s.text, hot: s.hot })),
    rec: {
      type: rec.type,
      action: rec.action,
      status: rec.status as CaseView['rec']['status'],
      rationale: rec.rationale,
      terms: rec.terms.map((t) => ({ k: t.key, v: t.value })),
    },
    evidence,
    activity,
    decision: toDecision(row.lastDecision, rec.type),
  };
}

export function toDetailView(dto: CaseDetailDto): CaseView {
  return toCaseView(
    dto.debtor,
    dto.evidence,
    dto.activity.map((a) => ({ t: a.text, m: a.source })),
  );
}

/** Thin HTTP client for the Tracker worklist and Case Management endpoints. */
@Injectable({ providedIn: 'root' })
export class DebtorApi {
  constructor(private http: HttpClient) {}

  /** `portfolio` is enforced by the server from the login token; 'all' is 403 for an officer. */
  list(
    scope: DebtorScope,
    year: number | 'all',
    funding: FundKey | 'all',
    portfolio: PortfolioScope = 'own',
  ): Observable<CaseView[]> {
    let params = new HttpParams().set('scope', scope).set('year', String(year)).set('portfolio', portfolio);
    if (funding !== 'all') params = params.set('funding', funding);
    return this.http
      .get<DebtorRowDto[]>(`${API_BASE}/api/debtors`, { params })
      .pipe(map((rows) => rows.map((r) => toCaseView(r))));
  }

  detail(debtorKey: string): Observable<CaseView> {
    return this.http
      .get<CaseDetailDto>(`${API_BASE}/api/debtors/${encodeURIComponent(debtorKey)}`)
      .pipe(map(toDetailView));
  }

  /** Saves an officer decision; the response is the refreshed case, so the caller needs no re-fetch. */
  decide(debtorKey: string, request: DecisionRequest): Observable<CaseView> {
    return this.http
      .post<CaseDetailDto>(`${API_BASE}/api/debtors/${encodeURIComponent(debtorKey)}/decision`, request)
      .pipe(map(toDetailView));
  }
}
