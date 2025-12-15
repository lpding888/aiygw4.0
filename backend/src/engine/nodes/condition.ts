/**
 * 条件判断节点执行器
 * 根据条件表达式决定后续流程走向
 *
 * 功能：
 * - 支持多种比较运算符
 * - 支持变量模板解析
 * - 输出true/false分支控制
 */

import logger from '../../utils/logger.js';
import {
    NodeExecutor,
    NodeExecutionContext,
    NodeExecutionResult,
    NodeConfig,
    NodeError,
    NodeErrorType
} from '../types.js';

/**
 * 条件节点配置
 */
interface ConditionConfig {
    // 条件表达式或对象
    condition: ConditionExpression | string;
    // 条件为真时的输出键
    trueOutputKey?: string;
    // 条件为假时的输出键
    falseOutputKey?: string;
}

/**
 * 条件表达式
 */
interface ConditionExpression {
    left: string | number | boolean; // 左操作数（支持变量模板）
    operator: ConditionOperator; // 比较运算符
    right: string | number | boolean; // 右操作数（支持变量模板）
    logic?: 'and' | 'or'; // 逻辑运算符（用于组合多个条件）
    next?: ConditionExpression; // 下一个条件（链式）
}

/**
 * 条件运算符
 */
type ConditionOperator =
    | 'eq' // 等于
    | 'neq' // 不等于
    | 'gt' // 大于
    | 'gte' // 大于等于
    | 'lt' // 小于
    | 'lte' // 小于等于
    | 'contains' // 包含
    | 'startsWith' // 以...开头
    | 'endsWith' // 以...结尾
    | 'matches' // 正则匹配
    | 'exists' // 存在
    | 'isEmpty' // 为空
    | 'isNull'; // 为null

/**
 * 条件判断节点执行器
 */
class ConditionNodeExecutor implements NodeExecutor {
    /**
     * 执行条件判断节点
     */
    async execute(context: NodeExecutionContext): Promise<NodeExecutionResult> {
        const startTime = Date.now();

        try {
            const config = this.parseConfig(context.node);

            logger.info(
                `[Condition] 开始执行: flowId=${context.flowContext.flowId} ` + `nodeId=${context.node.id}`
            );

            // 解析并评估条件
            const result = this.evaluateCondition(config.condition, context.flowContext.state);

            // 设置输出
            const trueKey = config.trueOutputKey || 'conditionResult';
            const falseKey = config.falseOutputKey || 'conditionResult';

            // 更新流程状态
            context.flowContext.state[trueKey] = result;

            const duration = Date.now() - startTime;

            logger.info(
                `[Condition] 执行成功: nodeId=${context.node.id} ` +
                `result=${result} duration=${duration}ms`
            );

            return {
                success: true,
                outputs: {
                    result,
                    branch: result ? 'true' : 'false'
                },
                duration,
                metadata: {
                    evaluatedCondition: JSON.stringify(config.condition),
                    result
                }
            };
        } catch (error: unknown) {
            const duration = Date.now() - startTime;

            logger.error(`[Condition] 执行失败: nodeId=${context.node.id}`, error);

            return {
                success: false,
                error: this.handleError(error),
                duration
            };
        }
    }

    /**
     * 验证节点配置
     */
    validate(config: NodeConfig): boolean {
        try {
            this.parseConfig(config);
            return true;
        } catch (error) {
            logger.error('[Condition] 配置验证失败:', error);
            return false;
        }
    }

    /**
     * 解析节点配置
     * @private
     */
    private parseConfig(node: NodeConfig): ConditionConfig {
        const rawConfig = node.config as Record<string, unknown> | undefined;
        if (!rawConfig || typeof rawConfig !== 'object') {
            throw new Error('条件节点配置无效');
        }

        const condition = rawConfig.condition;
        if (!condition) {
            throw new Error('条件表达式不能为空');
        }

        return {
            condition: condition as ConditionExpression | string,
            trueOutputKey:
                typeof rawConfig.trueOutputKey === 'string' ? rawConfig.trueOutputKey : undefined,
            falseOutputKey:
                typeof rawConfig.falseOutputKey === 'string' ? rawConfig.falseOutputKey : undefined
        };
    }

