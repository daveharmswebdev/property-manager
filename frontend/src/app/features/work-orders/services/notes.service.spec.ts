import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NotesService, NoteDto, NotesResponse, CreateNoteRequest } from './notes.service';

describe('NotesService', () => {
  let service: NotesService;
  let httpMock: HttpTestingController;

  const mockNote: NoteDto = {
    id: 'note-1',
    entityType: 'WorkOrder',
    entityId: 'wo-1',
    content: 'Called vendor, they will arrive tomorrow.',
    createdByUserId: 'user-1',
    createdByUserName: 'Dave',
    createdAt: '2026-01-29T14:30:00Z'
  };

  const mockNotesResponse: NotesResponse = {
    items: [mockNote],
    totalCount: 1
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        NotesService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(NotesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getNotes', () => {
    it('should get notes for entity', () => {
      service.getNotes('WorkOrder', 'wo-1').subscribe(response => {
        expect(response.items).toHaveLength(1);
        expect(response.items[0].content).toBe('Called vendor, they will arrive tomorrow.');
        expect(response.totalCount).toBe(1);
      });

      const req = httpMock.expectOne(r =>
        r.url === '/api/v1/notes' &&
        r.params.get('entityType') === 'WorkOrder' &&
        r.params.get('entityId') === 'wo-1'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockNotesResponse);
    });

    it('should handle empty notes response', () => {
      const emptyResponse: NotesResponse = { items: [], totalCount: 0 };

      service.getNotes('WorkOrder', 'wo-empty').subscribe(response => {
        expect(response.items).toHaveLength(0);
        expect(response.totalCount).toBe(0);
      });

      const req = httpMock.expectOne(r => r.url === '/api/v1/notes');
      req.flush(emptyResponse);
    });

    it('should handle multiple notes sorted by API (newest first)', () => {
      const multipleNotes: NotesResponse = {
        items: [
          { ...mockNote, id: 'note-2', createdAt: '2026-01-30T10:00:00Z', content: 'Newer note' },
          { ...mockNote, id: 'note-1', createdAt: '2026-01-29T14:30:00Z', content: 'Older note' }
        ],
        totalCount: 2
      };

      service.getNotes('WorkOrder', 'wo-1').subscribe(response => {
        expect(response.items).toHaveLength(2);
        expect(response.items[0].content).toBe('Newer note');
        expect(response.items[1].content).toBe('Older note');
      });

      const req = httpMock.expectOne(r => r.url === '/api/v1/notes');
      req.flush(multipleNotes);
    });
  });

  describe('createNote', () => {
    it('should create a note', () => {
      const request: CreateNoteRequest = {
        entityType: 'WorkOrder',
        entityId: 'wo-1',
        content: 'New note content'
      };
      const mockResponse = { id: 'new-note-id' };

      service.createNote(request).subscribe(response => {
        expect(response.id).toBe('new-note-id');
      });

      const req = httpMock.expectOne('/api/v1/notes');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);
    });

    it('should send correct request body with entityType and entityId', () => {
      const request: CreateNoteRequest = {
        entityType: 'WorkOrder',
        entityId: 'wo-specific',
        content: 'Test note'
      };

      service.createNote(request).subscribe();

      const req = httpMock.expectOne('/api/v1/notes');
      expect(req.request.body.entityType).toBe('WorkOrder');
      expect(req.request.body.entityId).toBe('wo-specific');
      expect(req.request.body.content).toBe('Test note');
      req.flush({ id: 'created-id' });
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully for getNotes', () => {
      let errorOccurred = false;

      service.getNotes('WorkOrder', 'wo-1').subscribe({
        error: (error) => {
          errorOccurred = true;
          expect(error.status).toBe(500);
        }
      });

      const req = httpMock.expectOne(r => r.url === '/api/v1/notes');
      req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

      expect(errorOccurred).toBe(true);
    });

    it('should handle API errors gracefully for createNote', () => {
      const request: CreateNoteRequest = {
        entityType: 'WorkOrder',
        entityId: 'wo-1',
        content: 'Note'
      };
      let errorOccurred = false;

      service.createNote(request).subscribe({
        error: (error) => {
          errorOccurred = true;
          expect(error.status).toBe(400);
        }
      });

      const req = httpMock.expectOne('/api/v1/notes');
      req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });

      expect(errorOccurred).toBe(true);
    });

    it('should handle 404 for non-existent entity', () => {
      let errorOccurred = false;

      service.getNotes('WorkOrder', 'non-existent').subscribe({
        error: (error) => {
          errorOccurred = true;
          expect(error.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(r => r.url === '/api/v1/notes');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      expect(errorOccurred).toBe(true);
    });
  });
});
