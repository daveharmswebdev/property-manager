# Story 5.6: Real-Time Receipt Sync (SignalR)

Status: done

## Story

As a property owner using phone and desktop together,
I want receipts captured on my phone to appear on desktop immediately,
So that I can run an efficient assembly-line workflow.

## Acceptance Criteria

1. **AC-5.6.1**: Real-time receipt notification on capture
   - When I capture a receipt on my phone
   - The receipt appears in the desktop queue within 1-2 seconds
   - The badge count updates in real-time
   - No page refresh required

2. **AC-5.6.2**: Real-time update when receipt is processed
   - When I process a receipt on desktop (link to expense)
   - Other connected devices see the queue update
   - The receipt disappears from their view

3. **AC-5.6.3**: Visual feedback for new receipts
   - When a new receipt arrives via SignalR on desktop
   - A subtle animation appears as it joins the queue
   - Optional: soft notification sound

4. **AC-5.6.4**: Automatic reconnection handling
   - When connection is temporarily lost
   - SignalR automatically reconnects
   - Queue syncs to current state on reconnect

5. **AC-5.6.5**: Account-based group isolation
   - Only users in the same account receive updates
   - Cross-account notifications are never sent

## Tasks / Subtasks

- [x] Task 1: Create SignalR Hub (Backend) (AC: 5.6.1, 5.6.2, 5.6.5)
  - [x] Create `PropertyManager.Api/Hubs/ReceiptHub.cs`
  - [x] Implement `OnConnectedAsync` - add user to account group
  - [x] Implement `OnDisconnectedAsync` - remove from group
  - [x] Group name format: `account-{accountId}`
  - [x] Add `[Authorize]` attribute to hub

- [x] Task 2: Configure SignalR in Program.cs (AC: 5.6.1)
  - [x] Add `builder.Services.AddSignalR()`
  - [x] Map hub endpoint: `app.MapHub<ReceiptHub>("/hubs/receipts")`
  - [x] Configure JWT authentication for SignalR
  - [x] Add CORS policy for SignalR

- [x] Task 3: Create SignalR Event DTOs (AC: 5.6.1, 5.6.2)
  - [x] Create `ReceiptAddedEvent` record in Application layer
  - [x] Create `ReceiptLinkedEvent` record in Application layer
  - [x] Create `ReceiptDeletedEvent` record in Application layer

- [x] Task 4: Create IReceiptNotificationService Interface (AC: 5.6.1, 5.6.2)
  - [x] Define in `PropertyManager.Application/Common/Interfaces/`
  - [x] Method: `NotifyReceiptAdded(Guid accountId, ReceiptAddedEvent)`
  - [x] Method: `NotifyReceiptLinked(Guid accountId, ReceiptLinkedEvent)`
  - [x] Method: `NotifyReceiptDeleted(Guid accountId, ReceiptDeletedEvent)`

- [x] Task 5: Implement ReceiptNotificationService (AC: 5.6.1, 5.6.2, 5.6.5)
  - [x] Create `PropertyManager.Api/Services/ReceiptNotificationService.cs` (placed in Api layer due to Hub dependency)
  - [x] Inject `IHubContext<ReceiptHub>`
  - [x] Implement methods to broadcast to account groups
  - [x] Register in DI container

- [x] Task 6: Integrate Notifications into Receipt Handlers (AC: 5.6.1, 5.6.2)
  - [x] Update `CreateReceiptHandler` to call `NotifyReceiptAdded`
  - [x] Update `ProcessReceiptHandler` to call `NotifyReceiptLinked`
  - [x] Update `DeleteReceiptHandler` to call `NotifyReceiptDeleted`

- [x] Task 7: Create Angular SignalR Service (AC: 5.6.1, 5.6.4)
  - [x] Install `@microsoft/signalr` package
  - [x] Create `frontend/src/app/core/signalr/signalr.service.ts`
  - [x] Implement connection with JWT token from auth
  - [x] Configure automatic reconnection with exponential backoff
  - [x] Expose connection state as signal

- [x] Task 8: Create ReceiptSignalRService (AC: 5.6.1, 5.6.2, 5.6.3)
  - [x] Create `frontend/src/app/features/receipts/services/receipt-signalr.service.ts`
  - [x] Subscribe to `ReceiptAdded` event
  - [x] Subscribe to `ReceiptLinked` event
  - [x] Subscribe to `ReceiptDeleted` event
  - [x] Integrate with `ReceiptStore` to update state

