import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Request model for creating a work order (AC #1, #5, Story 9-4)
 */
export interface CreateWorkOrderRequest {
  propertyId: string;
  description: string;
  categoryId?: string;
  status?: string; // Reported, Assigned, Completed
  vendorId?: string; // Story 9-4: Vendor assignment (null for DIY)
  tagIds?: string[];
}

/**
 * Request model for updating a work order (AC #6)
 */
export interface UpdateWorkOrderRequest {
  description: string;
  categoryId?: string;
  status?: string;
  vendorId?: string;
  tagIds?: string[];
}

/**
 * Request model for creating a work order tag
 */
export interface CreateWorkOrderTagRequest {
  name: string;
}

/**
 * Response model for get all work order tags
 */
export interface GetAllWorkOrderTagsResponse {
  items: WorkOrderTagDto[];
  totalCount: number;
}

/**
 * Response model for work order creation
 */
export interface CreateWorkOrderResponse {
  id: string;
}

/**
 * Work order DTO (Story 9-4: Added isDiy)
 */
export interface WorkOrderDto {
  id: string;
  propertyId: string;
  propertyName: string;
  vendorId?: string;
  vendorName?: string;
  isDiy: boolean; // Story 9-4: True when vendorId is null
  categoryId?: string;
  categoryName?: string;
  status: string;
  description: string;
  createdAt: string;
  createdByUserId: string;
  tags: WorkOrderTagDto[];
  primaryPhotoThumbnailUrl?: string; // Photo symmetry feature
}

/**
 * Work order tag DTO
 */
export interface WorkOrderTagDto {
  id: string;
  name: string;
}

/**
 * Response model for get all work orders
 */
export interface GetAllWorkOrdersResponse {
  items: WorkOrderDto[];
  totalCount: number;
}

/**
 * Response model for get work orders by property (Story 9-11)
 */
export interface GetWorkOrdersByPropertyResponse {
  items: WorkOrderDto[];
  totalCount: number;
}

/**
 * Work Order Status enum values
 */
export const WorkOrderStatus = {
  Reported: 'Reported',
  Assigned: 'Assigned',
  Completed: 'Completed',
} as const;

export type WorkOrderStatusType = (typeof WorkOrderStatus)[keyof typeof WorkOrderStatus];

/**
 * WorkOrderService (AC #1, #6)
 *
 * Provides API methods for work order management.
 */
@Injectable({ providedIn: 'root' })
export class WorkOrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/work-orders';
  private readonly tagsBaseUrl = '/api/v1/work-order-tags';

  /**
   * Create a new work order (AC #1)
   * @param request Work order details
   * @returns Observable with new work order ID
   */
  createWorkOrder(request: CreateWorkOrderRequest): Observable<CreateWorkOrderResponse> {
    return this.http.post<CreateWorkOrderResponse>(this.baseUrl, request);
  }

  /**
   * Get all work orders
   * @param status Optional status filter (Reported, Assigned, Completed)
   * @param propertyId Optional property filter
   * @returns Observable with list of work orders
   */
  getWorkOrders(status?: string, propertyId?: string): Observable<GetAllWorkOrdersResponse> {
    const params: Record<string, string> = {};
    if (status) {
      params['status'] = status;
    }
    if (propertyId) {
      params['propertyId'] = propertyId;
    }
    return this.http.get<GetAllWorkOrdersResponse>(this.baseUrl, { params });
  }

  /**
   * Get a single work order by ID
   * @param id Work order GUID
   * @returns Observable with work order details
   */
  getWorkOrder(id: string): Observable<WorkOrderDto> {
    return this.http.get<WorkOrderDto>(`${this.baseUrl}/${id}`);
  }

  /**
   * Update an existing work order (AC #6)
   * @param id Work order GUID
   * @param request Updated work order details
   * @returns Observable that completes on success
   */
  updateWorkOrder(id: string, request: UpdateWorkOrderRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, request);
  }

  /**
   * Get all work order tags (AC #8)
   * @returns Observable with list of tags
   */
  getWorkOrderTags(): Observable<GetAllWorkOrderTagsResponse> {
    return this.http.get<GetAllWorkOrderTagsResponse>(this.tagsBaseUrl);
  }

  /**
   * Create a new work order tag (AC #10)
   * @param request Tag details
   * @returns Observable with new tag ID
   */
  createWorkOrderTag(request: CreateWorkOrderTagRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.tagsBaseUrl, request);
  }

  /**
   * Delete a work order (soft delete) (Story 9-9, AC #6)
   * @param id Work order GUID
   * @returns Observable that completes on success
   */
  deleteWorkOrder(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Get work orders for a specific property (Story 9-11 AC #1, #5)
   * Used on property detail page to show maintenance history.
   * @param propertyId Property GUID
   * @param limit Optional limit for number of results (e.g., 5 for recent work orders)
   * @returns Observable with list of work orders for the property with total count
   */
  getWorkOrdersByProperty(propertyId: string, limit?: number): Observable<GetWorkOrdersByPropertyResponse> {
    const params: Record<string, string> = {};
    if (limit !== undefined) {
      params['limit'] = limit.toString();
    }
    return this.http.get<GetWorkOrdersByPropertyResponse>(
      `/api/v1/properties/${propertyId}/work-orders`,
      { params }
    );
  }
}
