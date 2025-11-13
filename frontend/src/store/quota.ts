/**
 * 配额状态管理（Zustand）
 * 艹！这个SB Store管理用户的配额信息，实时更新余额！
 *
 * 功能：
 * 1. 存储用户当前配额（剩余次数、总次数、计划类型）
 * 2. 提供检查配额、消费配额的方法
 * 3. 从后端API同步配额状态
 * 4. 配额不足时触发购买引导
 *
 * @author 老王
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_MEMBER_QUOTA = Number(process.env.NEXT_PUBLIC_PLAN_MONTHLY_QUOTA ?? '100');

type ServerQuotaPayload = {
  remaining: number;
  isMember: boolean;
  expireAt?: string | null;
};

const normalizeQuotaPayload = (payload: ServerQuotaPayload): QuotaInfo => {
  const remaining = Math.max(payload.remaining ?? 0, 0);
  const total = payload.isMember ? DEFAULT_MEMBER_QUOTA : remaining;
  return {
    plan_type: payload.isMember ? 'pro' : 'free',
    plan_name: payload.isMember ? '月度会员' : '免费体验',
    total_quota: total,
    used_quota: Math.max(total - remaining, 0),
    remaining_quota: remaining,
    quota_reset_at: payload.expireAt ?? null,
    plan_expires_at: payload.expireAt ?? null,
    is_trial: !payload.isMember,
    can_upgrade: !payload.isMember,
  };
};

/**
 * 套餐计划类型
 */
export type PlanType = 'free' | 'pro' | 'enterprise';

/**
 * 配额类型
 */
export interface QuotaInfo {
  // 当前计划
  plan_type: PlanType;
  plan_name: string; // 如：免费版、专业版、企业版

  // 配额详情
  total_quota: number; // 总配额（次数）
  used_quota: number; // 已使用配额
  remaining_quota: number; // 剩余配额

  // 时间相关
  quota_reset_at?: string; // 配额重置时间（ISO 8601格式）
  plan_expires_at?: string; // 套餐过期时间

  // 额外信息
  is_trial?: boolean; // 是否试用
  can_upgrade?: boolean; // 是否可升级
}

/**
 * 配额消费记录
 */
export interface QuotaConsumption {
  action_type: string; // 操作类型（如：chat、generate_image、upload）
  quota_cost: number; // 消费配额数量（默认1）
  timestamp: number; // 时间戳
}

/**
 * 配额状态
 */
interface QuotaState {
  // 当前配额信息
  quota: QuotaInfo | null;

  // 加载状态
  isLoading: boolean;
  error: string | null;

  // 最后更新时间
  lastUpdated: number | null;

  // Actions

  /**
   * 从后端API获取配额信息
   */
  fetchQuota: () => Promise<void>;

  /**
   * 检查配额是否充足
   * @param cost 需要消费的配额数量（默认1）
   * @returns 是否有足够配额
   */
  checkQuota: (cost?: number) => boolean;

  /**
   * 消费配额
   * @param actionType 操作类型
   * @param cost 消费配额数量（默认1）
   * @returns 是否消费成功
   */
  consumeQuota: (actionType: string, cost?: number) => Promise<boolean>;

  /**
   * 手动设置配额（用于测试或特殊场景）
   */
  setQuota: (quota: QuotaInfo) => void;

  /**
   * 清空配额信息（退出登录时使用）
   */
  clearQuota: () => void;

  /**
   * 重置错误状态
   */
  resetError: () => void;
}

/**
 * 创建配额Store
 * 艹！用Zustand + persist中间件，确保配额信息持久化到localStorage！
 */