- [x] Task 9: Update ReceiptStore for Real-Time Updates (AC: 5.6.1, 5.6.2)
  - [x] Add `addReceiptRealTime(receipt)` method
  - [x] Add `removeFromQueue(receiptId)` method (existing)
  - [x] Ensure optimistic UI already in place works with SignalR updates
  - [x] Handle duplicate prevention (same receipt from HTTP + SignalR)

- [x] Task 10: Add Visual Animation for New Receipts (AC: 5.6.3)
  - [x] Create CSS slide-in animation for new queue items
  - [x] Add subtle highlight/glow effect for 2 seconds
  - [x] Sound notification deferred (user preference)

- [x] Task 11: Update Shell/Navigation Badge (AC: 5.6.1)
  - [x] Connect badge count to real-time updates (via ReceiptStore)
  - [x] Badge updates automatically via SignalR events

- [x] Task 12: Handle Reconnection and State Sync (AC: 5.6.4)
  - [x] On reconnect, fetch current unprocessed receipts
  - [x] Replace local state with server state
  - [x] Show toast: "Reconnected - syncing receipts..."
  - [x] Log reconnection events for debugging

- [x] Task 13: Write Backend Unit Tests
  - [x] Updated existing handler tests to include notification service mock
  - [x] All 427 backend tests pass

- [x] Task 14: Write Frontend Unit Tests
  - [x] Updated receipts.component.spec.ts to include isNewReceipt mock
  - [x] All 512 frontend tests pass

- [x] Task 15: E2E Tests (Skipped)
  - [x] E2E testing SignalR would be brittle - skipped per user request
  - [x] Manual testing checklist provided

- [ ] Task 16: Manual Verification Checklist
  - [ ] Open app on two devices (phone + desktop) logged into same account
  - [ ] Capture receipt on phone
  - [ ] Verify receipt appears on desktop within 2 seconds
  - [ ] Verify badge updates on desktop
  - [ ] Process receipt on desktop
  - [ ] Verify receipt disappears from phone queue
  - [ ] Kill network on desktop, wait, restore
  - [ ] Verify reconnection and state sync

## Dev Notes

### Architecture Patterns

**Clean Architecture SignalR Integration:**
```
PropertyManager.Api/
├── Hubs/
│   └── ReceiptHub.cs                 # NEW - SignalR Hub

PropertyManager.Application/
├── Common/
│   └── Interfaces/
│       └── IReceiptNotificationService.cs  # NEW - Interface
├── Receipts/
│   ├── CreateReceipt.cs              # UPDATE - Add notification
│   ├── ProcessReceipt.cs             # UPDATE - Add notification
│   └── DeleteReceipt.cs              # UPDATE - Add notification

PropertyManager.Infrastructure/
├── Notifications/
│   └── ReceiptNotificationService.cs  # NEW - Implementation

frontend/src/app/
├── core/
│   └── signalr/
│       └── signalr.service.ts         # NEW - Core SignalR service
├── features/receipts/
│   └── services/
│       └── receipt-signalr.service.ts # NEW - Receipt-specific SignalR
```

### Backend Implementation

**ReceiptHub (ASP.NET Core SignalR):**
```csharp
// Api/Hubs/ReceiptHub.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace PropertyManager.Api.Hubs;

[Authorize]
public class ReceiptHub : Hub
{
    private readonly ILogger<ReceiptHub> _logger;

    public ReceiptHub(ILogger<ReceiptHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var accountId = Context.User?.FindFirst("accountId")?.Value;

        if (!string.IsNullOrEmpty(accountId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"account-{accountId}");
            _logger.LogInformation("User {UserId} connected to account group {AccountId}",
                Context.UserIdentifier, accountId);
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var accountId = Context.User?.FindFirst("accountId")?.Value;

        if (!string.IsNullOrEmpty(accountId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"account-{accountId}");
            _logger.LogInformation("User {UserId} disconnected from account group {AccountId}",
                Context.UserIdentifier, accountId);
        }

        await base.OnDisconnectedAsync(exception);
    }
}
```

**SignalR Configuration in Program.cs:**
```csharp
// Add to Program.cs

// Services
builder.Services.AddSignalR();
builder.Services.AddScoped<IReceiptNotificationService, ReceiptNotificationService>();

// Configure JWT for SignalR (before app.Build())
builder.Services.AddAuthentication().AddJwtBearer(options =>
{
    // Existing JWT config...

    // Handle JWT in query string for SignalR
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;

            if (!string.IsNullOrEmpty(accessToken) &&
                path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        }
    };
});

// Endpoints (after app.Build())
app.MapHub<ReceiptHub>("/hubs/receipts");
```

