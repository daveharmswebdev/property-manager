import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RegisterResponse {
  userId: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ValidationError {
  type: string;
  title: string;
  status: number;
  errors: Record<string, string[]>;
  traceId: string;
}

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  traceId: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/auth';

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.baseUrl}/register`, request);
  }

  verifyEmail(token: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/verify-email`, { token });
  }
}
