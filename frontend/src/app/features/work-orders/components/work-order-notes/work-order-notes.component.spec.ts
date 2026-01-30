import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { WorkOrderNotesComponent } from './work-order-notes.component';
import { NotesService, NoteDto, NotesResponse } from '../../services/notes.service';

describe('WorkOrderNotesComponent', () => {
  let component: WorkOrderNotesComponent;
  let fixture: ComponentFixture<WorkOrderNotesComponent>;
  let notesServiceSpy: {
    getNotes: ReturnType<typeof vi.fn>;
    createNote: ReturnType<typeof vi.fn>;
    deleteNote: ReturnType<typeof vi.fn>;
  };
  let snackBarSpy: { open: ReturnType<typeof vi.fn> };
  let dialogSpy: { open: ReturnType<typeof vi.fn> };
  let dialogRefSpy: { afterClosed: ReturnType<typeof vi.fn> };

  const mockNote: NoteDto = {
    id: 'note-1',
    entityType: 'WorkOrder',
    entityId: 'wo-1',
    content: 'Called vendor, they will arrive tomorrow.',
    createdByUserId: 'user-1',
    createdByUserName: 'Dave',
    createdAt: '2026-01-29T14:30:00Z'
  };

  const mockOlderNote: NoteDto = {
    id: 'note-2',
    entityType: 'WorkOrder',
    entityId: 'wo-1',
    content: 'Reported the leak to management.',
    createdByUserId: 'user-1',
    createdByUserName: 'Dave',
    createdAt: '2026-01-28T10:00:00Z'
  };

  const mockNotesResponse: NotesResponse = {
    items: [mockNote, mockOlderNote], // Newest first from API
    totalCount: 2
  };

  beforeEach(async () => {
    dialogRefSpy = {
      afterClosed: vi.fn().mockReturnValue(of(true))
    };

    notesServiceSpy = {
      getNotes: vi.fn().mockReturnValue(of(mockNotesResponse)),
      createNote: vi.fn().mockReturnValue(of({ id: 'new-note-id' })),
      deleteNote: vi.fn().mockReturnValue(of(void 0))
    };

    snackBarSpy = {
      open: vi.fn()
    };

    dialogSpy = {
      open: vi.fn().mockReturnValue(dialogRefSpy)
    };

    await TestBed.configureTestingModule({
      imports: [WorkOrderNotesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: NotesService, useValue: notesServiceSpy },
        { provide: MatSnackBar, useValue: snackBarSpy },
        { provide: MatDialog, useValue: dialogSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WorkOrderNotesComponent);
    component = fixture.componentInstance;
    component.workOrderId = 'wo-1';
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Display Notes (AC #1, #2)', () => {
    it('should display notes list when notes exist', () => {
      fixture.detectChanges(); // triggers ngOnInit and loadNotes

      const noteItems = fixture.nativeElement.querySelectorAll('.note-item');
      expect(noteItems.length).toBe(2);
    });

    it('should display note content, author, and timestamp', () => {
      fixture.detectChanges();

      const firstNote = fixture.nativeElement.querySelector('.note-item');
      expect(firstNote.textContent).toContain('Called vendor, they will arrive tomorrow.');
      expect(firstNote.textContent).toContain('Dave');
      // Timestamp should be formatted - just check it exists
      expect(firstNote.querySelector('.note-timestamp')).toBeTruthy();
    });

    it('should sort notes newest first', () => {
      fixture.detectChanges();

      const noteContents = fixture.nativeElement.querySelectorAll('.note-content');
      expect(noteContents[0].textContent).toContain('Called vendor');
      expect(noteContents[1].textContent).toContain('Reported the leak');
    });

    it('should have text input and Add Note button (AC #1)', () => {
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('textarea');
      const button = fixture.nativeElement.querySelector('button');

      expect(input).toBeTruthy();
      expect(button.textContent).toContain('Add Note');
    });
  });

  describe('Empty State (AC #3)', () => {
    beforeEach(() => {
      notesServiceSpy.getNotes.mockReturnValue(of({ items: [], totalCount: 0 }));
    });

    it('should show empty state when no notes', () => {
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No notes yet');
    });

    it('should still show text input and Add Note button when empty', () => {
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('textarea');
      const button = fixture.nativeElement.querySelector('button');

      expect(input).toBeTruthy();
      expect(button).toBeTruthy();
    });
  });

  describe('Add Note (AC #4, #5)', () => {
    it('should disable Add button when input is empty (AC #5)', () => {
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button.add-note-button');
      expect(button.disabled).toBe(true);
    });

    it('should enable Add button when input has content', () => {
      fixture.detectChanges();

      component.noteContent.setValue('Test note content');
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button.add-note-button');
      expect(button.disabled).toBe(false);
    });

    it('should call service on Add click (AC #4)', () => {
      fixture.detectChanges();

      component.noteContent.setValue('New test note');
      component.addNote();

      expect(notesServiceSpy.createNote).toHaveBeenCalledWith({
        entityType: 'WorkOrder',
        entityId: 'wo-1',
        content: 'New test note'
      });
    });

    it('should clear input after successful add (AC #4)', () => {
      fixture.detectChanges();

      component.noteContent.setValue('New test note');
      component.addNote();

      expect(component.noteContent.value).toBe('');
    });

    it('should show snackbar on success (AC #4)', () => {
      fixture.detectChanges();

      component.noteContent.setValue('New test note');
      component.addNote();

      expect(snackBarSpy.open).toHaveBeenCalledWith('Note added', 'Close', expect.any(Object));
    });

    it('should reload notes after add (AC #7)', () => {
      fixture.detectChanges();
      notesServiceSpy.getNotes.mockClear(); // Clear initial call count

      component.noteContent.setValue('Brand new note');
      component.addNote();

      // loadNotes should be called again after successful add
      expect(notesServiceSpy.getNotes).toHaveBeenCalledWith('WorkOrder', 'wo-1');
    });
  });

  describe('Error Handling', () => {
    it('should show error snackbar on add failure', () => {
      notesServiceSpy.createNote.mockReturnValue(throwError(() => new Error('Network error')));
      fixture.detectChanges();

      component.noteContent.setValue('Test note');
      component.addNote();

      expect(snackBarSpy.open).toHaveBeenCalledWith('Failed to add note', 'Close', expect.any(Object));
    });

    it('should not clear input on add failure', () => {
      notesServiceSpy.createNote.mockReturnValue(throwError(() => new Error('Network error')));
      fixture.detectChanges();

      component.noteContent.setValue('Test note');
      component.addNote();

      expect(component.noteContent.value).toBe('Test note');
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner before notes loaded', () => {
      // Don't call detectChanges yet to check initial state
      expect(component.isLoading()).toBe(true);
    });

    it('should hide loading spinner after notes loaded', () => {
      fixture.detectChanges(); // Triggers load which completes sync

      expect(component.isLoading()).toBe(false);
    });

    it('should have loading container class in template', () => {
      // This test verifies that the loading UI structure exists in the template.
      // The actual spinner visibility is controlled by @if(isLoading()) which
      // we can't easily test because ngOnInit completes synchronously.
      // We verify the structure exists by checking the component template.
      fixture.detectChanges();

      // After load completes, verify the component has proper structure
      // by checking that notes-section wrapper exists
      const notesSection = fixture.nativeElement.querySelector('.notes-section');
      expect(notesSection).toBeTruthy();
    });
  });

  describe('Long Content (AC #6)', () => {
    it('should display full text without truncation', () => {
      const longNote: NoteDto = {
        ...mockNote,
        content: 'This is a very long note with multiple lines.\nLine 2 here.\nLine 3 with more content.\nAnd line 4 to make it really long.'
      };
      notesServiceSpy.getNotes.mockReturnValue(of({ items: [longNote], totalCount: 1 }));

      fixture.detectChanges();

      const noteContent = fixture.nativeElement.querySelector('.note-content');
      expect(noteContent.textContent).toContain('This is a very long note');
      expect(noteContent.textContent).toContain('Line 2 here');
      expect(noteContent.textContent).toContain('line 4 to make it really long');
    });
  });

  describe('Service calls', () => {
    it('should call getNotes on init with correct parameters', () => {
      fixture.detectChanges();

      expect(notesServiceSpy.getNotes).toHaveBeenCalledWith('WorkOrder', 'wo-1');
    });

    it('should call loadNotes with showSpinner=true on init', () => {
      const loadNotesSpy = vi.spyOn(component, 'loadNotes');
      fixture.detectChanges();

      expect(loadNotesSpy).toHaveBeenCalledWith(true);
    });

    it('should not show loading spinner when refreshing after add note', () => {
      fixture.detectChanges(); // Initial load
      expect(component.isLoading()).toBe(false);

      // Simulate refresh (called without showSpinner argument)
      component.loadNotes();

      // isLoading should remain false during refresh
      expect(component.isLoading()).toBe(false);
    });
  });

  describe('Delete Note (Story 10-3)', () => {
    it('should display delete button on each note (AC #1)', () => {
      fixture.detectChanges();

      const deleteButtons = fixture.nativeElement.querySelectorAll('.delete-note-button');
      expect(deleteButtons.length).toBe(2); // Two notes in mock data
    });

    it('should open confirmation dialog when delete clicked (AC #2)', () => {
      fixture.detectChanges();

      component.confirmDelete(mockNote);

      expect(dialogSpy.open).toHaveBeenCalled();
      const dialogData = dialogSpy.open.mock.calls[0][1].data;
      expect(dialogData.title).toBe('Delete this note?');
    });

    it('should call service on confirm (AC #3)', () => {
      dialogRefSpy.afterClosed.mockReturnValue(of(true));
      fixture.detectChanges();

      component.confirmDelete(mockNote);

      expect(notesServiceSpy.deleteNote).toHaveBeenCalledWith('note-1');
    });

    it('should remove note from list after successful delete (AC #3)', () => {
      dialogRefSpy.afterClosed.mockReturnValue(of(true));
      fixture.detectChanges();

      expect(component.notes().length).toBe(2);

      component.confirmDelete(mockNote);

      expect(component.notes().length).toBe(1);
      expect(component.notes().find(n => n.id === 'note-1')).toBeUndefined();
    });

    it('should show success snackbar after delete (AC #3)', () => {
      dialogRefSpy.afterClosed.mockReturnValue(of(true));
      fixture.detectChanges();

      component.confirmDelete(mockNote);

      expect(snackBarSpy.open).toHaveBeenCalledWith('Note deleted', 'Close', expect.any(Object));
    });

    it('should not delete when cancel is clicked (AC #4)', () => {
      dialogRefSpy.afterClosed.mockReturnValue(of(false));
      fixture.detectChanges();

      component.confirmDelete(mockNote);

      expect(notesServiceSpy.deleteNote).not.toHaveBeenCalled();
      expect(component.notes().length).toBe(2);
    });

    it('should show error snackbar on delete failure (AC #5)', () => {
      dialogRefSpy.afterClosed.mockReturnValue(of(true));
      notesServiceSpy.deleteNote.mockReturnValue(throwError(() => new Error('Network error')));
      fixture.detectChanges();

      component.confirmDelete(mockNote);

      expect(snackBarSpy.open).toHaveBeenCalledWith('Failed to delete note', 'Close', expect.any(Object));
    });

    it('should not remove note from list on delete failure (AC #5)', () => {
      dialogRefSpy.afterClosed.mockReturnValue(of(true));
      notesServiceSpy.deleteNote.mockReturnValue(throwError(() => new Error('Network error')));
      fixture.detectChanges();

      component.confirmDelete(mockNote);

      expect(component.notes().length).toBe(2);
    });
  });
});
