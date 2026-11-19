import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';
import { CaseStore } from '../../core/case-store.service';
import { mockApiProviders, resetMockApi } from '../../testing/mock-api';

describe('HomeComponent — pick-up callout (TC-37 #256, FTC-95 #199)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HomeComponent>>;
  let store: CaseStore;

  beforeEach(() => {
    resetMockApi();
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), ...mockApiProviders()],
    });
    fixture = TestBed.createComponent(HomeComponent);
    store = TestBed.inject(CaseStore);
    TestBed.flushEffects();
    fixture.detectChanges();
  });

  function calloutText(): string {
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.c-title')) as HTMLElement[];
    return titles.map((t) => t.textContent ?? '').find((t) => t.includes('picked up')) ?? '';
  }

  it('counts the same scoped picked-up list as the Tracker tab badge', () => {
    expect(store.picked().length).toBeGreaterThan(0);
    expect(fixture.componentInstance.picked()).toBe(store.picked().length);
    expect(calloutText()).toContain(`The agent has picked up ${store.picked().length} student`);
  });

  it('follows the store when the scoped list changes, rather than counting the whole book', () => {
    store.picked.set(store.picked().slice(0, 1));
    store.paying.set([]);
    fixture.detectChanges();
    expect(calloutText()).toContain('The agent has picked up 1 student for a human today');
    expect(fixture.componentInstance.paying()).toBe(0);
  });

  it('links the callout to the Tracker, scoped to today\'s pickups (issue #132)', () => {
    const link = fixture.nativeElement.querySelector('a.btn-blue') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/tracker?filter=new');
  });
});
