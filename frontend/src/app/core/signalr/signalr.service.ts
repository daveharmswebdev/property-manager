import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { AuthService } from '../services/auth.service';

/**
 * Core SignalR service for managing WebSocket connections (AC-5.6.1, AC-5.6.4).
 *
 * Provides:
 * - Connection management with JWT authentication
 * - Automatic reconnection with exponential backoff
 * - Connection state signals for reactive UI updates
 * - Event subscription/unsubscription
 */
@Injectable({ providedIn: 'root' })
export class SignalRService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private hubConnection: HubConnection | null = null;

  /** Current connection state */
  readonly connectionState = signal<HubConnectionState>(
    HubConnectionState.Disconnected
  );

  /** Whether connection is active */
  readonly isConnected = signal(false);

  /** Whether reconnection is in progress */
  readonly isReconnecting = signal(false);

  /**
   * Connect to the SignalR hub with JWT authentication.
   * Uses access token from AuthService for authentication.
   */
  async connect(): Promise<void> {
    // Already connected
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      return;
    }

    const token = this.authService.accessToken();
    if (!token) {
      console.warn('SignalR: No auth token available, skipping connection');
      return;
    }

    this.hubConnection = new HubConnectionBuilder()
      .withUrl('/hubs/receipts', {
        accessTokenFactory: () => this.authService.accessToken() || '',
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Exponential backoff: 0s, 2s, 4s, 8s, 16s, max 30s
          const delay = Math.min(
            Math.pow(2, retryContext.previousRetryCount) * 1000,
            30000
          );
          console.log(`SignalR: Reconnecting in ${delay}ms...`);
          return delay;
        },
      })
      .configureLogging(LogLevel.Information)
      .build();

    this.setupConnectionHandlers();

    try {
      await this.hubConnection.start();
      this.connectionState.set(HubConnectionState.Connected);
      this.isConnected.set(true);
      this.isReconnecting.set(false);
      console.log('SignalR: Connected');
    } catch (err) {
      console.error('SignalR: Connection failed', err);
      this.connectionState.set(HubConnectionState.Disconnected);
      this.isConnected.set(false);
    }
  }

  /**
   * Setup handlers for connection lifecycle events.
   */
  private setupConnectionHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.onreconnecting((error) => {
      console.log('SignalR: Reconnecting...', error);
      this.connectionState.set(HubConnectionState.Reconnecting);
      this.isConnected.set(false);
      this.isReconnecting.set(true);
    });

    this.hubConnection.onreconnected((connectionId) => {
      console.log('SignalR: Reconnected', connectionId);
      this.connectionState.set(HubConnectionState.Connected);
      this.isConnected.set(true);
      this.isReconnecting.set(false);
    });

    this.hubConnection.onclose((error) => {
      console.log('SignalR: Connection closed', error);
      this.connectionState.set(HubConnectionState.Disconnected);
      this.isConnected.set(false);
      this.isReconnecting.set(false);
    });
  }

  /**
   * Subscribe to a SignalR event.
   * @param eventName The event name to subscribe to
   * @param callback The callback to execute when event is received
   */
  on<T>(eventName: string, callback: (data: T) => void): void {
    this.hubConnection?.on(eventName, callback);
  }

  /**
   * Unsubscribe from a SignalR event.
   * @param eventName The event name to unsubscribe from
   */
  off(eventName: string): void {
    this.hubConnection?.off(eventName);
  }

  /**
   * Disconnect from the SignalR hub.
   */
  async disconnect(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = null;
      this.isConnected.set(false);
      this.isReconnecting.set(false);
      this.connectionState.set(HubConnectionState.Disconnected);
      console.log('SignalR: Disconnected');
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
