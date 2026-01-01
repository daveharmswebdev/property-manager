import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ReceiptsComponent } from './receipts.component';
import { ReceiptStore } from './stores/receipt.store';
import { ApiClient, UnprocessedReceiptDto } from '../../core/api/api.service';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of } from 'rxjs';

describe('ReceiptsComponent', () => {
  let component: ReceiptsComponent;
  let fixture: ComponentFixture<ReceiptsComponent>;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };
  let mockStore: {
    unprocessedReceipts: ReturnType<typeof signal<UnprocessedReceiptDto[]>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    isEmpty: ReturnType<typeof signal<boolean>>;
    unprocessedCount: ReturnType<typeof signal<number>>;
    hasReceipts: ReturnType<typeof signal<boolean>>;
    loadUnprocessedReceipts: ReturnType<typeof vi.fn>;
  };

  const mockReceipts: UnprocessedReceiptDto[] = [
    {
      id: 'receipt-1',
      createdAt: new Date(),
      propertyId: 'property-1',
      propertyName: 'Oak Street Duplex',
      contentType: 'image/jpeg',
      viewUrl: 'https://s3.amazonaws.com/test-1.jpg',
    },
    {
      id: 'receipt-2',
      createdAt: new Date(),
      propertyId: undefined,
      propertyName: undefined,
      contentType: 'image/png',
      viewUrl: 'https://s3.amazonaws.com/test-2.png',
    },
  ];

  beforeEach(async () => {
    routerSpy = {
      navigate: vi.fn(),
    };

    mockStore = {
      unprocessedReceipts: signal<UnprocessedReceiptDto[]>([]),
      isLoading: signal(false),
      error: signal<string | null>(null),
      isEmpty: signal(true),
      unprocessedCount: signal(0),
      hasReceipts: signal(false),
      loadUnprocessedReceipts: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ReceiptsComponent],
      providers: [
        provideNoopAnimations(),
        { provide: Router, useValue: routerSpy },
        { provide: ReceiptStore, useValue: mockStore },
        {
          provide: ApiClient,
          useValue: {
            receipts_GetUnprocessed: vi
              .fn()
              .mockReturnValue(of({ items: [], totalCount: 0 })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReceiptsComponent);
    component = fixture.componentInstance;
  });

  describe('initialization', () => {
    it('should create', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should call loadUnprocessedReceipts on init', () => {
      fixture.detectChanges();
      expect(mockStore.loadUnprocessedReceipts).toHaveBeenCalled();
    });

    it('should display page title', () => {
      fixture.detectChanges();
      const title = fixture.debugElement.query(By.css('.page-title'));
      expect(title.nativeElement.textContent).toContain('Receipts to Process');
    });
  });

  describe('loading state', () => {
    it('should show loading spinner when loading', () => {
      mockStore.isLoading.set(true);
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(
        By.css('[data-testid="receipts-loading"]')
      );
      expect(spinner).toBeTruthy();
    });

    it('should not show empty state or queue when loading', () => {
      mockStore.isLoading.set(true);
      fixture.detectChanges();

      const emptyState = fixture.debugElement.query(
        By.css('[data-testid="receipts-empty"]')
      );
      const queue = fixture.debugElement.query(
        By.css('[data-testid="receipts-queue"]')
      );

      expect(emptyState).toBeNull();
      expect(queue).toBeNull();
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      mockStore.isLoading.set(false);
      mockStore.isEmpty.set(true);
      fixture.detectChanges();
    });

    it('should display empty state when no receipts', () => {
      const emptyState = fixture.debugElement.query(
        By.css('[data-testid="receipts-empty"]')
      );
      expect(emptyState).toBeTruthy();
    });

    it('should show check icon in empty state', () => {
      const checkIcon = fixture.debugElement.query(By.css('.check-icon'));
      expect(checkIcon).toBeTruthy();
    });

    it('should show "All caught up!" heading', () => {
      const heading = fixture.debugElement.query(
        By.css('[data-testid="receipts-empty"] h2')
      );
      expect(heading.nativeElement.textContent).toContain('All caught up!');
    });

    it('should show "No receipts to process." message', () => {
      const message = fixture.debugElement.query(
        By.css('[data-testid="receipts-empty"] p')
      );
      expect(message.nativeElement.textContent).toContain(
        'No receipts to process.'
      );
    });
  });

  describe('receipt list', () => {
    beforeEach(() => {
      mockStore.isLoading.set(false);
      mockStore.isEmpty.set(false);
      mockStore.unprocessedReceipts.set(mockReceipts);
      fixture.detectChanges();
    });

    it('should display receipt queue when receipts exist', () => {
      const queue = fixture.debugElement.query(
        By.css('[data-testid="receipts-queue"]')
      );
      expect(queue).toBeTruthy();
    });

    it('should render correct number of receipt items', () => {
      const items = fixture.debugElement.queryAll(By.css('app-receipt-queue-item'));
      expect(items.length).toBe(2);
    });

    it('should navigate to receipt detail on click', () => {
      component.onReceiptClick(mockReceipts[0]);

      expect(routerSpy.navigate).toHaveBeenCalledWith([
        '/receipts',
        'receipt-1',
      ]);
    });
  });
});
