import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WorkOrderDetailComponent } from './work-order-detail.component';
import { WorkOrderStore } from '../../stores/work-order.store';
import { WorkOrderPhotoStore } from '../../stores/work-order-photo.store';
import { WorkOrderDto, WorkOrderService, WorkOrderExpensesResponse } from '../../services/work-order.service';
import { ExpenseService, ExpenseDto } from '../../../expenses/services/expense.service';
import { NotesService } from '../../services/notes.service';

/**
 * Unit tests for WorkOrderDetailComponent (Story 9-8)
 *
 * Test coverage:
 * - AC #1: Navigation to detail page
 * - AC #2: Work order detail display (status, property, description, category, vendor, tags, dates)
 * - AC #3: Edit and Delete action buttons
 * - AC #4: Placeholder sections for Photos, Notes, Expenses
 * - AC #5: Back navigation
 * - AC #6: 404 error handling
 * - AC #7: Loading state
 */
describe('WorkOrderDetailComponent', () => {
  let component: WorkOrderDetailComponent;
  let fixture: ComponentFixture<WorkOrderDetailComponent>;
  let mockWorkOrderStore: {
    isLoadingDetail: WritableSignal<boolean>;
    detailError: WritableSignal<string | null>;
    selectedWorkOrder: WritableSignal<WorkOrderDto | null>;
    isUpdating: WritableSignal<boolean>;
    isDeleting: WritableSignal<boolean>;
    loadWorkOrderById: ReturnType<typeof vi.fn>;
    clearSelectedWorkOrder: ReturnType<typeof vi.fn>;
    deleteWorkOrder: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  const mockWorkOrder: WorkOrderDto = {
    id: 'wo-123',
    propertyId: 'prop-456',
    propertyName: 'Test Property',
    vendorId: 'vendor-789',
    vendorName: 'John Plumber',
    isDiy: false,
    categoryId: 'cat-101',
    categoryName: 'Plumbing',
    status: 'Assigned',
    description: 'Fix the leaky faucet in the kitchen',
    createdAt: '2026-01-20T10:30:00Z',
    createdByUserId: 'user-111',
    tags: [
      { id: 'tag-1', name: 'Urgent' },
      { id: 'tag-2', name: 'Kitchen' },
    ],
  };

  const mockDiyWorkOrder: WorkOrderDto = {
    id: 'wo-456',
    propertyId: 'prop-456',
    propertyName: 'Test Property',
    vendorId: undefined,
    vendorName: undefined,
    isDiy: true,
    categoryId: undefined,
    categoryName: undefined,
    status: 'Reported',
    description: 'DIY repair task',
    createdAt: '2026-01-21T14:00:00Z',
    createdByUserId: 'user-111',
    tags: [],
  };

  beforeEach(async () => {
    mockWorkOrderStore = {
      isLoadingDetail: signal(false),
      detailError: signal<string | null>(null),
      selectedWorkOrder: signal<WorkOrderDto | null>(null),
      isUpdating: signal(false),
      isDeleting: signal(false),
      loadWorkOrderById: vi.fn(),
      clearSelectedWorkOrder: vi.fn(),
      deleteWorkOrder: vi.fn(),
    };

    const mockNotesService = {
      getNotes: vi.fn().mockReturnValue(of({ items: [], totalCount: 0 })),
      createNote: vi.fn().mockReturnValue(of({ id: 'new-note-id' }))
    };

    const mockWorkOrderService = {
      getWorkOrderExpenses: vi.fn().mockReturnValue(of({ items: [], totalCount: 0 } as WorkOrderExpensesResponse)),
    };

    const mockExpenseService = {
      getExpensesByProperty: vi.fn().mockReturnValue(of({ items: [], totalCount: 0, page: 1, pageSize: 500, totalPages: 1, ytdTotal: 0 })),
      getExpense: vi.fn().mockReturnValue(of({
        id: 'exp-1', propertyId: 'prop-456', propertyName: 'Test', categoryId: 'cat-1',
        categoryName: 'Repairs', amount: 100, date: '2026-01-15', description: 'Test', createdAt: '2026-01-15',
      } as ExpenseDto)),
      updateExpense: vi.fn().mockReturnValue(of(undefined)),
    };

    const mockSnackBar = {
      open: vi.fn(),
    };

    const mockPhotoStore = {
      photos: signal([]),
      sortedPhotos: signal([]),
      isLoading: signal(false),
      error: signal<string | null>(null),
      uploadError: signal<string | null>(null),
      isUploading: signal(false),
      uploadProgress: signal(0),
      photoCount: signal(0),
      hasPhotos: signal(false),
      isEmpty: signal(true),
      workOrderId: signal<string | null>(null),
      loadPhotos: vi.fn(),
      uploadPhoto: vi.fn().mockResolvedValue(true),
      deletePhoto: vi.fn(),
      clear: vi.fn(),
      clearError: vi.fn(),
      clearUploadError: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [WorkOrderDetailComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'work-orders', component: WorkOrderDetailComponent },
          { path: 'work-orders/:id', component: WorkOrderDetailComponent },
          { path: 'work-orders/:id/edit', component: WorkOrderDetailComponent },
          { path: 'properties/:id', component: WorkOrderDetailComponent },
          { path: 'vendors/:id', component: WorkOrderDetailComponent },
        ]),
        { provide: WorkOrderStore, useValue: mockWorkOrderStore },
        { provide: WorkOrderPhotoStore, useValue: mockPhotoStore },
        { provide: NotesService, useValue: mockNotesService },
        { provide: WorkOrderService, useValue: mockWorkOrderService },
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: MatSnackBar, useValue: mockSnackBar },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'wo-123',
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkOrderDetailComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
  });

  /**
   * Helper to set up component with loaded work order data
   */
  function setupWithWorkOrder(workOrder: WorkOrderDto = mockWorkOrder): void {
    fixture.detectChanges(); // Triggers ngOnInit
    mockWorkOrderStore.selectedWorkOrder.set(workOrder);
    fixture.detectChanges();
  }

  describe('initialization (AC #1)', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should load work order on init', () => {
      fixture.detectChanges();
      expect(mockWorkOrderStore.loadWorkOrderById).toHaveBeenCalledWith('wo-123');
    });

    it('should clear selected work order on destroy', () => {
      fixture.detectChanges();
      component.ngOnDestroy();
      expect(mockWorkOrderStore.clearSelectedWorkOrder).toHaveBeenCalled();
    });
  });

  describe('loading state (AC #7)', () => {
    it('should show spinner when loading', () => {
      mockWorkOrderStore.isLoadingDetail.set(true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      expect(compiled.querySelector('mat-spinner')).toBeTruthy();
      expect(compiled.textContent).toContain('Loading work order...');
    });

    it('should hide content when loading', () => {
      mockWorkOrderStore.isLoadingDetail.set(true);
      fixture.detectChanges();

      const header = fixture.nativeElement.querySelector('.work-order-header');
      expect(header).toBeFalsy();
    });
  });

  describe('error state (AC #6)', () => {
    it('should show error message when detailError is set', () => {
      mockWorkOrderStore.detailError.set('Work order not found');
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Work order not found');
      expect(compiled.querySelector('.error-icon')).toBeTruthy();
    });

    it('should show back button in error state', () => {
      mockWorkOrderStore.detailError.set('Work order not found');
      fixture.detectChanges();

      const backButton = fixture.nativeElement.querySelector('.error-card button');
      expect(backButton).toBeTruthy();
      expect(backButton.textContent).toContain('Back to Work Orders');
    });

    it('should navigate to work orders list when error back button clicked', () => {
      mockWorkOrderStore.detailError.set('Work order not found');
      fixture.detectChanges();

      const backButton = fixture.debugElement.query(By.css('.error-card button'));
      backButton.triggerEventHandler('click', null);
      expect(router.navigate).toHaveBeenCalledWith(['/work-orders']);
    });
  });

  describe('work order detail display (AC #2)', () => {
    beforeEach(() => {
      setupWithWorkOrder();
    });

    it('should display status badge with correct class', () => {
      const badge = fixture.nativeElement.querySelector('.status-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('Assigned');
      expect(badge.classList.contains('status-assigned')).toBe(true);
    });

    it('should display property name as link', () => {
      const propertyLink = fixture.nativeElement.querySelector('.property-link');
      expect(propertyLink).toBeTruthy();
      expect(propertyLink.textContent).toContain('Test Property');
    });

    it('should display full description', () => {
      const description = fixture.nativeElement.querySelector('.description-text');
      expect(description).toBeTruthy();
      expect(description.textContent).toContain('Fix the leaky faucet in the kitchen');
    });

    it('should display category name', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Plumbing');
    });

    it('should display vendor name as link when assigned', () => {
      const vendorLink = fixture.nativeElement.querySelector('.vendor-link');
      expect(vendorLink).toBeTruthy();
      expect(vendorLink.textContent).toContain('John Plumber');
    });

    it('should display tags as chips', () => {
      const chips = fixture.nativeElement.querySelectorAll('mat-chip');
      expect(chips.length).toBe(2);
      expect(chips[0].textContent).toContain('Urgent');
      expect(chips[1].textContent).toContain('Kitchen');
    });

    it('should display created date', () => {
      const compiled = fixture.nativeElement;
      // Check that the date is displayed (format may vary)
      expect(compiled.textContent).toContain('Jan');
      expect(compiled.textContent).toContain('2026');
    });
  });

  describe('DIY work order display (AC #2)', () => {
    beforeEach(() => {
      setupWithWorkOrder(mockDiyWorkOrder);
    });

    it('should display DIY label when isDiy is true', () => {
      const diyLabel = fixture.nativeElement.querySelector('.diy-label');
      expect(diyLabel).toBeTruthy();
      expect(diyLabel.textContent).toContain('DIY (Self)');
    });

    it('should not show vendor link for DIY work order', () => {
      const vendorLink = fixture.nativeElement.querySelector('.vendor-link');
      expect(vendorLink).toBeFalsy();
    });

    it('should display "Not categorized" when no category', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Not categorized');
    });

    it('should display "No tags" when tags array is empty', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('No tags');
    });

    it('should display status badge with reported class', () => {
      const badge = fixture.nativeElement.querySelector('.status-badge');
      expect(badge.classList.contains('status-reported')).toBe(true);
    });
  });

  describe('action buttons (AC #3)', () => {
    beforeEach(() => {
      setupWithWorkOrder();
    });

    it('should display edit button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('.action-buttons button');
      const editBtn = Array.from(buttons).find((b: any) => b.textContent.includes('Edit'));
      expect(editBtn).toBeTruthy();
    });

    it('should display delete button', () => {
      const deleteButton = fixture.debugElement.query(By.css('button[color="warn"]'));
      expect(deleteButton).toBeTruthy();
      expect(deleteButton.nativeElement.textContent).toContain('Delete');
    });

    it('should have both edit and delete buttons', () => {
      const buttons = fixture.nativeElement.querySelectorAll('.action-buttons button');
      expect(buttons.length).toBe(2);

      const buttonText = Array.from(buttons).map((b: any) => b.textContent);
      expect(buttonText.some((t: string) => t.includes('Edit'))).toBe(true);
      expect(buttonText.some((t: string) => t.includes('Delete'))).toBe(true);
    });
  });

  describe('placeholder sections (AC #4)', () => {
    beforeEach(() => {
      setupWithWorkOrder();
    });

    it('should display Photos section with gallery component (Story 10-5)', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Photos');
      // Photos section now uses the gallery component instead of placeholder
      expect(compiled.querySelector('app-work-order-photo-gallery')).toBeTruthy();
    });

    it('should display Notes section with notes component (Story 10-2)', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Notes');
      // Notes component shows "No notes yet" in empty state
      expect(compiled.querySelector('app-work-order-notes')).toBeTruthy();
    });

    it('should display Linked Expenses section with empty state', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Linked Expenses');
      expect(compiled.textContent).toContain('No expenses linked yet');
    });

    it('should display Link Existing Expense button', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Link Existing Expense');
    });
  });

  describe('back navigation (AC #5)', () => {
    beforeEach(() => {
      setupWithWorkOrder();
    });

    it('should display back button in header', () => {
      const backButton = fixture.debugElement.query(By.css('.back-button'));
      expect(backButton).toBeTruthy();
    });

    it('should navigate to work orders list when back button clicked', () => {
      const backButton = fixture.debugElement.query(By.css('.back-button'));
      backButton.triggerEventHandler('click', null);
      expect(router.navigate).toHaveBeenCalledWith(['/work-orders']);
    });

    it('should call goBack method', () => {
      vi.spyOn(component, 'goBack');
      const backButton = fixture.debugElement.query(By.css('.back-button'));
      backButton.triggerEventHandler('click', null);
      expect(component.goBack).toHaveBeenCalled();
    });
  });

  describe('section cards', () => {
    beforeEach(() => {
      setupWithWorkOrder();
    });

    it('should have Property section card', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Property');
    });

    it('should have Description section card', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Description');
    });

    it('should have Details section card', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Details');
    });
  });

  describe('linked expenses section (Story 11.3)', () => {
    it('should load linked expenses on init', () => {
      const mockWoService = TestBed.inject(WorkOrderService);
      fixture.detectChanges();
      expect(mockWoService.getWorkOrderExpenses).toHaveBeenCalledWith('wo-123');
    });

    it('should display expense list when expenses are loaded', () => {
      const mockWoService = TestBed.inject(WorkOrderService);
      (mockWoService.getWorkOrderExpenses as ReturnType<typeof vi.fn>).mockReturnValue(of({
        items: [
          { id: 'exp-1', date: '2026-01-15', description: 'Faucet parts', categoryName: 'Repairs', amount: 125.50 },
          { id: 'exp-2', date: '2026-01-10', description: null, categoryName: 'Supplies', amount: 45.00 },
        ],
        totalCount: 2,
      } as WorkOrderExpensesResponse));

      setupWithWorkOrder();

      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Faucet parts');
      expect(compiled.textContent).toContain('Repairs');
      expect(compiled.textContent).toContain('No description');
      expect(compiled.textContent).toContain('Supplies');
    });

    it('should display expenses total', () => {
      const mockWoService = TestBed.inject(WorkOrderService);
      (mockWoService.getWorkOrderExpenses as ReturnType<typeof vi.fn>).mockReturnValue(of({
        items: [
          { id: 'exp-1', date: '2026-01-15', description: 'Faucet', categoryName: 'Repairs', amount: 125.50 },
          { id: 'exp-2', date: '2026-01-10', description: 'Pipe', categoryName: 'Supplies', amount: 44.50 },
        ],
        totalCount: 2,
      }));

      setupWithWorkOrder();

      const totalEl = fixture.nativeElement.querySelector('.expenses-total');
      expect(totalEl).toBeTruthy();
      expect(totalEl.textContent).toContain('$170.00');
    });

    it('should show empty state when no expenses', () => {
      setupWithWorkOrder();

      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('No expenses linked yet');
    });

    it('should show unlink button on each expense row', () => {
      const mockWoService = TestBed.inject(WorkOrderService);
      (mockWoService.getWorkOrderExpenses as ReturnType<typeof vi.fn>).mockReturnValue(of({
        items: [
          { id: 'exp-1', date: '2026-01-15', description: 'Test', categoryName: 'Repairs', amount: 100 },
        ],
        totalCount: 1,
      }));

      setupWithWorkOrder();

      const unlinkButtons = fixture.nativeElement.querySelectorAll('.expense-actions button');
      expect(unlinkButtons.length).toBe(1);
    });

    it('should call unlinkExpense when unlink button clicked', () => {
      const mockWoService = TestBed.inject(WorkOrderService);
      (mockWoService.getWorkOrderExpenses as ReturnType<typeof vi.fn>).mockReturnValue(of({
        items: [
          { id: 'exp-1', date: '2026-01-15', description: 'Test', categoryName: 'Repairs', amount: 100 },
        ],
        totalCount: 1,
      }));

      setupWithWorkOrder();

      vi.spyOn(component, 'unlinkExpense');
      const unlinkButton = fixture.debugElement.query(By.css('.expense-actions button'));
      unlinkButton.triggerEventHandler('click', null);
      expect(component.unlinkExpense).toHaveBeenCalledWith('exp-1');
    });
  });

  describe('status badge colors', () => {
    it('should have status-reported class for Reported status', () => {
      const reportedWorkOrder = { ...mockWorkOrder, status: 'Reported' };
      setupWithWorkOrder(reportedWorkOrder);

      const badge = fixture.nativeElement.querySelector('.status-badge');
      expect(badge.classList.contains('status-reported')).toBe(true);
    });

    it('should have status-assigned class for Assigned status', () => {
      const assignedWorkOrder = { ...mockWorkOrder, status: 'Assigned' };
      setupWithWorkOrder(assignedWorkOrder);

      const badge = fixture.nativeElement.querySelector('.status-badge');
      expect(badge.classList.contains('status-assigned')).toBe(true);
    });

    it('should have status-completed class for Completed status', () => {
      const completedWorkOrder = { ...mockWorkOrder, status: 'Completed' };
      setupWithWorkOrder(completedWorkOrder);

      const badge = fixture.nativeElement.querySelector('.status-badge');
      expect(badge.classList.contains('status-completed')).toBe(true);
    });
  });
});
