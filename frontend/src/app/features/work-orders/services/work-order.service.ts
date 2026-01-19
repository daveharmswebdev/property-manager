import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Request model for creating a work order (AC #1)
 */
export interface CreateWorkOrderRequest {
  propertyId: string;
  description: string;
  categoryId?: string;
  status?: string; // Reported, Assigned, Completed
}

/**
 * Response model for work order creation
 */
export interface CreateWorkOrderResponse {
  id: string;
}

/**
 * Work order DTO
 */
export interface WorkOrderDto {
  id: string;
  propertyId: string;
  propertyName: string;
  vendorId?: string;
  vendorName?: string;
  categoryId?: string;
  categoryName?: string;
  status: string;
  description: string;
  createdAt: string;
  createdByUserId: string;
  tags: WorkOrderTagDto[];
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
}
