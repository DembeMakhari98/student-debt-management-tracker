import { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth/auth.service';
import { CaseStore } from './case-store.service';
import { DebtService } from './debt.service';
import { mockApi, mockApiProviders, resetMockApi } from '../testing/mock-api';

describe('CaseStore — Tracker and Case Management data from the API (issue #65)', () => {
  let store: CaseStore;
  let debt: DebtService;

  /** Lets the store's reload effect run. */
  const settle = () => TestBed.flushEffects();

  const paramsOf = (query: string) => new URLSearchParams(query);

  beforeEach(() => {
    resetMockApi();
    TestBed.configureTestingModule({ providers: mockApiProviders() });
    debt = TestBed.inject(DebtService);
    store = TestBed.inject(CaseStore);
    settle();
  });

  it('loads picked, refunds and paying from GET /api/debtors, one call per scope', () => {
    const scopes = mockApi.listCalls.map((q) => paramsOf(q).get('scope')).sort();
    expect(scopes).toEqual(['paying', 'picked', 'refunds']);
    expect(store.state()).toBe('ready');
    expect(store.picked().length).toBeGreaterThan(0);
  });

  it('asks for the narrowest portfolio (own) by default and sends year and funding', () => {
    for (const q of mockApi.listCalls) {
      const p = paramsOf(q);
      expect(p.get('portfolio')).toBe('own');
      expect(p.get('year')).toBe(String(debt.year()));
      expect(p.has('funding')).toBeFalse();
    }
  });

  it('exposes cases as picked-up followed by refunds', () => {
    expect(store.cases().map((c) => c.d.id)).toEqual([...store.picked(), ...store.refunds()].map((c) => c.d.id));
  });

  it('reloads with the new filters when the year, funding or portfolio changes', () => {
    mockApi.listCalls = [];
    debt.setFunding('gov');
    settle();
    expect(mockApi.listCalls.length).toBe(3);
    expect(mockApi.listCalls.every((q) => paramsOf(q).get('funding') === 'gov')).toBeTrue();

    mockApi.listCalls = [];
    debt.setYear('all');
    settle();
    expect(mockApi.listCalls.every((q) => paramsOf(q).get('year') === 'all')).toBeTrue();

    mockApi.listCalls = [];
    debt.setPortfolioScope('team');
    settle();
    expect(mockApi.listCalls.every((q) => paramsOf(q).get('portfolio') === 'team')).toBeTrue();
  });

  it('records the HTTP status of a failed list load and explains a 403', () => {
    mockApi.failList = true;
    mockApi.listStatus = 403;
    store.reload();
    expect(store.state()).toBe('error');
    expect(store.listErrorStatus()).toBe(403);
    expect(store.listErrorMessage()).toContain("don't have access");
  });

  it('explains a 400 (invalid filter) differently from a 403', () => {
    mockApi.failList = true;
    mockApi.listStatus = 400;
    store.reload();
    expect(store.listErrorStatus()).toBe(400);
    expect(store.listErrorMessage()).toContain('rejected the current filters');
  });

  it('falls back to the connection message when the server sends no status', () => {
    mockApi.failList = true;
    mockApi.listStatus = 0;
    store.reload();
    expect(store.state()).toBe('error');
    expect(store.listErrorMessage()).toContain("didn't respond");
  });

  it('clears the error once a retry succeeds', () => {
    mockApi.failList = true;
    mockApi.listStatus = 403;
    store.reload();
    expect(store.state()).toBe('error');

    mockApi.failList = false;
    store.reload();
    expect(store.state()).toBe('ready');
    expect(store.listErrorStatus()).toBeNull();
  });

  it('loads a case detail with evidence and activity', () => {
    const key = store.picked()[0].d.id;
    store.loadDetail(key);
    expect(store.detailState()).toBe('ready');
    expect(store.detail()?.d.id).toBe(key);
    expect(store.detail()?.evidence.length).toBeGreaterThan(0);
    expect(mockApi.detailCalls).toContain(key);
  });

  it('reports 403 (another team) and 404 (no such case) on a failed detail load', () => {
    mockApi.failDetail = true;
    mockApi.detailStatus = 403;
    store.loadDetail('STU-100301-2026');
    expect(store.detailState()).toBe('error');
    expect(store.detailErrorStatus()).toBe(403);

    mockApi.failDetail = false;
    store.loadDetail('STU-000000-2026');
    expect(store.detailErrorStatus()).toBe(404);
  });

  it('clears the detail when no case is open', () => {
    store.loadDetail(store.picked()[0].d.id);
    store.loadDetail(null);
    expect(store.detail()).toBeNull();
    expect(store.detailState()).toBe('idle');
  });

  describe('decide() — saving an officer decision (issue #66)', () => {
    const run = (key: string, request: Parameters<CaseStore['decide']>[1]) => {
      let saved: boolean | undefined;
      store.decide(key, request).subscribe((v) => (saved = v));
      return saved;
    };

    it('POSTs the decision, emits true, and returns to idle', () => {
      const key = store.picked()[0].d.id;
      expect(run(key, { action: 'APPROVE' })).toBeTrue();
      expect(mockApi.decisionCalls).toEqual([{ key, body: { action: 'APPROVE' } }]);
      expect(store.decisionState()).toBe('idle');
    });

    it('refreshes the open detail and the list row from the response', () => {
      const key = store.picked()[0].d.id;
      store.loadDetail(key);
      expect(store.detail()?.decision).toBeNull();

      run(key, { action: 'DECLINE', reason: 'Verbal arrangement' });

      expect(store.detail()?.decision?.action).toBe('Declined');
      expect(store.detail()?.decision?.reason).toBe('Verbal arrangement');
      expect(store.picked().find((c) => c.d.id === key)!.decision?.action).toBe('Declined');
    });

    it('keeps the list order when a row is refreshed', () => {
      const before = store.picked().map((c) => c.d.id);
      run(before[1], { action: 'APPROVE' });
      expect(store.picked().map((c) => c.d.id)).toEqual(before);
    });

    it('also refreshes a case that sits in the refund list', () => {
      const key = store.refunds()[0].d.id;
      run(key, { action: 'APPROVE' });
      expect(store.refunds().find((c) => c.d.id === key)!.decision?.action).toBe('Approved');
    });

    it('tells DebtService about the saved decision so the autonomous run leaves the case alone', () => {
      const spy = spyOn(debt, 'recordServerDecision').and.callThrough();
      const key = store.picked()[0].d.id;
      run(key, { action: 'APPROVE' });
      expect(spy).toHaveBeenCalledWith(key, jasmine.objectContaining({ action: 'Approved' }));
    });

    it('keeps the decision after the lists are reloaded', () => {
      const key = store.picked()[0].d.id;
      run(key, { action: 'APPROVE' });
      store.reload();
      expect(store.picked().find((c) => c.d.id === key)!.decision?.action).toBe('Approved');
    });

    for (const [status, text] of [
      [403, 'belongs to another team'],
      [404, 'no longer exists'],
      [401, 'session has expired'],
      [400, 'rejected this decision'],
      [500, "Couldn't save the decision"],
      [0, "Couldn't save the decision"],
    ] as const) {
      it(`a ${status} leaves the case undecided and explains it`, () => {
        const key = store.picked()[0].d.id;
        mockApi.failDecision = true;
        mockApi.decisionStatus = status;

        expect(run(key, { action: 'APPROVE' })).toBeFalse();

        expect(store.decisionState()).toBe('error');
        expect(store.decisionErrorStatus()).toBe(status);
        expect(store.decisionErrorFor()).toBe(key);
        expect(store.decisionErrorMessage()).toContain(text);
        expect(store.picked().find((c) => c.d.id === key)!.decision).toBeNull();
      });
    }

    it('ignores a second decision while one is saving, and does not call the API', () => {
      store.decisionState.set('saving');
      expect(run(store.picked()[0].d.id, { action: 'APPROVE' })).toBeFalse();
      expect(mockApi.decisionCalls).toEqual([]);
    });

    it('clears an earlier failure when the next save starts and succeeds', () => {
      const key = store.picked()[0].d.id;
      mockApi.failDecision = true;
      run(key, { action: 'APPROVE' });
      expect(store.decisionState()).toBe('error');

      mockApi.failDecision = false;
      expect(run(key, { action: 'APPROVE' })).toBeTrue();
      expect(store.decisionState()).toBe('idle');
      expect(store.decisionErrorStatus()).toBeNull();
      expect(store.decisionErrorFor()).toBeNull();
    });

    it('resets the saving state when the user signs out', () => {
      mockApi.failDecision = true;
      run(store.picked()[0].d.id, { action: 'APPROVE' });
      (TestBed.inject(AuthService).token as WritableSignal<string | null>).set(null);
      settle();
      expect(store.decisionState()).toBe('idle');
      expect(store.decisionErrorFor()).toBeNull();
    });
  });

  it('empties everything when the user signs out', () => {
    (TestBed.inject(AuthService).token as WritableSignal<string | null>).set(null);
    settle();
    expect(store.state()).toBe('idle');
    expect(store.picked()).toEqual([]);
    expect(store.cases()).toEqual([]);
    expect(store.detail()).toBeNull();
  });
});
