/**
 * 个性化推荐 SDK 客户端
 * 艹！这个SDK负责获取推荐、追踪用户行为！
 *
 * @author 老王
 */

/**
 * 推荐场景
 */
export type RecoScene = 'template' | 'lookbook' | 'product' | 'prompt' | 'style';

/**
 * 推荐策略
 */
export type RecoStrategy = 'embedding' | 'collaborative' | 'popular' | 'trending' | 'personalized';

/**
 * 推荐项
 */
export interface RecoItem {
  id: string;
  type: string; // template, product, etc.
  score: number; // 推荐分数
  reason?: string; // 推荐理由
  metadata?: Record<string, any>;
}

/**
 * 推荐请求参数
 */
export interface RecoCandidatesParams {
  scene: RecoScene; // 推荐场景
  user_id?: string;
  limit?: number; // 返回数量，默认10
  strategy?: RecoStrategy; // 推荐策略
  context?: Record<string, any>; // 上下文信息
  exclude_ids?: string[]; // 排除的ID列表
}

/**
 * 推荐响应
 */
export interface RecoCandidatesResponse {
  items: RecoItem[];
  strategy: RecoStrategy;
  timestamp: number;
  session_id: string; // 用于追踪
}

/**
 * 行为追踪类型
 */
export type RecoEventType = 'view' | 'click' | 'generate' | 'like' | 'dislike' | 'share';

/**
 * 行为追踪参数
 */
export interface RecoTrackParams {
  event_type: RecoEventType;
  scene: RecoScene;
  item_id: string;
  item_type: string;
  session_id?: string; // 推荐会话ID
  position?: number; // 在推荐列表中的位置
  score?: number; // 推荐分数
  metadata?: Record<string, any>;
}

/**
 * 推荐SDK配置
 */
export interface RecoClientConfig {
  endpoint?: string; // API端点，默认 '/api/reco'
  auto_track_view?: boolean; // 自动追踪曝光，默认true
  batch_size?: number; // 批量上报大小，默认10
  flush_interval?: number; // 上报间隔（毫秒），默认5000
  enable_cache?: boolean; // 启用缓存，默认true
  cache_ttl?: number; // 缓存TTL（毫秒），默认60000
}

/**
 * 推荐客户端类
 */