export const useQuotaStore = create<QuotaState>()(
  persist(
    (set, get) => ({
      // 初始状态
      quota: null,
      isLoading: false,
      error: null,
      lastUpdated: null,

      /**
       * 从后端API获取配额信息
       */
      fetchQuota: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch('/api/account/quota', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error(`获取配额失败: ${response.status} ${response.statusText}`);
          }

          const payload = await response.json();
          if (!payload?.success || !payload?.data) {
            throw new Error(payload?.message || '获取配额失败');
          }

          const normalized = normalizeQuotaPayload(payload.data as ServerQuotaPayload);

          set({
            quota: normalized,
            isLoading: false,
            error: null,
            lastUpdated: Date.now(),
          });

          console.log('[配额管理] 配额同步成功:', normalized);
        } catch (error: any) {
          console.error('[配额管理] 获取配额失败:', error);
          set({
            isLoading: false,
            error: error.message || '获取配额失败',
          });
        }
      },

      /**
       * 检查配额是否充足
       */
      checkQuota: (cost = 1) => {
        const { quota } = get();

        if (!quota) {
          console.warn('[配额管理] 配额信息未加载，无法检查');
          return false;
        }

        const sufficient = quota.remaining_quota >= cost;

        if (!sufficient) {
          console.warn('[配额管理] 配额不足！剩余:', quota.remaining_quota, '需要:', cost);
        }

        return sufficient;
      },

      /**
       * 消费配额
       */
      consumeQuota: async (actionType: string, cost = 1) => {
        const { quota, checkQuota } = get();

        // 1. 检查配额
        if (!checkQuota(cost)) {
          console.error('[配额管理] 配额不足，消费失败');
          return false;
        }

        try {
          // 2. 调用后端API消费配额
          const response = await fetch('/api/account/quota/consume', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action_type: actionType,
              quota_cost: cost,
            }),
          });

          if (!response.ok) {
            throw new Error(`消费配额失败: ${response.status} ${response.statusText}`);
          }

          const payload = await response.json();
          if (!payload?.success) {
            throw new Error(payload?.message || '消费配额失败');
          }

          const remaining = payload?.data?.remaining;
          if (typeof remaining === 'number' && quota) {
            set({
              quota: {
                ...quota,
                remaining_quota: Math.max(remaining, 0),
                used_quota: Math.max((quota.total_quota ?? DEFAULT_MEMBER_QUOTA) - Math.max(remaining, 0), 0),
              },
              lastUpdated: Date.now(),
            });
          } else {
            // 回退到全量同步
            await get().fetchQuota();
          }

          console.log(`[配额管理] 消费配额成功: ${actionType}, 消费: ${cost}`);
          return true;
        } catch (error: any) {
          console.error('[配额管理] 消费配额失败:', error);
          set({ error: error.message || '消费配额失败' });
          return false;
        }
      },

      /**
       * 手动设置配额
       */
      setQuota: (quota: QuotaInfo) => {
        set({
          quota,
          lastUpdated: Date.now(),
          error: null,
        });
        console.log('[配额管理] 手动设置配额:', quota);
      },

      /**
       * 清空配额信息
       */
      clearQuota: () => {
        set({
          quota: null,
          isLoading: false,
          error: null,
          lastUpdated: null,
        });
        console.log('[配额管理] 配额信息已清空');
      },

      /**
       * 重置错误状态
       */
      resetError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'quota-storage', // localStorage key
      partialize: (state) => ({
        // 只持久化配额和最后更新时间
        quota: state.quota,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
);

/**
 * 配额Hook（便捷使用）
 */
export const useQuota = () => {
  const store = useQuotaStore();

  return {
    // 状态
    quota: store.quota,
    isLoading: store.isLoading,
    error: store.error,
    lastUpdated: store.lastUpdated,

    // 计算属性
    hasQuota: store.quota ? store.quota.remaining_quota > 0 : false,
    quotaPercentage: store.quota
      ? store.quota.total_quota > 0
        ? (store.quota.remaining_quota / store.quota.total_quota) * 100
        : 0
      : 0,

    // 方法
    fetchQuota: store.fetchQuota,
    checkQuota: store.checkQuota,
    consumeQuota: store.consumeQuota,
    setQuota: store.setQuota,
    clearQuota: store.clearQuota,
    resetError: store.resetError,
  };
};
