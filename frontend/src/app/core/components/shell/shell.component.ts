import { Component, inject, signal, computed, effect, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { SidebarNavComponent } from '../sidebar-nav/sidebar-nav.component';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { YearSelectorComponent } from '../../../shared/components/year-selector/year-selector.component';
import { MobileCaptureFabComponent } from '../../../features/receipts/components/mobile-capture-fab/mobile-capture-fab.component';
import { ReceiptSignalRService } from '../../../features/receipts/services/receipt-signalr.service';
import { SignalRService } from '../../signalr/signalr.service';
import { ReceiptStore } from '../../../features/receipts/stores/receipt.store';
import { AuthService } from '../../services/auth.service';
import { BREAKPOINTS } from '../../constants/layout.constants';

/**
 * Shell Component - Main layout wrapper for authenticated views (AC7.1, AC7.3, AC-5.6.1)
 *
 * Provides:
 * - Dark sidebar navigation on desktop (≥1024px) - always visible
 * - Collapsible sidebar on tablet (768-1023px) - toggle with hamburger menu
 * - Bottom tab navigation on mobile (<768px)
 * - Light background content area (#FAFAFA)
 * - Responsive layout with smooth transitions
 * - SignalR initialization for real-time receipt updates (AC-5.6.1)
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatProgressSpinnerModule,
    SidebarNavComponent,
    BottomNavComponent,
    YearSelectorComponent,
    MobileCaptureFabComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit, OnDestroy {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly receiptSignalR = inject(ReceiptSignalRService);
  private readonly signalR = inject(SignalRService);
  private readonly receiptStore = inject(ReceiptStore);
  private readonly authService = inject(AuthService);

  // Breakpoint detection using CDK BreakpointObserver
  // Mobile: <768px, Tablet: 768-1023px, Desktop: ≥1024px
  private readonly isDesktop$ = this.breakpointObserver
    .observe([BREAKPOINTS.DESKTOP_QUERY])
    .pipe(map((result) => result.matches));

  private readonly isTablet$ = this.breakpointObserver
    .observe([BREAKPOINTS.TABLET_QUERY])
    .pipe(map((result) => result.matches));

  private readonly isMobile$ = this.breakpointObserver
    .observe([BREAKPOINTS.MOBILE_QUERY])
    .pipe(map((result) => result.matches));

  // Convert observables to signals for reactive template binding
  readonly isDesktop = toSignal(this.isDesktop$, { initialValue: false });
  readonly isTablet = toSignal(this.isTablet$, { initialValue: false });
  readonly isMobile = toSignal(this.isMobile$, { initialValue: false });

  // Sidebar open state for tablet (collapsible)
  readonly sidebarOpen = signal(false);

  // Computed: Show sidebar on desktop (always) or tablet (when open)
  readonly showSidebar = computed(() => this.isDesktop() || this.isTablet());

  // Computed: Sidebar mode - 'side' for desktop, 'over' for tablet
  readonly sidebarMode = computed(() => this.isDesktop() ? 'side' : 'over');

  // Computed: Sidebar should be opened - always on desktop, toggle on tablet
  readonly sidebarOpened = computed(() => this.isDesktop() || (this.isTablet() && this.sidebarOpen()));

  // Computed: Show bottom nav only on mobile
  readonly showBottomNav = computed(() => this.isMobile());

  // Computed: Show hamburger menu on tablet
  readonly showMenuButton = computed(() => this.isTablet());

  // Logout state for mobile header (AC-7.1.3)
  readonly isLoggingOut = signal(false);

  /** Track previous reconnecting state for detecting reconnection completion */
  private wasReconnecting = false;

  /** Effect to handle SignalR reconnection (AC-5.6.4) */
  private reconnectEffect = effect(() => {
    const isReconnecting = this.signalR.isReconnecting();
    const isConnected = this.signalR.isConnected();

    // Detect transition: wasReconnecting=true → isReconnecting=false && isConnected=true
    if (this.wasReconnecting && !isReconnecting && isConnected) {
      // Connection restored after reconnection - sync state
      this.receiptSignalR.handleReconnection();
    }

    // Update tracking state
    this.wasReconnecting = isReconnecting;
  });

  constructor() {
    // Close sidebar when switching away from tablet mode
    effect(() => {
      if (!this.isTablet()) {
        this.sidebarOpen.set(false);
      }
    });
  }

  ngOnInit(): void {
    // Initialize SignalR for real-time receipt updates (AC-5.6.1)
    this.receiptSignalR.initialize();

    // Load initial receipt count for badge
    this.receiptStore.loadUnprocessedReceipts();
  }

  ngOnDestroy(): void {
    // Disconnect SignalR when shell is destroyed (logout)
    this.signalR.disconnect();
  }

  /**
   * Toggle sidebar visibility (tablet only)
   */
  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  /**
   * Close sidebar (used when clicking backdrop on tablet)
   */
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  /**
   * Logout handler for mobile header (AC-7.1.2)
   * Calls auth service and redirects to login
   */
  logout(): void {
    this.authService.logoutAndRedirect(this.isLoggingOut);
  }
}
