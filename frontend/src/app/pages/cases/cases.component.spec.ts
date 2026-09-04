import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { CasesComponent } from './cases.component';
import { DebtService } from '../../core/debt.service';

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
