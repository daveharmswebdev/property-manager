import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { authInterceptor } from './auth.interceptor';
import { AuthService, LoginResponse } from '../services/auth.service';

/**
 * Story 21.7 — Unit tests for the functional `authInterceptor`.
 *
 * Pins the five-branch decision tree (see story Dev Notes for diagram):
 *   1. token + non-auth URL  → add Authorization header
 *   2. auth URL              → no header, 401 passes straight through
 *   3. 401 + idle            → refresh once, retry with new token
 *   4. 401 + refreshing      → wait on refreshTokenInProgress, retry
 *   5. refresh failure       → logout + navigate(['/login'])
 */
describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpTesting: HttpTestingController;
  let mockAuthService: {
    accessToken: () => string | null;
    refreshToken: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    refreshTokenInProgress: BehaviorSubject<boolean>;
    isRefreshingToken: boolean;
  };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  // Writable token signal — the mock's `accessToken` is the read-only view of this.
  // Using a signal mirrors the real `AuthService.accessToken = this._accessToken.asReadonly()`.
  let writableTokenSignal: WritableSignal<string | null>;
  let refreshTokenInProgress$: BehaviorSubject<boolean>;

  /** Helper — flip the token under test. */
  function setToken(value: string | null) {
    writableTokenSignal.set(value);
  }

  beforeEach(() => {
    writableTokenSignal = signal<string | null>(null);
    refreshTokenInProgress$ = new BehaviorSubject<boolean>(false);

    mockAuthService = {
      // Calling `accessToken()` returns the current value, matching the real signal contract.
      accessToken: () => writableTokenSignal(),
      refreshToken: vi.fn(),
      // logout() returns Observable<void> in the real service.
      logout: vi.fn().mockReturnValue(of(undefined)),
      refreshTokenInProgress: refreshTokenInProgress$,
      // The interceptor reads `isRefreshingToken` as a property — we expose it as a
      // plain boolean field that individual tests can set directly. This mirrors the
      // shape the interceptor consumes (it never assumes a getter; just reads the value).
      isRefreshingToken: false,
    };

    mockRouter = {
      // Match the real Router.navigate signature (returns Promise<boolean>).
      navigate: vi.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        // Provider order matters: provideHttpClient() must be registered before provideHttpClientTesting().
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Task 5 — token injection (AC-9, AC-10, AC-11)
  // ===========================================================================
  describe('token injection', () => {
    // ---- AC-9 ---------------------------------------------------------------
    it('adds Authorization header for protected routes when token is present', () => {
      setToken('abc.def.ghi');

      httpClient.get('/api/v1/properties').subscribe();

      const req = httpTesting.expectOne('/api/v1/properties');
      expect(req.request.headers.get('Authorization')).toBe('Bearer abc.def.ghi');

      req.flush({});
    });

    // ---- AC-10 --------------------------------------------------------------
    it('does NOT add Authorization header for /api/v1/auth/* URLs even with a token', () => {
      setToken('abc.def.ghi');

      httpClient
        .post('/api/v1/auth/login', { email: 'a@b.com', password: 'pw' })
        .subscribe();

      const req = httpTesting.expectOne('/api/v1/auth/login');
      expect(req.request.headers.has('Authorization')).toBe(false);

      req.flush({ accessToken: 't', expiresIn: 3600 });
    });

    // ---- AC-11 --------------------------------------------------------------
    it('does NOT add Authorization header when no token is present', () => {
      // No setToken — accessToken() returns null.

      httpClient.get('/api/v1/properties').subscribe();

      const req = httpTesting.expectOne('/api/v1/properties');
      expect(req.request.headers.has('Authorization')).toBe(false);

      req.flush({});
    });
  });

  // ===========================================================================
  // Task 6 — 401 → refresh → retry happy path (AC-12, AC-13)
  // ===========================================================================
  describe('401 → refresh → retry', () => {
    // ---- AC-12 --------------------------------------------------------------
    it('on 401 from a protected route, calls refresh once and retries with the new token', () => {
      setToken('old.token');

      // refreshToken() succeeds and updates the token before emitting.
      mockAuthService.refreshToken.mockImplementation(() => {
        setToken('new.token');
        return of({ accessToken: 'new.token', expiresIn: 3600 } as LoginResponse);
      });

      const results: unknown[] = [];
      const errors: unknown[] = [];
      httpClient.get('/api/v1/properties').subscribe({
        next: v => results.push(v),
        error: e => errors.push(e),
      });

      // First request — flush 401 to trigger the refresh path.
      const first = httpTesting.expectOne('/api/v1/properties');
      expect(first.request.headers.get('Authorization')).toBe('Bearer old.token');
      first.flush({}, { status: 401, statusText: 'Unauthorized' });

      // Retry request — must carry the freshly-refreshed token.
      const retry = httpTesting.expectOne('/api/v1/properties');
      expect(retry.request.headers.get('Authorization')).toBe('Bearer new.token');
      retry.flush({ items: [] });

      expect(mockAuthService.refreshToken).toHaveBeenCalledTimes(1);
      expect(errors).toEqual([]);
      expect(results).toEqual([{ items: [] }]);
    });

    // ---- AC-13 --------------------------------------------------------------
    it('on 401 from an /api/v1/auth/* endpoint, does NOT call refresh and surfaces the 401', () => {
      setToken('abc');

      const errors: HttpErrorResponse[] = [];
      httpClient
        .post('/api/v1/auth/login', { email: 'a@b.com', password: 'wrong' })
        .subscribe({
          error: e => errors.push(e),
        });

      const req = httpTesting.expectOne('/api/v1/auth/login');
      req.flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
      expect(errors.length).toBe(1);
      expect(errors[0].status).toBe(401);
    });
  });

  // ===========================================================================
  // Task 7 — refresh failure (AC-14)
  // ===========================================================================
  describe('refresh failure', () => {
    // ---- AC-14 --------------------------------------------------------------
    it('on refresh failure, calls logout() and navigates to /login, surfacing the error', () => {
      setToken('old.token');

      mockAuthService.refreshToken.mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }),
        ),
      );

      const errors: unknown[] = [];
      httpClient.get('/api/v1/properties').subscribe({
        error: e => errors.push(e),
      });

      const req = httpTesting.expectOne('/api/v1/properties');
      req.flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(mockAuthService.refreshToken).toHaveBeenCalledTimes(1);
      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
      expect(errors.length).toBe(1);
    });
  });

  // ===========================================================================
  // Task 8 — concurrent-refresh coordination (AC-15, AC-16)
  // ===========================================================================
  describe('concurrent refresh in progress', () => {
    // ---- AC-15 --------------------------------------------------------------
    it('on 401 while refresh is in progress, waits for refreshTokenInProgress and retries with the post-refresh token', () => {
      setToken('old.token');

      // Simulate that another request has already kicked off the refresh.
      mockAuthService.isRefreshingToken = true;
      refreshTokenInProgress$.next(true);

      const results: unknown[] = [];
      const errors: unknown[] = [];
      httpClient.get('/api/v1/properties').subscribe({
        next: v => results.push(v),
        error: e => errors.push(e),
      });

      // Flush the protected request with 401 — interceptor enters the "wait" branch.
      const first = httpTesting.expectOne('/api/v1/properties');
      first.flush({}, { status: 401, statusText: 'Unauthorized' });

      // The in-progress refresh handles the refresh — this interceptor invocation must NOT
      // call refreshToken itself.
      expect(mockAuthService.refreshToken).not.toHaveBeenCalled();

      // No retry should be in flight yet — the interceptor is still waiting on the BehaviorSubject.
      httpTesting.expectNone('/api/v1/properties');

      // Simulate the in-progress refresh completing: token gets updated, then the
      // BehaviorSubject emits `false`, which unblocks the interceptor's filter+take(1).
      setToken('new.token');
      mockAuthService.isRefreshingToken = false;
      refreshTokenInProgress$.next(false);

      // The retry must now fire with the freshly-set token.
      const retry = httpTesting.expectOne('/api/v1/properties');
      expect(retry.request.headers.get('Authorization')).toBe('Bearer new.token');
      retry.flush({ items: [] });

      expect(errors).toEqual([]);
      expect(results).toEqual([{ items: [] }]);
      // Belt-and-braces: the interceptor never called refreshToken in the wait branch.
      expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
    });

    // ---- AC-16 --------------------------------------------------------------
    it('on 401 while refresh is in progress and no token after completion, navigates to /login and errors', () => {
      setToken('old.token');

      mockAuthService.isRefreshingToken = true;
      refreshTokenInProgress$.next(true);

      const errors: Error[] = [];
      httpClient.get('/api/v1/properties').subscribe({
        error: e => errors.push(e),
      });

      const first = httpTesting.expectOne('/api/v1/properties');
      first.flush({}, { status: 401, statusText: 'Unauthorized' });

      // Refresh completes WITHOUT producing a token.
      setToken(null);
      mockAuthService.isRefreshingToken = false;
      refreshTokenInProgress$.next(false);

      // No retry should be in flight (the interceptor short-circuits to /login).
      httpTesting.expectNone('/api/v1/properties');

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
      expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Authentication failed');
    });
  });
});
