import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Request model for creating an income entry (AC-4.1.3)
 */
export interface CreateIncomeRequest {
  propertyId: string;
  amount: number;
  date: string; // ISO date string (YYYY-MM-DD)
  source?: string;
  description?: string;
}

/**
 * Response model for income creation
 */
export interface CreateIncomeResponse {
  id: string;
}

/**
 * Income DTO (AC-4.1.6)
 */
export interface IncomeDto {
  id: string;
  propertyId: string;
  propertyName: string;
  amount: number;
  date: string;
  source?: string;
  description?: string;
  createdAt: string;
}

/**
 * Response model for income by property
 */
export interface IncomeListResponse {
  items: IncomeDto[];
  totalCount: number;
  ytdTotal: number;
}

/**
 * Response model for income total
 */
export interface IncomeTotalResponse {
  total: number;
  year: number;
}

/**
 * IncomeService (AC-4.1.3, AC-4.1.4)
 *
 * Provides API methods for income management.
 */
@Injectable({ providedIn: 'root' })
export class IncomeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1';

  /**
   * Create a new income entry (AC-4.1.3)
   * @param request Income details
   * @returns Observable with new income ID
   */
  createIncome(request: CreateIncomeRequest): Observable<CreateIncomeResponse> {
    return this.http.post<CreateIncomeResponse>(`${this.baseUrl}/income`, request);
  }

  /**
   * Get income for a property (AC-4.1.2, AC-4.1.6)
   * @param propertyId Property GUID
   * @param year Optional tax year filter
   * @returns Observable with income list and YTD total
   */
  getIncomeByProperty(propertyId: string, year?: number): Observable<IncomeListResponse> {
    const params = year ? { year: year.toString() } : undefined;
    return this.http.get<IncomeListResponse>(
      `${this.baseUrl}/properties/${propertyId}/income`,
      { params }
    );
  }

  /**
   * Get income total for a property (AC-4.1.4)
   * @param propertyId Property GUID
   * @param year Tax year
   * @returns Observable with total income amount
   */
  getIncomeTotalByProperty(propertyId: string, year: number): Observable<IncomeTotalResponse> {
    return this.http.get<IncomeTotalResponse>(
      `${this.baseUrl}/properties/${propertyId}/income/total`,
      { params: { year: year.toString() } }
    );
  }
}