    /**
     * 评估条件表达式
     * @private
     */
    private evaluateCondition(
        condition: ConditionExpression | string,
        state: Record<string, unknown>
    ): boolean {
        // 字符串形式的简单表达式
        if (typeof condition === 'string') {
            return this.evaluateStringCondition(condition, state);
        }

        // 结构化条件表达式
        return this.evaluateExpressionCondition(condition, state);
    }

    /**
     * 评估字符串条件
     * @private
     */
    private evaluateStringCondition(
        condition: string,
        state: Record<string, unknown>
    ): boolean {
        // 解析变量
        const resolved = this.resolveValue(condition, state);

        // 布尔值直接返回
        if (typeof resolved === 'boolean') {
            return resolved;
        }

        // 字符串'true'/'false'
        if (typeof resolved === 'string') {
            return resolved.toLowerCase() === 'true';
        }

        // 数字非0为true
        if (typeof resolved === 'number') {
            return resolved !== 0;
        }

        // 其他truthy检查
        return !!resolved;
    }

    /**
     * 评估结构化条件表达式
     * @private
     */
    private evaluateExpressionCondition(
        expr: ConditionExpression,
        state: Record<string, unknown>
    ): boolean {
        // 解析左右操作数
        const left = this.resolveValue(expr.left, state);
        const right = this.resolveValue(expr.right, state);

        // 执行比较
        let result = this.compare(left, expr.operator, right);

        // 处理链式条件
        if (expr.next) {
            const nextResult = this.evaluateExpressionCondition(expr.next, state);
            if (expr.logic === 'and') {
                result = result && nextResult;
            } else if (expr.logic === 'or') {
                result = result || nextResult;
            }
        }

        return result;
    }

    /**
     * 比较两个值
     * @private
     */
    private compare(left: unknown, operator: ConditionOperator, right: unknown): boolean {
        switch (operator) {
            case 'eq':
                return left === right;
            case 'neq':
                return left !== right;
            case 'gt':
                return Number(left) > Number(right);
            case 'gte':
                return Number(left) >= Number(right);
            case 'lt':
                return Number(left) < Number(right);
            case 'lte':
                return Number(left) <= Number(right);
            case 'contains':
                return String(left).includes(String(right));
            case 'startsWith':
                return String(left).startsWith(String(right));
            case 'endsWith':
                return String(left).endsWith(String(right));
            case 'matches':
                try {
                    return new RegExp(String(right)).test(String(left));
                } catch {
                    return false;
                }
            case 'exists':
                return left !== undefined && left !== null;
            case 'isEmpty':
                if (left === null || left === undefined) return true;
                if (typeof left === 'string') return left.length === 0;
                if (Array.isArray(left)) return left.length === 0;
                if (typeof left === 'object') return Object.keys(left).length === 0;
                return false;
            case 'isNull':
                return left === null || left === undefined;
            default:
                return false;
        }
    }

    /**
     * 解析变量值
     * @private
     */
    private resolveValue(value: unknown, state: Record<string, unknown>): unknown {
        if (typeof value === 'string') {
            // 解析 {{variable}} 模板
            const match = value.match(/^\{\{([^}]+)\}\}$/);
            if (match) {
                return this.getNestedValue(state, match[1].trim());
            }
            // 包含变量的字符串
            return value.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
                const resolved = this.getNestedValue(state, path.trim());
                return resolved !== undefined ? String(resolved) : '';
            });
        }
        return value;
    }

    /**
     * 获取嵌套对象值
     * @private
     */
    private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
        const keys = path.split('.');
        let value: unknown = obj;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = (value as Record<string, unknown>)[key];
            } else {
                return undefined;
            }
        }

        return value;
    }

    /**
     * 处理错误
     * @private
     */
    private handleError(error: unknown): NodeError {
        const err = error instanceof Error ? error : new Error(String(error));
        return {
            code: 'CONDITION_ERROR',
            message: err.message || 'Condition evaluation failed',
            type: NodeErrorType.EXECUTION_FAILED
        };
    }
}

// 导出单例
export const conditionNodeExecutor = new ConditionNodeExecutor();

export default conditionNodeExecutor;