**IReceiptNotificationService Interface:**
```csharp
// Application/Common/Interfaces/IReceiptNotificationService.cs
namespace PropertyManager.Application.Common.Interfaces;

public interface IReceiptNotificationService
{
    Task NotifyReceiptAddedAsync(Guid accountId, ReceiptAddedEvent receipt, CancellationToken ct = default);
    Task NotifyReceiptLinkedAsync(Guid accountId, ReceiptLinkedEvent receipt, CancellationToken ct = default);
    Task NotifyReceiptDeletedAsync(Guid accountId, Guid receiptId, CancellationToken ct = default);
}

public record ReceiptAddedEvent(
    Guid Id,
    string? ThumbnailUrl,
    Guid? PropertyId,
    string? PropertyName,
    DateTime CreatedAt
);

public record ReceiptLinkedEvent(
    Guid ReceiptId,
    Guid ExpenseId
);
```

**ReceiptNotificationService Implementation:**
```csharp
// Infrastructure/Notifications/ReceiptNotificationService.cs
using Microsoft.AspNetCore.SignalR;
using PropertyManager.Api.Hubs;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Infrastructure.Notifications;

public class ReceiptNotificationService : IReceiptNotificationService
{
    private readonly IHubContext<ReceiptHub> _hubContext;
    private readonly ILogger<ReceiptNotificationService> _logger;

    public ReceiptNotificationService(
        IHubContext<ReceiptHub> hubContext,
        ILogger<ReceiptNotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task NotifyReceiptAddedAsync(Guid accountId, ReceiptAddedEvent receipt, CancellationToken ct = default)
    {
        var groupName = $"account-{accountId}";
        _logger.LogInformation("Broadcasting ReceiptAdded to group {Group}", groupName);

        await _hubContext.Clients.Group(groupName)
            .SendAsync("ReceiptAdded", receipt, ct);
    }

    public async Task NotifyReceiptLinkedAsync(Guid accountId, ReceiptLinkedEvent receipt, CancellationToken ct = default)
    {
        var groupName = $"account-{accountId}";
        _logger.LogInformation("Broadcasting ReceiptLinked to group {Group}", groupName);

        await _hubContext.Clients.Group(groupName)
            .SendAsync("ReceiptLinked", receipt, ct);
    }

    public async Task NotifyReceiptDeletedAsync(Guid accountId, Guid receiptId, CancellationToken ct = default)
    {
        var groupName = $"account-{accountId}";
        _logger.LogInformation("Broadcasting ReceiptDeleted to group {Group}", groupName);

        await _hubContext.Clients.Group(groupName)
            .SendAsync("ReceiptDeleted", new { ReceiptId = receiptId }, ct);
    }
}
```

**Update CreateReceiptHandler:**
```csharp
// Application/Receipts/CreateReceipt.cs (add to handler)
private readonly IReceiptNotificationService _notificationService;

// In Handle method, after SaveChangesAsync:
await _notificationService.NotifyReceiptAddedAsync(
    _currentUser.AccountId,
    new ReceiptAddedEvent(
        receipt.Id,
        null, // Thumbnail URL if available
        receipt.PropertyId,
        property?.Name,
        receipt.CreatedAt
    ),
    cancellationToken);
```

### Frontend Implementation

**SignalR Service (Core):**
```typescript
// core/signalr/signalr.service.ts
import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class SignalRService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private hubConnection: HubConnection | null = null;

  readonly connectionState = signal<HubConnectionState>(HubConnectionState.Disconnected);
  readonly isConnected = signal(false);

  async connect(): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      console.warn('No auth token available for SignalR');
      return;
    }

    this.hubConnection = new HubConnectionBuilder()
      .withUrl('/hubs/receipts', {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Exponential backoff: 0s, 2s, 4s, 8s, 16s, max 30s
          const delay = Math.min(Math.pow(2, retryContext.previousRetryCount) * 1000, 30000);
          console.log(`SignalR reconnecting in ${delay}ms...`);
          return delay;
        }
      })
      .configureLogging(LogLevel.Information)
      .build();

    this.setupConnectionHandlers();

    try {
      await this.hubConnection.start();
      this.connectionState.set(HubConnectionState.Connected);
      this.isConnected.set(true);
      console.log('SignalR connected');
    } catch (err) {
      console.error('SignalR connection failed:', err);
      this.connectionState.set(HubConnectionState.Disconnected);
      this.isConnected.set(false);
    }
  }

  private setupConnectionHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.onreconnecting((error) => {
      console.log('SignalR reconnecting...', error);
      this.connectionState.set(HubConnectionState.Reconnecting);
      this.isConnected.set(false);
    });

    this.hubConnection.onreconnected((connectionId) => {
      console.log('SignalR reconnected:', connectionId);
      this.connectionState.set(HubConnectionState.Connected);
      this.isConnected.set(true);
    });

    this.hubConnection.onclose((error) => {
      console.log('SignalR connection closed', error);
      this.connectionState.set(HubConnectionState.Disconnected);
      this.isConnected.set(false);
    });
  }

  on<T>(eventName: string, callback: (data: T) => void): void {
    this.hubConnection?.on(eventName, callback);
  }

  off(eventName: string): void {
    this.hubConnection?.off(eventName);
  }

  async disconnect(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = null;
      this.isConnected.set(false);
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
```

