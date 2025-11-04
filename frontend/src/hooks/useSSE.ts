/**
 * SSE实时进度Hook
 * 艹，这个Hook必须稳定可靠，支持自动重连、错误处理、进度更新！
 *
 * @author 老王
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';

// SSE事件类型
export interface SSEEvent {
  type: 'progress' | 'status' | 'complete' | 'error';
  data: any;
  timestamp: number;
}

// SSE进度事件
export interface ProgressEvent {
  taskId: string;
  progress: number;
  message: string;
  currentStep?: string;
  totalSteps?: number;
  estimatedTime?: number;
}

// SSE状态事件
export interface StatusEvent {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  error?: string;
}

// SSE完成事件
export interface CompleteEvent {
  taskId: string;
  result: {
    images: string[];
    metadata?: any;
  };
  completedAt: string;
}

// SSE配置
export interface UseSSEConfig {
  onProgress?: (event: ProgressEvent) => void;
  onStatus?: (event: StatusEvent) => void;
  onComplete?: (event: CompleteEvent) => void;
  onError?: (error: Error) => void;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
}

export function useSSE(config: UseSSEConfig = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);

  const {
    onProgress,
    onStatus,
    onComplete,
    onError,
    reconnectAttempts = 3,
    reconnectDelay = 2000,
    heartbeatInterval = 30000
  } = config;

  // 清理连接
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }

    setIsConnected(false);
    reconnectCountRef.current = 0;
  }, []);

  // 心跳检测
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }

    heartbeatTimeoutRef.current = setTimeout(() => {
      console.warn('SSE heartbeat timeout, reconnecting...');
      cleanup();
      if (currentTask) {
        connect(currentTask);
      }
    }, heartbeatInterval);
  }, [currentTask, cleanup, heartbeatInterval]);

  // 重连逻辑
  const attemptReconnect = useCallback((taskId: string) => {
    if (reconnectCountRef.current >= reconnectAttempts) {
      console.error('Max reconnection attempts reached');
      message.error('连接已断开，请刷新页面重试');
      return;
    }

    reconnectCountRef.current++;

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`Attempting to reconnect (${reconnectCountRef.current}/${reconnectAttempts})`);
      connect(taskId);
    }, reconnectDelay * reconnectCountRef.current);
  }, [reconnectAttempts, reconnectDelay]);

  // 建立SSE连接
  const connect = useCallback((taskId: string) => {
    // 清理现有连接
    cleanup();

    try {
      // 构建SSE URL
      const sseUrl = `/api/tools/tasks/${taskId}/stream`;

      console.log('Connecting to SSE:', sseUrl);

      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      // 连接成功
      eventSource.onopen = () => {
        console.log('SSE connection established');
        setIsConnected(true);
        setCurrentTask(taskId);
        reconnectCountRef.current = 0;
        startHeartbeat();
      };

      // 接收消息
      eventSource.onmessage = (event) => {
        try {
          const sseEvent: SSEEvent = JSON.parse(event.data);
          setLastEvent(sseEvent);
          startHeartbeat(); // 重置心跳

          switch (sseEvent.type) {
            case 'progress':
              onProgress?.(sseEvent.data as ProgressEvent);
              break;

            case 'status':
              onStatus?.(sseEvent.data as StatusEvent);
              break;

            case 'complete':
              onComplete?.(sseEvent.data as CompleteEvent);
              cleanup(); // 完成后关闭连接
              break;

            case 'error':
              console.error('SSE error event:', sseEvent.data);
              const error = new Error(sseEvent.data.message || 'Unknown error');
              onError?.(error);
              cleanup();
              break;
          }
        } catch (error) {
          console.error('Failed to parse SSE event:', error);
        }
      };

      // 连接错误
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setIsConnected(false);

        // 如果连接还没建立，说明是连接失败
        if (eventSource.readyState === EventSource.CONNECTING) {
          return; // 还在尝试连接中
        }

        // 连接断开，尝试重连
        if (reconnectCountRef.current < reconnectAttempts) {
          attemptReconnect(taskId);
        } else {
          message.error('连接已断开，请刷新页面重试');
          onError?.(new Error('Connection failed after max attempts'));
          cleanup();
        }
      };

    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      onError?.(error as Error);
    }
  }, [cleanup, onProgress, onStatus, onComplete, onError, attemptReconnect, startHeartbeat]);

  // 断开连接
  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // 发送心跳ping
  const ping = useCallback(() => {
    if (isConnected && currentTask) {
      console.log('SSE ping for task:', currentTask);
      startHeartbeat();
    }
  }, [isConnected, currentTask, startHeartbeat]);

  // 组件卸载时清理
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isConnected,
    currentTask,
    lastEvent,
    connect,
    disconnect,
    ping
  };
}