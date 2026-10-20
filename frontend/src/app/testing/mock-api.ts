import { HttpErrorResponse, HttpInterceptorFn, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, Provider, inject, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { FUND } from '../core/constants';
import { DebtService } from '../core/debt.service';
import { ActivityEntryDto, CaseDetailDto, DebtorRowDto, DecisionDto, DecisionRequest } from '../core/debtor-api';
import { DEBTORS } from '../core/mock-data';
import { Debtor, PortfolioScope } from '../core/models';

/**
 * Test double for the backend's `/api/debtors` endpoints, answering from the in-memory mock
 * dataset so page specs exercise the real CaseStore → DebtorApi → mapper → template path
 * without a server. Flip `mockApi.failList` / `mockApi.failDetail` / `mockApi.failDecision` to
 * simulate an outage. A decision POSTed to `/api/debtors/{key}/decision` is remembered, so later list
 * and detail reads return it — the "survives a reload" behaviour of the real backend (issue #66).
 */
export const mockApi = {
  failList: false,
  listStatus: 500,
  failDetail: false,
  detailStatus: 500,
  failDecision: false,
  decisionStatus: 500,
  enforcePortfolio: false,
  listCalls: [] as string[],
  detailCalls: [] as string[],
  decisionCalls: [] as { key: string; body: DecisionRequest }[],
};

const serverDecisions = new Map<string, DecisionDto>();
const serverActivity = new Map<string, ActivityEntryDto[]>();

export function resetMockApi(): void {
  mockApi.failList = false;
  mockApi.listStatus = 500;
  mockApi.failDetail = false;
  mockApi.detailStatus = 500;
  mockApi.failDecision = false;
  mockApi.decisionStatus = 500;
  mockApi.enforcePortfolio = false;
  mockApi.listCalls = [];
  mockApi.detailCalls = [];
  mockApi.decisionCalls = [];
  serverDecisions.clear();
  serverActivity.clear();
}

function rowOf(debt: DebtService, d: Debtor): DebtorRowDto {
  const rec = debt.recommend(d);
  const score = debt.riskScore(d);
  return {
    debtorKey: d.id,
    studentId: d.id,
    name: d.name,
    year: d.year,
    programme: d.prog,
    fundingSource: d.funding.toUpperCase(),
    fundingLabel: FUND[d.funding].label,
    fundingStatus: d.fundStatus,
    missedInstalments: d.missed,
    lastPaymentDate: d.lastPay,
    arrangementStatus: d.arrangement,
    ageing: { ...d.ageing },
    balance: debt.rowTotal(d),
    debt: debt.rowDebt(d),
    credit: Math.abs(Math.min(0, debt.rowTotal(d))),
    owedToStudent: debt.owedToStudent(d),
    pickedUp: debt.pickedUp(d),
    riskScore: score,
    riskBand: debt.bandOf(score),
    assignedOfficer: d.assignedOfficer || null,
    signals: debt.signalsOf(d).map((s) => ({ text: s.t, hot: s.hot })),
    recommendation: {
      type: rec.type,
      action: rec.action,
      status: rec.status,
      rationale: rec.rationale,
      agent: debt.agentOf(rec.type),
      policyClause: debt.policyClauseOf(rec.type),
      terms: rec.terms.map((t) => ({ key: t.k, value: t.v })),
    },
    lastDecision: serverDecisions.get(d.id) ?? null,
  };
}

const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const url = new URL(req.urlWithParams);

  // DebtService fetches the KPI summary from its constructor (issue #64), so this branch must run
  // before anything injects DebtService, or the two would depend on each other circularly.
  if (url.pathname === '/api/summary') {
    const year = url.searchParams.get('year');
    const funding = url.searchParams.get('funding');
    const rs = DEBTORS.filter(
      (d) => (!year || year === 'all' || d.year === Number(year)) && (!funding || funding === 'all' || d.funding === funding),
    );
    const total = (d: Debtor) => d.ageing.current + d.ageing.d30 + d.ageing.d60 + d.ageing.d90 + d.ageing.d120;
    const debtors = rs.filter((d) => total(d) > 0);
    const credits = rs.filter((d) => total(d) < 0);
    const totalDebt = debtors.reduce((s, d) => s + total(d), 0);
    const over90 = rs.reduce((s, d) => s + Math.max(0, d.ageing.d90) + Math.max(0, d.ageing.d120), 0);
    return of(
      new HttpResponse({
        status: 200,
        body: {
          registeredStudents: rs.length,
          totalDebt,
          debtorCount: debtors.length,
          totalCredit: Math.abs(credits.reduce((s, d) => s + total(d), 0)),
          creditCount: credits.length,
          atRisk90Plus: over90,
          atRisk90PlusPct: totalDebt ? (over90 / totalDebt) * 100 : 0,
          averageBalance: debtors.length ? totalDebt / debtors.length : 0,
        },
      }),
    );
  }

  if (!url.pathname.startsWith('/api/debtors')) return next(req);
  const debt = inject(DebtService);
  const ok = (body: unknown) => of(new HttpResponse({ status: 200, body }));
  const fail = () => throwError(() => new HttpErrorResponse({ status: mockApi.listStatus, url: req.url }));

  const detailOf = (d: Debtor): CaseDetailDto => ({
    debtor: rowOf(debt, d),
    evidence: debt.evidenceOf(d),
    activity: [
      ...(serverActivity.get(d.id) ?? []),
      ...debt.activityOf(d).map((a) => ({ text: a.t, source: a.m, createdAt: null })),
    ],
    lastDecision: serverDecisions.get(d.id) ?? null,
  });

  const decisionPath = /^\/api\/debtors\/([^/]+)\/decision$/.exec(url.pathname);
  if (decisionPath && req.method === 'POST') {
    const decisionKey = decodeURIComponent(decisionPath[1]);
    const request = req.body as DecisionRequest;
    mockApi.decisionCalls.push({ key: decisionKey, body: request });
    if (mockApi.failDecision) return throwError(() => new HttpErrorResponse({ status: mockApi.decisionStatus, url: req.url }));
    const d = DEBTORS.find((x) => x.id === decisionKey);
    if (!d) return throwError(() => new HttpErrorResponse({ status: 404, url: req.url }));
    const decidedBy = 'Test Officer';
    serverDecisions.set(d.id, {
      action: request.action,
      amendedTerms: request.amendedTerms ?? null,
      reason: request.reason ?? null,
      decidedBy,
      decidedAt: new Date().toISOString(),
    });
    const verb = { APPROVE: 'approved', AMEND: 'amended and approved', DECLINE: 'declined' }[request.action];
    serverActivity.set(d.id, [
      {
        text: `Recommendation ${verb} by ${decidedBy}` + (request.action === 'DECLINE' ? ` — ${request.reason}` : ''),
        source: `Officer decision · ${decidedBy}`,
        createdAt: new Date().toISOString(),
      },
      ...(serverActivity.get(d.id) ?? []),
    ]);
    return ok(detailOf(d));
  }

  const key = decodeURIComponent(url.pathname.replace('/api/debtors', '').replace(/^\//, ''));
  if (key) {
    mockApi.detailCalls.push(key);
    if (mockApi.failDetail) return throwError(() => new HttpErrorResponse({ status: mockApi.detailStatus, url: req.url }));
    const d = DEBTORS.find((x) => x.id === key);
    if (!d) return throwError(() => new HttpErrorResponse({ status: 404, url: req.url }));
    return ok(detailOf(d));
  }

  mockApi.listCalls.push(url.search);
  if (mockApi.failList) return fail();
  const year = url.searchParams.get('year');
  const funding = url.searchParams.get('funding');
  const scope = url.searchParams.get('scope') ?? 'picked';
  const portfolio = (url.searchParams.get('portfolio') ?? 'own') as PortfolioScope;
  if (mockApi.enforcePortfolio && portfolio === 'all' && debt.currentOfficer().role !== 'manager') {
    return throwError(() => new HttpErrorResponse({ status: 403, url: req.url }));
  }
  const inFilter = (d: Debtor) =>
    (!mockApi.enforcePortfolio || debt.inPortfolio(d, debt.currentOfficer(), portfolio)) &&
    (!year || year === 'all' || d.year === Number(year)) && (!funding || funding === 'all' || d.funding === funding);
  const byRisk = (a: Debtor, b: Debtor) => debt.riskScore(b) - debt.riskScore(a);
  const byCredit = (a: Debtor, b: Debtor) => debt.rowTotal(a) - debt.rowTotal(b);

  const picked = DEBTORS.filter((d) => inFilter(d) && debt.pickedUp(d)).sort(byRisk);
  const refunds = DEBTORS.filter((d) => inFilter(d) && debt.owedToStudent(d)).sort(byCredit);
  const paying = DEBTORS.filter((d) => inFilter(d) && debt.rowDebt(d) > 0 && !debt.pickedUp(d));
  const chosen = scope === 'refunds' ? refunds : scope === 'paying' ? paying : scope === 'cases' ? [...picked, ...refunds] : picked;
  return ok(chosen.map((d) => rowOf(debt, d)));
};

/** Providers for a page spec: the mock API, plus a signed-in AuthService so CaseStore loads. */
export function mockApiProviders(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(withInterceptors([mockApiInterceptor])),
    { provide: AuthService, useValue: { token: signal('test-token'), user: signal(null), logout: () => {} } },
  ];
}
