import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserManagementStore } from './user-management.store';
import {
  ApiClient,
  InvitationDto,
  AccountUserDto,
} from '../../../core/api/api.service';

describe('UserManagementStore', () => {
  let store: InstanceType<typeof UserManagementStore>;
  let mockApiClient: {
    invitations_GetAccountInvitations: ReturnType<typeof vi.fn>;
    invitations_CreateInvitation: ReturnType<typeof vi.fn>;
    invitations_ResendInvitation: ReturnType<typeof vi.fn>;
    accountUsers_GetAccountUsers: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };

  const mockInvitations: InvitationDto[] = [
    {
      id: '1',
      email: 'user1@example.com',
      role: 'Owner',
      createdAt: new Date(),
      expiresAt: new Date(),
      status: 'Pending',
    },
    {
      id: '2',
      email: 'user2@example.com',
      role: 'Contributor',
      createdAt: new Date(),
      expiresAt: new Date(),
      status: 'Expired',
    },
  ];

  const mockUsers: AccountUserDto[] = [
    {
      userId: '1',
      email: 'owner@example.com',
      displayName: 'Owner',
      role: 'Owner',
      createdAt: new Date(),
    },
  ];

  beforeEach(() => {
    mockApiClient = {
      invitations_GetAccountInvitations: vi.fn(),
      invitations_CreateInvitation: vi.fn(),
      invitations_ResendInvitation: vi.fn(),
      accountUsers_GetAccountUsers: vi.fn(),
    };
    mockSnackBar = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        UserManagementStore,
        { provide: ApiClient, useValue: mockApiClient },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    });

    store = TestBed.inject(UserManagementStore);
  });

  describe('initial state', () => {
    it('should have empty invitations array', () => {
      expect(store.invitations()).toEqual([]);
    });

    it('should have empty users array', () => {
      expect(store.users()).toEqual([]);
    });

    it('should have loading false', () => {
      expect(store.loading()).toBe(false);
    });

    it('should have error null', () => {
      expect(store.error()).toBeNull();
    });
  });

  describe('loadInvitations', () => {
    it('should load invitations from API', () => {
      mockApiClient.invitations_GetAccountInvitations.mockReturnValue(
        of({ items: mockInvitations, totalCount: 2 }),
      );

      store.loadInvitations();

      expect(store.invitations()).toEqual(mockInvitations);
      expect(store.loading()).toBe(false);
    });

    it('should set error on failure', () => {
      mockApiClient.invitations_GetAccountInvitations.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      store.loadInvitations();

      expect(store.error()).toBe('Failed to load invitations');
      expect(store.loading()).toBe(false);
    });
  });

  describe('loadUsers', () => {
    it('should load users from API', () => {
      mockApiClient.accountUsers_GetAccountUsers.mockReturnValue(
        of({ items: mockUsers, totalCount: 1 }),
      );

      store.loadUsers();

      expect(store.users()).toEqual(mockUsers);
      expect(store.loading()).toBe(false);
    });

    it('should set error on failure', () => {
      mockApiClient.accountUsers_GetAccountUsers.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      store.loadUsers();

      expect(store.error()).toBe('Failed to load users');
      expect(store.loading()).toBe(false);
    });
  });

  describe('sendInvitation', () => {
    it('should create invitation and reload list', () => {
      mockApiClient.invitations_CreateInvitation.mockReturnValue(
        of({ invitationId: 'new-id', message: 'sent' }),
      );
      mockApiClient.invitations_GetAccountInvitations.mockReturnValue(
        of({ items: mockInvitations, totalCount: 2 }),
      );

      store.sendInvitation({ email: 'new@example.com', role: 'Contributor' });

      expect(mockApiClient.invitations_CreateInvitation).toHaveBeenCalledWith({
        email: 'new@example.com',
        role: 'Contributor',
      });
      expect(mockSnackBar.open).toHaveBeenCalled();
      expect(store.loading()).toBe(false);
    });

    it('should set error on failure', () => {
      mockApiClient.invitations_CreateInvitation.mockReturnValue(
        throwError(() => ({ status: 400, message: 'Bad Request' })),
      );

      store.sendInvitation({ email: 'bad@example.com', role: 'Owner' });

      expect(store.error()).toBeTruthy();
      expect(store.loading()).toBe(false);
    });
  });

  describe('resendInvitation', () => {
    it('should resend invitation and reload list', () => {
      mockApiClient.invitations_ResendInvitation.mockReturnValue(
        of({ invitationId: 'new-id', message: 'resent' }),
      );
      mockApiClient.invitations_GetAccountInvitations.mockReturnValue(
        of({ items: mockInvitations, totalCount: 2 }),
      );

      store.resendInvitation('expired-id');

      expect(mockApiClient.invitations_ResendInvitation).toHaveBeenCalledWith('expired-id');
      expect(mockSnackBar.open).toHaveBeenCalled();
      expect(store.loading()).toBe(false);
    });

    it('should set error on failure', () => {
      mockApiClient.invitations_ResendInvitation.mockReturnValue(
        throwError(() => ({ status: 400, message: 'Bad Request' })),
      );

      store.resendInvitation('some-id');

      expect(store.error()).toBeTruthy();
      expect(store.loading()).toBe(false);
    });
  });
});
