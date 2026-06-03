import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { LandlordInvitationsListComponent } from './landlord-invitations-list.component';
import { AdminStore } from '../../stores/admin.store';
import { LandlordInvitationDto } from '../../../../core/api/api.service';

describe('LandlordInvitationsListComponent', () => {
  let component: LandlordInvitationsListComponent;
  let fixture: ComponentFixture<LandlordInvitationsListComponent>;
  let invitationsSignal: ReturnType<typeof signal<LandlordInvitationDto[]>>;
  let mockStore: {
    invitations: ReturnType<typeof signal<LandlordInvitationDto[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    loadInvitations: ReturnType<typeof vi.fn>;
    createInvitation: ReturnType<typeof vi.fn>;
    resendInvitation: ReturnType<typeof vi.fn>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };

  const pendingRow: LandlordInvitationDto = {
    id: 'p1',
    email: 'pending@example.com',
    createdAt: new Date(),
    expiresAt: new Date(),
    status: 'Pending',
    invitedBy: 'Admin',
  };

  const expiredRow: LandlordInvitationDto = {
    id: 'e1',
    email: 'expired@example.com',
    createdAt: new Date(),
    expiresAt: new Date(),
    status: 'Expired',
    invitedBy: 'Admin',
  };

  async function setup(invitations: LandlordInvitationDto[]) {
    invitationsSignal = signal<LandlordInvitationDto[]>(invitations);
    mockStore = {
      invitations: invitationsSignal,
      loading: signal(false),
      loadInvitations: vi.fn(),
      createInvitation: vi.fn(),
      resendInvitation: vi.fn(),
    };
    mockDialog = { open: vi.fn() };

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LandlordInvitationsListComponent, NoopAnimationsModule],
      providers: [
        { provide: AdminStore, useValue: mockStore },
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandlordInvitationsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should call loadInvitations on init (AC: #3)', async () => {
    await setup([]);
    expect(mockStore.loadInvitations).toHaveBeenCalled();
  });

  it('should show empty state when there are no invitations (AC: #3)', async () => {
    await setup([]);
    const empty = fixture.debugElement.query(By.css('.empty-message'));
    expect(empty?.nativeElement.textContent).toContain('No landlord invitations yet.');
  });

  it('should render a row per invitation (AC: #3)', async () => {
    await setup([pendingRow, expiredRow]);
    const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
    expect(rows.length).toBe(2);
  });

  it('should show Resend only for Expired rows (AC: #6)', async () => {
    await setup([pendingRow, expiredRow]);
    const resendButtons = fixture.debugElement.queryAll(By.css('tbody tr button'));
    // Only the expired row has a Resend button
    expect(resendButtons.length).toBe(1);
    expect(resendButtons[0].nativeElement.textContent).toContain('Resend');
  });

  it('should call store.resendInvitation when Resend is clicked (AC: #6)', async () => {
    await setup([expiredRow]);
    const resendButton = fixture.debugElement.query(By.css('tbody tr button'));
    resendButton.nativeElement.click();
    expect(mockStore.resendInvitation).toHaveBeenCalledWith('e1');
  });

  it('should open the create dialog and call createInvitation on close with a value (AC: #4, #5)', async () => {
    await setup([]);
    mockDialog.open.mockReturnValue({
      afterClosed: () => of({ email: 'new@example.com' }),
    });

    component.openInviteDialog();

    expect(mockDialog.open).toHaveBeenCalled();
    expect(mockStore.createInvitation).toHaveBeenCalledWith({ email: 'new@example.com' });
  });

  it('should NOT call createInvitation when the dialog is cancelled', async () => {
    await setup([]);
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });

    component.openInviteDialog();

    expect(mockStore.createInvitation).not.toHaveBeenCalled();
  });
});
