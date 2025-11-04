/**
 * 规则引擎运行时
 * 艹！这个引擎负责规则评估和动作执行！
 *
 * @author 老王
 */

import type {
  Rule,
  RuleContext,
  RuleExecutionResult,
  Condition,
  ConditionOperator,
  Action,
  RuleEngineConfig,
  EventTrigger,
} from './types';

/**
 * 规则引擎类
 */
export class RuleEngine {
  private rules: Map<string, Rule> = new Map();
  private config: RuleEngineConfig;
  private actionQueue: Array<{ rule: Rule; action: Action; context: RuleContext }> = [];
  private processing = false;
  private eventDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private eventThrottleTimers: Map<string, number> = new Map();

  constructor(config: RuleEngineConfig) {
    this.config = {
      max_concurrent_actions: 10,
      default_action_timeout: 5000,
      enable_logging: true,
      enable_metrics: true,
      ...config,
    };
  }

  /**
   * 加载规则
   */
  loadRules(rules: Rule[]): void {
    this.rules.clear();
    rules.forEach((rule) => {
      if (rule.status === 'enabled') {
        this.rules.set(rule.id, rule);
      }
    });

    if (this.config.enable_logging) {
      console.log(`[RuleEngine] 加载了 ${this.rules.size} 条规则`);
    }
  }

  /**
   * 添加单条规则
   */
  addRule(rule: Rule): void {
    if (rule.status === 'enabled') {
      this.rules.set(rule.id, rule);
      if (this.config.enable_logging) {
        console.log(`[RuleEngine] 添加规则: ${rule.name}`);
      }
    }
  }

  /**
   * 移除规则
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    if (this.config.enable_logging) {
      console.log(`[RuleEngine] 移除规则: ${ruleId}`);
    }
  }

  /**
   * 触发事件，评估相关规则
   */
  async triggerEvent(eventName: string, eventData?: any, context?: Partial<RuleContext>): Promise<RuleExecutionResult[]> {
    if (!this.config.enabled) {
      return [];
    }

    const fullContext: RuleContext = {
      event_name: eventName,
      event_data: eventData,
      timestamp: Date.now(),
      ...context,
    };

    // 找到所有匹配的事件触发器规则
    const matchingRules = Array.from(this.rules.values()).filter(
      (rule) => rule.trigger.type === 'event' && rule.trigger.event_name === eventName
    );

    // 按优先级排序
    matchingRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const results: RuleExecutionResult[] = [];

    for (const rule of matchingRules) {
      const trigger = rule.trigger as EventTrigger;

      // 处理防抖
      if (trigger.debounce) {
        const timerId = this.eventDebounceTimers.get(rule.id);
        if (timerId) {
          clearTimeout(timerId);
        }

        await new Promise<void>((resolve) => {
          const newTimerId = setTimeout(() => {
            this.eventDebounceTimers.delete(rule.id);
            resolve();
          }, trigger.debounce);
          this.eventDebounceTimers.set(rule.id, newTimerId);
        });
      }

      // 处理节流
      if (trigger.throttle) {
        const lastTime = this.eventThrottleTimers.get(rule.id) || 0;
        const now = Date.now();
        if (now - lastTime < trigger.throttle) {
          if (this.config.enable_logging) {
            console.log(`[RuleEngine] 规则 ${rule.name} 被节流`);
          }
          continue;
        }
        this.eventThrottleTimers.set(rule.id, now);
      }

      // 评估规则
      const result = await this.evaluateRule(rule, fullContext);
      results.push(result);
    }

    return results;
  }

  /**
   * 评估单条规则
   */
  private async evaluateRule(rule: Rule, context: RuleContext): Promise<RuleExecutionResult> {
    const startTime = Date.now();

    const result: RuleExecutionResult = {
      rule_id: rule.id,
      rule_name: rule.name,
      triggered: true,
      conditions_met: false,
      actions_executed: 0,
      actions_failed: 0,
      duration_ms: 0,
      timestamp: context.timestamp,
    };

    try {
      // 评估条件
      const conditionsMet = this.evaluateConditions(rule.conditions, context);
      result.conditions_met = conditionsMet;

      if (conditionsMet) {
        // 执行动作
        if (this.config.enable_logging) {
          console.log(`[RuleEngine] 规则 ${rule.name} 条件满足，执行 ${rule.actions.length} 个动作`);
        }

        const actionResults = await Promise.allSettled(
          rule.actions.map((action) => this.executeAction(action, context))
        );

        actionResults.forEach((actionResult, index) => {
          if (actionResult.status === 'fulfilled') {
            result.actions_executed++;
          } else {
            result.actions_failed++;
            if (!result.errors) result.errors = [];
            result.errors.push({
              action_index: index,
              error: actionResult.reason?.message || 'Unknown error',
            });
          }
        });
      } else {
        if (this.config.enable_logging) {
          console.log(`[RuleEngine] 规则 ${rule.name} 条件不满足`);
        }
      }
    } catch (error: any) {
      result.actions_failed++;
      if (!result.errors) result.errors = [];
      result.errors.push({
        action_index: -1,
        error: error.message || 'Unknown error',
      });
    }

    result.duration_ms = Date.now() - startTime;
    return result;
  }

  /**
   * 评估条件
   */
  private evaluateConditions(conditions: Condition[], context: RuleContext): boolean {
    if (!conditions || conditions.length === 0) {
      return true; // 无条件，默认满足
    }

    return conditions.every((condition) => this.evaluateCondition(condition, context));
  }

