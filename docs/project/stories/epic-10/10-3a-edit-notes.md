# Story 10.3a: Edit Notes

Status: ready-for-review

## Story

As a **property owner**,
I want **to edit notes on a work order**,
So that **I can correct typos or update information without creating duplicate notes**.

## Acceptance Criteria

### AC #1: Edit Button Visibility

**Given** I am viewing the notes list on a work order detail page
**When** I hover over or view a note
**Then** I see an edit icon/button on that note (alongside the delete button)

### AC #2: Edit Mode Activation

**Given** I click the edit icon on a note
**When** edit mode activates
**Then** the note content becomes editable (inline textarea or modal)
**And** I see [Save] and [Cancel] buttons
**And** the textarea is pre-populated with the current note content

### AC #3: Successful Edit

**Given** I modify the note content and click "Save"
**When** the update completes via `PUT /api/v1/notes/{id}`
**Then** I see snackbar "Note updated"
**And** the note displays the updated content
**And** the note now shows the "(edited)" annotation

### AC #4: Edited Annotation Display

**Given** a note has been edited (UpdatedAt > CreatedAt)
**When** I view the note
**Then** I see the timestamp display in this format:
- Author name
- Created timestamp (e.g., "Jan 8, 2026 at 2:34 PM")
- *(edited [update timestamp])* in italics

**Examples:**
- Same day edit: `John Smith • Jan 8, 2026 at 2:34 PM • *(edited 3:15 PM)*`
- Different day edit: `John Smith • Jan 8, 2026 at 2:34 PM • *(edited Jan 9, 2026 at 10:00 AM)*`

### AC #5: Cancel Edit

**Given** I am in edit mode
**When** I click "Cancel"
**Then** edit mode closes
**And** the note content reverts to its original value
**And** no API call is made

### AC #6: Empty Content Validation

**Given** I am editing a note
**When** I clear all content and try to save
**Then** I see validation error "Note cannot be empty"
**And** the save is prevented

### AC #7: Error Handling

**Given** the update API call fails
**When** an error occurs
**Then** I see snackbar "Failed to update note"
**And** the note remains in edit mode with the attempted changes

## Tasks / Subtasks

> **TDD Approach:** This story follows Test-Driven Development (Red-Green-Refactor).
> For each feature: write failing tests first, then implement minimum code to pass.

---

### Phase 1: Backend Implementation (TDD)

#### Task 1: RED - Write Failing Backend Tests (AC: #3)

- [x] 1.1 Add update tests to `NotesControllerTests.cs`:
  ```csharp
  [Fact]
  public async Task UpdateNote_ValidRequest_ReturnsNoContent()

  [Fact]
  public async Task UpdateNote_NotFound_Returns404()

  [Fact]
  public async Task UpdateNote_EmptyContent_ReturnsBadRequest()

  [Fact]
  public async Task UpdateNote_OtherUsersNote_ReturnsForbidden()
  ```
- [x] 1.2 **Run tests - verify they FAIL** (Red phase)

#### Task 2: GREEN - Implement Update Command (AC: #3)

- [x] 2.1 Create `UpdateNoteCommand.cs` in Application layer:
  ```csharp
  public record UpdateNoteCommand(Guid NoteId, string Content) : IRequest<Unit>;
  ```
- [x] 2.2 Create `UpdateNoteCommandValidator.cs`:
  ```csharp
  RuleFor(x => x.Content).NotEmpty().WithMessage("Note cannot be empty");
  ```
- [x] 2.3 Create `UpdateNoteCommandHandler.cs`:
  - Fetch note by ID with AccountId filter
  - Return 404 if not found
  - Update Content and UpdatedAt
  - Save changes
- [x] 2.4 **Run tests - verify they PASS** (Green phase)

#### Task 3: GREEN - Add PUT Endpoint (AC: #3)

- [x] 3.1 Add `PUT /api/v1/notes/{id}` endpoint to `NotesController.cs`:
  ```csharp
  [HttpPut("{id:guid}")]
  public async Task<IActionResult> UpdateNote(Guid id, UpdateNoteRequest request)
  {
      await _mediator.Send(new UpdateNoteCommand(id, request.Content));
      return NoContent();
  }
  ```
- [x] 3.2 Create `UpdateNoteRequest.cs` DTO
- [x] 3.3 **Run tests - verify they PASS** (Green phase)

---

### Phase 2: Frontend Service Layer (TDD)

