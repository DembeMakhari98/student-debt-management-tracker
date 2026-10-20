import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE } from './api';
import { CaseDetailDto, DebtorApi, DebtorRowDto, parseAmendedTerms, toCaseView, toDecision } from './debtor-api';

function row(overrides: Partial<DebtorRowDto> = {}): DebtorRowDto {
  return {
    debtorKey: 'STU-100234-2026',
    studentId: 'STU-100234',
    name: 'Test Student',
    year: 2026,
    programme: 'BCom',
    fundingSource: 'GOV',
    fundingLabel: 'Government',
    fundingStatus: 'Approved',
    missedInstalments: 2,
    lastPaymentDate: '2026-03-01',
    arrangementStatus: null,
    ageing: { current: 0, d30: 100, d60: 200, d90: 0, d120: 0 },
    balance: 300,
    debt: 300,
    credit: 0,
    owedToStudent: false,
    pickedUp: true,
    riskScore: 71,
    riskBand: 'High',
    assignedOfficer: 'nomsa-mahlangu',
    signals: [{ text: 'Missed 2 instalments', hot: true }],
    recommendation: {
      type: 'arrangement',
      action: 'Payment arrangement',
      status: 'Needs approval',
      rationale: 'Missed two or more.',
      agent: 'Intervention Planner',
      policyClause: 'FIN-04.2',
      terms: [{ key: 'Instalments', value: '3' }],
    },
    lastDecision: null,
    ...overrides,
  };
}

describe('DebtorApi — Tracker and Case Management client (issue #65)', () => {
  let api: DebtorApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(DebtorApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GETs /api/debtors with scope, year and portfolio, and omits funding when it is "all"', () => {
    api.list('picked', 2026, 'all').subscribe();
    const req = http.expectOne((r) => r.url === `${API_BASE}/api/debtors`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('scope')).toBe('picked');
    expect(req.request.params.get('year')).toBe('2026');
    expect(req.request.params.get('portfolio')).toBe('own');
    expect(req.request.params.has('funding')).toBeFalse();
    req.flush([]);
  });

  it('sends the funding filter and the requested portfolio when given', () => {
    api.list('cases', 'all', 'gov', 'team').subscribe();
    const req = http.expectOne((r) => r.url === `${API_BASE}/api/debtors`);
    expect(req.request.params.get('funding')).toBe('gov');
    expect(req.request.params.get('year')).toBe('all');
    expect(req.request.params.get('portfolio')).toBe('team');
    req.flush([]);
  });

  it('maps rows into the view models the pages render', () => {
    let result: ReturnType<typeof toCaseView>[] = [];
    api.list('picked', 2026, 'all').subscribe((r) => (result = r));
    http.expectOne((r) => r.url === `${API_BASE}/api/debtors`).flush([row()]);
    expect(result.length).toBe(1);
    expect(result[0].d.id).toBe('STU-100234-2026');
    expect(result[0].d.funding).toBe('gov');
    expect(result[0].score).toBe(71);
    expect(result[0].signals).toEqual([{ t: 'Missed 2 instalments', hot: true }]);
    expect(result[0].rec.terms).toEqual([{ k: 'Instalments', v: '3' }]);
    expect(result[0].decision).toBeNull();
  });

  it('maps an unassigned case (null assignedOfficer) to an empty owner', () => {
    expect(toCaseView(row({ assignedOfficer: null })).d.assignedOfficer).toBe('');
  });

  it('GETs a case detail with the key URL-encoded and maps evidence and activity', () => {
    let view: ReturnType<typeof toCaseView> | undefined;
    api.detail('STU 1/2026').subscribe((v) => (view = v));
    const req = http.expectOne(`${API_BASE}/api/debtors/STU%201%2F2026`);
    expect(req.request.method).toBe('GET');
    const body: CaseDetailDto = {
      debtor: row(),
      evidence: ['Ageing: 60 days'],
      activity: [{ text: 'Risk scored', source: 'Risk Sentinel', createdAt: null }],
      lastDecision: null,
    };
    req.flush(body);
    expect(view?.evidence).toEqual(['Ageing: 60 days']);
    expect(view?.activity).toEqual([{ t: 'Risk scored', m: 'Risk Sentinel' }]);
  });

  it('propagates HTTP errors so the store can read the status (403 other team, 404 unknown)', () => {
    let status = 0;
    api.detail('STU-100301-2026').subscribe({ error: (e) => (status = e.status) });
    http.expectOne(`${API_BASE}/api/debtors/STU-100301-2026`).flush('no', { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
  });
});

describe('debtor-api mapping helpers', () => {
  it('parses amended terms from the JSON array the decision endpoint writes', () => {
    expect(parseAmendedTerms('[{"key":"Instalments","value":"6"}]')).toEqual([{ k: 'Instalments', v: '6' }]);
  });

  it('keeps unparseable amended terms as a single "Amended" term instead of dropping them', () => {
    expect(parseAmendedTerms('six instalments')).toEqual([{ k: 'Amended', v: 'six instalments' }]);
  });

  it('returns undefined when there are no amended terms', () => {
    expect(parseAmendedTerms(null)).toBeUndefined();
  });

  it('maps a last decision, and ignores one with an unknown action', () => {
    const dto = { action: 'APPROVE', amendedTerms: null, reason: null, decidedBy: 'nomsa-mahlangu', decidedAt: '2026-10-01T08:00:00Z' };
    expect(toDecision(dto, 'arrangement')?.action).toBe('Approved');
    expect(toDecision({ ...dto, action: 'DECLINE', reason: 'Not eligible' }, 'arrangement')?.reason).toBe('Not eligible');
    expect(toDecision({ ...dto, action: 'SHRUG' }, 'arrangement')).toBeNull();
    expect(toDecision(null, 'arrangement')).toBeNull();
  });
});
