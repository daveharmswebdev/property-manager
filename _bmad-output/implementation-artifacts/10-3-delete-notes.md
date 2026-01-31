# Story 10.3: Delete Notes

Status: complete

## Story

As a **property owner**,
I want **to delete notes from a work order**,
So that **I can remove incorrect or outdated information**.

## Acceptance Criteria

### AC #1: Delete Button Visibility

**Given** I am viewing the notes list on a work order detail page
**When** I hover over or view a note
**Then** I see a delete icon/button on that note

### AC #2: Delete Confirmation Dialog

**Given** I click the delete icon on a note
**When** the confirmation dialog appears
**Then** I see:
- Title: "Delete this note?"
- Options: [Cancel] [Delete]

### AC #3: Successful Deletion

**Given** I confirm deletion by clicking "Delete"
**When** the delete completes
**Then** the note is soft-deleted via `DELETE /api/v1/notes/{id}`
**And** I see snackbar "Note deleted"
**And** the note disappears from the notes list immediately

### AC #4: Cancel Deletion

**Given** I click "Cancel" on the confirmation dialog
**When** the dialog closes
**Then** the note remains unchanged in the list

### AC #5: Error Handling

**Given** the delete API call fails
**When** an error occurs
**Then** I see snackbar "Failed to delete note"
**And** the note remains in the list

## Tasks / Subtasks

> **TDD Approach:** This story follows Test-Driven Development (Red-Green-Refactor).
> For each feature: write failing tests first, then implement minimum code to pass.

---

### Phase 1: Backend Verification

#### Task 1: Verify Backend DELETE Endpoint Exists (AC: #3)

- [x] 1.1 Confirm `DELETE /api/v1/notes/{id}` endpoint exists from Story 10-1
- [x] 1.2 Verify endpoint returns 204 No Content on success
- [x] 1.3 Verify endpoint returns 404 if note doesn't exist
- [x] 1.4 Verify soft-delete behavior (sets DeletedAt timestamp)
- [x] 1.5 Manual test with Postman/curl to confirm endpoint works

---

### Phase 2: Frontend Service Layer (TDD)

#### Task 2: RED - Write Failing Notes Service Delete Test (AC: #3, #5)

- [x] 2.1 Add delete tests to `notes.service.spec.ts`:
  ```typescript
  describe('deleteNote', () => {
    it('should delete a note successfully', async () => {
      // DELETE /api/v1/notes/{id} returns 204
    });

    it('should handle 404 error when note not found', async () => {
      // Error handling test
    });

    it('should handle server errors gracefully', async () => {
      // Error handling test
    });
  });
  ```
- [x] 2.2 **Run tests - verify they FAIL** (Red phase)

#### Task 3: GREEN - Implement deleteNote Method (AC: #3)

