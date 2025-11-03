import { useEffect, useRef, useCallback } from 'react';
import { useWebSocketStore } from '@/store/websocketStore';
import { useTaskStore } from '@/store/taskStore';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onTaskProgress?: (taskId: string, progress: number) => void;
  onTaskStatus?: (taskId: string, status: string) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError,
    onTaskProgress,
    onTaskStatus
  } = options;

  const {
    socket,
    isConnected,
    error,
    taskProgress,
    taskStatus,
    connect,
    disconnect,
    send,
    getTaskProgress,
    getTaskStatus
  } = useWebSocketStore();

  const { subscribeToProgress, unsubscribeFromProgress } = useTaskStore();

  const isInitialized = useRef(false);

  // 自动连接
  useEffect(() => {
    if (autoConnect && !isInitialized.current && typeof window !== 'undefined') {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
      connect(wsUrl);
      isInitialized.current = true;
    }

    return () => {
      if (isInitialized.current) {
        disconnect();
        isInitialized.current = false;
      }
    };
  }, [autoConnect, connect, disconnect]);

  // 连接状态变化监听
  useEffect(() => {
    if (isConnected && onConnect) {
      onConnect();
    } else if (!isConnected && onDisconnect) {
      onDisconnect();
    }
  }, [isConnected, onConnect, onDisconnect]);

  // 错误状态监听
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // 任务进度变化监听
  useEffect(() => {
    if (onTaskProgress) {
      taskProgress.forEach((progress, taskId) => {
        onTaskProgress(taskId, progress);
      });
    }
  }, [taskProgress, onTaskProgress]);

  // 任务状态变化监听
  useEffect(() => {
    if (onTaskStatus) {
      taskStatus.forEach((status, taskId) => {
        onTaskStatus(taskId, status);
      });
    }
  }, [taskStatus, onTaskStatus]);

  // 订阅任务进度
  const subscribeProgress = useCallback((taskId: string, callback: (progress: number) => void) => {
    subscribeToProgress(taskId, callback);

    // 如果已有进度，立即调用回调
    const currentProgress = getTaskProgress(taskId);
    if (currentProgress > 0) {
      callback(currentProgress);
    }
  }, [subscribeToProgress, getTaskProgress]);

  // 取消订阅任务进度
  const unsubscribeProgress = useCallback((taskId: string) => {
    unsubscribeFromProgress(taskId);
  }, [unsubscribeFromProgress]);

  // 发送消息
  const sendMessage = useCallback((data: any) => {
    send(data);
  }, [send]);

  return {
    socket,
    isConnected,
    error,
    taskProgress,
    taskStatus,
    connect,
    disconnect,
    send: sendMessage,
    getTaskProgress,
    getTaskStatus,
    subscribeProgress,
    unsubscribeProgress
  };
};