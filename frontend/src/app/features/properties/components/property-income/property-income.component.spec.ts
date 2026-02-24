import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PropertyIncomeComponent } from './property-income.component';
import { IncomeService, IncomeDto } from '../../../income/services/income.service';

describe('PropertyIncomeComponent', () => {
  let component: PropertyIncomeComponent;
  let fixture: ComponentFixture<PropertyIncomeComponent>;
  let incomeService: {
    getIncomeByProperty: ReturnType<typeof vi.fn>;
    deleteIncome: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };
  let dialog: MatDialog;

  const mockIncome: IncomeDto[] = [
    {
      id: 'inc-1',
      propertyId: 'prop-1',
      propertyName: 'Test Property',
      amount: 1500,
      date: '2026-01-15',
      source: 'Rent',
      description: 'January rent payment',
      createdAt: '2026-01-15T10:00:00Z',
    },
    {
      id: 'inc-2',
      propertyId: 'prop-1',
      propertyName: 'Test Property',
      amount: 200,
      date: '2026-01-20',
      source: 'Parking',
      description: 'Parking fee',
      createdAt: '2026-01-20T10:00:00Z',
    },
  ];

  beforeEach(async () => {
    incomeService = {
      getIncomeByProperty: vi.fn().mockReturnValue(
        of({ items: mockIncome, totalCount: 2, ytdTotal: 1700 })
      ),
      deleteIncome: vi.fn().mockReturnValue(of(undefined)),
    };

    router = { navigate: vi.fn() };
    snackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PropertyIncomeComponent, MatDialogModule],
      providers: [
        provideAnimations(),
        provideRouter([]),
        { provide: IncomeService, useValue: incomeService },
        { provide: Router, useValue: router },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PropertyIncomeComponent);
    dialog = fixture.debugElement.injector.get(MatDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('propertyId', 'prop-1');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Data Loading', () => {
    it('should call getIncomeByProperty on init with propertyId', () => {
      expect(incomeService.getIncomeByProperty).toHaveBeenCalledWith('prop-1');
    });

    it('should set incomeEntries from response', () => {
      expect(component.incomeEntries().length).toBe(2);
      expect(component.incomeEntries()[0].id).toBe('inc-1');
    });

    it('should set totalCount from response', () => {
      expect(component.totalCount()).toBe(2);
    });
  });

  describe('Loading State', () => {
    it('should show spinner when loading', () => {
      component['isLoading'].set(true);
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('mat-spinner');
      expect(spinner).toBeTruthy();
    });

    it('should hide spinner after data loads', () => {
      const spinner = fixture.nativeElement.querySelector('mat-spinner');
      expect(spinner).toBeFalsy();
    });
  });

  describe('Error State', () => {
    beforeEach(() => {
      incomeService.getIncomeByProperty.mockReturnValue(
        throwError(() => new Error('API Error'))
      );

      const newFixture = TestBed.createComponent(PropertyIncomeComponent);
      newFixture.componentRef.setInput('propertyId', 'prop-1');
      newFixture.detectChanges();
      fixture = newFixture;
      component = newFixture.componentInstance;
    });

    it('should show error message on API failure', () => {
      const errorState = fixture.nativeElement.querySelector('.error-state');
      expect(errorState).toBeTruthy();
      expect(errorState.textContent).toContain('Failed to load income');
    });

    it('should show retry button', () => {
      const retryButton = fixture.nativeElement.querySelector('.error-state button');
      expect(retryButton).toBeTruthy();
      expect(retryButton.textContent).toContain('Retry');
    });

    it('should reload income when retry is clicked', () => {
      incomeService.getIncomeByProperty.mockClear();
      incomeService.getIncomeByProperty.mockReturnValue(
        of({ items: mockIncome, totalCount: 2, ytdTotal: 1700 })
      );

      const retryButton = fixture.nativeElement.querySelector('.error-state button');
      retryButton.click();
      fixture.detectChanges();

      expect(incomeService.getIncomeByProperty).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    beforeEach(() => {
      incomeService.getIncomeByProperty.mockReturnValue(
        of({ items: [], totalCount: 0, ytdTotal: 0 })
      );

      const newFixture = TestBed.createComponent(PropertyIncomeComponent);
      newFixture.componentRef.setInput('propertyId', 'prop-1');
      newFixture.detectChanges();
      fixture = newFixture;
      component = newFixture.componentInstance;
    });

    it('should show empty state when no income', () => {
      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No income recorded yet');
    });
  });

  describe('Table Rendering', () => {
    it('should render table with correct column headers', () => {
      const header = fixture.nativeElement.querySelector('.list-header');
      expect(header).toBeTruthy();
      expect(header.textContent).toContain('Date');
      expect(header.textContent).toContain('Source');
      expect(header.textContent).toContain('Description');
      expect(header.textContent).toContain('Amount');
      expect(header.textContent).toContain('Actions');
    });

    it('should NOT have a Property column', () => {
      const header = fixture.nativeElement.querySelector('.list-header');
      expect(header.textContent).not.toContain('Property');
    });

    it('should render income rows', () => {
      const rows = fixture.nativeElement.querySelectorAll('.income-row');
      expect(rows.length).toBe(2);
    });

    it('should display source in rows', () => {
      const sources = fixture.nativeElement.querySelectorAll('.cell-source');
      expect(sources[0].textContent.trim()).toBe('Rent');
    });

    it('should display description in rows', () => {
      const descriptions = fixture.nativeElement.querySelectorAll('.cell-description');
      expect(descriptions[0].textContent.trim()).toBe('January rent payment');
    });

    it('should display amount with currency format', () => {
      const amounts = fixture.nativeElement.querySelectorAll('.cell-amount');
      expect(amounts[0].textContent).toContain('$1,500');
    });

    it('should show total count in header', () => {
      const title = fixture.nativeElement.querySelector('mat-card-title');
      expect(title.textContent).toContain('(2)');
    });

    it('should show dash when source is empty', () => {
      incomeService.getIncomeByProperty.mockReturnValue(
        of({
          items: [{ ...mockIncome[0], source: undefined }],
          totalCount: 1,
          ytdTotal: 1500,
        })
      );

      const newFixture = TestBed.createComponent(PropertyIncomeComponent);
      newFixture.componentRef.setInput('propertyId', 'prop-1');
      newFixture.detectChanges();

      const source = newFixture.nativeElement.querySelector('.cell-source');
      expect(source.textContent.trim()).toBe('\u2014');
    });
  });

  describe('Row Click Navigation', () => {
    it('should navigate to income detail on row click', () => {
      const rows = fixture.nativeElement.querySelectorAll('.income-row');
      rows[0].click();
      expect(router.navigate).toHaveBeenCalledWith(['/income', 'inc-1']);
    });
  });

  describe('Delete Income', () => {
    it('should call onDeleteIncome when delete button clicked', () => {
      const spy = vi.spyOn(component, 'onDeleteIncome');

      // Delete button is the second button inside .cell-actions
      const actionsCells = fixture.nativeElement.querySelectorAll('.cell-actions');
      const deleteBtn = actionsCells[0].querySelectorAll('button')[1];
      deleteBtn.click();

      expect(spy).toHaveBeenCalledWith(mockIncome[0]);
    });

    it('should call deleteIncome service and refresh on confirm', () => {
      vi.spyOn(dialog, 'open').mockReturnValue({
        afterClosed: () => of(true),
      } as any);

      component.onDeleteIncome(mockIncome[0]);
      fixture.detectChanges();

      expect(incomeService.deleteIncome).toHaveBeenCalledWith('inc-1');
      expect(snackBar.open).toHaveBeenCalledWith('Income deleted', 'Close', expect.any(Object));
    });

    it('should NOT call deleteIncome when dialog is cancelled', () => {
      vi.spyOn(dialog, 'open').mockReturnValue({
        afterClosed: () => of(false),
      } as any);

      component.onDeleteIncome(mockIncome[0]);

      expect(incomeService.deleteIncome).not.toHaveBeenCalled();
    });
  });

  describe('Add Income Button', () => {
    it('should emit addClick when Add Income button is clicked', () => {
      const addClickSpy = vi.fn();
      component.addClick.subscribe(addClickSpy);

      const addBtn = fixture.nativeElement.querySelector('.add-income-btn');
      addBtn.click();

      expect(addClickSpy).toHaveBeenCalled();
    });
  });

  describe('Edit Action', () => {
    it('should navigate to income detail on edit click', () => {
      const editBtn = fixture.nativeElement.querySelector('.cell-actions button:first-child');
      editBtn.click();

      expect(router.navigate).toHaveBeenCalledWith(['/income', 'inc-1']);
    });
  });
});
