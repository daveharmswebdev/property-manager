import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  ApiClient,
  NoteDto as GeneratedNoteDto,
  GetNotesResult,
  CreateNoteResponse,
  CreateNoteRequest as GeneratedCreateNoteRequest,
  UpdateNoteRequest,
} from '../../../core/api/api.service';

/**
 * Note DTO with required fields for component use (Story 10-1, 10-3a)
 * Re-exports generated type with non-null assertions for cleaner component code.
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
 * NotesService (Story 10-2, 10-3, 10-3a)
 *
 * Provides API methods for polymorphic notes using generated NSwag client.
 * Backend implemented in Story 10-1.
 */
@Injectable({ providedIn: 'root' })
export class NotesService {
  private readonly apiClient = inject(ApiClient);

  /**
   * Get notes for an entity (AC #2)
   * @param entityType Entity type (e.g., 'WorkOrder')
   * @param entityId Entity GUID
   * @returns Observable with list of notes (sorted newest first by API)
   */
  getNotes(entityType: string, entityId: string): Observable<NotesResponse> {
    return this.apiClient.notes_GetNotes(entityType, entityId).pipe(
      map((result: GetNotesResult) => ({
        items: (result.items ?? []).map(this.mapNoteDto),
        totalCount: result.totalCount ?? 0,
      }))
    );
  }

  /**
   * Create a new note (AC #4)
   * @param request Note details
   * @returns Observable with new note ID
   */
  createNote(request: CreateNoteRequest): Observable<{ id: string }> {
    const apiRequest: GeneratedCreateNoteRequest = {
      entityType: request.entityType,
      entityId: request.entityId,
      content: request.content,
    };
    return this.apiClient.notes_CreateNote(apiRequest).pipe(
      map((response: CreateNoteResponse) => ({ id: response.id! }))
    );
  }

  /**
   * Delete a note (Story 10-3, AC #3)
   * Soft-deletes the note on the backend.
   * @param noteId Note GUID
   * @returns Observable that completes on success (204 No Content)
   */
  deleteNote(noteId: string): Observable<void> {
    return this.apiClient.notes_DeleteNote(noteId);
  }

  /**
   * Update a note (Story 10-3a, AC #3)
   * Updates note content on the backend.
   * @param noteId Note GUID
   * @param content New note content
   * @returns Observable that completes on success (204 No Content)
   */
  updateNote(noteId: string, content: string): Observable<void> {
    const request: UpdateNoteRequest = { content };
    return this.apiClient.notes_UpdateNote(noteId, request);
  }

  /**
   * Map generated NoteDto to service NoteDto with required fields
   */
  private mapNoteDto(note: GeneratedNoteDto): NoteDto {
    return {
      id: note.id!,
      entityType: note.entityType!,
      entityId: note.entityId!,
      content: note.content!,
      createdByUserId: note.createdByUserId!,
      createdByUserName: note.createdByUserName!,
      createdAt: note.createdAt instanceof Date
        ? note.createdAt.toISOString()
        : String(note.createdAt),
      updatedAt: note.updatedAt instanceof Date
        ? note.updatedAt.toISOString()
        : String(note.updatedAt),
    };
  }
}
