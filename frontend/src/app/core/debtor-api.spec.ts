import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE } from './api';
import { AGENTS, POLICY } from './constants';
import { DebtService } from './debt.service';
import { RiskBand } from './models';
import {
  CaseDetailDto,
  DebtorApi,
  DebtorRowDto,
  RECOMMENDATION_LABELS,
  encodeAmendedTerms,
  parseAmendedTerms,
  recommendationLabel,
  toCaseView,
  toDecision,
} from './debtor-api';

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
    riskBand: 'HIGH',
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

  describe('decide() — POST /api/debtors/{key}/decision (issue #66)', () => {
    const detailBody = (decision: CaseDetailDto['lastDecision']): CaseDetailDto => ({
      debtor: row({ lastDecision: decision }),
      evidence: [],
      activity: [{ text: 'Recommendation approved by Nomsa Mahlangu', source: 'Officer decision · Nomsa Mahlangu', createdAt: null }],
      lastDecision: decision,
    });

    it('POSTs APPROVE with only the action', () => {
      api.decide('STU-100234-2026', { action: 'APPROVE' }).subscribe();
      const req = http.expectOne(`${API_BASE}/api/debtors/STU-100234-2026/decision`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ action: 'APPROVE' });
      req.flush(detailBody(null));
    });

    it('POSTs AMEND with the terms as a JSON string, and DECLINE with the reason', () => {
      api.decide('STU-1', { action: 'AMEND', amendedTerms: encodeAmendedTerms([{ k: 'Instalments', v: '6' }]) }).subscribe();
      const amend = http.expectOne(`${API_BASE}/api/debtors/STU-1/decision`);
      expect(amend.request.body.action).toBe('AMEND');
      expect(typeof amend.request.body.amendedTerms).toBe('string');
      amend.flush(detailBody(null));

      api.decide('STU-2', { action: 'DECLINE', reason: 'Verbal arrangement' }).subscribe();
      const decline = http.expectOne(`${API_BASE}/api/debtors/STU-2/decision`);
      expect(decline.request.body).toEqual({ action: 'DECLINE', reason: 'Verbal arrangement' });
      decline.flush(detailBody(null));
    });

    it('URL-encodes the debtor key', () => {
      api.decide('STU 1/2026', { action: 'APPROVE' }).subscribe();
      http.expectOne(`${API_BASE}/api/debtors/STU%201%2F2026/decision`).flush(detailBody(null));
    });

    it('maps the response into the refreshed case, including the saved decision', () => {
      let view: ReturnType<typeof toCaseView> | undefined;
      api.decide('STU-100234-2026', { action: 'APPROVE' }).subscribe((v) => (view = v));
      http.expectOne(`${API_BASE}/api/debtors/STU-100234-2026/decision`).flush(
        detailBody({ action: 'APPROVE', amendedTerms: null, reason: null, decidedBy: 'Nomsa Mahlangu', decidedAt: '2026-10-01T08:00:00Z' }),
      );
      expect(view?.decision?.action).toBe('Approved');
      expect(view?.decision?.decidedBy).toBe('Nomsa Mahlangu');
      expect(view?.activity[0].t).toContain('approved by');
    });

    it('propagates the HTTP status so the store can explain it', () => {
      let status = -1;
      api.decide('STU-100301-2026', { action: 'APPROVE' }).subscribe({ error: (e) => (status = e.status) });
      http.expectOne(`${API_BASE}/api/debtors/STU-100301-2026/decision`).flush('no', { status: 403, statusText: 'Forbidden' });
      expect(status).toBe(403);
    });
  });

  describe('engage() — POST /api/debtors/{key}/engagements (issue #59, #269)', () => {
    it('POSTs the channel and maps the response into activity entries', () => {
      let activity: { t: string; m: string }[] = [];
      api.engage('STU-100234-2026', { channel: 'SMS' }).subscribe((a) => (activity = a));
      const req = http.expectOne(`${API_BASE}/api/debtors/STU-100234-2026/engagements`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ channel: 'SMS' });
      req.flush([{ text: 'SMS sent to student', source: 'Engagement Agent · Nomsa Mahlangu', createdAt: null }]);
      expect(activity).toEqual([{ t: 'SMS sent to student', m: 'Engagement Agent · Nomsa Mahlangu' }]);
    });

    it('sends an optional note and URL-encodes the debtor key', () => {
      api.engage('STU 1/2026', { channel: 'CALL', note: 'Promised to pay Friday' }).subscribe();
      const req = http.expectOne(`${API_BASE}/api/debtors/STU%201%2F2026/engagements`);
      expect(req.request.body).toEqual({ channel: 'CALL', note: 'Promised to pay Friday' });
      req.flush([]);
    });

    it('propagates a 409 when the hand-over is not yet eligible', () => {
      let status = -1;
      api.engage('STU-100301-2026', { channel: 'HANDOVER' }).subscribe({ error: (e) => (status = e.status) });
      http.expectOne(`${API_BASE}/api/debtors/STU-100301-2026/engagements`).flush('no', { status: 409, statusText: 'Conflict' });
      expect(status).toBe(409);
    });
  });

  it('propagates HTTP errors so the store can read the status (403 other team, 404 unknown)', () => {
    let status = 0;
    api.detail('STU-100301-2026').subscribe({ error: (e) => (status = e.status) });
    http.expectOne(`${API_BASE}/api/debtors/STU-100301-2026`).flush('no', { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
  });
});