**Receipt SignalR Service:**
```typescript
// features/receipts/services/receipt-signalr.service.ts
import { Injectable, inject, OnDestroy } from '@angular/core';
import { SignalRService } from '../../../core/signalr/signalr.service';
import { ReceiptStore } from '../stores/receipt.store';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface ReceiptAddedEvent {
  id: string;
  thumbnailUrl?: string;
  propertyId?: string;
  propertyName?: string;
  createdAt: string;
}

export interface ReceiptLinkedEvent {
  receiptId: string;
  expenseId: string;
}

export interface ReceiptDeletedEvent {
  receiptId: string;
}

@Injectable({ providedIn: 'root' })
export class ReceiptSignalRService implements OnDestroy {
  private readonly signalR = inject(SignalRService);
  private readonly receiptStore = inject(ReceiptStore);
  private readonly snackBar = inject(MatSnackBar);

  private isSubscribed = false;

  async initialize(): Promise<void> {
    await this.signalR.connect();
    this.subscribeToEvents();
  }

  private subscribeToEvents(): void {
    if (this.isSubscribed) return;

    this.signalR.on<ReceiptAddedEvent>('ReceiptAdded', (event) => {
      console.log('Receipt added via SignalR:', event);
      this.receiptStore.addReceiptRealTime({
        id: event.id,
        thumbnailUrl: event.thumbnailUrl,
        propertyId: event.propertyId,
        propertyName: event.propertyName,
        createdAt: event.createdAt,
        processedAt: null,
        expenseId: null
      });
      // Optional: play sound or show toast
    });

    this.signalR.on<ReceiptLinkedEvent>('ReceiptLinked', (event) => {
      console.log('Receipt linked via SignalR:', event);
      this.receiptStore.removeFromQueue(event.receiptId);
    });

    this.signalR.on<ReceiptDeletedEvent>('ReceiptDeleted', (event) => {
      console.log('Receipt deleted via SignalR:', event);
      this.receiptStore.removeFromQueue(event.receiptId);
    });

    this.isSubscribed = true;
  }

  ngOnDestroy(): void {
    this.signalR.off('ReceiptAdded');
    this.signalR.off('ReceiptLinked');
    this.signalR.off('ReceiptDeleted');
    this.isSubscribed = false;
  }
}
```

**Update ReceiptStore:**
```typescript
// Add to receipt.store.ts

// Add method for real-time updates from SignalR
addReceiptRealTime(receipt: ReceiptDto): void {
  // Check for duplicates (may already exist from HTTP response)
  const existing = this.unprocessedReceipts().find(r => r.id === receipt.id);
  if (existing) {
    console.log('Receipt already exists, skipping duplicate:', receipt.id);
    return;
  }

  // Add to beginning of list with animation flag
  patchState(this.state, {
    unprocessedReceipts: [receipt, ...this.unprocessedReceipts()]
  });
}

removeReceiptRealTime(receiptId: string): void {
  patchState(this.state, {
    unprocessedReceipts: this.unprocessedReceipts().filter(r => r.id !== receiptId)
  });
}
```

**Animation for New Receipts:**
```typescript
// Add to receipt-queue-item.component.ts
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ])
    ]),
    trigger('highlight', [
      state('new', style({ backgroundColor: 'rgba(102, 187, 106, 0.2)' })),
      state('normal', style({ backgroundColor: 'transparent' })),
      transition('new => normal', animate('2s ease-out'))
    ])
  ]
})
```

### CORS Configuration

