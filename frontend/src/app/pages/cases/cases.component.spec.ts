import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { CasesComponent } from './cases.component';
import { DebtService } from '../../core/debt.service';
import { FUND, POLICY } from '../../core/constants';

describe('CasesComponent — case list & case detail (issue #12)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CasesComponent>>;
  let component: CasesComponent;
  let debt: DebtService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CasesComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    });

    fixture = TestBed.createComponent(CasesComponent);
    component = fixture.componentInstance;
    debt = TestBed.inject(DebtService);
    fixture.detectChanges();
    expect(component.selected()).withContext('a default case must be selected for these tests').toBeTruthy();
  });

  it('AC1 — the case list holds every picked-up and credit case for the current filter scope', () => {
    const wantedIds = debt.caseRows().map((d) => d.id);
    expect(component.list().map((c) => c.d.id)).toEqual(wantedIds);

    const renderedIds = Array.from(fixture.nativeElement.querySelectorAll('.case-item .tag'))
      .map((el) => (el as HTMLElement).textContent?.trim())
      .filter((t) => wantedIds.includes(t ?? ''));
    expect(renderedIds.length).toBe(wantedIds.length);
  });

  it('AC2 — the first case in the list defaults as selected', () => {
    expect(component.selected()!.d.id).toBe(component.list()[0].d.id);
  });

  it('AC2 — clicking a case in the list selects it and updates the detail pane', () => {
    const other = component.list().find((c) => c.d.id !== component.selected()!.d.id);
    expect(other).withContext('fixture data must contain at least two cases').toBeTruthy();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.case-item')) as HTMLButtonElement[];
    const target = buttons.find((b) => b.textContent?.includes(other!.d.id));
    expect(target).withContext(`a case-item button for ${other!.d.id} must be rendered`).toBeTruthy();

    target!.click();
    fixture.detectChanges();

    expect(component.selected()!.d.id).toBe(other!.d.id);
    expect(fixture.nativeElement.textContent).toContain(other!.d.name);
  });

  it('AC2 — deep-linking via ?case=<id> pre-selects that case', () => {
    const target = component.list()[component.list().length - 1];

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CasesComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({ case: target.d.id })) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    });
    const deepLinkedFixture = TestBed.createComponent(CasesComponent);
    deepLinkedFixture.detectChanges();

    expect(deepLinkedFixture.componentInstance.selected()!.d.id).toBe(target.d.id);
  });

  it('AC3 — the case header shows the score/band, name, ID + programme, funding pill, amount and policy clause', () => {
    const sel = component.selected()!;
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain(sel.d.name);
    expect(text).toContain(`${sel.d.id} · ${sel.d.prog}`);
    expect(text).toContain(FUND[sel.d.funding].label);
    expect(text).toContain(POLICY[sel.rec.type]);
    if (!component.isCredit(sel)) {
      expect(text).toContain(String(sel.score));
    }
    sel.signals.forEach((s) => expect(text).toContain(s.t));
  });

  it('AC5 — the ageing position bars are scaled to the largest bucket on the case, and the total is shown', () => {
    const buckets = component.buckets();
    expect(buckets.length).toBeGreaterThan(0);

    const positiveBuckets = buckets.filter((b) => b.amt > 0);
    if (positiveBuckets.length) {
      expect(Math.max(...buckets.map((b) => b.pct))).toBe(100);
      buckets.forEach((b) => expect(b.pct).toBeLessThanOrEqual(100));
    }

    const sel = component.selected()!;
    expect(fixture.nativeElement.textContent).toContain(component.R(sel.debt || sel.credit));
  });

  it('AC6 — the activity log renders every entry with its text and source, newest-first per Section 4.6', () => {
    const sel = component.selected()!;
    expect(sel.activity.length).toBeGreaterThan(0);
    expect(sel.activity[0].t).toContain('Risk scored');
    expect(sel.activity[0].m).toContain('Risk Sentinel');

    const text = fixture.nativeElement.textContent as string;
    sel.activity.forEach((a) => {
      expect(text).toContain(a.t);
      expect(text).toContain(a.m);
    });
  });
});

describe('CasesComponent — engagement channels panel (issue #14)', () => {
  let component: CasesComponent;
  let debt: DebtService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CasesComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    });

    const fixture = TestBed.createComponent(CasesComponent);
    component = fixture.componentInstance;
    debt = TestBed.inject(DebtService);
    fixture.detectChanges();

    expect(component.selected()).withContext('a default case must be selected for these tests').toBeTruthy();
    spyOn(debt, 'logEngagementAction');
  });

  it('sendSms() logs an SMS entry against the selected case', () => {
    const id = component.selected()!.d.id;
    component.sendSms();
    expect(debt.logEngagementAction).toHaveBeenCalledWith(id, jasmine.objectContaining({ t: 'SMS sent to student' }));
  });

  it('sendWhatsApp() logs a WhatsApp entry against the selected case', () => {
    const id = component.selected()!.d.id;
    component.sendWhatsApp();
    expect(debt.logEngagementAction).toHaveBeenCalledWith(
      id,
      jasmine.objectContaining({ t: 'WhatsApp message sent to student' }),
    );
  });

  it('logCall() logs a call entry against the selected case', () => {
    const id = component.selected()!.d.id;
    component.logCall();
    expect(debt.logEngagementAction).toHaveBeenCalledWith(id, jasmine.objectContaining({ t: 'Call logged with student' }));
  });

  it('handToAdaptConnect() is a no-op (button ships disabled pending the hand-off interface)', () => {
    component.handToAdaptConnect();
    expect(debt.logEngagementAction).not.toHaveBeenCalled();
  });
});

