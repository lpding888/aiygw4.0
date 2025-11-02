import { create } from 'zustand';
import { Task } from '@/types';

interface WebSocketState {
  socket: WebSocket | null;
  isConnected: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectInterval: number;
  error: string | null;

  // 任务进度追踪
  taskProgress: Map<string, number>;
  taskStatus: Map<string, string>;

  // 操作方法
  connect: (url: string) => void;
  disconnect: () => void;
  reconnect: () => void;
  send: (data: any) => void;

  // 任务状态更新
  updateTaskProgress: (taskId: string, progress: number) => void;
  updateTaskStatus: (taskId: string, status: string) => void;
  getTaskProgress: (taskId: string) => number;
  getTaskStatus: (taskId: string) => string | undefined;

  // 重置状态
  resetState: () => void;
}

const initialState = {
  socket: null,
  isConnected: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectInterval: 3000,
  error: null,
  taskProgress: new Map(),
  taskStatus: new Map()
};

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  ...initialState,

  // 连接WebSocket
  connect: (url: string) => {
    try {
      // 清理现有连接
      const { socket } = get();
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }

      const wsUrl = url.startsWith('ws') ? url : `ws://${url}`;
      const newSocket = new WebSocket(wsUrl);

      newSocket.onopen = () => {
        console.log('WebSocket连接已建立');
        set({
          socket: newSocket,
          isConnected: true,
          reconnectAttempts: 0,
          error: null
        });

        // 发送认证信息
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('token');
          if (token) {
            newSocket.send(JSON.stringify({
              type: 'auth',
              token
            }));
          }
        }
      };

      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { updateTaskProgress, updateTaskStatus } = get();

          switch (data.type) {
            case 'task_progress':
              updateTaskProgress(data.taskId, data.progress);
              break;

            case 'task_status':
              updateTaskStatus(data.taskId, data.status);
              break;

            case 'task_completed':
              updateTaskProgress(data.taskId, 100);
              updateTaskStatus(data.taskId, 'success');
              break;

            case 'task_failed':
              updateTaskStatus(data.taskId, 'failed');
              break;

            default:
              console.log('未处理的WebSocket消息:', data);
          }
        } catch (error) {
          console.error('处理WebSocket消息失败:', error);
        }
      };

      newSocket.onclose = (event) => {
        console.log('WebSocket连接已关闭', event.code, event.reason);
        set({
          socket: null,
          isConnected: false
        });

        // 自动重连（非正常关闭时）
        if (event.code !== 1000) {
          const { reconnectAttempts, maxReconnectAttempts } = get();
          if (reconnectAttempts < maxReconnectAttempts) {
            console.log(`尝试重连 (${reconnectAttempts + 1}/${maxReconnectAttempts})`);
            set({ reconnectAttempts: reconnectAttempts + 1 });

            setTimeout(() => {
              get().reconnect();
            }, get().reconnectInterval);
          } else {
            set({
              error: 'WebSocket连接失败，请刷新页面重试'
            });
          }
        }
      };

      newSocket.onerror = (error) => {
        console.error('WebSocket连接错误:', error);
        set({
          error: 'WebSocket连接错误'
        });
      };

      set({ socket: newSocket });
    } catch (error: any) {
      console.error('创建WebSocket连接失败:', error);
      set({
        error: error.message || 'WebSocket连接失败'
      });
    }
  },

  // 断开连接
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.close(1000, '用户主动断开');
      set({
        socket: null,
        isConnected: false,
        reconnectAttempts: 0
      });
    }
  },

  // 重新连接
  reconnect: () => {
    const { isConnected } = get();
    if (!isConnected) {
      // 这里需要从环境变量或配置中获取WebSocket URL
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'localhost:3000';
      get().connect(wsUrl);
    }
  },

  // 发送消息
  send: (data: any) => {
    const { socket, isConnected } = get();
    if (socket && isConnected) {
      try {
        socket.send(JSON.stringify(data));
      } catch (error) {
        console.error('发送WebSocket消息失败:', error);
      }
    } else {
      console.warn('WebSocket未连接，无法发送消息');
    }
  },

  // 更新任务进度
  updateTaskProgress: (taskId: string, progress: number) => {
    set((state) => {
      const newTaskProgress = new Map(state.taskProgress);
      newTaskProgress.set(taskId, progress);
      return { taskProgress: newTaskProgress };
    });
  },

  // 更新任务状态
  updateTaskStatus: (taskId: string, status: string) => {
    set((state) => {
      const newTaskStatus = new Map(state.taskStatus);
      newTaskStatus.set(taskId, status);
      return { taskStatus: newTaskStatus };
    });
  },

  // 获取任务进度
  getTaskProgress: (taskId: string) => {
    const { taskProgress } = get();
    return taskProgress.get(taskId) || 0;
  },

  // 获取任务状态
  getTaskStatus: (taskId: string) => {
    const { taskStatus } = get();
    return taskStatus.get(taskId);
  },

  // 重置状态
  resetState: () => set(initialState)
}));