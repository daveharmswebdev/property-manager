import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { NotFoundComponent } from './not-found.component';

describe('NotFoundComponent', () => {
  let component: NotFoundComponent;
  let fixture: ComponentFixture<NotFoundComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotFoundComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NotFoundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default title (AC-2.3.6)', () => {
    expect(component.title).toBe('Property not found');
  });

  it('should have default message (AC-2.3.6)', () => {
    expect(component.message).toBe(
      "The property you're looking for doesn't exist or you don't have access to it."
    );
  });

  it('should have default returnLink to dashboard', () => {
    expect(component.returnLink).toBe('/dashboard');
  });

  it('should have default returnLinkText', () => {
    expect(component.returnLinkText).toBe('Back to Dashboard');
  });

  it('should display search_off icon', () => {
    const icon = fixture.debugElement.query(By.css('.not-found-icon'));
    expect(icon.nativeElement.textContent.trim()).toBe('search_off');
  });

  it('should display the title in h1 element', () => {
    const title = fixture.debugElement.query(By.css('h1'));
    expect(title.nativeElement.textContent.trim()).toBe('Property not found');
  });

  it('should display the message in p element', () => {
    const message = fixture.debugElement.query(By.css('p'));
    expect(message.nativeElement.textContent.trim()).toBe(
      "The property you're looking for doesn't exist or you don't have access to it."
    );
  });

  it('should display return button with correct text', () => {
    const button = fixture.debugElement.query(By.css('button'));
    expect(button.nativeElement.textContent).toContain('Back to Dashboard');
  });

  it('should have correct returnLink value', () => {
    expect(component.returnLink).toBe('/dashboard');
  });

  it('should display arrow_back icon in return button', () => {
    const buttonIcon = fixture.debugElement.query(By.css('button mat-icon'));
    expect(buttonIcon.nativeElement.textContent.trim()).toBe('arrow_back');
  });

  it('should have not-found-container wrapper', () => {
    const container = fixture.debugElement.query(By.css('.not-found-container'));
    expect(container).toBeTruthy();
  });

  it('should have not-found-card inside mat-card', () => {
    const card = fixture.debugElement.query(By.css('.not-found-card'));
    expect(card).toBeTruthy();
  });
});

describe('NotFoundComponent with custom inputs', () => {
  let component: NotFoundComponent;
  let fixture: ComponentFixture<NotFoundComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotFoundComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NotFoundComponent);
    component = fixture.componentInstance;
    component.title = 'Work Order not found';
    component.message = 'The work order does not exist.';
    component.returnLink = '/work-orders';
    component.returnLinkText = 'Back to Work Orders';
    fixture.detectChanges();
  });

  it('should display custom title', () => {
    const title = fixture.debugElement.query(By.css('h1'));
    expect(title.nativeElement.textContent.trim()).toBe('Work Order not found');
  });

  it('should display custom message', () => {
    const message = fixture.debugElement.query(By.css('p'));
    expect(message.nativeElement.textContent.trim()).toBe(
      'The work order does not exist.'
    );
  });

  it('should have custom returnLink value', () => {
    expect(component.returnLink).toBe('/work-orders');
  });

  it('should display custom return link text', () => {
    const button = fixture.debugElement.query(By.css('button'));
    expect(button.nativeElement.textContent).toContain('Back to Work Orders');
  });
});

describe('NotFoundComponent security behavior (AC-2.3.6)', () => {
  let component: NotFoundComponent;
  let fixture: ComponentFixture<NotFoundComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotFoundComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NotFoundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show same message for non-existent and unauthorized properties (AC-2.3.6)', () => {
    // Security requirement: Don't reveal whether property exists but belongs to another user
    // Both scenarios should show the same generic message
    const message = fixture.debugElement.query(By.css('p'));
    expect(message.nativeElement.textContent).toContain(
      "doesn't exist or you don't have access"
    );
  });
});
