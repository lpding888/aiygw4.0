/**
 * WebSocket服务
 *
 * 实时推送任务进度、系统通知等
 */

const { Server } = require('ws');
const logger = require('../utils/logger');
const { verifyToken } = require('../utils/jwt');

interface ClientConnection {
  id: string;
  userId: string;
  ws: any;
  isAlive: boolean;
  lastPing: Date;
  subscriptions: Set<string>;
}

export class WebSocketService {
  private wss: any;
  private clients = new Map<string, ClientConnection>();
  private heartbeatInterval: NodeJS.Timeout;
  private port = process.env.WS_PORT || 3001;

  /**
   * 初始化WebSocket服务
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new Server({ port: this.port });

        this.wss.on('connection', (ws: any, req: any) => {
          this.handleConnection(ws, req);
        });

        this.wss.on('error', (error: Error) => {
          logger.error('WebSocket服务器错误:', error);
          reject(error);
        });

        // 启动心跳检测
        this.startHeartbeat();

        logger.info(`WebSocket服务已启动，端口: ${this.port}`);
        resolve();
      } catch (error) {
        logger.error('WebSocket服务启动失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 处理客户端连接
   */
  private handleConnection(ws: any, req: any): void {
    const clientId = this.generateClientId();

    // 从URL参数或查询字符串中获取token
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');

    let userId: string;

    try {
      // 验证token
      const decoded = verifyToken(token);
      userId = decoded.userId;
    } catch (error) {
      logger.warn('WebSocket连接token验证失败', { clientId, error: error.message });
      ws.close(1008, 'Token无效');
      return;
    }

    // 创建客户端连接
    const client: ClientConnection = {
      id: clientId,
      userId,
      ws,
      isAlive: true,
      lastPing: new Date(),
      subscriptions: new Set()
    };

    this.clients.set(clientId, client);

    logger.info('WebSocket客户端已连接', { clientId, userId });

    // 发送连接成功消息
    this.sendToClient(clientId, {
      type: 'connected',
      data: {
        clientId,
        serverTime: new Date().toISOString()
      }
    });

    // 处理客户端消息
    ws.on('message', (data: string) => {
      this.handleMessage(clientId, data);
    });

    // 处理连接关闭
    ws.on('close', (code: number, reason: string) => {
      this.handleDisconnection(clientId, code, reason);
    });

    // 处理错误
    ws.on('error', (error: Error) => {
      logger.error('WebSocket客户端错误:', { clientId, error: error.message });
    });

    // 处理pong响应
    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.isAlive = true;
        client.lastPing = new Date();
      }
    });
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(clientId: string, data: string): void {
    try {
      const message = JSON.parse(data);
      const client = this.clients.get(clientId);

      if (!client) return;

      switch (message.type) {
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
          break;

        case 'subscribe':
          this.handleSubscribe(clientId, message.data);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.data);
          break;

        case 'task_progress':
          // 客户端请求任务进度
          if (message.data.taskId) {
            this.sendTaskProgress(clientId, message.data.taskId);
          }
          break;

        default:
          logger.warn('未知的WebSocket消息类型', { clientId, type: message.type });
      }
    } catch (error) {
      logger.error('处理WebSocket消息失败', { clientId, error: error.message });
    }
  }

  /**
   * 处理订阅
   */
  private handleSubscribe(clientId: string, data: { channel: string }): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channel } = data;

    // 验证订阅权限
    if (this.canSubscribe(client.userId, channel)) {
      client.subscriptions.add(channel);

      this.sendToClient(clientId, {
        type: 'subscribed',
        data: { channel }
      });

      logger.debug('客户端订阅成功', { clientId, channel });
    } else {
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: '无权限订阅该频道' }
      });
    }
  }

  /**
   * 处理取消订阅
   */
  private handleUnsubscribe(clientId: string, data: { channel: string }): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channel } = data;
    client.subscriptions.delete(channel);

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      data: { channel }
    });

    logger.debug('客户端取消订阅', { clientId, channel });
  }

  /**
   * 处理连接断开
   */
  private handleDisconnection(clientId: string, code: number, reason: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      logger.info('WebSocket客户端已断开', {
        clientId,
        userId: client.userId,
        code,
        reason
      });
      this.clients.delete(clientId);
    }
  }

  /**
   * 发送消息给指定客户端
   */
  sendToClient(clientId: string, message: any): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== 1) { // 1 = OPEN
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('发送WebSocket消息失败', { clientId, error: error.message });
      return false;
    }
  }

  /**
   * 广播消息给所有客户端
   */
  broadcast(message: any, channel?: string): number {
    let sentCount = 0;

    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState !== 1) continue; // 1 = OPEN

      // 如果指定了频道，只发送给订阅了该频道的客户端
      if (channel && !client.subscriptions.has(channel)) continue;

      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * 发送给指定用户的所有连接
   */
  sendToUser(userId: string, message: any): number {
    let sentCount = 0;

    for (const [clientId, client] of this.clients) {
      if (client.userId === userId && client.ws.readyState === 1) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * 发送任务进度更新
   */
  sendTaskProgress(taskId: string, progress: number, status?: string): void {
    const message = {
      type: 'task_progress',
      data: {
        taskId,
        progress,
        status,
        timestamp: new Date().toISOString()
      }
    };

    this.broadcast(message, `task:${taskId}`);
  }

  /**
   * 发送任务完成通知
   */
  sendTaskCompleted(taskId: string, result: any): void {
    const message = {
      type: 'task_completed',
      data: {
        taskId,
        result,
        timestamp: new Date().toISOString()
      }
    };

    this.broadcast(message, `task:${taskId}`);
  }

  /**
   * 发送任务失败通知
   */
  sendTaskFailed(taskId: string, error: string): void {
    const message = {
      type: 'task_failed',
      data: {
        taskId,
        error,
        timestamp: new Date().toISOString()
      }
    };

    this.broadcast(message, `task:${taskId}`);
  }

  /**
   * 发送系统通知
   */
  sendSystemNotification(notification: {
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    userId?: string;
  }): void {
    const message = {
      type: 'system_notification',
      data: {
        ...notification,
        timestamp: new Date().toISOString()
      }
    };

    if (notification.userId) {
      this.sendToUser(notification.userId, message);
    } else {
      this.broadcast(message, 'system');
    }
  }

  /**
   * 发送实时统计数据
   */
  sendStats(stats: any): void {
    const message = {
      type: 'stats_update',
      data: {
        ...stats,
        timestamp: new Date().toISOString()
      }
    };

    this.broadcast(message, 'stats');
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of this.clients) {
        if (!client.isAlive) {
          logger.warn('WebSocket客户端心跳超时，断开连接', { clientId });
          client.ws.terminate();
          this.clients.delete(clientId);
          continue;
        }

        client.isAlive = false;
        client.ws.ping();
      }
    }, 30000); // 30秒心跳间隔
  }

  /**
   * 检查订阅权限
   */
  private canSubscribe(userId: string, channel: string): boolean {
    // 用户可以订阅自己的任务频道
    if (channel.startsWith(`task:user_${userId}`)) {
      return true;
    }

    // 管理员可以订阅系统频道
    if (channel.startsWith('system:') || channel.startsWith('admin:')) {
      // 这里需要检查用户是否为管理员
      // 暂时返回true，实际应该查询数据库
      return true;
    }

    // 其他频道根据业务逻辑判断
    return true;
  }

  /**
   * 发送任务进度给特定客户端
   */
  private async sendTaskProgress(clientId: string, taskId: string): Promise<void> {
    try {
      // 从数据库查询任务进度
      const { knex } = require('../db/connection');
      const task = await knex('tasks')
        .where('id', taskId)
        .first();

      if (task) {
        this.sendToClient(clientId, {
          type: 'task_progress',
          data: {
            taskId,
            progress: task.progress || 0,
            status: task.status,
            resultUrls: task.result_urls,
            errorReason: task.error_reason,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      logger.error('获取任务进度失败', { taskId, error: error.message });
    }
  }

  /**
   * 获取连接统计
   */
  getStats() {
    const stats = {
      totalConnections: this.clients.size,
      connectionsByUser: new Map<string, number>(),
      subscriptions: new Map<string, number>()
    };

    for (const client of this.clients.values()) {
      // 统计每个用户的连接数
      const userCount = stats.connectionsByUser.get(client.userId) || 0;
      stats.connectionsByUser.set(client.userId, userCount + 1);

      // 统计每个频道的订阅数
      for (const channel of client.subscriptions) {
        const channelCount = stats.subscriptions.get(channel) || 0;
        stats.subscriptions.set(channel, channelCount + 1);
      }
    }

    return {
      totalConnections: stats.totalConnections,
      connectionsByUser: Object.fromEntries(stats.connectionsByUser),
      subscriptions: Object.fromEntries(stats.subscriptions)
    };
  }

  /**
   * 关闭WebSocket服务
   */
  async close(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.wss) {
      return new Promise((resolve) => {
        this.wss.close(() => {
          logger.info('WebSocket服务已关闭');
          resolve();
        });
      });
    }
  }

  /**
   * 生成客户端ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 单例实例
const websocketService = new WebSocketService();
module.exports = websocketService;