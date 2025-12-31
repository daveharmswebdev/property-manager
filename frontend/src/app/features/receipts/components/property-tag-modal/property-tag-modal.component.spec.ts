import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PropertyTagModalComponent } from './property-tag-modal.component';
import { MatDialogRef } from '@angular/material/dialog';
import { PropertyStore } from '../../../properties/stores/property.store';
import { signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('PropertyTagModalComponent', () => {
  let component: PropertyTagModalComponent;
  let fixture: ComponentFixture<PropertyTagModalComponent>;
  let dialogRefSpy: {
    close: ReturnType<typeof vi.fn>;
  };
  let propertyStoreSpy: {
    properties: ReturnType<typeof signal>;
    loadProperties: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    dialogRefSpy = {
      close: vi.fn(),
    };

    propertyStoreSpy = {
      properties: signal([
        { id: 'prop-1', name: 'Property 1', street: '123 Main St', city: 'Austin', state: 'TX', zipCode: '78701', expenseTotal: 100, incomeTotal: 200 },
        { id: 'prop-2', name: 'Property 2', street: '456 Oak Ave', city: 'Austin', state: 'TX', zipCode: '78702', expenseTotal: 150, incomeTotal: 250 },
      ]),
      loadProperties: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PropertyTagModalComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: PropertyStore, useValue: propertyStoreSpy },
      ],
    });

    fixture = TestBed.createComponent(PropertyTagModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('property list (AC-5.2.3)', () => {
    it('should display properties in dropdown', () => {
      const select = fixture.nativeElement.querySelector('mat-select');
      expect(select).toBeTruthy();
    });

    it('should load properties on init if not already loaded', () => {
      propertyStoreSpy.properties = signal([]);

      fixture = TestBed.createComponent(PropertyTagModalComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(propertyStoreSpy.loadProperties).toHaveBeenCalled();
    });

    it('should not load properties if already loaded', () => {
      expect(propertyStoreSpy.loadProperties).not.toHaveBeenCalled();
    });
  });

  describe('skip button (AC-5.2.4)', () => {
    it('should close dialog with null propertyId when Skip clicked', () => {
      component.onSkip();

      expect(dialogRefSpy.close).toHaveBeenCalledWith({ propertyId: null });
    });
  });

  describe('save button (AC-5.2.3)', () => {
    it('should close dialog with selected propertyId when Save clicked', () => {
      component.selectedPropertyId = 'prop-1';

      component.onSave();

      expect(dialogRefSpy.close).toHaveBeenCalledWith({ propertyId: 'prop-1' });
    });

    it('should close dialog with null if no property selected', () => {
      component.selectedPropertyId = null;

      component.onSave();

      expect(dialogRefSpy.close).toHaveBeenCalledWith({ propertyId: null });
    });
  });
});
