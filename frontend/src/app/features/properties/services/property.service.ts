import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface CreatePropertyRequest {
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface CreatePropertyResponse {
  id: string;
}

@Injectable({ providedIn: 'root' })
export class PropertyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/properties';

  createProperty(request: CreatePropertyRequest): Observable<CreatePropertyResponse> {
    return this.http.post<CreatePropertyResponse>(this.baseUrl, request);
  }
}