**Update Program.cs for SignalR CORS:**
```csharp
// Ensure CORS allows SignalR
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "https://your-production-domain.com")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required for SignalR
    });
});
```

### Package Dependencies

**Backend (NuGet):**
- SignalR is included in ASP.NET Core - no additional package needed

**Frontend (npm):**
```bash
npm install @microsoft/signalr
```

### Testing Strategy

**Backend Unit Tests (xUnit):**
```csharp
[Fact]
public async Task OnConnectedAsync_AddsUserToAccountGroup()
{
    // Arrange: Mock hub context with user claims
    // Act: Call OnConnectedAsync
    // Assert: Groups.AddToGroupAsync called with correct group name
}

[Fact]
public async Task NotifyReceiptAddedAsync_BroadcastsToAccountGroup()
{
    // Arrange: Mock IHubContext
    // Act: Call NotifyReceiptAddedAsync
    // Assert: SendAsync called on correct group with ReceiptAdded event
}
```

**Frontend Unit Tests (Vitest):**
```typescript
describe('ReceiptSignalRService', () => {
  it('should add receipt to store on ReceiptAdded event', () => {
    // Mock SignalR event
    // Verify store.addReceiptRealTime called
  });

  it('should remove receipt from store on ReceiptLinked event', () => {
    // Mock SignalR event
    // Verify store.removeFromQueue called
  });
});
```

### Previous Story Learnings (From 5-5)

**Patterns to Follow:**
- Signal-based state management
- data-testid attributes for testing
- Snackbar for user feedback
- Optimistic UI updates via store methods
- MatDialog patterns for modals

**Existing Code to Leverage:**
- `ReceiptStore` already has queue management methods
- Shell component already displays receipt badge
- Auth service already manages JWT tokens

### Git Context

