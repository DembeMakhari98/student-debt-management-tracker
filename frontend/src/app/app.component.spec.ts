import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { DebtService } from './core/debt.service';

describe('AppComponent — global chrome export button (issue #17)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AppComponent>>;
  let debt: DebtService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });

    fixture = TestBed.createComponent(AppComponent);
    debt = TestBed.inject(DebtService);
    fixture.detectChanges();
  });

  it('calls DebtService.exportCsv() when the Export CSV button is clicked', () => {
    spyOn(debt, 'exportCsv');

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const exportButton = buttons.find((b) => b.textContent?.trim() === 'Export CSV');
    expect(exportButton).toBeTruthy();

    exportButton!.click();

    expect(debt.exportCsv).toHaveBeenCalled();
  });
});
