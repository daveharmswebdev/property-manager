import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Tenant property DTO — read-only, no financial data (Story 20.5, AC #2).
 */
export interface TenantPropertyDto {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

/**
 * Maintenance request photo DTO (Story 20.4).
 */
export interface MaintenanceRequestPhotoDto {
  id: string;
  thumbnailUrl: string | null;
  viewUrl: string | null;
  isPrimary: boolean;
  displayOrder: number;
  originalFileName: string;
  fileSizeBytes: number;
  createdAt: string;
}

/**
 * Maintenance request DTO matching backend MaintenanceRequestDto.
 */
export interface MaintenanceRequestDto {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  description: string;
  status: string;
  dismissalReason: string | null;
  submittedByUserId: string;
  submittedByUserName: string | null;
  workOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  photos: MaintenanceRequestPhotoDto[] | null;
}

/**
 * Paginated maintenance requests response.
 */
export interface PaginatedMaintenanceRequests {
  items: MaintenanceRequestDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Tenant Service (Story 20.5, AC #2, #3, #4)
 *
 * HTTP service for tenant-specific API calls.
 * Uses manual HttpClient calls (no NSwag generation).
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/maintenance-requests';

  /**
   * Get the current tenant's assigned property info.
   */
  getTenantProperty(): Observable<TenantPropertyDto> {
    return this.http.get<TenantPropertyDto>(`${this.baseUrl}/tenant-property`);
  }

  /**
   * Get maintenance requests with pagination.
   */
  getMaintenanceRequests(page = 1, pageSize = 20): Observable<PaginatedMaintenanceRequests> {
    const params = new HttpParams().set('page', page.toString()).set('pageSize', pageSize.toString());
    return this.http.get<PaginatedMaintenanceRequests>(this.baseUrl, { params });
  }

  /**
   * Get a single maintenance request by ID with full detail.
   */
  getMaintenanceRequestById(id: string): Observable<MaintenanceRequestDto> {
    return this.http.get<MaintenanceRequestDto>(`${this.baseUrl}/${id}`);
  }
}