Recent Epic 5 commits showing established patterns:
- `3917b1e` feat(receipts): Add receipt processing into expenses (#48)
- `14a03e5` feat(receipts): Add unprocessed receipt queue with navigation badges (#47)
- `e5bf51e` feat(receipts): Add mobile receipt capture with camera FAB (#46)
- `c724331` feat(receipts): Add S3 presigned URL infrastructure for receipt uploads (#45)

### Deployment Notes

**Environment Variables:**
- No new environment variables required
- SignalR uses existing JWT authentication

**Infrastructure:**
- SignalR works out of the box on Render
- For scaling: Consider Azure SignalR Service or Redis backplane

**Render.com Considerations:**
- WebSocket connections are supported
- May need to configure keep-alive for long-running connections

### Project Structure Notes

- SignalR hub follows ASP.NET Core conventions
- Frontend service follows Angular feature-based structure
- Clean separation between core SignalR and receipt-specific service
- Reuses existing auth infrastructure

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Real-Time Architecture]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.6: Real-Time Receipt Sync]
- [Source: _bmad-output/implementation-artifacts/5-5-view-and-delete-receipts.md]
- [Source: frontend/src/app/features/receipts/stores/receipt.store.ts]
- [Source: frontend/src/app/core/auth/auth.service.ts]
- [ASP.NET Core SignalR Docs](https://learn.microsoft.com/en-us/aspnet/core/signalr/introduction)
- [@microsoft/signalr npm package](https://www.npmjs.com/package/@microsoft/signalr)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Backend: SignalR hub with JWT auth and account-based group isolation
- Backend: Notification service broadcasts to account groups on receipt CRUD
- Frontend: Core SignalR service with automatic reconnection
- Frontend: Receipt-specific SignalR service updates store on events
- Frontend: CSS animations for new receipts (slide-in + highlight)
- All 427 backend tests pass
- All 512 frontend tests pass
- E2E tests skipped per user request (SignalR tests would be brittle)
- Note: ReceiptNotificationService placed in Api layer (not Infrastructure) due to Hub dependency

### File List

**New Files:**
- `backend/src/PropertyManager.Api/Hubs/ReceiptHub.cs`
- `backend/src/PropertyManager.Api/Services/ReceiptNotificationService.cs`
- `backend/src/PropertyManager.Application/Common/Interfaces/IReceiptNotificationService.cs`
- `backend/tests/PropertyManager.Api.Tests/Hubs/ReceiptHubTests.cs` (code review fix)
- `backend/tests/PropertyManager.Api.Tests/Services/ReceiptNotificationServiceTests.cs` (code review fix)
- `frontend/src/app/core/signalr/signalr.service.ts`
- `frontend/src/app/core/signalr/signalr.service.spec.ts` (code review fix)
- `frontend/src/app/features/receipts/services/receipt-signalr.service.ts`
- `frontend/src/app/features/receipts/services/receipt-signalr.service.spec.ts` (code review fix)

**Modified Files:**
- `backend/src/PropertyManager.Api/Program.cs` (SignalR config, JWT events, hub mapping)
- `backend/src/PropertyManager.Application/Receipts/CreateReceipt.cs` (notification)
- `backend/src/PropertyManager.Application/Receipts/ProcessReceipt.cs` (notification)
- `backend/src/PropertyManager.Application/Receipts/DeleteReceipt.cs` (notification)
- `backend/tests/PropertyManager.Application.Tests/Receipts/CreateReceiptHandlerTests.cs` (mock + notification verify)
- `backend/tests/PropertyManager.Application.Tests/Receipts/ProcessReceiptHandlerTests.cs` (mock + notification verify)
- `backend/tests/PropertyManager.Application.Tests/Receipts/DeleteReceiptHandlerTests.cs` (mock + notification verify)
- `backend/tests/PropertyManager.Api.Tests/PropertyManager.Api.Tests.csproj` (added Moq package)
- `frontend/src/app/features/receipts/stores/receipt.store.ts` (addReceiptRealTime, isNewReceipt)
- `frontend/src/app/features/receipts/receipts.component.ts` (isNew binding)
- `frontend/src/app/features/receipts/receipts.component.spec.ts` (mock)
- `frontend/src/app/features/receipts/components/receipt-queue-item/receipt-queue-item.component.ts` (animation)
- `frontend/src/app/core/components/shell/shell.component.ts` (SignalR init, reconnection logic fix)
- `frontend/package.json` (@microsoft/signalr added)
- `frontend/package-lock.json`

### Senior Developer Review (AI)

**Reviewer:** Amelia (Dev Agent)
**Date:** 2026-01-04
**Outcome:** Approved after fixes

#### Issues Found and Fixed:

| ID | Severity | Issue | Resolution |
|----|----------|-------|------------|
| H1 | HIGH | Reconnection logic bug in shell.component.ts - `!wasReconnecting && isConnected` triggered on initial connect, not on actual reconnect | Fixed: Added `wasReconnecting` state tracking to detect proper reconnection transition |
| M1 | MEDIUM | Handler tests mocked IReceiptNotificationService but never verified calls | Fixed: Added `Verify()` calls to CreateReceipt, ProcessReceipt, DeleteReceipt handler tests |
| M2 | MEDIUM | No unit tests for ReceiptHub (AC-5.6.5 account isolation) | Fixed: Created `ReceiptHubTests.cs` with 7 tests for OnConnectedAsync/OnDisconnectedAsync |
| M3 | MEDIUM | No unit tests for ReceiptNotificationService | Fixed: Created `ReceiptNotificationServiceTests.cs` with 5 tests |
| M4 | MEDIUM | No frontend SignalR service tests | Fixed: Created `signalr.service.spec.ts` (10 tests) and `receipt-signalr.service.spec.ts` (12 tests) |
| L1 | LOW | Architecture: ReceiptNotificationService in Api layer | Noted but not changed - requires larger refactor, Hub dependency is valid reason |
| L2 | LOW | File List incomplete | Fixed: Updated File List with all changed files |

#### Test Results After Fixes:
- Backend: 439 tests passing (267 Application + 158 Api + 14 Infrastructure)
- Frontend: 534 tests passing (up from 512)

#### Files Modified During Review:
- `frontend/src/app/core/components/shell/shell.component.ts` (reconnection fix)
- `backend/tests/PropertyManager.Application.Tests/Receipts/*HandlerTests.cs` (notification verification)
- `backend/tests/PropertyManager.Api.Tests/Hubs/ReceiptHubTests.cs` (new)
- `backend/tests/PropertyManager.Api.Tests/Services/ReceiptNotificationServiceTests.cs` (new)
- `backend/tests/PropertyManager.Api.Tests/PropertyManager.Api.Tests.csproj` (Moq package)
- `frontend/src/app/core/signalr/signalr.service.spec.ts` (new)
- `frontend/src/app/features/receipts/services/receipt-signalr.service.spec.ts` (new)

### Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-04 | Dev Agent (Opus 4.5) | Initial implementation of SignalR real-time sync |
| 2026-01-04 | Dev Agent (Opus 4.5) | Code review: Fixed reconnection logic, added missing tests |
