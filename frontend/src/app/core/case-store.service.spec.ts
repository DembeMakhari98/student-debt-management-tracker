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

  it('empties everything when the user signs out', () => {
    (TestBed.inject(AuthService).token as WritableSignal<string | null>).set(null);
    settle();
    expect(store.state()).toBe('idle');
    expect(store.picked()).toEqual([]);
    expect(store.cases()).toEqual([]);
    expect(store.detail()).toBeNull();
  });
});
