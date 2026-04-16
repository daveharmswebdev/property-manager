import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../services/auth.service';
import { ReceiptStore } from '../../../features/receipts/stores/receipt.store';

/**
 * Navigation item interface for sidebar links
 */
interface NavItem {
  label: string;
  route: string;
  icon: string;
  badge?: number | null;
}

/**
 * Sidebar Navigation Component (AC7.1, AC7.2)
 *
 * Dark sidebar with:
 * - Upkeep Blue accents for active states
 * - Navigation items with icons
 * - User profile section in footer
 * - Logout functionality
 */
@Component({
  selector: 'app-sidebar-nav',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatListModule,
    MatIconModule,
    MatBadgeModule,
    MatButtonModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './sidebar-nav.component.html',
  styleUrl: './sidebar-nav.component.scss',
})
export class SidebarNavComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly receiptStore = inject(ReceiptStore);

  readonly currentUser = this.authService.currentUser;
  readonly isLoggingOut = signal(false);

  /** Unprocessed receipt count for badge (AC-5.3.1) */
  readonly unprocessedReceiptCount = this.receiptStore.unprocessedCount;

  // Navigation items filtered by role (AC7.1, AC-19.5 #1, #2)
  readonly navItems = computed<NavItem[]>(() => {
    const allItems: NavItem[] = [
      { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
      { label: 'Properties', route: '/properties', icon: 'home_work' },
      { label: 'Expenses', route: '/expenses', icon: 'receipt_long' },
      { label: 'Income', route: '/income', icon: 'payments' },
      { label: 'Receipts', route: '/receipts', icon: 'document_scanner' },
      { label: 'Vendors', route: '/vendors', icon: 'business' },
      { label: 'Work Orders', route: '/work-orders', icon: 'assignment' },
      { label: 'Reports', route: '/reports', icon: 'assessment' },
      { label: 'Settings', route: '/settings', icon: 'settings' },
    ];

    if (this.authService.currentUser()?.role === 'Owner') {
      return allItems;
    }

    // Tenant sees only Dashboard (Story 20.5, AC #5)
    if (this.authService.currentUser()?.role === 'Tenant') {
      return [{ label: 'Dashboard', route: '/tenant', icon: 'dashboard' }];
    }

    // Contributor sees only these routes
    const contributorRoutes = ['/dashboard', '/receipts', '/work-orders'];
    return allItems.filter((item) => contributorRoutes.includes(item.route));
  });

  ngOnInit(): void {
    // Load unprocessed receipts on init to populate badge count
    // Skip for Tenant users who don't use receipts (Story 20.5)
    if (this.authService.currentUser()?.role !== 'Tenant') {
      this.receiptStore.loadUnprocessedReceipts();
    }
  }

  /**
   * Get badge count for a nav item (AC-5.3.1)
   * Currently only Receipts has a dynamic badge
   */
  getBadgeCount(item: NavItem): number {
    if (item.route === '/receipts') {
      return this.unprocessedReceiptCount();
    }
    return item.badge ?? 0;
  }

  /**
   * Get user display name - prefer displayName, fall back to email, then 'User' (AC-7.2.1, AC-7.2.2)
   */
  get userDisplayName(): string {
    const user = this.currentUser();
    if (!user) return 'User';
    return user.displayName || user.email || 'User';
  }

  /**
   * Logout handler (AC7.2) - calls auth service and redirects to login
   */
  logout(): void {
    this.authService.logoutAndRedirect(this.isLoggingOut);
  }
}
