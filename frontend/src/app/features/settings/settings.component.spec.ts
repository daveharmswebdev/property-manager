import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { SettingsComponent } from './settings.component';
import { UserManagementStore } from './stores/user-management.store';
import { InvitationDto, AccountUserDto } from '../../core/api/api.service';
import { AuthService } from '../../core/services/auth.service';

describe('SettingsComponent (User Management)', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let mockStore: {
    invitations: ReturnType<typeof signal>;
    users: ReturnType<typeof signal>;
    loading: ReturnType<typeof signal>;
    error: ReturnType<typeof signal>;
    loadInvitations: ReturnType<typeof vi.fn>;
    loadUsers: ReturnType<typeof vi.fn>;
    sendInvitation: ReturnType<typeof vi.fn>;
    resendInvitation: ReturnType<typeof vi.fn>;
    updateUserRole: ReturnType<typeof vi.fn>;
    removeUser: ReturnType<typeof vi.fn>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockAuthService: { currentUser: ReturnType<typeof signal> };

  const mockInvitations: InvitationDto[] = [
    {
      id: '1',
      email: 'pending@example.com',
      role: 'Owner',
      createdAt: new Date('2026-04-01'),
      expiresAt: new Date('2026-04-02'),
      status: 'Pending',
    },
    {
      id: '2',
      email: 'expired@example.com',
      role: 'Contributor',
      createdAt: new Date('2026-03-01'),
      expiresAt: new Date('2026-03-02'),
      status: 'Expired',
    },
  ];

  const mockUsers: AccountUserDto[] = [
    {
      userId: 'u1',
      email: 'owner@example.com',
      displayName: 'Owner User',
      role: 'Owner',
      createdAt: new Date('2026-01-01'),
    },
    {
      userId: 'u2',
      email: 'contributor@example.com',
      displayName: 'Contributor User',
      role: 'Contributor',
      createdAt: new Date('2026-02-01'),
    },
  ];

  beforeEach(async () => {
    mockStore = {
      invitations: signal(mockInvitations),
      users: signal(mockUsers),
      loading: signal(false),
      error: signal(null),
      loadInvitations: vi.fn(),
      loadUsers: vi.fn(),
      sendInvitation: vi.fn(),
      resendInvitation: vi.fn(),
      updateUserRole: vi.fn(),
      removeUser: vi.fn(),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of({ email: 'new@example.com', role: 'Owner' }),
      } as unknown as MatDialogRef<unknown>),
    };

    mockAuthService = {
      currentUser: signal({ userId: 'u1', accountId: 'a1', role: 'Owner', email: 'owner@example.com', displayName: 'Owner User' }),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsComponent, NoopAnimationsModule],
      providers: [
        { provide: UserManagementStore, useValue: mockStore },
        { provide: MatDialog, useValue: mockDialog },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load invitations on init', () => {
    expect(mockStore.loadInvitations).toHaveBeenCalled();
  });

  it('should load users on init', () => {
    expect(mockStore.loadUsers).toHaveBeenCalled();
  });

  it('should display page title', () => {
    const title = fixture.nativeElement.querySelector('h1, h2');
    expect(title?.textContent).toContain('User Management');
  });

  it('should open invite dialog when button clicked', () => {
    component.openInviteDialog();
    expect(mockDialog.open).toHaveBeenCalled();
  });

  it('should send invitation when dialog returns data', () => {
    component.openInviteDialog();
    expect(mockStore.sendInvitation).toHaveBeenCalledWith({
      email: 'new@example.com',
      role: 'Owner',
    });
  });

  it('should not send invitation when dialog is cancelled', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });

    component.openInviteDialog();
    expect(mockStore.sendInvitation).not.toHaveBeenCalled();
  });

  it('should call resendInvitation on store', () => {
    component.onResendInvitation('2');
    expect(mockStore.resendInvitation).toHaveBeenCalledWith('2');
  });

  // Story 19.7 Tests

  it('should call updateUserRole on store when role changes', () => {
    // AC #2: Role change triggers store method
    component.onRoleChange('u2', 'Owner');
    expect(mockStore.updateUserRole).toHaveBeenCalledWith({ userId: 'u2', role: 'Owner' });
  });

  it('should open confirm dialog and call removeUser on confirm', () => {
    // AC #4: Remove triggers confirm dialog then store method
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(true),
    });

    component.onRemoveUser('u2', 'contributor@example.com');

    expect(mockDialog.open).toHaveBeenCalled();
    expect(mockStore.removeUser).toHaveBeenCalledWith('u2');
  });

  it('should not call removeUser when confirm dialog is cancelled', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(false),
    });

    component.onRemoveUser('u2', 'contributor@example.com');

    expect(mockDialog.open).toHaveBeenCalled();
    expect(mockStore.removeUser).not.toHaveBeenCalled();
  });

  it('should not show remove button for the current user', () => {
    // AC #3/#5: Remove button hidden for self
    fixture.detectChanges();

    // The Account Users table is the second table
    const accountUsersTable = fixture.nativeElement.querySelectorAll('.data-table')[1];
    expect(accountUsersTable).toBeTruthy();

    const rows = accountUsersTable.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    // First row (u1 = current user) should NOT have remove button
    const firstRowRemoveBtn = rows[0]?.querySelector('button[color="warn"]');
    expect(firstRowRemoveBtn).toBeNull();
    // Second row (u2 = different user) SHOULD have remove button
    const secondRowRemoveBtn = rows[1]?.querySelector('button[color="warn"]');
    expect(secondRowRemoveBtn).toBeTruthy();
  });
});
