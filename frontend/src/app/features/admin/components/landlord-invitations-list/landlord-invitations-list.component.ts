import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { AdminStore } from '../../stores/admin.store';
import { CreateLandlordInvitationDialogComponent } from '../create-landlord-invitation-dialog/create-landlord-invitation-dialog.component';

/**
 * Landlord Invitations list (Story 22.4, AC: #3, #4, #5, #6, #9).
 * Mirrors the Settings invitations table: mat-card + plain data-table + mat-chip status.
 * "Resend" is shown only for Expired rows. Empty state when there are no invitations.
 */
@Component({
  selector: 'app-landlord-invitations-list',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <mat-card class="section-card">
      <mat-card-header>
        <mat-card-title>
          <mat-icon class="section-icon">mail_outline</mat-icon>
          Landlord Invitations
        </mat-card-title>
        <button
          mat-raised-button
          color="primary"
          (click)="openInviteDialog()"
          data-testid="invite-landlord"
        >
          <mat-icon>person_add</mat-icon>
          Invite New Landlord
        </button>
      </mat-card-header>
      <mat-card-content>
        @if (store.loading()) {
          <div class="loading-container">
            <mat-spinner diameter="40"></mat-spinner>
          </div>
        }

        @if (store.invitations().length === 0) {
          <p class="empty-message">No landlord invitations yet.</p>
        } @else {
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Created</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Invited By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (invitation of store.invitations(); track invitation.id) {
                  <tr>
                    <td>{{ invitation.email }}</td>
                    <td>{{ invitation.createdAt | date: 'mediumDate' }}</td>
                    <td>{{ invitation.expiresAt | date: 'mediumDate' }}</td>
                    <td>
                      <mat-chip-set>
                        <mat-chip
                          [class.status-pending]="invitation.status === 'Pending'"
                          [class.status-expired]="invitation.status === 'Expired'"
                          [class.status-accepted]="invitation.status === 'Accepted'"
                        >
                          {{ invitation.status }}
                        </mat-chip>
                      </mat-chip-set>
                    </td>
                    <td>{{ invitation.invitedBy }}</td>
                    <td>
                      @if (invitation.status === 'Expired') {
                        <button mat-button color="primary" (click)="onResend(invitation.id!)">
                          <mat-icon>replay</mat-icon>
                          Resend
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .section-card {
        margin-bottom: 24px;
      }

      .section-icon {
        vertical-align: middle;
        margin-right: 8px;
      }

      mat-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .loading-container {
        display: flex;
        justify-content: center;
        padding: 24px;
      }

      .empty-message {
        color: var(--pm-text-secondary);
        text-align: center;
        padding: 16px;
      }

      .table-container {
        overflow-x: auto;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
      }

      .data-table th,
      .data-table td {
        text-align: left;
        padding: 12px 16px;
        border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
      }

      .data-table th {
        font-weight: 500;
        color: var(--pm-text-secondary);
        font-size: 0.875rem;
      }

      .data-table td {
        color: var(--pm-text-primary);
      }

      .status-pending {
        --mdc-chip-elevated-container-color: var(--mat-sys-primary-container, #e0e7ff);
        --mdc-chip-label-text-color: var(--mat-sys-on-primary-container, #1e40af);
      }

      .status-expired {
        --mdc-chip-elevated-container-color: var(--mat-sys-error-container, #fee2e2);
        --mdc-chip-label-text-color: var(--mat-sys-on-error-container, #991b1b);
      }

      .status-accepted {
        --mdc-chip-elevated-container-color: var(--mat-sys-tertiary-container, #dcfce7);
        --mdc-chip-label-text-color: var(--mat-sys-on-tertiary-container, #166534);
      }
    `,
  ],
})
export class LandlordInvitationsListComponent implements OnInit {
  protected readonly store = inject(AdminStore);
  private readonly dialog = inject(MatDialog);

  ngOnInit(): void {
    this.store.loadInvitations();
  }

  openInviteDialog(): void {
    const dialogRef = this.dialog.open(CreateLandlordInvitationDialogComponent, {
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.store.createInvitation(result);
      }
    });
  }

  onResend(id: string): void {
    this.store.resendInvitation(id);
  }
}