describe('CasesComponent — engagement panel, real click → service → template (issue #14)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CasesComponent>>;
  let component: CasesComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CasesComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    });

    fixture = TestBed.createComponent(CasesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.selected()).withContext('a default case must be selected for these tests').toBeTruthy();
  });

  function findButton(text: string): HTMLButtonElement {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const btn = buttons.find((b) => b.textContent?.trim() === text);
    if (!btn) throw new Error(`button not found: "${text}"`);
    return btn;
  }

  it('clicking Send SMS through the real template updates the "Agent activity" panel', () => {
    findButton('Send SMS').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('SMS sent to student');
  });

  it('clicking the same engagement button twice renders both entries without throwing (regression: NG0955 duplicate track keys)', () => {
    const btn = findButton('Send SMS');
    expect(() => {
      btn.click();
      fixture.detectChanges();
      btn.click();
      fixture.detectChanges();
    }).not.toThrow();

    const matches = (fixture.nativeElement.textContent as string).match(/SMS sent to student/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it('Hand to Adapt Connect renders disabled and adds no activity entry when clicked', () => {
    const btn = findButton('Hand to Adapt Connect');
    expect(btn.disabled).toBeTrue();

    const before = component.selected()!.activity.length;
    btn.click();
    fixture.detectChanges();
    expect(component.selected()!.activity.length).toBe(before);
  });
});

describe('CasesComponent — approve/amend/decline (issue #13)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CasesComponent>>;
  let component: CasesComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CasesComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    });

    fixture = TestBed.createComponent(CasesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.selected()).withContext('a default case must be selected for these tests').toBeTruthy();
  });

  function findButton(text: string): HTMLButtonElement {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const btn = buttons.find((b) => b.textContent?.trim() === text);
    if (!btn) throw new Error(`button not found: "${text}"`);
    return btn;
  }

  it('approve() records the decision and hides the decision buttons', () => {
    component.approve();
    fixture.detectChanges();

    expect(component.selected()!.decision?.action).toBe('Approved');
    expect(fixture.nativeElement.textContent).toContain('Approved by Nomsa Mahlangu');
    expect(() => findButton('Approve')).toThrowError();
  });

  it('clicking Approve through the real template resolves the case and clears its "needs approval" badge', () => {
    // Force a case that actually needs approval so the badge assertion is meaningful.
    const needsApproval = component.list().find((c) => component.debt.needsApproval(c));
    expect(needsApproval).withContext('fixture data must contain at least one Needs approval case').toBeTruthy();
    component.selectCase(needsApproval!.d.id);
    fixture.detectChanges();

    const before = component.needingApproval();
    findButton('Approve').click();
    fixture.detectChanges();

    expect(component.needingApproval()).toBe(before - 1);
  });

  it('openAmend() seeds the draft from the current terms, and saveAmend() records the edited terms', () => {
    const originalTerms = component.selected()!.rec.terms;
    component.openAmend();
    expect(component.amendDraft()).toEqual(originalTerms);

    component.updateAmendTerm(0, 'Edited value');
    component.saveAmend();
    fixture.detectChanges();

    const decision = component.selected()!.decision;
    expect(decision?.action).toBe('Amended');
    expect(decision?.amendedTerms?.[0].v).toBe('Edited value');
    expect(component.panel()).toBe('none');
  });

  it('amend terms through the real template updates an input and the resolved panel reflects it', () => {
    findButton('Amend terms').click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input).withContext('amend panel must render an input per term').toBeTruthy();
    input.value = 'R 999';
    input.dispatchEvent(new Event('input'));
    findButton('Save & approve').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('R 999');
    expect(fixture.nativeElement.textContent).toContain('Amended terms');
  });

  it('confirmDecline() is a no-op without a reason, and records the decision once one is set', () => {
    component.openDecline();
    component.confirmDecline();
    expect(component.selected()!.decision).toBeNull();

    component.updateDeclineReason('  ');
    component.confirmDecline();
    expect(component.selected()!.decision).toBeNull();

    component.updateDeclineReason('Already resolved via a verbal arrangement');
    component.confirmDecline();
    expect(component.selected()!.decision?.action).toBe('Declined');
    expect(component.selected()!.decision?.reason).toBe('Already resolved via a verbal arrangement');
  });

  it('decline through the real template disables Confirm until a reason is typed', () => {
    findButton('Decline').click();
    fixture.detectChanges();

    const confirmBtn = findButton('Confirm decline');
    expect(confirmBtn.disabled).toBeTrue();

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Reason entered by the officer';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirmBtn.disabled).toBeFalse();

    confirmBtn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reason entered by the officer');
  });

  it('switching case closes any open amend/decline panel', () => {
    component.openDecline();
    expect(component.panel()).toBe('decline');

    const other = component.list().find((c) => c.d.id !== component.selected()!.d.id);
    expect(other).withContext('fixture data must contain at least two cases').toBeTruthy();
    component.selectCase(other!.d.id);

    expect(component.panel()).toBe('none');
  });
});
