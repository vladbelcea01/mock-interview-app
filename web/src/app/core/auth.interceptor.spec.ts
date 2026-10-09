import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const auth = { token: vi.fn(), logout: vi.fn() };
  const snackBar = { open: vi.fn() };
  const api = (path: string) => `${environment.apiUrl}${path}`;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('adds the bearer token to API requests', () => {
    auth.token.mockReturnValue('tok123');
    http.get(api('/sessions')).subscribe();
    expect(backend.expectOne(api('/sessions')).request.headers.get('Authorization')).toBe('Bearer tok123');
  });

  it('does not send the token to other origins', () => {
    auth.token.mockReturnValue('tok123');
    http.get('https://example.com/data').subscribe();
    expect(backend.expectOne('https://example.com/data').request.headers.has('Authorization')).toBe(false);
  });

  it('logs out on 401 from a protected endpoint', () => {
    auth.token.mockReturnValue('expired');
    http.get(api('/sessions')).subscribe({ error: () => undefined });
    backend.expectOne(api('/sessions')).flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.logout).toHaveBeenCalled();
  });

  it('leaves a failed login to the login form (no logout, no snackbar)', () => {
    auth.token.mockReturnValue(null);
    http.post(api('/auth/login'), {}).subscribe({ error: () => undefined });
    backend
      .expectOne(api('/auth/login'))
      .flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.logout).not.toHaveBeenCalled();
    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('shows the API message for other errors', () => {
    auth.token.mockReturnValue('tok');
    http.post(api('/participants'), {}).subscribe({ error: () => undefined });
    backend
      .expectOne(api('/participants'))
      .flush({ message: 'A participant with this email already exists' }, { status: 409, statusText: 'Conflict' });
    expect(snackBar.open).toHaveBeenCalledWith('A participant with this email already exists', 'Dismiss', expect.anything());
  });

  it('explains when the server cannot be reached', () => {
    auth.token.mockReturnValue(null);
    http.get(api('/health')).subscribe({ error: () => undefined });
    backend.expectOne(api('/health')).error(new ProgressEvent('error'), { status: 0 });
    expect(snackBar.open).toHaveBeenCalledWith(expect.stringContaining('Cannot reach the server'), 'Dismiss', expect.anything());
  });
});
