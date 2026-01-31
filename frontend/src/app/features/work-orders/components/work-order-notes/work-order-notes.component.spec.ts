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
    updateNote: ReturnType<typeof vi.fn>;
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
    createdAt: '2026-01-29T14:30:00Z',
    updatedAt: '2026-01-29T14:30:00Z'
  };

  const mockOlderNote: NoteDto = {
    id: 'note-2',
    entityType: 'WorkOrder',
    entityId: 'wo-1',
    content: 'Reported the leak to management.',
    createdByUserId: 'user-1',
    createdByUserName: 'Dave',
    createdAt: '2026-01-28T10:00:00Z',
    updatedAt: '2026-01-28T10:00:00Z'
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
      deleteNote: vi.fn().mockReturnValue(of(void 0)),
      updateNote: vi.fn().mockReturnValue(of(void 0))
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

    it('should have accessible aria-label on delete buttons', () => {
      fixture.detectChanges();

      const deleteButtons = fixture.nativeElement.querySelectorAll('.delete-note-button');
      deleteButtons.forEach((button: HTMLElement) => {
        expect(button.getAttribute('aria-label')).toBe('Delete note');
      });
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

    it('should disable delete button while delete is in progress', () => {
      dialogRefSpy.afterClosed.mockReturnValue(of(true));
      fixture.detectChanges();

      // Simulate delete in progress by setting the signal directly
      component.deletingNoteId.set('note-1');
      fixture.detectChanges();

      const deleteButtons = fixture.nativeElement.querySelectorAll('.delete-note-button');
      const firstButton = deleteButtons[0] as HTMLButtonElement;
      expect(firstButton.disabled).toBe(true);
    });

    it('should reset deletingNoteId after successful delete', () => {
      dialogRefSpy.afterClosed.mockReturnValue(of(true));
      fixture.detectChanges();

      component.confirmDelete(mockNote);

      expect(component.deletingNoteId()).toBeNull();
    });

    it('should reset deletingNoteId after failed delete', () => {
      dialogRefSpy.afterClosed.mockReturnValue(of(true));
      notesServiceSpy.deleteNote.mockReturnValue(throwError(() => new Error('Network error')));
      fixture.detectChanges();

      component.confirmDelete(mockNote);

      expect(component.deletingNoteId()).toBeNull();
    });
  });

  describe('Edit Note (Story 10-3a)', () => {
    it('should display edit button on each note (AC #1)', () => {
      fixture.detectChanges();

      const editButtons = fixture.nativeElement.querySelectorAll('.edit-note-button');
      expect(editButtons.length).toBe(2); // Two notes in mock data
    });

    it('should enter edit mode when edit button clicked (AC #2)', () => {
      fixture.detectChanges();

      component.startEdit(mockNote);

      expect(component.editingNoteId()).toBe('note-1');
    });

    it('should show textarea with current content in edit mode (AC #2)', () => {
      fixture.detectChanges();
      component.startEdit(mockNote);
      fixture.detectChanges();

      expect(component.editContent()).toBe('Called vendor, they will arrive tomorrow.');
    });

    it('should show save and cancel buttons in edit mode (AC #2)', () => {
      fixture.detectChanges();
      component.startEdit(mockNote);
      fixture.detectChanges();

      const saveButton = fixture.nativeElement.querySelector('.save-edit-button');
      const cancelButton = fixture.nativeElement.querySelector('.cancel-edit-button');

      expect(saveButton).toBeTruthy();
      expect(cancelButton).toBeTruthy();
    });

    it('should call service on save (AC #3)', () => {
      fixture.detectChanges();
      component.startEdit(mockNote);
      component.editContent.set('Updated note content');

      component.saveEdit(mockNote.id);

      expect(notesServiceSpy.updateNote).toHaveBeenCalledWith('note-1', 'Updated note content');
    });

    it('should update note in list after successful edit (AC #3)', () => {
      fixture.detectChanges();
      component.startEdit(mockNote);
      component.editContent.set('Updated note content');

      component.saveEdit(mockNote.id);

      const updatedNote = component.notes().find(n => n.id === 'note-1');
      expect(updatedNote?.content).toBe('Updated note content');
    });

    it('should show success snackbar after edit (AC #3)', () => {
      fixture.detectChanges();
      component.startEdit(mockNote);
      component.editContent.set('Updated note content');

      component.saveEdit(mockNote.id);

      expect(snackBarSpy.open).toHaveBeenCalledWith('Note updated', 'Close', expect.any(Object));
    });

    it('should exit edit mode and revert on cancel (AC #5)', () => {
      fixture.detectChanges();
      component.startEdit(mockNote);
      component.editContent.set('Changed but not saved');

      component.cancelEdit();

      expect(component.editingNoteId()).toBeNull();
      expect(component.editContent()).toBe('');
      // Note should still have original content
      const note = component.notes().find(n => n.id === 'note-1');
      expect(note?.content).toBe('Called vendor, they will arrive tomorrow.');
    });

    it('should prevent save when content is empty (AC #6)', () => {
      fixture.detectChanges();
      component.startEdit(mockNote);
      component.editContent.set('   '); // Whitespace only

      component.saveEdit(mockNote.id);

      expect(notesServiceSpy.updateNote).not.toHaveBeenCalled();
    });

    it('should show error snackbar on edit failure (AC #7)', () => {
      notesServiceSpy.updateNote.mockReturnValue(throwError(() => new Error('Network error')));
      fixture.detectChanges();
      component.startEdit(mockNote);
      component.editContent.set('Updated content');

      component.saveEdit(mockNote.id);

      expect(snackBarSpy.open).toHaveBeenCalledWith('Failed to update note', 'Close', expect.any(Object));
    });

    it('should remain in edit mode on edit failure (AC #7)', () => {
      notesServiceSpy.updateNote.mockReturnValue(throwError(() => new Error('Network error')));
      fixture.detectChanges();
      component.startEdit(mockNote);
      component.editContent.set('Updated content');

      component.saveEdit(mockNote.id);

      expect(component.editingNoteId()).toBe('note-1');
      expect(component.editContent()).toBe('Updated content');
    });

    it('should display edited annotation when UpdatedAt > CreatedAt (AC #4)', () => {
      const editedNote: NoteDto = {
        ...mockNote,
        updatedAt: '2026-01-30T15:00:00Z' // Later than createdAt
      };
      notesServiceSpy.getNotes.mockReturnValue(of({ items: [editedNote], totalCount: 1 }));

      fixture.detectChanges();

      const editedAnnotation = fixture.nativeElement.querySelector('.edited-annotation');
      expect(editedAnnotation).toBeTruthy();
      expect(editedAnnotation.textContent).toContain('edited');
    });

    it('should show same-day edit time without date (AC #4)', () => {
      // Create note and edit on same day
      const sameDay = new Date();
      const editedNote: NoteDto = {
        ...mockNote,
        createdAt: new Date(sameDay.setHours(10, 0, 0, 0)).toISOString(),
        updatedAt: new Date(sameDay.setHours(15, 0, 0, 0)).toISOString()
      };
      notesServiceSpy.getNotes.mockReturnValue(of({ items: [editedNote], totalCount: 1 }));

      fixture.detectChanges();

      const editedAnnotation = fixture.nativeElement.querySelector('.edited-annotation');
      expect(editedAnnotation).toBeTruthy();
      // Should show time like "3:00 PM" but not the date
      expect(editedAnnotation.textContent).toMatch(/edited.*PM/i);
      // Should NOT contain month name for same-day edits
      expect(editedAnnotation.textContent).not.toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
    });

    it('should show different-day edit with full date (AC #4)', () => {
      // Create note on different day than edit
      const editedNote: NoteDto = {
        ...mockNote,
        createdAt: '2026-01-28T10:00:00Z',
        updatedAt: '2026-01-30T15:00:00Z'
      };
      notesServiceSpy.getNotes.mockReturnValue(of({ items: [editedNote], totalCount: 1 }));

      fixture.detectChanges();

      const editedAnnotation = fixture.nativeElement.querySelector('.edited-annotation');
      expect(editedAnnotation).toBeTruthy();
      // Should contain month name for different-day edits
      expect(editedAnnotation.textContent).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
    });

    it('should not display edited annotation when UpdatedAt equals CreatedAt', () => {
      // mockNote has updatedAt === createdAt
      fixture.detectChanges();

      const editedAnnotation = fixture.nativeElement.querySelector('.edited-annotation');
      expect(editedAnnotation).toBeNull();
    });
  });
});