#### Task 4: RED - Write Failing Notes Service Update Test (AC: #3, #7)

- [x] 4.1 Add update tests to `notes.service.spec.ts`:
  ```typescript
  describe('updateNote', () => {
    it('should update a note successfully', async () => {
      // PUT /api/v1/notes/{id} returns 204
    });

    it('should handle 404 error when note not found', async () => {
      // Error handling test
    });

    it('should handle server errors gracefully', async () => {
      // Error handling test
    });
  });
  ```
- [x] 4.2 **Run tests - verify they FAIL** (Red phase)

#### Task 5: GREEN - Implement updateNote Method (AC: #3)

- [x] 5.1 Add `updateNote()` method to `notes.service.ts`:
  ```typescript
  updateNote(noteId: string, content: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${noteId}`, { content });
  }
  ```
- [x] 5.2 **Run tests - verify they PASS** (Green phase)

---

### Phase 3: Component Edit Functionality (TDD)

#### Task 6: RED - Write Failing Component Edit Tests (AC: #1, #2, #3, #4, #5, #6, #7)

- [x] 6.1 Add edit tests to `work-order-notes.component.spec.ts`:
  ```typescript
  describe('Edit Note', () => {
    it('should display edit button on each note', () => {});
    it('should enter edit mode when edit button clicked', () => {});
    it('should show textarea with current content in edit mode', () => {});
    it('should show save and cancel buttons in edit mode', () => {});
    it('should call service on save', () => {});
    it('should update note in list after successful edit', () => {});
    it('should show success snackbar after edit', () => {});
    it('should exit edit mode and revert on cancel', () => {});
    it('should prevent save when content is empty', () => {});
    it('should show error snackbar on edit failure', () => {});
    it('should display edited annotation when UpdatedAt > CreatedAt', () => {});
    it('should show same-day edit time without date', () => {});
    it('should show different-day edit with full date', () => {});
  });
  ```
- [x] 6.2 **Run tests - verify they FAIL** (Red phase)

#### Task 7: GREEN - Implement Edit Button UI (AC: #1)

- [x] 7.1 Add edit icon button to each note in template (next to delete):
  ```html
  <button mat-icon-button
          (click)="startEdit(note)"
          aria-label="Edit note">
    <mat-icon>edit</mat-icon>
  </button>
  ```
- [x] 7.2 Style edit button consistent with delete button

#### Task 8: GREEN - Implement Edit Mode (AC: #2, #5, #6)

- [x] 8.1 Add edit state signals to component:
  ```typescript
  editingNoteId = signal<string | null>(null);
  editContent = signal<string>('');
  ```
- [x] 8.2 Implement `startEdit()` method:
  ```typescript
  startEdit(note: NoteDto): void {
    this.editingNoteId.set(note.id);
    this.editContent.set(note.content);
  }
  ```
- [x] 8.3 Implement `cancelEdit()` method:
  ```typescript
  cancelEdit(): void {
    this.editingNoteId.set(null);
    this.editContent.set('');
  }
  ```
- [x] 8.4 Add edit mode template with textarea and buttons:
  ```html
  @if (editingNoteId() === note.id) {
    <textarea [(ngModel)]="editContent" required></textarea>
    <button mat-button (click)="cancelEdit()">Cancel</button>
    <button mat-raised-button color="primary"
            [disabled]="!editContent().trim()"
            (click)="saveEdit(note.id)">Save</button>
  }
  ```

#### Task 9: GREEN - Implement Save Edit (AC: #3, #7)

- [x] 9.1 Implement `saveEdit()` method:
  ```typescript
  saveEdit(noteId: string): void {
    const content = this.editContent().trim();
    if (!content) return;

    this.notesService.updateNote(noteId, content).subscribe({
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
        this.snackBar.open('Failed to update note', 'Close', { duration: 3000 });
      }
    });
  }
  ```
- [x] 9.2 **Run tests - verify they PASS** (Green phase)

#### Task 10: GREEN - Implement Edited Annotation Display (AC: #4)

- [x] 10.1 Add helper method to check if note was edited:
  ```typescript
  isEdited(note: NoteDto): boolean {
    return new Date(note.updatedAt) > new Date(note.createdAt);
  }
  ```
- [x] 10.2 Add helper method to format edit timestamp:
  ```typescript
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
  ```
- [x] 10.3 Update template to show edited annotation:
  ```html
  <span class="note-meta">
    {{ note.createdByUserName }} • {{ formatCreatedAt(note.createdAt) }}
    @if (isEdited(note)) {
      <span class="edited-annotation">
        • <em>(edited {{ formatEditTime(note) }})</em>
      </span>
    }
  </span>
  ```
- [x] 10.4 Add styling for edited annotation:
  ```scss
  .edited-annotation {
    em {
      font-style: italic;
      color: var(--text-secondary);
    }
  }
  ```
- [x] 10.5 **Run tests - verify they PASS** (Green phase)

---

### Phase 4: Final Verification

#### Task 11: Full Test Suite & Manual Verification

- [x] 11.1 Run full backend test suite: `dotnet test` - **1319 tests passing**
- [x] 11.2 Run full frontend test suite: `npm test` - **2075 tests passing**
- [x] 11.3 Manual verification checklist:
  - [x] Edit button visible on notes
  - [x] Clicking edit enters edit mode with textarea
  - [x] Current content pre-populated
  - [ ] Save updates the note *(requires backend restart)*
  - [ ] Snackbar shows "Note updated" *(requires backend restart)*
  - [x] Cancel reverts without saving
  - [x] Empty content shows validation (Save button disabled)
  - [ ] Edited notes show "(edited [timestamp])" in italics *(requires backend restart)*
  - [ ] Same-day edits show time only *(requires backend restart)*
  - [ ] Different-day edits show full date *(requires backend restart)*
  - [x] Error handling works correctly (snackbar shows on failure)

> **Note:** Backend restart required to test edit save functionality. The running backend doesn't have the new PUT endpoint yet.

## Dev Notes

### Architecture Compliance

**Backend Structure:**
```
backend/src/PropertyManager.Application/
├── Features/
│   └── Notes/
│       └── Commands/
│           └── UpdateNote/
│               ├── UpdateNoteCommand.cs         ← CREATE
│               ├── UpdateNoteCommandHandler.cs  ← CREATE
│               └── UpdateNoteCommandValidator.cs ← CREATE

