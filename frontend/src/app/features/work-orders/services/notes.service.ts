import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Note DTO matching backend API response (Story 10-1, 10-3a)
 * - updatedAt enables "(edited)" annotation when updatedAt > createdAt
 */
export interface NoteDto {
  id: string;
  entityType: string;
  entityId: string;
  content: string;
  createdByUserId: string;
  createdByUserName: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response model for get notes endpoint
 */
export interface NotesResponse {
  items: NoteDto[];
  totalCount: number;
}

/**
 * Request model for creating a note (AC #4)
 */
export interface CreateNoteRequest {
  entityType: string;
  entityId: string;
  content: string;
}

/**
 * NotesService (Story 10-2, AC #4)
 *
 * Provides API methods for polymorphic notes.
 * Backend implemented in Story 10-1.
 */
@Injectable({ providedIn: 'root' })
export class NotesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/notes';

  /**
   * Get notes for an entity (AC #2)
   * @param entityType Entity type (e.g., 'WorkOrder')
   * @param entityId Entity GUID
   * @returns Observable with list of notes (sorted newest first by API)
   */
  getNotes(entityType: string, entityId: string): Observable<NotesResponse> {
    return this.http.get<NotesResponse>(this.baseUrl, {
      params: { entityType, entityId }
    });
  }

  /**
   * Create a new note (AC #4)
   * @param request Note details
   * @returns Observable with new note ID
   */
  createNote(request: CreateNoteRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.baseUrl, request);
  }

  /**
   * Delete a note (Story 10-3, AC #3)
   * Soft-deletes the note on the backend.
   * @param noteId Note GUID
   * @returns Observable that completes on success (204 No Content)
   */
  deleteNote(noteId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${noteId}`);
  }

  /**
   * Update a note (Story 10-3a, AC #3)
   * Updates note content on the backend.
   * @param noteId Note GUID
   * @param content New note content
   * @returns Observable that completes on success (204 No Content)
   */
  updateNote(noteId: string, content: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${noteId}`, { content });
  }
}
