import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AdminStore } from './admin.store';
import { ApiClient, LandlordInvitationDto } from '../../../core/api/api.service';

describe('AdminStore', () => {
  let store: InstanceType<typeof AdminStore>;
  let mockApiClient: {
    adminLandlordInvitations_GetLandlordInvitations: ReturnType<typeof vi.fn>;
    adminLandlordInvitations_CreateLandlordInvitation: ReturnType<typeof vi.fn>;
    adminLandlordInvitations_ResendLandlordInvitation: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };

  const mockInvitations: LandlordInvitationDto[] = [
    {
      id: '1',
      email: 'landlord1@example.com',
      createdAt: new Date(),
      expiresAt: new Date(),
      status: 'Pending',
      invitedBy: 'Admin',
    },
    {
      id: '2',
      email: 'landlord2@example.com',
      createdAt: new Date(),
      expiresAt: new Date(),
      status: 'Expired',
      invitedBy: 'Admin',
    },
  ];

  beforeEach(() => {
    mockApiClient = {
      adminLandlordInvitations_GetLandlordInvitations: vi.fn(),
      adminLandlordInvitations_CreateLandlordInvitation: vi.fn(),
      adminLandlordInvitations_ResendLandlordInvitation: vi.fn(),
    };
    mockSnackBar = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AdminStore,
        { provide: ApiClient, useValue: mockApiClient },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    });

    store = TestBed.inject(AdminStore);
  });

  describe('initial state', () => {
    it('should have empty invitations, loading false, error null', () => {
      expect(store.invitations()).toEqual([]);
      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
    });
  });

  describe('loadInvitations (AC: #3)', () => {
    it('should load invitations from API', () => {
      mockApiClient.adminLandlordInvitations_GetLandlordInvitations.mockReturnValue(
        of({ items: mockInvitations, totalCount: 2 }),
      );

      store.loadInvitations();

      expect(store.invitations()).toEqual(mockInvitations);
      expect(store.loading()).toBe(false);
    });

    it('should set error on failure', () => {
      mockApiClient.adminLandlordInvitations_GetLandlordInvitations.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      store.loadInvitations();

      expect(store.error()).toBe('Failed to load landlord invitations');
      expect(store.loading()).toBe(false);
    });
  });

  describe('createInvitation (AC: #5)', () => {
    it('should create invitation, show success snackbar, and reload list', () => {
      mockApiClient.adminLandlordInvitations_CreateLandlordInvitation.mockReturnValue(
        of({ invitationId: 'new-id', message: 'sent' }),
      );
      mockApiClient.adminLandlordInvitations_GetLandlordInvitations.mockReturnValue(
        of({ items: mockInvitations, totalCount: 2 }),
      );

      store.createInvitation({ email: 'new@example.com' });

      expect(mockApiClient.adminLandlordInvitations_CreateLandlordInvitation).toHaveBeenCalledWith({
        email: 'new@example.com',
      });
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Landlord invitation sent to new@example.com',
        'Close',
        expect.objectContaining({ duration: 3000 }),
      );
      // Reload was triggered
      expect(mockApiClient.adminLandlordInvitations_GetLandlordInvitations).toHaveBeenCalled();
      expect(store.loading()).toBe(false);
    });

    it('should set error and show error snackbar on failure', () => {
      mockApiClient.adminLandlordInvitations_CreateLandlordInvitation.mockReturnValue(
        throwError(() => ({
          status: 400,
          errors: { Email: ['This email is already registered'] },
        })),
      );

      store.createInvitation({ email: 'dupe@example.com' });

      expect(store.error()).toBe('This email is already registered');
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'This email is already registered',
        'Close',
        expect.objectContaining({ duration: 5000 }),
      );
      expect(store.loading()).toBe(false);
    });
  });

  describe('resendInvitation (AC: #6)', () => {
    it('should resend, show success snackbar, and reload list', () => {
      mockApiClient.adminLandlordInvitations_ResendLandlordInvitation.mockReturnValue(
        of({ invitationId: 'new-id', message: 'resent' }),
      );
      mockApiClient.adminLandlordInvitations_GetLandlordInvitations.mockReturnValue(
        of({ items: mockInvitations, totalCount: 2 }),
      );

      store.resendInvitation('expired-id');

      expect(mockApiClient.adminLandlordInvitations_ResendLandlordInvitation).toHaveBeenCalledWith(
        'expired-id',
      );
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Landlord invitation resent successfully',
        'Close',
        expect.objectContaining({ duration: 3000 }),
      );
      expect(mockApiClient.adminLandlordInvitations_GetLandlordInvitations).toHaveBeenCalled();
      expect(store.loading()).toBe(false);
    });

    it('should set error and show error snackbar on failure', () => {
      mockApiClient.adminLandlordInvitations_ResendLandlordInvitation.mockReturnValue(
        throwError(() => ({ status: 400, title: 'Can only resend expired invitations' })),
      );

      store.resendInvitation('some-id');

      expect(store.error()).toBe('Can only resend expired invitations');
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Can only resend expired invitations',
        'Close',
        expect.objectContaining({ duration: 5000 }),
      );
      expect(store.loading()).toBe(false);
    });
  });
});