  /**
   * 评估单个条件
   */
  private evaluateCondition(condition: Condition, context: RuleContext): boolean {
    // 处理AND条件组
    if (condition.and && condition.and.length > 0) {
      return condition.and.every((c) => this.evaluateCondition(c, context));
    }

    // 处理OR条件组
    if (condition.or && condition.or.length > 0) {
      return condition.or.some((c) => this.evaluateCondition(c, context));
    }

    // 获取字段值
    const fieldValue = this.getFieldValue(condition.field, context);
    const targetValue = condition.value;

    // 根据操作符比较
    return this.compareValues(fieldValue, condition.operator, targetValue);
  }

  /**
   * 从上下文中获取字段值
   */
  private getFieldValue(field: string, context: RuleContext): any {
    // 支持点号路径，如 'event_data.user.age'
    const parts = field.split('.');
    let value: any = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * 比较值
   */
  private compareValues(fieldValue: any, operator: ConditionOperator, targetValue: any): boolean {
    switch (operator) {
      case 'eq':
        return fieldValue === targetValue;
      case 'ne':
        return fieldValue !== targetValue;
      case 'gt':
        return fieldValue > targetValue;
      case 'gte':
        return fieldValue >= targetValue;
      case 'lt':
        return fieldValue < targetValue;
      case 'lte':
        return fieldValue <= targetValue;
      case 'in':
        return Array.isArray(targetValue) && targetValue.includes(fieldValue);
      case 'not_in':
        return Array.isArray(targetValue) && !targetValue.includes(fieldValue);
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(targetValue);
      case 'matches':
        return typeof fieldValue === 'string' && new RegExp(targetValue).test(fieldValue);
      default:
        return false;
    }
  }

  /**
   * 执行动作
   */
  private async executeAction(action: Action, context: RuleContext): Promise<void> {
    const timeout = this.config.default_action_timeout || 5000;

    return Promise.race([
      this.doExecuteAction(action, context),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Action timeout')), timeout)
      ),
    ]);
  }

  /**
   * 实际执行动作
   */
  private async doExecuteAction(action: Action, context: RuleContext): Promise<void> {
    switch (action.type) {
      case 'webhook':
        await this.executeWebhook(action, context);
        break;
      case 'notification':
        await this.executeNotification(action, context);
        break;
      case 'experiment_toggle':
        await this.executeExperimentToggle(action, context);
        break;
      case 'quota_adjust':
        await this.executeQuotaAdjust(action, context);
        break;
      case 'custom':
        await this.executeCustomAction(action, context);
        break;
      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  /**
   * 执行Webhook动作
   */
  private async executeWebhook(action: Action & { type: 'webhook' }, context: RuleContext): Promise<void> {
    const { url, method, headers, body, timeout = 5000, retries = 3 } = action;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: body ? JSON.stringify({ ...body, context }) : undefined,
          signal: AbortSignal.timeout(timeout),
        });

        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
        }

        if (this.config.enable_logging) {
          console.log(`[RuleEngine] Webhook executed: ${url}`);
        }

        return;
      } catch (error: any) {
        lastError = error;
        if (this.config.enable_logging) {
          console.warn(`[RuleEngine] Webhook attempt ${attempt + 1} failed:`, error.message);
        }
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1))); // 指数退避
        }
      }
    }

    throw lastError || new Error('Webhook failed');
  }

  /**
   * 执行通知动作
   */
  private async executeNotification(action: Action & { type: 'notification' }, context: RuleContext): Promise<void> {
    const { channel, recipients, template, data } = action;

    // 调用通知服务API
    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        recipients,
        template,
        data: { ...data, context },
      }),
    });

    if (!response.ok) {
      throw new Error(`Notification failed: ${response.status}`);
    }

    if (this.config.enable_logging) {
      console.log(`[RuleEngine] Notification sent via ${channel} to ${recipients.length} recipients`);
    }
  }

  /**
   * 执行实验开关动作
   */
  private async executeExperimentToggle(action: Action & { type: 'experiment_toggle' }, context: RuleContext): Promise<void> {
    const { experiment_id, enabled } = action;

    const response = await fetch(`/api/experiments/${experiment_id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      throw new Error(`Experiment toggle failed: ${response.status}`);
    }

    if (this.config.enable_logging) {
      console.log(`[RuleEngine] Experiment ${experiment_id} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * 执行配额调整动作
   */
  private async executeQuotaAdjust(action: Action & { type: 'quota_adjust' }, context: RuleContext): Promise<void> {
    const { quota_type, adjustment, reason } = action;

    const response = await fetch('/api/quotas/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: context.user_id,
        quota_type,
        adjustment,
        reason,
      }),
    });

    if (!response.ok) {
      throw new Error(`Quota adjust failed: ${response.status}`);
    }

    if (this.config.enable_logging) {
      console.log(`[RuleEngine] Quota ${quota_type} adjusted by ${adjustment}`);
    }
  }

  /**
   * 执行自定义动作
   */
  private async executeCustomAction(action: Action & { type: 'custom' }, context: RuleContext): Promise<void> {
    // 自定义动作需要注册处理器
    throw new Error(`Custom action handler not implemented: ${action.handler}`);
  }

  /**
   * 导出规则为JSON
   */
  exportRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 导入规则从JSON
   */
  importRules(rules: Rule[]): void {
    this.loadRules(rules);
  }

  /**
   * 获取规则统计
   */
  getStats() {
    return {
      total_rules: this.rules.size,
      enabled_rules: Array.from(this.rules.values()).filter((r) => r.status === 'enabled').length,
      event_rules: Array.from(this.rules.values()).filter((r) => r.trigger.type === 'event').length,
      schedule_rules: Array.from(this.rules.values()).filter((r) => r.trigger.type === 'schedule').length,
    };
  }
}

/**
 * 全局规则引擎实例
 */
export const ruleEngine = new RuleEngine({
  enabled: true,
  enable_logging: true,
  enable_metrics: true,
});