describe('debtor-api mapping helpers', () => {
  it('encodeAmendedTerms writes the {key, value} JSON array that parseAmendedTerms reads back', () => {
    const terms = [{ k: 'Instalments', v: '6 × R 1,200' }, { k: 'Start', v: '2026-11-01' }];
    expect(JSON.parse(encodeAmendedTerms(terms))).toEqual([
      { key: 'Instalments', value: '6 × R 1,200' },
      { key: 'Start', value: '2026-11-01' },
    ]);
    expect(parseAmendedTerms(encodeAmendedTerms(terms))).toEqual(terms);
  });

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

describe('recommendation type mapping (issue #277)', () => {
  /**
   * The backend's `RecommendationType` enum (RecommendationType.java): the name it sends as
   * `recommendation.type`, with the owning agent and policy clause it sends alongside. Spelled out
   * here so the app's own tables are checked against the real contract, not against themselves.
   */
  const BACKEND_TYPES: [name: string, label: string, agent: string, clause: string][] = [
    ['REFUND', 'Refund', 'Assurance Agent', 'FIN-02.6'],
    ['REGISTRATION_HOLD', 'Registration hold', 'Assurance Agent', 'FIN-09.3'],
    ['HARDSHIP_FUND', 'Hardship fund', 'Funding Broker', 'FIN-07.1'],
    ['PAYMENT_ARRANGEMENT', 'Payment arrangement', 'Intervention Planner', 'FIN-04.2'],
    ['FUNDING_CHASE', 'Funding chase', 'Funding Broker', 'FIN-05.4'],
    ['REMINDER_CADENCE', 'Reminder cadence', 'Engagement Agent', 'FIN-03.1'],
    ['MONITOR', 'Monitor', 'Risk Sentinel', 'FIN-01.0'],
  ];

  const rowOfType = (name: string, agent: string, clause: string) => {
    const base = row();
    return row({ recommendation: { ...base.recommendation, type: name, agent, policyClause: clause } });
  };

  for (const [name, label, agent, clause] of BACKEND_TYPES) {
    it(`${name} becomes "${label}", whose agent and policy clause are ${agent} and ${clause}`, () => {
      const view = toCaseView(rowOfType(name, agent, clause));

      expect(view.rec.type).toBe(label);
      expect(AGENTS[view.rec.type]).withContext('agent looked up by the mapped type').toBe(agent);
      expect(POLICY[view.rec.type]).withContext('policy clause looked up by the mapped type').toBe(clause);
    });
  }

  it('covers every recommendation the agent and policy tables know about, and nothing else', () => {
    expect(Object.values(RECOMMENDATION_LABELS).sort()).toEqual(Object.keys(AGENTS).sort());
    expect(Object.values(RECOMMENDATION_LABELS).sort()).toEqual(Object.keys(POLICY).sort());
    expect(Object.keys(RECOMMENDATION_LABELS).sort()).toEqual(BACKEND_TYPES.map(([name]) => name).sort());
  });

  it('shows no raw enum name for any type', () => {
    for (const [name, , agent, clause] of BACKEND_TYPES) {
      expect(toCaseView(rowOfType(name, agent, clause)).rec.type).not.toBe(name);
    }
  });

  it('passes a type it does not know through unchanged', () => {
    expect(recommendationLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
    expect(toCaseView(rowOfType('SOMETHING_NEW', 'X', 'Y')).rec.type).toBe('SOMETHING_NEW');
  });

  it('maps the risk band enum name to the display name bandColor compares against, so High is red and Elevated is honey', () => {
    // RiskBand.java sends WATCH / ELEVATED / HIGH; CREDIT is sent for a student owed money.
    const bands: [string, string][] = [['WATCH', 'Watch'], ['ELEVATED', 'Elevated'], ['HIGH', 'High']];
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const debt = TestBed.inject(DebtService);
    for (const [name, label] of bands) {
      expect(toCaseView(row({ riskBand: name })).band).toBe(label as RiskBand);
    }
    expect(debt.bandColor(toCaseView(row({ riskBand: 'HIGH' })).band)).not.toBe(debt.bandColor('Watch'));
    expect(debt.bandColor(toCaseView(row({ riskBand: 'ELEVATED' })).band)).not.toBe(debt.bandColor('Watch'));
    expect(toCaseView(row({ riskBand: 'CREDIT' })).band as string).toBe('CREDIT');
  });

  it('records a saved decision against the same mapped type as the row, so the case is not reopened', () => {
    const decided = row({
      recommendation: { ...row().recommendation, type: 'REFUND', agent: 'Assurance Agent', policyClause: 'FIN-02.6' },
      lastDecision: { action: 'APPROVE', amendedTerms: null, reason: null, decidedBy: 'Nomsa Mahlangu', decidedAt: '2026-10-01T08:00:00Z' },
    });

    const view = toCaseView(decided);

    expect(view.decision?.recommendationType).toBe('Refund');
    expect(view.decision?.recommendationType).toBe(view.rec.type);
  });
});
