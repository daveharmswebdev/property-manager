import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { NotesService, NoteDto } from '../../services/notes.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * WorkOrderNotesComponent (Story 10-2, 10-3, 10-3a)
 *
 * Displays and manages notes for a work order.
 *
 * Features:
 * - Display list of existing notes (AC #1, #2)
 * - Empty state when no notes (AC #3)
 * - Add new note form (AC #4)
 * - Validation - empty note disabled (AC #5)
 * - Long content display (AC #6)
 * - Real-time update after add (AC #7)
 * - Delete notes with confirmation (Story 10-3)
 * - Edit notes inline (Story 10-3a)
 * - Edited annotation display (Story 10-3a AC #4)
 */
@Component({
  selector: 'app-work-order-notes',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="notes-section">
      <!-- Add Note Form (AC #1, #4, #5) -->
      <div class="add-note-form">
        <mat-form-field appearance="outline" class="note-input">
          <mat-label>Add a note</mat-label>
          <textarea
            matInput
            [formControl]="noteContent"
            placeholder="Enter your note..."
            rows="2"
          ></textarea>
        </mat-form-field>
        <button
          mat-raised-button
          color="primary"
          type="submit"
          class="add-note-button"
          [disabled]="noteContent.invalid || isSubmitting()"
          (click)="addNote()"
        >
          <mat-icon>add</mat-icon>
          Add Note
        </button>
      </div>

      <!-- Loading State -->
      @if (isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="32"></mat-spinner>
        </div>
      }

      <!-- Notes List (AC #2) -->
      @if (!isLoading() && notes().length > 0) {
        <div class="notes-list">
          @for (note of notes(); track note.id) {
            <div class="note-item">
              <div class="note-header">
                <div class="note-meta">
                  <span class="note-author">{{ note.createdByUserName }}</span>
                  <span class="note-timestamp">
                    {{ note.createdAt | date:'MMM d, y' }} at {{ note.createdAt | date:'h:mm a' }}
                  </span>
                  @if (isEdited(note)) {
                    <span class="edited-annotation">
                      • <em>(edited {{ formatEditTime(note) }})</em>
                    </span>
                  }
                </div>
                <div class="note-actions">
                  <!-- Edit Button (Story 10-3a AC #1) -->
                  @if (editingNoteId() !== note.id) {
                    <button
                      mat-icon-button
                      class="edit-note-button"
                      (click)="startEdit(note)"
                      aria-label="Edit note"
                    >
                      <mat-icon>edit</mat-icon>
                    </button>
                  }
                  <!-- Delete Button -->
                  <button
                    mat-icon-button
                    class="delete-note-button"
                    color="warn"
                    (click)="confirmDelete(note)"
                    [disabled]="deletingNoteId() === note.id"
                    aria-label="Delete note"
                  >
                    @if (deletingNoteId() === note.id) {
                      <mat-spinner diameter="20"></mat-spinner>
                    } @else {
                      <mat-icon>delete</mat-icon>
                    }
                  </button>
                </div>
              </div>
              <!-- Edit Mode (Story 10-3a AC #2) -->
              @if (editingNoteId() === note.id) {
                <div class="edit-mode">
                  <textarea
                    class="edit-textarea"
                    [value]="editContent()"
                    (input)="editContent.set($any($event.target).value)"
                    rows="3"
                  ></textarea>
                  <div class="edit-actions">
                    <button
                      mat-button
                      class="cancel-edit-button"
                      (click)="cancelEdit()"
                    >
                      Cancel
                    </button>
                    <button
                      mat-raised-button
                      color="primary"
                      class="save-edit-button"
                      [disabled]="!editContent().trim()"
                      (click)="saveEdit(note.id)"
                    >
                      Save
                    </button>
                  </div>
                </div>
              } @else {
                <div class="note-content">{{ note.content }}</div>
              }
            </div>
          }
        </div>
      }

      <!-- Empty State (AC #3) -->
      @if (!isLoading() && notes().length === 0) {
        <div class="empty-state no-notes">
          <mat-icon class="empty-icon">notes</mat-icon>
          <p>No notes yet</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .notes-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .add-note-form {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .note-input {
      flex: 1;
    }

    .add-note-button {
      margin-top: 8px;
      white-space: nowrap;
    }

    .add-note-button mat-icon {
      margin-right: 4px;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 24px;
    }

    .notes-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .note-item {
      padding: 12px 16px;
      background: var(--mat-sys-surface-container-low);
      border-radius: 8px;
      border-left: 3px solid var(--mat-sys-primary);
    }

    .note-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .note-meta {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .note-author {
      font-weight: 500;
      color: var(--mat-sys-on-surface);
    }

    .note-timestamp {
      color: var(--mat-sys-outline);
    }

    .note-actions {
      display: flex;
      gap: 4px;
    }

    .edit-note-button,
    .delete-note-button {
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .note-item:hover .edit-note-button,
    .note-item:hover .delete-note-button {
      opacity: 1;
    }

    .edited-annotation {
      color: var(--mat-sys-outline);
      font-size: 12px;
    }

    .edited-annotation em {
      font-style: italic;
    }

    .edit-mode {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .edit-textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 4px;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.5;
      resize: vertical;
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
    }

    .edit-textarea:focus {
      outline: none;
      border-color: var(--mat-sys-primary);
    }

    .edit-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .note-content {
      white-space: pre-wrap;
      line-height: 1.5;
      color: var(--mat-sys-on-surface);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
      text-align: center;
      color: var(--mat-sys-outline);
    }

    .empty-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      margin-bottom: 8px;
      opacity: 0.5;
    }

    .empty-state p {
      margin: 0;
      font-size: 14px;
      font-style: italic;
    }

    /* Responsive */
    @media (max-width: 600px) {
      .add-note-form {
        flex-direction: column;
      }

      .add-note-button {
        width: 100%;
        margin-top: 0;
      }

      .note-header {
        flex-direction: row;
        flex-wrap: wrap;
      }

      .note-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }

      /* Always show action buttons on mobile (no hover) */
      .edit-note-button,
      .delete-note-button {
        opacity: 1;
      }
    }
  `]
})
export class WorkOrderNotesComponent implements OnInit {
  @Input({ required: true }) workOrderId!: string;

  private readonly destroyRef = inject(DestroyRef);
  private readonly notesService = inject(NotesService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  notes = signal<NoteDto[]>([]);
  isLoading = signal(true);
  isSubmitting = signal(false);
  deletingNoteId = signal<string | null>(null);

  // Edit state (Story 10-3a)
  editingNoteId = signal<string | null>(null);
  editContent = signal('');

  noteContent = new FormControl('', Validators.required);

  ngOnInit(): void {
    this.loadNotes(true);
  }

  /**
   * Load notes from API (AC #2)
   * @param showSpinner Whether to show loading spinner (true for initial load, false for refresh)
   */
  loadNotes(showSpinner = false): void {
    if (showSpinner) {
      this.isLoading.set(true);
    }
    this.notesService.getNotes('WorkOrder', this.workOrderId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.notes.set(response.items);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('Failed to load notes', 'Close', { duration: 3000 });
      }
    });
  }

  /**
   * Add a new note (AC #4, #7)
   */
  addNote(): void {
    if (this.noteContent.invalid) return;

    this.isSubmitting.set(true);
    this.notesService.createNote({
      entityType: 'WorkOrder',
      entityId: this.workOrderId,
      content: this.noteContent.value!.trim()
    }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.loadNotes(); // Reload to get updated list with new note at top
        this.noteContent.setValue('');
        this.isSubmitting.set(false);
        this.snackBar.open('Note added', 'Close', { duration: 3000 });
      },
      error: () => {
        this.isSubmitting.set(false);
        this.snackBar.open('Failed to add note', 'Close', { duration: 3000 });
      }
    });
  }

  /**
   * Open confirmation dialog for delete (Story 10-3, AC #2)
   */
  confirmDelete(note: NoteDto): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete this note?',
        message: 'This action cannot be undone.',
        confirmText: 'Delete',
        icon: 'warning',
        iconColor: 'warn',
        confirmIcon: 'delete'
      },
      width: '400px',
      disableClose: true
    });

    dialogRef.afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(confirmed => {
      if (confirmed) {
        this.deleteNote(note.id);
      }
    });
  }

  /**
   * Delete a note (Story 10-3, AC #3, #5)
   */
  private deleteNote(noteId: string): void {
    this.deletingNoteId.set(noteId);
    this.notesService.deleteNote(noteId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.notes.update(notes => notes.filter(n => n.id !== noteId));
        this.deletingNoteId.set(null);
        this.snackBar.open('Note deleted', 'Close', { duration: 3000 });
      },
      error: () => {
        this.deletingNoteId.set(null);
        this.snackBar.open('Failed to delete note', 'Close', { duration: 3000 });
      }
    });
  }

  // ===== Edit Note Methods (Story 10-3a) =====

  /**
   * Enter edit mode for a note (AC #2)
   */
  startEdit(note: NoteDto): void {
    this.editingNoteId.set(note.id);
    this.editContent.set(note.content);
  }

  /**
   * Cancel edit mode (AC #5)
   */
  cancelEdit(): void {
    this.editingNoteId.set(null);
    this.editContent.set('');
  }

  /**
   * Save edited note (AC #3, #6, #7)
   */
  saveEdit(noteId: string): void {
    const content = this.editContent().trim();
    if (!content) return; // AC #6 - empty validation

    this.notesService.updateNote(noteId, content).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        // Update note in local list with new content and updatedAt
        this.notes.update(notes => notes.map(n =>
          n.id === noteId
            ? { ...n, content, updatedAt: new Date().toISOString() }
            : n
        ));
        this.editingNoteId.set(null);
        this.editContent.set('');
        this.snackBar.open('Note updated', 'Close', { duration: 3000 });
      },
      error: () => {
        // AC #7 - remain in edit mode on failure
        this.snackBar.open('Failed to update note', 'Close', { duration: 3000 });
      }
    });
  }

  /**
   * Check if note has been edited (AC #4)
   */
  isEdited(note: NoteDto): boolean {
    return new Date(note.updatedAt) > new Date(note.createdAt);
  }

  /**
   * Format edit timestamp for display (AC #4)
   * - Same day: just show time (e.g., "3:15 PM")
   * - Different day: show full date and time
   */
  formatEditTime(note: NoteDto): string {
    const created = new Date(note.createdAt);
    const updated = new Date(note.updatedAt);

    // Same day: just show time
    if (this.isSameDay(created, updated)) {
      return updated.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    }

    // Different day: show full date and time
    return updated.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.toDateString() === d2.toDateString();
  }
}
