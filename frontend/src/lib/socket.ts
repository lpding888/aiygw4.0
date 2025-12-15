'use client';

import { io, Socket } from 'socket.io-client';

export type ExecutionEvent = {
  type: string;
  execution_id: string;
  timestamp: string;
  [key: string]: unknown;
};

class RealtimeClient {
  private socket: Socket | null = null;
  private userId: string | null = null;

  connect(userId: string | null = null, token?: string | null) {
    if (this.socket?.connected) {
      return;
    }

    this.userId = userId;
    // Connect to default namespace / path or configured URL
    const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    this.socket = io(url, {
      transports: ['websocket'],
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      if (userId) {
        this.socket?.emit('join', userId);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Socket] Connection Error:', err);
    });
  }

  joinExecution(executionId: string) {
    if (this.socket?.connected) {
      this.socket.emit('join_execution', executionId);
    } else {
      // Retry once connected? Not handling queueing for now.
      // It's better to ensure connection first.
      const onConnect = () => {
        this.socket?.emit('join_execution', executionId);
        this.socket?.off('connect', onConnect);
      }
      this.socket?.on('connect', onConnect);
    }
  }

  leaveExecution(executionId: string) {
    this.socket?.emit('leave_execution', executionId);
  }

  onExecutionEvent(handler: (event: ExecutionEvent) => void) {
    this.socket?.on('execution:event', handler);
    // Also listen to specific legacy events if backend emits them separately
    // But backend now emits execution:event for all.
  }

  offExecutionEvent(handler: (event: ExecutionEvent) => void) {
    this.socket?.off('execution:event', handler);
  }

  // Generic Listeners for legacy support if needed
  on(event: string, handler: (...args: any[]) => void) {
    this.socket?.on(event, handler);
  }

  off(event: string, handler: (...args: any[]) => void) {
    this.socket?.off(event, handler);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
    }
  }
}

export const realtime = new RealtimeClient();
