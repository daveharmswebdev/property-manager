import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal, computed } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { IncomeDetailComponent } from './income-detail.component';
import { IncomeDetailStore } from '../stores/income-detail.store';
import { IncomeDto } from '../services/income.service';

describe('IncomeDetailComponent', () => {
  let component: IncomeDetailComponent;
  let fixture: ComponentFixture<IncomeDetailComponent>;

  const mockIncome: IncomeDto = {
    id: 'inc-1',
    propertyId: 'prop-1',
    propertyName: 'Test Property',
    amount: 1500,
    date: '2026-01-15',
    source: 'Test Tenant',
    description: 'Monthly rent',
    createdAt: '2026-01-15T10:00:00Z',
  };

  const isEditingSignal = signal(false);
  const mockStore = {
    income: signal(mockIncome),
    isLoading: signal(false),
    isUpdating: signal(false),
    isDeleting: signal(false),
    isEditing: isEditingSignal,
    isViewMode: computed(() => !isEditingSignal()),
    error: signal<string | null>(null),
    loadIncome: vi.fn(),
    updateIncome: vi.fn(),
    deleteIncome: vi.fn(),
    startEditing: vi.fn(),
    cancelEditing: vi.fn(),
    reset: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    isEditingSignal.set(false);

    await TestBed.configureTestingModule({
      imports: [IncomeDetailComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: IncomeDetailStore, useValue: mockStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display income detail container', () => {
    const container = fixture.debugElement.query(By.css('.income-detail-container'));
    expect(container).toBeTruthy();
  });

  describe('view mode', () => {
    it('should display amount', () => {
      const amount = fixture.debugElement.query(By.css('[data-testid="income-amount"]'));
      expect(amount).toBeTruthy();
      expect(amount.nativeElement.textContent).toContain('$1,500.00');
    });

    it('should display source', () => {
      const source = fixture.debugElement.query(By.css('[data-testid="income-source"]'));
      expect(source).toBeTruthy();
      expect(source.nativeElement.textContent).toContain('Test Tenant');
    });

    it('should display description', () => {
      const desc = fixture.debugElement.query(By.css('[data-testid="income-description"]'));
      expect(desc).toBeTruthy();
      expect(desc.nativeElement.textContent).toContain('Monthly rent');
    });

    it('should display property name', () => {
      const prop = fixture.debugElement.query(By.css('[data-testid="income-property"]'));
      expect(prop).toBeTruthy();
      expect(prop.nativeElement.textContent).toContain('Test Property');
    });

    it('should display date', () => {
      const date = fixture.debugElement.query(By.css('[data-testid="income-date"]'));
      expect(date).toBeTruthy();
      expect(date.nativeElement.textContent.trim()).not.toBe('');
    });

    it('should display "Back to Income" link', () => {
      const backLink = fixture.debugElement.query(By.css('.back-link'));
      expect(backLink).toBeTruthy();
      expect(backLink.nativeElement.textContent).toContain('Back to Income');
    });

    it('should display Edit button', () => {
      const editBtn = fixture.debugElement.query(By.css('.action-bar button'));
      expect(editBtn).toBeTruthy();
      expect(editBtn.nativeElement.textContent).toContain('Edit');
    });

    it('should display Delete button', () => {
      const buttons = fixture.debugElement.queryAll(By.css('.action-bar button'));
      const deleteBtn = buttons.find(b => b.nativeElement.textContent.includes('Delete'));
      expect(deleteBtn).toBeTruthy();
    });
  });

  describe('edit mode', () => {
    beforeEach(() => {
      isEditingSignal.set(true);
      fixture.detectChanges();
    });

    it('should show form in edit mode', () => {
      const form = fixture.debugElement.query(By.css('form'));
      expect(form).toBeTruthy();
    });

    it('should show Save button', () => {
      const submitBtn = fixture.debugElement.query(By.css('button[type="submit"]'));
      expect(submitBtn).toBeTruthy();
      expect(submitBtn.nativeElement.textContent).toContain('Save');
    });

    it('should show Cancel button', () => {
      const cancelBtn = fixture.debugElement.queryAll(By.css('.form-actions button'))
        .find(b => b.nativeElement.textContent.includes('Cancel'));
      expect(cancelBtn).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('should call store.startEditing when Edit button is clicked', () => {
      const editBtn = fixture.debugElement.query(By.css('.action-bar button'));
      editBtn.nativeElement.click();
      expect(mockStore.startEditing).toHaveBeenCalled();
    });

    it('should call store.cancelEditing when Cancel button is clicked', () => {
      isEditingSignal.set(true);
      fixture.detectChanges();

      const cancelBtn = fixture.debugElement.queryAll(By.css('.form-actions button'))
        .find(b => b.nativeElement.textContent.includes('Cancel'));
      cancelBtn!.nativeElement.click();
      expect(mockStore.cancelEditing).toHaveBeenCalled();
    });

    it('should open confirm dialog and call store.deleteIncome on confirm', () => {
      const dialog = fixture.debugElement.injector.get(MatDialog);
      vi.spyOn(dialog, 'open').mockReturnValue({
        afterClosed: () => of(true),
      } as any);

      const deleteBtn = fixture.debugElement.queryAll(By.css('.action-bar button'))
        .find(b => b.nativeElement.textContent.includes('Delete'));
      deleteBtn!.nativeElement.click();

      expect(dialog.open).toHaveBeenCalled();
      expect(mockStore.deleteIncome).toHaveBeenCalled();
    });

    it('should pass secondaryMessage with amount and date to delete dialog (AC-16.5.1)', () => {
      const dialog = fixture.debugElement.injector.get(MatDialog);
      vi.spyOn(dialog, 'open').mockReturnValue({
        afterClosed: () => of(false),
      } as any);

      const deleteBtn = fixture.debugElement.queryAll(By.css('.action-bar button'))
        .find(b => b.nativeElement.textContent.includes('Delete'));
      deleteBtn!.nativeElement.click();

      const dialogData = (dialog.open as ReturnType<typeof vi.fn>).mock.calls[0][1].data;
      expect(dialogData.secondaryMessage).toBeTruthy();
      expect(dialogData.secondaryMessage).toContain('$1,500.00');
      expect(dialogData.secondaryMessage).toMatch(/Jan\s+\d{1,2},?\s+2026/);
    });

    it('should not call store.deleteIncome when dialog is cancelled', () => {
      const dialog = fixture.debugElement.injector.get(MatDialog);
      vi.spyOn(dialog, 'open').mockReturnValue({
        afterClosed: () => of(false),
      } as any);

      const deleteBtn = fixture.debugElement.queryAll(By.css('.action-bar button'))
        .find(b => b.nativeElement.textContent.includes('Delete'));
      deleteBtn!.nativeElement.click();

      expect(dialog.open).toHaveBeenCalled();
      expect(mockStore.deleteIncome).not.toHaveBeenCalled();
    });

    it('should call store.updateIncome with correct payload on submit', () => {
      // Enter edit mode
      isEditingSignal.set(true);
      fixture.detectChanges();

      // Populate form with valid data
      const form = (component as any).editForm;
      form.patchValue({
        amount: 2000,
        date: new Date(2026, 0, 20),
        source: 'Updated Tenant',
        description: 'Updated rent',
        propertyId: 'prop-1',
      });
      fixture.detectChanges();

      // Set incomeId so onSubmit can reference it
      (component as any).incomeId = 'inc-1';

      // Submit
      const submitBtn = fixture.debugElement.query(By.css('button[type="submit"]'));
      submitBtn.nativeElement.click();

      expect(mockStore.updateIncome).toHaveBeenCalledWith({
        incomeId: 'inc-1',
        request: expect.objectContaining({
          amount: 2000,
          date: '2026-01-20',
          source: 'Updated Tenant',
          description: 'Updated rent',
          propertyId: 'prop-1',
        }),
      });
    });
  });

  describe('destroy', () => {
    it('should call store.reset on destroy', () => {
      component.ngOnDestroy();
      expect(mockStore.reset).toHaveBeenCalled();
    });
  });
});

describe('IncomeDetailComponent loading state', () => {
  let fixture: ComponentFixture<IncomeDetailComponent>;

  const mockStore = {
    income: signal(null),
    isLoading: signal(true),
    isUpdating: signal(false),
    isDeleting: signal(false),
    isEditing: signal(false),
    isViewMode: computed(() => true),
    error: signal<string | null>(null),
    loadIncome: vi.fn(),
    reset: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeDetailComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: IncomeDetailStore, useValue: mockStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeDetailComponent);
    fixture.detectChanges();
  });

  it('should show loading spinner', () => {
    const spinner = fixture.debugElement.query(By.css('.loading-container mat-spinner'));
    expect(spinner).toBeTruthy();
  });
});

describe('IncomeDetailComponent error state', () => {
  let fixture: ComponentFixture<IncomeDetailComponent>;

  const mockStore = {
    income: signal(null),
    isLoading: signal(false),
    isUpdating: signal(false),
    isDeleting: signal(false),
    isEditing: signal(false),
    isViewMode: computed(() => true),
    error: signal('Income not found.'),
    loadIncome: vi.fn(),
    reset: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeDetailComponent],
      providers: [
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: IncomeDetailStore, useValue: mockStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeDetailComponent);
    fixture.detectChanges();
  });

  it('should show error message', () => {
    const error = fixture.debugElement.query(By.css('.error-container'));
    expect(error).toBeTruthy();
    expect(error.nativeElement.textContent).toContain('Income not found.');
  });

  it('should show "Back to Income" link in error state', () => {
    const link = fixture.debugElement.query(By.css('.error-container a'));
    expect(link).toBeTruthy();
    expect(link.nativeElement.textContent).toContain('Back to Income');
  });
});
