import { TestBed } from '@angular/core/testing';
import { SignalRService } from './signalr.service';
import { AuthService } from '../services/auth.service';
import { HubConnectionState } from '@microsoft/signalr';

describe('SignalRService', () => {
  let service: SignalRService;
  let authServiceSpy: { accessToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authServiceSpy = {
      accessToken: vi.fn().mockReturnValue(null),
    };

    TestBed.configureTestingModule({
      providers: [
        SignalRService,
        { provide: AuthService, useValue: authServiceSpy },
      ],
    });

    service = TestBed.inject(SignalRService);
  });

  describe('initial state', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have disconnected connection state initially', () => {
      expect(service.connectionState()).toBe(HubConnectionState.Disconnected);
    });

    it('should not be connected initially', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should not be reconnecting initially', () => {
      expect(service.isReconnecting()).toBe(false);
    });
  });

  describe('connect', () => {
    it('should not connect when no auth token available', async () => {
      authServiceSpy.accessToken.mockReturnValue(null);

      await service.connect();

      expect(service.isConnected()).toBe(false);
    });

    it('should log warning when no auth token available', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      authServiceSpy.accessToken.mockReturnValue(null);

      await service.connect();

      expect(consoleSpy).toHaveBeenCalledWith(
        'SignalR: No auth token available, skipping connection'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('on/off event handlers', () => {
    it('should not throw when calling on without connection', () => {
      expect(() => {
        service.on('TestEvent', () => {});
      }).not.toThrow();
    });

    it('should not throw when calling off without connection', () => {
      expect(() => {
        service.off('TestEvent');
      }).not.toThrow();
    });
  });

  describe('disconnect', () => {
    it('should not throw when disconnecting without connection', async () => {
      await expect(service.disconnect()).resolves.not.toThrow();
    });

    it('should reset connected state on disconnect', async () => {
      await service.disconnect();

      expect(service.isConnected()).toBe(false);
      expect(service.isReconnecting()).toBe(false);
    });
  });
});
