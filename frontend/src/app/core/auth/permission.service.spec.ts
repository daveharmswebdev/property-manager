import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { PermissionService } from './permission.service';
import { AuthService, User } from '../services/auth.service';

describe('PermissionService', () => {
  let service: PermissionService;
  let currentUserSignal: ReturnType<typeof signal<User | null>>;

  function createUser(role: string): User {
    return {
      userId: 'test-user-id',
      accountId: 'test-account-id',
      role,
      email: 'test@example.com',
      displayName: 'Test User',
      propertyId: null,
    };
  }

  beforeEach(() => {
    currentUserSignal = signal<User | null>(createUser('Owner'));

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser: currentUserSignal } },
      ],
    });

    service = TestBed.inject(PermissionService);
  });

  describe('isOwner', () => {
    it('should return true for Owner role', () => {
      currentUserSignal.set(createUser('Owner'));
      expect(service.isOwner()).toBe(true);
    });

    it('should return false for Contributor role', () => {
      currentUserSignal.set(createUser('Contributor'));
      expect(service.isOwner()).toBe(false);
    });

    it('should return false for null user', () => {
      currentUserSignal.set(null);
      expect(service.isOwner()).toBe(false);
    });
  });

  describe('isContributor', () => {
    it('should return true for Contributor role', () => {
      currentUserSignal.set(createUser('Contributor'));
      expect(service.isContributor()).toBe(true);
    });

    it('should return false for Owner role', () => {
      currentUserSignal.set(createUser('Owner'));
      expect(service.isContributor()).toBe(false);
    });

    it('should return false for null user', () => {
      currentUserSignal.set(null);
      expect(service.isContributor()).toBe(false);
    });
  });

  describe('isTenant', () => {
    it('should return true for Tenant role', () => {
      currentUserSignal.set(createUser('Tenant'));
      expect(service.isTenant()).toBe(true);
    });

    it('should return false for Owner role', () => {
      currentUserSignal.set(createUser('Owner'));
      expect(service.isTenant()).toBe(false);
    });

    it('should return false for Contributor role', () => {
      currentUserSignal.set(createUser('Contributor'));
      expect(service.isTenant()).toBe(false);
    });

    it('should return false for null user', () => {
      currentUserSignal.set(null);
      expect(service.isTenant()).toBe(false);
    });
  });

  describe('canAccess', () => {
    // AC: #1 - Owner sees all routes
    it('should allow Owner to access /expenses', () => {
      currentUserSignal.set(createUser('Owner'));
      expect(service.canAccess('/expenses')).toBe(true);
    });

    it('should allow Owner to access /properties', () => {
      currentUserSignal.set(createUser('Owner'));
      expect(service.canAccess('/properties')).toBe(true);
    });

    it('should allow Owner to access /vendors', () => {
      currentUserSignal.set(createUser('Owner'));
      expect(service.canAccess('/vendors')).toBe(true);
    });

    it('should allow Owner to access /reports', () => {
      currentUserSignal.set(createUser('Owner'));
      expect(service.canAccess('/reports')).toBe(true);
    });

    it('should allow Owner to access /settings', () => {
      currentUserSignal.set(createUser('Owner'));
      expect(service.canAccess('/settings')).toBe(true);
    });

    // AC: #2, #3 - Contributor limited access
    it('should deny Contributor access to /expenses', () => {
      currentUserSignal.set(createUser('Contributor'));
      expect(service.canAccess('/expenses')).toBe(false);
    });

    it('should deny Contributor access to /properties', () => {
      currentUserSignal.set(createUser('Contributor'));
      expect(service.canAccess('/properties')).toBe(false);
    });

    it('should deny Contributor access to /vendors', () => {
      currentUserSignal.set(createUser('Contributor'));
      expect(service.canAccess('/vendors')).toBe(false);
    });

    it('should deny Contributor access to /reports', () => {
      currentUserSignal.set(createUser('Contributor'));
      expect(service.canAccess('/reports')).toBe(false);
    });

    it('should deny Contributor access to /settings', () => {
      currentUserSignal.set(createUser('Contributor'));
      expect(service.canAccess('/settings')).toBe(false);
    });

    // Contributor-accessible routes
    it('should allow Contributor to access /receipts', () => {
      currentUserSignal.set(createUser('Contributor'));
      expect(service.canAccess('/receipts')).toBe(true);
    });

    it('should allow Contributor to access /work-orders', () => {
      currentUserSignal.set(createUser('Contributor'));
      expect(service.canAccess('/work-orders')).toBe(true);
    });

    it('should allow Contributor to access /dashboard', () => {
      currentUserSignal.set(createUser('Contributor'));
      expect(service.canAccess('/dashboard')).toBe(true);
    });

    it('should allow Contributor to access /work-orders/123', () => {
      currentUserSignal.set(createUser('Contributor'));
      expect(service.canAccess('/work-orders/123')).toBe(true);
    });

    // Tenant role — AC: #4 — Tenant denied all landlord routes
    it('should deny Tenant access to /expenses', () => {
      currentUserSignal.set(createUser('Tenant'));
      expect(service.canAccess('/expenses')).toBe(false);
    });

    it('should deny Tenant access to /properties', () => {
      currentUserSignal.set(createUser('Tenant'));
      expect(service.canAccess('/properties')).toBe(false);
    });

    it('should deny Tenant access to /vendors', () => {
      currentUserSignal.set(createUser('Tenant'));
      expect(service.canAccess('/vendors')).toBe(false);
    });

    it('should deny Tenant access to /reports', () => {
      currentUserSignal.set(createUser('Tenant'));
      expect(service.canAccess('/reports')).toBe(false);
    });

    it('should deny Tenant access to /settings', () => {
      currentUserSignal.set(createUser('Tenant'));
      expect(service.canAccess('/settings')).toBe(false);
    });

    it('should deny Tenant access to /dashboard', () => {
      currentUserSignal.set(createUser('Tenant'));
      expect(service.canAccess('/dashboard')).toBe(false);
    });

    it('should deny Tenant access to /receipts', () => {
      currentUserSignal.set(createUser('Tenant'));
      expect(service.canAccess('/receipts')).toBe(false);
    });

    it('should deny Tenant access to /work-orders', () => {
      currentUserSignal.set(createUser('Tenant'));
      expect(service.canAccess('/work-orders')).toBe(false);
    });

    // Null user
    it('should deny null user access to any route', () => {
      currentUserSignal.set(null);
      expect(service.canAccess('/dashboard')).toBe(false);
    });
  });
});
