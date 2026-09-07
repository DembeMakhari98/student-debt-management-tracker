import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TrackerComponent } from './tracker.component';
import { DebtService } from '../../core/debt.service';

describe('TrackerComponent — Debt Management Tracker workspace (issue #11)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TrackerComponent>>;
  let component: TrackerComponent;
  let debt: DebtService;
  let navigate: jasmine.Spy;

  beforeEach(() => {
    navigate = jasmine.createSpy('navigate');
    TestBed.configureTestingModule({
      imports: [TrackerComponent],
      providers: [{ provide: Router, useValue: { navigate } }],
    });

    fixture = TestBed.createComponent(TrackerComponent);
    component = fixture.componentInstance;
    debt = TestBed.inject(DebtService);
    fixture.detectChanges();
  });

  it('renders the picked-up list sorted by risk score descending', () => {
    const scores = component.pickedCases().map((c) => c.score);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
    // and the DOM actually renders one row per case
    const rendered = fixture.nativeElement.querySelectorAll('app-case-row');
    expect(rendered.length).toBe(component.pickedCases().length + component.refundCases().length);
  });

  it('renders the refund queue separately, largest-credit-first', () => {
    const credits = component.refundCases().map((c) => c.credit);
    const sorted = [...credits].sort((a, b) => b - a);
    expect(credits).toEqual(sorted);
  });

  it('reuses the debt summary KPI block from #10', () => {
    expect(fixture.nativeElement.querySelector('app-summary-cards')).toBeTruthy();
  });

  it('renders the "not picked up" table read-only with the required columns and no interactive controls', () => {
    expect(component.payingRows().length).withContext('mock data must contain at least one non-picked-up debtor for this test to be meaningful').toBeGreaterThan(0);
    const table: HTMLTableElement = fixture.nativeElement.querySelector('table');
    expect(table).toBeTruthy();
    const headers = Array.from(table.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Student', 'Funding', 'Funding status', 'Last payment', 'Current balance']);
    expect(table.querySelectorAll('button, a').length).toBe(0);
  });

  it('updates the rendered lists when the year filter changes', () => {
    const before = debt.rows().length;
    debt.setYear('all');
    fixture.detectChanges();
    expect(debt.rows().length).toBeGreaterThan(before);
    const rendered = fixture.nativeElement.querySelectorAll('app-case-row');
    expect(rendered.length).toBe(component.pickedCases().length + component.refundCases().length);
  });

  it('updates the rendered lists when the funding filter changes, to only that funding source', () => {
    debt.setFunding('gov');
    fixture.detectChanges();

    const all = [...component.pickedCases(), ...component.refundCases()].map((c) => c.d).concat(component.payingRows());
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((d) => d.funding === 'gov')).toBeTrue();
  });

  it('clicking a row navigates to Case Management with the correct case query param (issue #12)', () => {
    const all = [...component.pickedCases(), ...component.refundCases()];
    expect(all.length).toBeGreaterThan(0);
    const targetId = all[0].d.id;

    component.openCase(targetId);

    expect(navigate).toHaveBeenCalledWith(['/cases'], { queryParams: { case: targetId } });
    expect(debt.caseId()).toBe(targetId);
  });
});
