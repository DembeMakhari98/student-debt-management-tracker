import { TestBed } from '@angular/core/testing';
import { DebtService } from './debt.service';

describe('DebtService — engagement log (issue #14)', () => {
  let service: DebtService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DebtService);
  });

  function firstDebtorId(): string {
    const rows = service.caseRows();
    expect(rows.length).toBeGreaterThan(0);
    return rows[0].id;
  }

  it('appends a logged engagement action to that debtor\'s case activity', () => {
    const id = firstDebtorId();
    const before = service.caseOf(service.caseRows()[0]).activity.length;

    service.logEngagementAction(id, { t: 'SMS sent to student', m: 'Engagement Agent · Officer action' });

    const after = service.caseOf(service.caseRows()[0]).activity;
    expect(after.length).toBe(before + 1);
    expect(after[after.length - 1]).toEqual({ t: 'SMS sent to student', m: 'Engagement Agent · Officer action' });
  });

  it('preserves append order across multiple engagement actions (append-only)', () => {
    const id = firstDebtorId();

    service.logEngagementAction(id, { t: 'SMS sent to student', m: 'Engagement Agent · Officer action' });
    service.logEngagementAction(id, { t: 'Call logged with student', m: 'Engagement Agent · Officer action' });

    const activity = service.caseOf(service.caseRows()[0]).activity;
    const tail = activity.slice(-2).map((e) => e.t);
    expect(tail).toEqual(['SMS sent to student', 'Call logged with student']);
  });

  it('does not leak engagement entries between different debtors', () => {
    const rows = service.caseRows();
    expect(rows.length).toBeGreaterThan(1);
    const [a, b] = rows;

    service.logEngagementAction(a.id, { t: 'SMS sent to student', m: 'Engagement Agent · Officer action' });

    const bActivity = service.caseOf(b).activity;
    expect(bActivity.some((e) => e.t === 'SMS sent to student')).toBeFalse();
  });
});

describe('DebtService — CSV export (issue #17)', () => {
  let service: DebtService;

  const HEADER = [
    'Student ID', 'Name', 'Programme', 'Funding', 'Funding status', 'Year', 'Missed instalments', 'Last payment',
    'Current', '30 days', '60 days', '90 days', '120+ days', 'Balance', 'Risk score', 'Band', 'Picked up by agent',
    'AI recommendation', 'Status', 'Policy',
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DebtService);
  });

  /** Runs exportCsv() without triggering a real download; returns the generated anchor and CSV text. */
  async function captureExport(): Promise<{ anchor: HTMLAnchorElement; text: string }> {
    const realCreateElement = document.createElement.bind(document);
    let anchor!: HTMLAnchorElement;
    spyOn(document, 'createElement').and.callFake((tag: string) => {
      const el = realCreateElement(tag);
      if (tag === 'a') {
        anchor = el as HTMLAnchorElement;
        spyOn(anchor, 'click');
      }
      return el;
    });

    let blob!: Blob;
    spyOn(URL, 'createObjectURL').and.callFake((b: Blob) => {
      blob = b;
      return 'blob:mock-url';
    });
    spyOn(URL, 'revokeObjectURL');

    service.exportCsv();

    return { anchor, text: await blob.text() };
  }

  it('builds a header row matching the 20-column order exactly', async () => {
    const { text } = await captureExport();
    expect(text.split('\n')[0].split(',')).toEqual(HEADER);
  });

  it('exports the signed balance so credit rows are negative', async () => {
    service.setYear('all');
    service.setFunding('all');
    const credit = service.rows().find((d) => service.owedToStudent(d));
    expect(credit).toBeTruthy();

    const { text } = await captureExport();
    const line = text.split('\n').find((l) => l.startsWith(credit!.id + ','))!;
    const balanceIdx = HEADER.indexOf('Balance');
    expect(Number(line.split(',')[balanceIdx])).toBe(service.rowTotal(credit!));
    expect(Number(line.split(',')[balanceIdx])).toBeLessThan(0);
  });

  it('shows the literal "Credit" band for debtors in credit, not their score band', async () => {
    service.setYear('all');
    service.setFunding('all');
    const credit = service.rows().find((d) => service.owedToStudent(d));
    expect(credit).toBeTruthy();

    const { text } = await captureExport();
    const line = text.split('\n').find((l) => l.startsWith(credit!.id + ','))!;
    const bandIdx = HEADER.indexOf('Band');
    expect(line.split(',')[bandIdx]).toBe('Credit');
  });

  it('respects the currently selected year and funding filters', async () => {
    service.setYear('all');
    service.setFunding('all');
    const allIds = service.rows().map((d) => d.id);
    expect(allIds.length).toBeGreaterThan(0);

    const target = service.rows()[0];
    service.setYear(target.year);
    service.setFunding(target.funding);
    const filteredIds = service.rows().map((d) => d.id);
    expect(filteredIds.length).toBeLessThanOrEqual(allIds.length);

    const { text } = await captureExport();
    const bodyIds = text
      .split('\n')
      .slice(1)
      .filter((l) => l.length > 0)
      .map((l) => l.split(',')[0]);
    expect(bodyIds).toEqual(filteredIds);
  });

  it('names the file with the current year and funding filter', async () => {
    service.setYear(2024);
    service.setFunding('gov');

    const { anchor } = await captureExport();
    expect(anchor.download).toBe('student-debt-tracker-2024-gov.csv');
  });
});
