import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NotesService, CreateNoteRequest } from './notes.service';
import { ApiClient, GetNotesResult, CreateNoteResponse, NoteDto as GeneratedNoteDto } from '../../../core/api/api.service';

describe('NotesService', () => {
  let service: NotesService;
  let apiClientSpy: {
    notes_GetNotes: ReturnType<typeof vi.fn>;
    notes_CreateNote: ReturnType<typeof vi.fn>;
    notes_DeleteNote: ReturnType<typeof vi.fn>;
    notes_UpdateNote: ReturnType<typeof vi.fn>;
  };

  // Generated DTO uses Date objects
  const mockGeneratedNote: GeneratedNoteDto = {
    id: 'note-1',
    entityType: 'WorkOrder',
    entityId: 'wo-1',
    content: 'Called vendor, they will arrive tomorrow.',
    createdByUserId: 'user-1',
    createdByUserName: 'Dave',
    createdAt: new Date('2026-01-29T14:30:00Z'),
    updatedAt: new Date('2026-01-29T14:30:00Z')
  };

  const mockGetNotesResult: GetNotesResult = {
    items: [mockGeneratedNote],
    totalCount: 1
  };

  beforeEach(() => {
    apiClientSpy = {
      notes_GetNotes: vi.fn(),
      notes_CreateNote: vi.fn(),
      notes_DeleteNote: vi.fn(),
      notes_UpdateNote: vi.fn()
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        NotesService,
        { provide: ApiClient, useValue: apiClientSpy }
      ]
    });
    service = TestBed.inject(NotesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getNotes', () => {
    it('should get notes for entity', () => {
      apiClientSpy.notes_GetNotes.mockReturnValue(of(mockGetNotesResult));

      service.getNotes('WorkOrder', 'wo-1').subscribe(response => {
        expect(response.items).toHaveLength(1);
        expect(response.items[0].content).toBe('Called vendor, they will arrive tomorrow.');
        expect(response.totalCount).toBe(1);
      });

      expect(apiClientSpy.notes_GetNotes).toHaveBeenCalledWith('WorkOrder', 'wo-1');
    });

    it('should handle empty notes response', () => {
      const emptyResult: GetNotesResult = { items: [], totalCount: 0 };
      apiClientSpy.notes_GetNotes.mockReturnValue(of(emptyResult));

      service.getNotes('WorkOrder', 'wo-empty').subscribe(response => {
        expect(response.items).toHaveLength(0);
        expect(response.totalCount).toBe(0);
      });
    });

    it('should handle multiple notes sorted by API (newest first)', () => {
      const multipleNotes: GetNotesResult = {
        items: [
          { ...mockGeneratedNote, id: 'note-2', createdAt: new Date('2026-01-30T10:00:00Z'), updatedAt: new Date('2026-01-30T10:00:00Z'), content: 'Newer note' },
          { ...mockGeneratedNote, id: 'note-1', createdAt: new Date('2026-01-29T14:30:00Z'), updatedAt: new Date('2026-01-29T14:30:00Z'), content: 'Older note' }
        ],
        totalCount: 2
      };
      apiClientSpy.notes_GetNotes.mockReturnValue(of(multipleNotes));

      service.getNotes('WorkOrder', 'wo-1').subscribe(response => {
        expect(response.items).toHaveLength(2);
        expect(response.items[0].content).toBe('Newer note');
        expect(response.items[1].content).toBe('Older note');
      });
    });

    it('should convert Date objects to ISO strings', () => {
      apiClientSpy.notes_GetNotes.mockReturnValue(of(mockGetNotesResult));

      service.getNotes('WorkOrder', 'wo-1').subscribe(response => {
        expect(response.items[0].createdAt).toBe('2026-01-29T14:30:00.000Z');
        expect(response.items[0].updatedAt).toBe('2026-01-29T14:30:00.000Z');
      });
    });
  });

  describe('createNote', () => {
    it('should create a note', () => {
      const request: CreateNoteRequest = {
        entityType: 'WorkOrder',
        entityId: 'wo-1',
        content: 'New note content'
      };
      const mockResponse: CreateNoteResponse = { id: 'new-note-id' };
      apiClientSpy.notes_CreateNote.mockReturnValue(of(mockResponse));

      service.createNote(request).subscribe(response => {
        expect(response.id).toBe('new-note-id');
      });

      expect(apiClientSpy.notes_CreateNote).toHaveBeenCalledWith({
        entityType: 'WorkOrder',
        entityId: 'wo-1',
        content: 'New note content'
      });
    });

    it('should send correct request body with entityType and entityId', () => {
      const request: CreateNoteRequest = {
        entityType: 'WorkOrder',
        entityId: 'wo-specific',
        content: 'Test note'
      };
      apiClientSpy.notes_CreateNote.mockReturnValue(of({ id: 'created-id' }));

      service.createNote(request).subscribe();

      expect(apiClientSpy.notes_CreateNote).toHaveBeenCalledWith({
        entityType: 'WorkOrder',
        entityId: 'wo-specific',
        content: 'Test note'
      });
    });
  });

  describe('deleteNote', () => {
    it('should delete a note successfully', () => {
      let completed = false;
      apiClientSpy.notes_DeleteNote.mockReturnValue(of(void 0));

      service.deleteNote('note-1').subscribe({
        next: () => {
          completed = true;
        }
      });

      expect(completed).toBe(true);
      expect(apiClientSpy.notes_DeleteNote).toHaveBeenCalledWith('note-1');
    });

    it('should handle 404 error when note not found', () => {
      let errorOccurred = false;
      const error = { status: 404, message: 'Not Found' };
      apiClientSpy.notes_DeleteNote.mockReturnValue(throwError(() => error));

      service.deleteNote('non-existent').subscribe({
        error: (err) => {
          errorOccurred = true;
          expect(err.status).toBe(404);
        }
      });

      expect(errorOccurred).toBe(true);
    });

    it('should handle server errors gracefully', () => {
      let errorOccurred = false;
      const error = { status: 500, message: 'Server Error' };
      apiClientSpy.notes_DeleteNote.mockReturnValue(throwError(() => error));

      service.deleteNote('note-1').subscribe({
        error: (err) => {
          errorOccurred = true;
          expect(err.status).toBe(500);
        }
      });

      expect(errorOccurred).toBe(true);
    });
  });

  describe('updateNote', () => {
    it('should update a note successfully', () => {
      let completed = false;
      apiClientSpy.notes_UpdateNote.mockReturnValue(of(void 0));

      service.updateNote('note-1', 'Updated content').subscribe({
        next: () => {
          completed = true;
        }
      });

      expect(completed).toBe(true);
      expect(apiClientSpy.notes_UpdateNote).toHaveBeenCalledWith('note-1', { content: 'Updated content' });
    });

    it('should handle 404 error when note not found', () => {
      let errorOccurred = false;
      const error = { status: 404, message: 'Not Found' };
      apiClientSpy.notes_UpdateNote.mockReturnValue(throwError(() => error));

      service.updateNote('non-existent', 'Updated content').subscribe({
        error: (err) => {
          errorOccurred = true;
          expect(err.status).toBe(404);
        }
      });

      expect(errorOccurred).toBe(true);
    });

    it('should handle server errors gracefully', () => {
      let errorOccurred = false;
      const error = { status: 500, message: 'Server Error' };
      apiClientSpy.notes_UpdateNote.mockReturnValue(throwError(() => error));

      service.updateNote('note-1', 'Updated content').subscribe({
        error: (err) => {
          errorOccurred = true;
          expect(err.status).toBe(500);
        }
      });

      expect(errorOccurred).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully for getNotes', () => {
      let errorOccurred = false;
      const error = { status: 500, message: 'Server Error' };
      apiClientSpy.notes_GetNotes.mockReturnValue(throwError(() => error));

      service.getNotes('WorkOrder', 'wo-1').subscribe({
        error: (err) => {
          errorOccurred = true;
          expect(err.status).toBe(500);
        }
      });

      expect(errorOccurred).toBe(true);
    });

    it('should handle API errors gracefully for createNote', () => {
      const request: CreateNoteRequest = {
        entityType: 'WorkOrder',
        entityId: 'wo-1',
        content: 'Note'
      };
      let errorOccurred = false;
      const error = { status: 400, message: 'Bad Request' };
      apiClientSpy.notes_CreateNote.mockReturnValue(throwError(() => error));

      service.createNote(request).subscribe({
        error: (err) => {
          errorOccurred = true;
          expect(err.status).toBe(400);
        }
      });

      expect(errorOccurred).toBe(true);
    });

    it('should handle 404 for non-existent entity', () => {
      let errorOccurred = false;
      const error = { status: 404, message: 'Not Found' };
      apiClientSpy.notes_GetNotes.mockReturnValue(throwError(() => error));

      service.getNotes('WorkOrder', 'non-existent').subscribe({
        error: (err) => {
          errorOccurred = true;
          expect(err.status).toBe(404);
        }
      });

      expect(errorOccurred).toBe(true);
    });
  });
});