- [x] 3.1 Add `deleteNote()` method to `notes.service.ts`:
  ```typescript
  deleteNote(noteId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${noteId}`);
  }
  ```
- [x] 3.2 **Run tests - verify they PASS** (Green phase)

---

### Phase 3: Component Delete Functionality (TDD)

#### Task 4: RED - Write Failing Component Delete Tests (AC: #1, #2, #3, #4, #5)

- [x] 4.1 Add delete tests to `work-order-notes.component.spec.ts`:
  ```typescript
  describe('Delete Note', () => {
    it('should display delete button on each note', () => {});
    it('should open confirmation dialog when delete clicked', () => {});
    it('should call service on confirm', () => {});
    it('should remove note from list after successful delete', () => {});
    it('should show success snackbar after delete', () => {});
    it('should not delete when cancel is clicked', () => {});
    it('should show error snackbar on delete failure', () => {});
  });
  ```
- [x] 4.2 **Run tests - verify they FAIL** (Red phase)

#### Task 5: GREEN - Implement Delete Button UI (AC: #1)

- [x] 5.1 Add delete icon button to each note in template:
  ```html
  <button mat-icon-button
          color="warn"
          (click)="confirmDelete(note)"
          aria-label="Delete note">
    <mat-icon>delete</mat-icon>
  </button>
  ```
- [x] 5.2 Style delete button (subtle until hover, align right)

#### Task 6: GREEN - Implement Confirmation Dialog (AC: #2, #4)

- [x] 6.1 Add confirmation dialog using Angular Material Dialog or inline confirmation:
  ```typescript
  confirmDelete(note: NoteDto): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete this note?',
        confirmButton: 'Delete',
        cancelButton: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.deleteNote(note.id);
      }
    });
  }
  ```
- [x] 6.2 **Alternative:** Use inline confirmation pattern if preferred:
  ```typescript
  // Track which note is pending delete
  pendingDeleteId = signal<string | null>(null);

  confirmDelete(noteId: string): void {
    this.pendingDeleteId.set(noteId);
  }

  cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }
  ```

#### Task 7: GREEN - Implement Delete Action (AC: #3, #5)

- [x] 7.1 Implement `deleteNote()` method in component:
  ```typescript
  deleteNote(noteId: string): void {
    this.notesService.deleteNote(noteId).subscribe({
      next: () => {
        // Remove note from local list
        this.notes.update(notes => notes.filter(n => n.id !== noteId));
        this.snackBar.open('Note deleted', 'Close', { duration: 3000 });
      },
      error: (err) => {
        this.snackBar.open('Failed to delete note', 'Close', { duration: 3000 });
      }
    });
  }
  ```
- [x] 7.2 **Run tests - verify they PASS** (Green phase)

---

### Phase 4: UI Polish

#### Task 8: Style Delete Interaction (AC: #1, #2)

- [x] 8.1 Delete button appears on hover (desktop) or always visible (mobile)
- [x] 8.2 Delete button has appropriate color (warn/red)
- [x] 8.3 Confirmation dialog matches Material Design patterns
- [x] 8.4 Loading state while delete is in progress (optional)

---

### Phase 5: Final Verification

#### Task 9: Full Test Suite & Manual Verification

- [x] 9.1 Run full frontend test suite: `npm test`
- [x] 9.2 Manual verification checklist:
  - [x] Delete button visible on notes
  - [x] Clicking delete shows confirmation
  - [x] Confirming deletes the note
  - [x] Note disappears from list
  - [x] Snackbar shows "Note deleted"
  - [x] Cancel keeps note unchanged
  - [x] Error handling works correctly

## Dev Notes

### Architecture Compliance

**Frontend Structure:**
```
frontend/src/app/features/work-orders/
├── components/
│   └── work-order-notes/
│       ├── work-order-notes.component.ts    ← MODIFY (add delete)
│       └── work-order-notes.component.spec.ts  ← MODIFY (add tests)
├── services/
│   ├── notes.service.ts            ← MODIFY (add deleteNote)
│   └── notes.service.spec.ts       ← MODIFY (add tests)
```

**Backend Already Complete (Story 10-1):**
- `DELETE /api/v1/notes/{id}` - Soft-deletes note (sets DeletedAt)
- Returns 204 No Content on success
- Returns 404 Not Found if note doesn't exist

### API Contract (From Story 10-1)

**DELETE /api/v1/notes/{noteId}**
- Success: 204 No Content
- Not Found: 404
- Unauthorized: 401

### Implementation Decisions

1. **Confirmation Pattern:** Use Angular Material Dialog for consistency with other delete operations in the app (properties, expenses, etc.)

2. **Optimistic vs Pessimistic Delete:**
   - Use pessimistic: Wait for API success before removing from list
   - Provides better UX if delete fails

3. **Delete Button Placement:**
   - Right-aligned within note card/row
   - Icon button (trash icon) for compact UI
   - Visible on hover (desktop) or always visible (mobile)

### Existing Patterns to Follow

From Property Delete (Story 2-5):
- Use `ConfirmDialogComponent` from `shared/components/confirm-dialog/`
- Same dialog pattern with title, message, cancel/confirm buttons

From Expense Delete (Story 3-3):
- Inline confirmation pattern if shared dialog doesn't exist
- Snackbar feedback on success/failure

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| FR46 | Users can delete notes from a work order | Full frontend delete implementation |

### Previous Story Intelligence

From Story 10-2 (Add Notes to Work Order):
- NotesService exists at `frontend/src/app/features/work-orders/services/notes.service.ts`
- WorkOrderNotesComponent exists with notes list display
- Service already has `getNotes()` and `createNote()` methods
- Component uses signals for state management
- 29 tests already passing for notes functionality

From Story 10-1 (Polymorphic Notes Entity):
- Backend DELETE endpoint is fully implemented
- Soft-delete pattern (sets DeletedAt timestamp)
- 48 backend tests added and passing

### Git Intelligence

Recent commits:
- `b355966` - feat: add notes to work order detail (Story 10-2) (#131)
- `378c19f` - feat: add polymorphic notes entity (Story 10-1) (#130)

Pattern: Backend complete, frontend needs delete functionality added

### Testing Approach

- Add unit tests for NotesService.deleteNote()
- Add component tests for delete button visibility
- Add component tests for confirmation dialog
- Add component tests for successful delete flow
- Add component tests for error handling

### Project Context Reference

From CLAUDE.md:
- Frontend uses Angular 20+ with @ngrx/signals, Angular Material, Vitest
- Frontend test command: `npm test`
- Use existing shared components when available (ConfirmDialogComponent)

### References

- [Source: epics-work-orders-vendors.md#Story 3.3] - Delete Notes (lines 1130-1161)
- [Source: 10-1-polymorphic-notes-entity.md] - Backend DELETE endpoint implementation
- [Source: 10-2-add-notes-to-work-order.md] - Frontend notes service and component

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - Implementation completed without issues.

### Completion Notes List

1. **TDD Approach Followed:** All tests written before implementation (Red-Green-Refactor)
2. **Service Layer:** Added `deleteNote(noteId: string): Observable<void>` to NotesService
3. **Component Updates:**
   - Added delete button (mat-icon-button) with trash icon to each note
   - Implemented `confirmDelete(note)` using existing ConfirmDialogComponent
   - Implemented `deleteNote(noteId)` with pessimistic update (wait for API success)
   - Added snackbar feedback for success ("Note deleted") and error ("Failed to delete note")
4. **Styling:** Delete button hidden by default, appears on hover (desktop), always visible on mobile
5. **Tests Added:** 11 new tests (3 service + 8 component)
6. **All Tests Passing:** Frontend 2053 tests, Backend 1313 tests

### File List

**Modified Files:**
- `frontend/src/app/features/work-orders/services/notes.service.ts` (added deleteNote method)
- `frontend/src/app/features/work-orders/services/notes.service.spec.ts` (added 3 delete tests)
- `frontend/src/app/features/work-orders/components/work-order-notes/work-order-notes.component.ts` (added delete button, confirmDelete, deleteNote methods, styling)
- `frontend/src/app/features/work-orders/components/work-order-notes/work-order-notes.component.spec.ts` (added 8 delete tests)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-30 | Implemented Story 10-3: Delete Notes frontend functionality | Claude Opus 4.5 |
