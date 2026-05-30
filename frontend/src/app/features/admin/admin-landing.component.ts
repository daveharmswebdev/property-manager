import { Component } from '@angular/core';
import { LandlordInvitationsListComponent } from './components/landlord-invitations-list/landlord-invitations-list.component';

/**
 * Admin Console landing page (Story 22.4, AC: #2).
 * Platform-level area, gated by platformAdminGuard. Currently hosts the
 * Landlord Invitations section.
 */
@Component({
  selector: 'app-admin-landing',
  standalone: true,
  imports: [LandlordInvitationsListComponent],
  template: `
    <div class="admin-container">
      <div class="page-header">
        <h2>Admin Console</h2>
      </div>

      <app-landlord-invitations-list />
    </div>
  `,
  styles: [
    `
      .admin-container {
        padding: 24px;
        max-width: 960px;
        margin: 0 auto;
      }

      .page-header {
        margin-bottom: 24px;
      }

      .page-header h2 {
        margin: 0;
        color: var(--pm-text-primary);
      }
    `,
  ],
})
export class AdminLandingComponent {}
