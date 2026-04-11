import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { UserManagementStore } from './stores/user-management.store';
import { InviteUserDialogComponent } from './components/invite-user-dialog/invite-user-dialog.component';

/**
 * User Management page (AC: #1, #3, #4, #7).
 * Replaces the placeholder SettingsComponent.
 * Displays invitations and account users.
 */
@Component({
  selector: 'app-settings',
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
    <div class="user-management-container">
      <div class="page-header">
        <h2>User Management</h2>
        <button mat-raised-button color="primary" (click)="openInviteDialog()">
          <mat-icon>person_add</mat-icon>
          Invite User
        </button>
      </div>

      @if (store.loading()) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      }

      <!-- Pending Invitations Section -->
      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon class="section-icon">mail_outline</mat-icon>
            Pending Invitations
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (store.invitations().length === 0) {
            <p class="empty-message">No invitations sent yet.</p>
          } @else {
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Sent</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (invitation of store.invitations(); track invitation.id) {
                    <tr>
                      <td>{{ invitation.email }}</td>
                      <td>{{ invitation.role }}</td>
                      <td>{{ invitation.createdAt | date: 'mediumDate' }}</td>
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
                      <td>
                        @if (invitation.status === 'Expired') {
                          <button
                            mat-button
                            color="primary"
                            (click)="onResendInvitation(invitation.id!)"
                          >
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

      <!-- Account Users Section -->
      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon class="section-icon">group</mat-icon>
            Account Users
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (store.users().length === 0) {
            <p class="empty-message">No users found.</p>
          } @else {
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Name / Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  @for (user of store.users(); track user.userId) {
                    <tr>
                      <td>
                        @if (user.displayName) {
                          <div class="user-name">{{ user.displayName }}</div>
                        }
                        <div class="user-email">{{ user.email }}</div>
                      </td>
                      <td>{{ user.role }}</td>
                      <td>{{ user.createdAt | date: 'mediumDate' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .user-management-container {
        padding: 24px;
        max-width: 960px;
        margin: 0 auto;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
      }

      .page-header h2 {
        margin: 0;
        color: var(--pm-text-primary);
      }

      .loading-container {
        display: flex;
        justify-content: center;
        padding: 24px;
      }

      .section-card {
        margin-bottom: 24px;
      }

      .section-icon {
        vertical-align: middle;
        margin-right: 8px;
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

      .user-name {
        font-weight: 500;
      }

      .user-email {
        font-size: 0.875rem;
        color: var(--pm-text-secondary);
      }
    `,
  ],
})
export class SettingsComponent implements OnInit {
  protected readonly store = inject(UserManagementStore);
  private readonly dialog = inject(MatDialog);

  ngOnInit(): void {
    this.store.loadInvitations();
    this.store.loadUsers();
  }

  openInviteDialog(): void {
    const dialogRef = this.dialog.open(InviteUserDialogComponent, {
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.store.sendInvitation(result);
      }
    });
  }

  onResendInvitation(id: string): void {
    this.store.resendInvitation(id);
  }
}