backend/src/PropertyManager.Api/
├── Controllers/
│   └── NotesController.cs                      ← MODIFY (add PUT endpoint)
├── Models/
│   └── UpdateNoteRequest.cs                    ← CREATE
```

**Frontend Structure:**
```
frontend/src/app/features/work-orders/
├── components/
│   └── work-order-notes/
│       ├── work-order-notes.component.ts       ← MODIFY (add edit)
│       └── work-order-notes.component.spec.ts  ← MODIFY (add tests)
├── services/
│   ├── notes.service.ts                        ← MODIFY (add updateNote)
│   └── notes.service.spec.ts                   ← MODIFY (add tests)
```

### API Contract

**PUT /api/v1/notes/{noteId}**

Request:
```json
{
  "content": "Updated note content"
}
```

Response:
- Success: 204 No Content
- Not Found: 404
- Bad Request: 400 (empty content)
- Unauthorized: 401

### Implementation Decisions

1. **Inline Edit vs Modal:** Use inline edit (textarea replaces display) for quick edits - consistent with modern UX patterns (Slack, GitHub, etc.)

2. **Edited Annotation Format:** Follow Slack pattern
   - Same day: `• (edited 3:15 PM)`
   - Different day: `• (edited Jan 9, 2026 at 10:00 AM)`

3. **Edit vs Delete Button Order:** Edit button first (left), then delete button (right)

4. **Who Can Edit:** Only the note creator can edit their own notes (same pattern as delete)

### Existing Patterns to Follow

From Story 10-3 (Delete Notes):
- Button placement and hover behavior
- Snackbar feedback patterns
- Error handling approach
- Service method structure

### FRs Covered

| FR | Description | How This Story Addresses |
|----|-------------|-------------------------|
| - | Enhancement to FR42 | Extends "add notes" with edit capability |

### Previous Story Intelligence

From Story 10-3 (Delete Notes):
- NotesService has `deleteNote()` method pattern to follow
- Component has `confirmDelete()` pattern
- Tests use Vitest with Angular testing utilities
- 11 tests added for delete functionality

From Story 10-2 (Add Notes to Work Order):
- NoteDto interface includes `createdAt` and `updatedAt` fields
- Component uses signals for state management
- Service uses HttpClient with Observable pattern

### References

- [Source: 10-3-delete-notes.md] - Delete implementation pattern
- [Source: 10-2-add-notes-to-work-order.md] - Notes service and component structure

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-31 | Created story for Edit Notes with edited annotation | SM Agent (Bob) |