export class RecoClient {
  private config: Required<RecoClientConfig>;
  private trackQueue: RecoTrackParams[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private cache: Map<string, { data: RecoCandidatesResponse; expireAt: number }> = new Map();

  constructor(config: RecoClientConfig = {}) {
    this.config = {
      endpoint: '/api/reco',
      auto_track_view: true,
      batch_size: 10,
      flush_interval: 5000,
      enable_cache: true,
      cache_ttl: 60000,
      ...config,
    };

    // 启动定时flush
    this.startFlushTimer();

    // 页面卸载时flush
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flush(true);
      });
    }
  }

  /**
   * 获取推荐候选
   */
  async getCandidates(params: RecoCandidatesParams): Promise<RecoCandidatesResponse> {
    const cacheKey = this.getCacheKey(params);

    // 检查缓存
    if (this.config.enable_cache) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expireAt > Date.now()) {
        console.log('[Reco] 使用缓存:', cacheKey);
        return cached.data;
      }
    }

    try {
      const response = await fetch(`${this.config.endpoint}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          limit: params.limit || 10,
          strategy: params.strategy || 'personalized',
        }),
      });

      if (!response.ok) {
        throw new Error(`推荐请求失败: ${response.status}`);
      }

      const data: RecoCandidatesResponse = await response.json();

      // 缓存结果
      if (this.config.enable_cache) {
        this.cache.set(cacheKey, {
          data,
          expireAt: Date.now() + this.config.cache_ttl,
        });
      }

      // 自动追踪曝光
      if (this.config.auto_track_view && data.items.length > 0) {
        data.items.forEach((item, index) => {
          this.track({
            event_type: 'view',
            scene: params.scene,
            item_id: item.id,
            item_type: item.type,
            session_id: data.session_id,
            position: index,
            score: item.score,
          });
        });
      }

      return data;
    } catch (error: any) {
      console.error('[Reco] 获取推荐失败:', error);
      throw error;
    }
  }

  /**
   * 追踪用户行为
   */
  track(params: RecoTrackParams): void {
    this.trackQueue.push({
      ...params,
      metadata: {
        ...params.metadata,
        timestamp: Date.now(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
    });

    console.log('[Reco] 追踪事件:', params.event_type, params.item_id);

    // 达到批量大小，立即flush
    if (this.trackQueue.length >= this.config.batch_size) {
      this.flush();
    }
  }

  /**
   * 追踪点击
   */
  trackClick(params: Omit<RecoTrackParams, 'event_type'>): void {
    this.track({ ...params, event_type: 'click' });
  }

  /**
   * 追踪生成
   */
  trackGenerate(params: Omit<RecoTrackParams, 'event_type'>): void {
    this.track({ ...params, event_type: 'generate' });
  }

  /**
   * 追踪点赞
   */
  trackLike(params: Omit<RecoTrackParams, 'event_type'>): void {
    this.track({ ...params, event_type: 'like' });
  }

  /**
   * 追踪点踩
   */
  trackDislike(params: Omit<RecoTrackParams, 'event_type'>): void {
    this.track({ ...params, event_type: 'dislike' });
  }

  /**
   * 上报追踪数据
   */
  async flush(sync = false): Promise<void> {
    if (this.trackQueue.length === 0) {
      return;
    }

    const events = [...this.trackQueue];
    this.trackQueue = [];

    try {
      if (sync && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        // 同步上报（页面卸载时）
        const blob = new Blob([JSON.stringify({ events })], { type: 'application/json' });
        navigator.sendBeacon(`${this.config.endpoint}/track`, blob);
      } else {
        // 异步上报
        await fetch(`${this.config.endpoint}/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events }),
        });
      }

      console.log(`[Reco] 上报 ${events.length} 条追踪数据`);
    } catch (error: any) {
      console.error('[Reco] 上报失败:', error);
      // 失败时放回队列
      this.trackQueue.unshift(...events);
    }
  }

  /**
   * 启动定时flush
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flush_interval);
  }

  /**
   * 停止定时flush
   */
  stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[Reco] 缓存已清除');
  }

  /**
   * 生成缓存Key
   */
  private getCacheKey(params: RecoCandidatesParams): string {
    return `${params.scene}:${params.strategy || 'personalized'}:${params.limit || 10}:${JSON.stringify(params.context || {})}`;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      queue_size: this.trackQueue.length,
      cache_size: this.cache.size,
      config: this.config,
    };
  }
}

/**
 * 全局推荐客户端实例
 */
export const recoClient = new RecoClient({
  auto_track_view: true,
  batch_size: 10,
  flush_interval: 5000,
  enable_cache: true,
  cache_ttl: 60000,
});

/**
 * React Hook for 推荐
 */
export function useReco(scene: RecoScene, options: Partial<RecoCandidatesParams> = {}) {
  const [items, setItems] = React.useState<RecoItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string>('');

  const loadReco = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await recoClient.getCandidates({
        scene,
        ...options,
      });
      setItems(response.items);
      setSessionId(response.session_id);
    } catch (error) {
      console.error('[useReco] 加载失败:', error);
    } finally {
      setLoading(false);
    }
  }, [scene, JSON.stringify(options)]);

  React.useEffect(() => {
    loadReco();
  }, [loadReco]);

  const trackClick = React.useCallback(
    (itemId: string, itemType: string, position?: number) => {
      recoClient.trackClick({
        scene,
        item_id: itemId,
        item_type: itemType,
        session_id: sessionId,
        position,
      });
    },
    [scene, sessionId]
  );

  const trackGenerate = React.useCallback(
    (itemId: string, itemType: string, position?: number) => {
      recoClient.trackGenerate({
        scene,
        item_id: itemId,
        item_type: itemType,
        session_id: sessionId,
        position,
      });
    },
    [scene, sessionId]
  );

  return {
    items,
    loading,
    sessionId,
    reload: loadReco,
    trackClick,
    trackGenerate,
  };
}

// 导入React（如果使用useReco）
import React from 'react';
