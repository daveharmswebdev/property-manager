import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Maintenance Request Photo DTO (Story 20.4 / 20.7).
 *
 * Defined locally — these types are intentionally duplicated from
 * `tenant.service.ts` to keep the landlord inbox feature decoupled
 * from the tenant-dashboard module. Consolidation is a future tech-debt
 * opportunity once the landlord views (20.7–20.10) are stable.
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
 * Maintenance Request DTO (matches backend MaintenanceRequestDto).
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
 * Query parameters for the landlord maintenance requests inbox.
 *
 * Backend's `GetMaintenanceRequestsQuery.Status` is parsed via a single
 * `Enum.TryParse<MaintenanceRequestStatus>`. See "Status Filter Encoding"
 * in `docs/project/stories/epic-20/20-7-landlord-maintenance-request-inbox.md`.
 */
export interface MaintenanceRequestQueryParams {
  status?: string;
  propertyId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Maintenance Request Service (Story 20.7, AC #1, #2, #3, #4, #6, #7).
 *
 * HTTP service for the landlord maintenance request inbox.
 * Calls the same backend endpoints as `TenantService`; the backend
 * differentiates Owner vs Tenant via the JWT role claim.
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceRequestService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/maintenance-requests';

  /**
   * Get the landlord's aggregated maintenance request inbox.
   *
   * @param params Optional filters: status, propertyId, page, pageSize.
   *               Empty values are omitted from the query string.
   */
  getMaintenanceRequests(
    params: MaintenanceRequestQueryParams = {},
  ): Observable<PaginatedMaintenanceRequests> {
    let httpParams = new HttpParams();
    if (params.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params.propertyId) {
      httpParams = httpParams.set('propertyId', params.propertyId);
    }
    if (params.page !== undefined && params.page !== null) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params.pageSize !== undefined && params.pageSize !== null) {
      httpParams = httpParams.set('pageSize', params.pageSize.toString());
    }
    return this.http.get<PaginatedMaintenanceRequests>(this.baseUrl, { params: httpParams });
  }

  /**
   * Get a single maintenance request by ID with full detail (photos included).
   */
  getMaintenanceRequestById(id: string): Observable<MaintenanceRequestDto> {
    return this.http.get<MaintenanceRequestDto>(`${this.baseUrl}/${id}`);
  }
}
