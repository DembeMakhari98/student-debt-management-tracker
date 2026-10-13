import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_BASE } from '../../core/api';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let http: HttpTestingController;
  let router: Router;

  function setup(returnUrl: string | null = null): void {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) } },
        },
      ],
    });
    fixture = TestBed.createComponent(LoginComponent);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  function type(selector: string, value: string): void {
    const input = el().querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
  function submit(): void {
    el().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }
  function flushSuccess(): void {
    http.expectOne(`${API_BASE}/api/auth/login`).flush({
      token: 't',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: { username: 'nomsa.mahlangu', displayName: 'Nomsa Mahlangu', role: 'OFFICER', team: 'Team A', officerKey: 'nomsa-mahlangu' },
    });
  }

  afterEach(() => {
    http.verify();
    localStorage.removeItem('sdt.session');
    sessionStorage.removeItem('sdt.session');
  });

  it('shows validation messages and sends nothing when the form is empty', () => {
    setup();
    submit();
    expect(el().textContent).toContain('Enter your username.');
    expect(el().textContent).toContain('Enter your password.');
    http.expectNone(`${API_BASE}/api/auth/login`);
  });

  it('signs in and goes to /home by default', () => {
    setup();
    type('#username', 'nomsa.mahlangu');
    type('#password', 'Debt@2026!');
    submit();
    expect(el().querySelector('.submit')!.textContent).toContain('Signing in');
    flushSuccess();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('returns to the page the user was headed to', () => {
    setup('/cases');
    type('#username', 'nomsa.mahlangu');
    type('#password', 'Debt@2026!');
    submit();
    flushSuccess();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/cases');
  });

  it('ignores an off-site return URL', () => {
    setup('//evil.example.com');
    type('#username', 'nomsa.mahlangu');
    type('#password', 'Debt@2026!');
    submit();
    flushSuccess();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('shows the backend message and clears the password on bad credentials', () => {
    setup();
    type('#username', 'nomsa.mahlangu');
    type('#password', 'nope');
    submit();
    http.expectOne(`${API_BASE}/api/auth/login`)
      .flush({ message: 'Incorrect username or password' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(el().querySelector('[role="alert"]')!.textContent).toContain('Incorrect username or password');
    expect(el().querySelector<HTMLInputElement>('#password')!.value).toBe('');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('explains when the server cannot be reached', () => {
    setup();
    type('#username', 'nomsa.mahlangu');
    type('#password', 'Debt@2026!');
    submit();
    http.expectOne(`${API_BASE}/api/auth/login`).error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();
    expect(el().querySelector('[role="alert"]')!.textContent).toContain("Can't reach the server");
  });

  it('signs in with one click on a demo account', () => {
    setup();
    el().querySelector<HTMLButtonElement>('.demo-toggle')!.click();
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('.demo-list button')!.click();

    const req = http.expectOne(`${API_BASE}/api/auth/login`);
    expect(req.request.body).toEqual({ username: 'nomsa.mahlangu', password: 'Debt@2026!' });
    req.flush({
      token: 't',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: { username: 'nomsa.mahlangu', displayName: 'Nomsa Mahlangu', role: 'OFFICER', team: 'Team A', officerKey: 'nomsa-mahlangu' },
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('toggles password visibility', () => {
    setup();
    const input = el().querySelector<HTMLInputElement>('#password')!;
    expect(input.type).toBe('password');
    el().querySelector<HTMLButtonElement>('.reveal')!.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
  });

});
