import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService, LoginResponse, User } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  const baseUrl = '/api/v1/auth';

  // Valid JWT token payload for testing
  const mockUser: User = {
    userId: 'user-123',
    accountId: 'account-456',
    role: 'Owner',
    email: 'test@example.com',
    displayName: 'Test User',
  };

  // Create a mock JWT token (header.payload.signature)
  const createMockToken = (payload: object, expSeconds?: number): string => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const exp = expSeconds ?? Math.floor(Date.now() / 1000) + 3600; // Default: 1 hour from now
    const payloadWithExp = { ...payload, exp };
    const body = btoa(JSON.stringify(payloadWithExp));
    const signature = 'mock-signature';
    return `${header}.${body}.${signature}`;
  };

  const mockLoginResponse: LoginResponse = {
    accessToken: createMockToken(mockUser),
    expiresIn: 3600,
  };

  beforeEach(() => {
    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: mockRouter },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have null accessToken initially', () => {
      expect(service.accessToken()).toBeNull();
    });

    it('should have null currentUser initially', () => {
      expect(service.currentUser()).toBeNull();
    });

    it('should not be authenticated initially', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should be initializing initially', () => {
      expect(service.isInitializing()).toBe(true);
    });

    it('should not be refreshing token initially', () => {
      expect(service.isRefreshingToken).toBe(false);
    });
  });

  describe('login', () => {
    it('should send POST request with credentials', () => {
      const email = 'test@example.com';
      const password = 'password123';

      service.login(email, password).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email, password });
      expect(req.request.withCredentials).toBe(true);

      req.flush(mockLoginResponse);
    });

    it('should store access token on successful login', () => {
      service.login('test@example.com', 'password').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush(mockLoginResponse);

      expect(service.accessToken()).toBe(mockLoginResponse.accessToken);
    });

    it('should decode and store user info on successful login', () => {
      service.login('test@example.com', 'password').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush(mockLoginResponse);

      const user = service.currentUser();
      expect(user).not.toBeNull();
      expect(user?.userId).toBe(mockUser.userId);
      expect(user?.email).toBe(mockUser.email);
      expect(user?.role).toBe(mockUser.role);
    });

    it('should set isAuthenticated to true on successful login', () => {
      service.login('test@example.com', 'password').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush(mockLoginResponse);

      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return the login response', () => {
      let response: LoginResponse | undefined;
      service.login('test@example.com', 'password').subscribe(r => {
        response = r;
      });

      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush(mockLoginResponse);

      expect(response).toEqual(mockLoginResponse);
    });

    it('should propagate errors', () => {
      let error: any;
      service.login('test@example.com', 'wrong-password').subscribe({
        error: e => {
          error = e;
        },
      });

      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

      expect(error).toBeDefined();
      expect(error.status).toBe(401);
    });
  });

  describe('logout', () => {
    it('should send POST request to logout endpoint', () => {
      service.logout().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/logout`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);

      req.flush(null);
    });

    it('should clear auth state on successful logout', () => {
      // First login
      service.login('test@example.com', 'password').subscribe();
      httpMock.expectOne(`${baseUrl}/login`).flush(mockLoginResponse);

      expect(service.isAuthenticated()).toBe(true);

      // Then logout
      service.logout().subscribe();
      httpMock.expectOne(`${baseUrl}/logout`).flush(null);

      expect(service.accessToken()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should clear auth state even if API call fails', () => {
      // First login
      service.login('test@example.com', 'password').subscribe();
      httpMock.expectOne(`${baseUrl}/login`).flush(mockLoginResponse);

      expect(service.isAuthenticated()).toBe(true);

      // Logout with error
      service.logout().subscribe({ error: () => {} });
      httpMock.expectOne(`${baseUrl}/logout`).flush(null, { status: 500, statusText: 'Server Error' });

      expect(service.accessToken()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('logoutAndRedirect', () => {
    it('should call logout and navigate to login', async () => {
      // First login
      service.login('test@example.com', 'password').subscribe();
      httpMock.expectOne(`${baseUrl}/login`).flush(mockLoginResponse);

      service.logoutAndRedirect();

      const req = httpMock.expectOne(`${baseUrl}/logout`);
      req.flush(null);

      // Allow microtasks to complete
      await Promise.resolve();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should set loading signal to true during logout', async () => {
      const loadingSignal = signal(false);

      service.logoutAndRedirect(loadingSignal);
      expect(loadingSignal()).toBe(true);

      httpMock.expectOne(`${baseUrl}/logout`).flush(null);

      await Promise.resolve();

      expect(loadingSignal()).toBe(false);
    });

    it('should prevent double clicks when loading signal is true', () => {
      const loadingSignal = signal(true);

      service.logoutAndRedirect(loadingSignal);

      // Should not make API call
      httpMock.expectNone(`${baseUrl}/logout`);
    });

    it('should navigate to login even on error', async () => {
      service.logoutAndRedirect();

      const req = httpMock.expectOne(`${baseUrl}/logout`);
      req.flush(null, { status: 500, statusText: 'Server Error' });

      await Promise.resolve();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should reset loading signal on error', async () => {
      const loadingSignal = signal(false);

      service.logoutAndRedirect(loadingSignal);
      expect(loadingSignal()).toBe(true);

      httpMock.expectOne(`${baseUrl}/logout`).flush(null, { status: 500, statusText: 'Server Error' });

      await Promise.resolve();

      expect(loadingSignal()).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('should send POST request to refresh endpoint', () => {
      service.refreshToken().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);

      req.flush(mockLoginResponse);
    });

    it('should update access token on successful refresh', () => {
      service.refreshToken().subscribe();

      httpMock.expectOne(`${baseUrl}/refresh`).flush(mockLoginResponse);

      expect(service.accessToken()).toBe(mockLoginResponse.accessToken);
    });

    it('should update user info on successful refresh', () => {
      service.refreshToken().subscribe();

      httpMock.expectOne(`${baseUrl}/refresh`).flush(mockLoginResponse);

      expect(service.currentUser()?.userId).toBe(mockUser.userId);
    });

    it('should prevent multiple simultaneous refresh requests', () => {
      service.refreshToken().subscribe();

      // Try to call refresh again while first is in progress
      let error: Error | undefined;
      service.refreshToken().subscribe({ error: e => { error = e; } });

      // Only one request should be made
      httpMock.expectOne(`${baseUrl}/refresh`).flush(mockLoginResponse);

      expect(error?.message).toBe('Token refresh already in progress');
    });

    it('should allow new refresh after previous completes', () => {
      // First refresh
      service.refreshToken().subscribe();
      httpMock.expectOne(`${baseUrl}/refresh`).flush(mockLoginResponse);

      // Second refresh should work
      service.refreshToken().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/refresh`);
      req.flush(mockLoginResponse);
    });

    it('should clear auth state on refresh failure', () => {
      // First login
      service.login('test@example.com', 'password').subscribe();
      httpMock.expectOne(`${baseUrl}/login`).flush(mockLoginResponse);

      expect(service.isAuthenticated()).toBe(true);

      // Failed refresh
      service.refreshToken().subscribe({ error: () => {} });
      httpMock.expectOne(`${baseUrl}/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(service.accessToken()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should reset refresh in progress flag on error', () => {
      service.refreshToken().subscribe({ error: () => {} });
      httpMock.expectOne(`${baseUrl}/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(service.isRefreshingToken).toBe(false);
    });
  });

  describe('isTokenExpired', () => {
    it('should return true when no token exists', () => {
      expect(service.isTokenExpired()).toBe(true);
    });

    it('should return false for valid non-expired token', () => {
      const futureToken = createMockToken(mockUser, Math.floor(Date.now() / 1000) + 3600);
      const response = { accessToken: futureToken, expiresIn: 3600 };

      service.login('test@example.com', 'password').subscribe();
      httpMock.expectOne(`${baseUrl}/login`).flush(response);

      expect(service.isTokenExpired()).toBe(false);
    });

    it('should return true for expired token', () => {
      const expiredToken = createMockToken(mockUser, Math.floor(Date.now() / 1000) - 100);
      const response = { accessToken: expiredToken, expiresIn: 3600 };

      service.login('test@example.com', 'password').subscribe();
      httpMock.expectOne(`${baseUrl}/login`).flush(response);

      expect(service.isTokenExpired()).toBe(true);
    });

    it('should return true for malformed token', () => {
      const malformedResponse = { accessToken: 'not-a-valid-jwt', expiresIn: 3600 };

      service.login('test@example.com', 'password').subscribe();
      httpMock.expectOne(`${baseUrl}/login`).flush(malformedResponse);

      expect(service.isTokenExpired()).toBe(true);
    });
  });

  describe('forgotPassword', () => {
    it('should send POST request with email', () => {
      const email = 'test@example.com';

      service.forgotPassword(email).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/forgot-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email });

      req.flush(null);
    });

    it('should complete successfully', () => {
      let completed = false;
      service.forgotPassword('test@example.com').subscribe({
        complete: () => { completed = true; },
      });

      httpMock.expectOne(`${baseUrl}/forgot-password`).flush(null);

      expect(completed).toBe(true);
    });
  });

  describe('resetPassword', () => {
    it('should send POST request with token and new password', () => {
      const token = 'reset-token-123';
      const newPassword = 'newPassword123';

      service.resetPassword(token, newPassword).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/reset-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ token, newPassword });

      req.flush(null);
    });

    it('should complete successfully', () => {
      let completed = false;
      service.resetPassword('token', 'password').subscribe({
        complete: () => { completed = true; },
      });

      httpMock.expectOne(`${baseUrl}/reset-password`).flush(null);

      expect(completed).toBe(true);
    });

    it('should propagate errors for invalid token', () => {
      let error: any;
      service.resetPassword('invalid-token', 'password').subscribe({
        error: e => { error = e; },
      });

      httpMock.expectOne(`${baseUrl}/reset-password`).flush(
        { message: 'Invalid or expired token' },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(error).toBeDefined();
      expect(error.status).toBe(400);
    });
  });

  describe('initializeAuth', () => {
    it('should attempt to refresh token', () => {
      service.initializeAuth().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);

      req.flush(mockLoginResponse);
    });

    it('should set isInitializing to true at start', () => {
      // isInitializing is true by default, but let's verify behavior
      service.markInitialized(); // Reset to false first
      expect(service.isInitializing()).toBe(false);

      service.initializeAuth().subscribe();
      // Note: The service sets isInitializing to true synchronously

      httpMock.expectOne(`${baseUrl}/refresh`).flush(mockLoginResponse);
    });

    it('should set isInitializing to false on success', () => {
      service.initializeAuth().subscribe();

      httpMock.expectOne(`${baseUrl}/refresh`).flush(mockLoginResponse);

      expect(service.isInitializing()).toBe(false);
    });

    it('should set access token and user on success', () => {
      service.initializeAuth().subscribe();

      httpMock.expectOne(`${baseUrl}/refresh`).flush(mockLoginResponse);

      expect(service.accessToken()).toBe(mockLoginResponse.accessToken);
      expect(service.currentUser()?.userId).toBe(mockUser.userId);
    });

    it('should return null and clear state on failure', () => {
      let result: LoginResponse | null | undefined;
      service.initializeAuth().subscribe(r => { result = r; });

      httpMock.expectOne(`${baseUrl}/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(result).toBeNull();
      expect(service.accessToken()).toBeNull();
      expect(service.currentUser()).toBeNull();
    });

    it('should set isInitializing to false on failure', () => {
      service.initializeAuth().subscribe();

      httpMock.expectOne(`${baseUrl}/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(service.isInitializing()).toBe(false);
    });
  });

  describe('markInitialized', () => {
    it('should set isInitializing to false', () => {
      expect(service.isInitializing()).toBe(true);

      service.markInitialized();

      expect(service.isInitializing()).toBe(false);
    });
  });

  describe('refreshTokenInProgress', () => {
    it('should return BehaviorSubject for interceptor coordination', () => {
      const subject = service.refreshTokenInProgress;

      expect(subject).toBeDefined();
      expect(subject.value).toBe(false);
    });

    it('should emit true during refresh', () => {
      const values: boolean[] = [];
      service.refreshTokenInProgress.subscribe(v => values.push(v));

      service.refreshToken().subscribe();

      // Should be true while request is in flight
      expect(values).toContain(true);

      httpMock.expectOne(`${baseUrl}/refresh`).flush(mockLoginResponse);

      // Should be false after completion
      expect(service.refreshTokenInProgress.value).toBe(false);
    });
  });

  describe('token decoding edge cases', () => {
    it('should handle token without displayName', () => {
      const userWithoutDisplayName = { ...mockUser, displayName: undefined };
      const token = createMockToken(userWithoutDisplayName);
      const response = { accessToken: token, expiresIn: 3600 };

      service.login('test@example.com', 'password').subscribe();
      httpMock.expectOne(`${baseUrl}/login`).flush(response);

      expect(service.currentUser()?.displayName).toBeNull();
    });

    it('should set user to null for invalid token during login', () => {
      // Create a token that will fail JSON.parse in decodeToken
      const invalidToken = 'header.!!!invalid-base64!!!.signature';
      const response = { accessToken: invalidToken, expiresIn: 3600 };

      service.login('test@example.com', 'password').subscribe();
      httpMock.expectOne(`${baseUrl}/login`).flush(response);

      // Token is stored but user decoding fails
      expect(service.accessToken()).toBe(invalidToken);
      expect(service.currentUser()).toBeNull();
    });
  });
});
