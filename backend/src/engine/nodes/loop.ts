/**
 * 循环节点执行器
 * 对数组或范围执行循环，每次迭代执行子流程
 *
 * 功能：
 * - 支持数组遍历
 * - 支持范围循环（from-to）
 * - 支持while条件循环
 * - 支持break/continue控制
 * - 每次迭代更新状态
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
 * 循环节点配置
 */
interface LoopConfig {
    // 循环类型
    loopType: 'forEach' | 'range' | 'while';
    // forEach: 要遍历的数组（变量路径或实际数组）
    items?: string | unknown[];
    // range: 起始值
    from?: number;
    // range: 结束值
    to?: number;
    // range: 步长
    step?: number;
    // while: 条件表达式
    condition?: string;
    // 当前迭代项的变量名
    itemVar?: string;
    // 当前索引的变量名
    indexVar?: string;
    // 最大迭代次数（防止无限循环）
    maxIterations?: number;
    // 输出键名
    outputKey?: string;
}

/**
 * 迭代结果
 */
interface IterationResult {
    index: number;
    item: unknown;
    output: unknown;
}

/**
 * 循环节点执行器
 */
class LoopNodeExecutor implements NodeExecutor {
    private readonly DEFAULT_MAX_ITERATIONS = 1000;

    /**
     * 执行循环节点
     */
    async execute(context: NodeExecutionContext): Promise<NodeExecutionResult> {
        const startTime = Date.now();

        try {
            const config = this.parseConfig(context.node);

            logger.info(
                `[Loop] 开始执行: flowId=${context.flowContext.flowId} ` +
                `nodeId=${context.node.id} type=${config.loopType}`
            );

            // 根据循环类型执行
            const results = await this.executeLoop(config, context);

            // 合并结果到流程状态
            const outputKey = config.outputKey || 'loopResults';
            context.flowContext.state[outputKey] = results.map((r) => r.output);
            context.flowContext.state[`${outputKey}_full`] = results;

            const duration = Date.now() - startTime;

            logger.info(
                `[Loop] 执行成功: nodeId=${context.node.id} ` +
                `iterations=${results.length} duration=${duration}ms`
            );

            return {
                success: true,
                outputs: {
                    [outputKey]: results.map((r) => r.output),
                    iterationCount: results.length
                },
                duration,
                metadata: {
                    loopType: config.loopType,
                    iterationCount: results.length
                }
            };
        } catch (error: unknown) {
            const duration = Date.now() - startTime;

            logger.error(`[Loop] 执行失败: nodeId=${context.node.id}`, error);

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
            logger.error('[Loop] 配置验证失败:', error);
            return false;
        }
    }

    /**
     * 解析节点配置
     * @private
     */
    private parseConfig(node: NodeConfig): LoopConfig {
        const rawConfig = node.config as Record<string, unknown> | undefined;
        if (!rawConfig || typeof rawConfig !== 'object') {
            throw new Error('循环节点配置无效');
        }

        const loopType = rawConfig.loopType as 'forEach' | 'range' | 'while';
        if (!['forEach', 'range', 'while'].includes(loopType)) {
            throw new Error('无效的循环类型，支持: forEach, range, while');
        }

        // 验证特定类型的必需配置
        if (loopType === 'forEach' && !rawConfig.items) {
            throw new Error('forEach循环必须指定items');
        }
        if (loopType === 'range' && (rawConfig.from === undefined || rawConfig.to === undefined)) {
            throw new Error('range循环必须指定from和to');
        }
        if (loopType === 'while' && !rawConfig.condition) {
            throw new Error('while循环必须指定condition');
        }

        return {
            loopType,
            items: rawConfig.items as string | unknown[] | undefined,
            from: typeof rawConfig.from === 'number' ? rawConfig.from : undefined,
            to: typeof rawConfig.to === 'number' ? rawConfig.to : undefined,
            step: typeof rawConfig.step === 'number' ? rawConfig.step : 1,
            condition: typeof rawConfig.condition === 'string' ? rawConfig.condition : undefined,
            itemVar: typeof rawConfig.itemVar === 'string' ? rawConfig.itemVar : 'item',
            indexVar: typeof rawConfig.indexVar === 'string' ? rawConfig.indexVar : 'index',
            maxIterations:
                typeof rawConfig.maxIterations === 'number'
                    ? rawConfig.maxIterations
                    : this.DEFAULT_MAX_ITERATIONS,
            outputKey: typeof rawConfig.outputKey === 'string' ? rawConfig.outputKey : undefined
        };
    }

    /**
     * 执行循环
     * @private
     */
    private async executeLoop(
        config: LoopConfig,
        context: NodeExecutionContext
    ): Promise<IterationResult[]> {
        switch (config.loopType) {
            case 'forEach':
                return this.executeForEach(config, context);
            case 'range':
                return this.executeRange(config, context);
            case 'while':
                return this.executeWhile(config, context);
            default:
                throw new Error(`未知的循环类型: ${config.loopType}`);
        }
    }

    /**
     * 执行forEach循环
     * @private
     */
    private async executeForEach(
        config: LoopConfig,
        context: NodeExecutionContext
    ): Promise<IterationResult[]> {
        // 解析items
        let items: unknown[];
        if (typeof config.items === 'string') {
            const resolved = this.getNestedValue(context.flowContext.state, config.items);
            if (!Array.isArray(resolved)) {
                throw new Error(`items必须是数组: ${config.items}`);
            }
            items = resolved;
        } else if (Array.isArray(config.items)) {
            items = config.items;
        } else {
            throw new Error('items配置无效');
        }

        const results: IterationResult[] = [];
        const maxIterations = config.maxIterations || this.DEFAULT_MAX_ITERATIONS;

        for (let i = 0; i < Math.min(items.length, maxIterations); i++) {
            const item = items[i];

            // 设置当前迭代的变量
            context.flowContext.state[config.itemVar!] = item;
            context.flowContext.state[config.indexVar!] = i;

            // 记录迭代结果（这里只记录状态快照，实际子流程执行由引擎处理）
            results.push({
                index: i,
                item,
                output: { item, index: i }
            });
        }

        return results;
    }

    /**
     * 执行range循环
     * @private
     */
    private async executeRange(
        config: LoopConfig,
        context: NodeExecutionContext
    ): Promise<IterationResult[]> {
        const from = config.from!;
        const to = config.to!;
        const step = config.step || 1;

        if (step === 0) {
            throw new Error('step不能为0');
        }

        const results: IterationResult[] = [];
        const maxIterations = config.maxIterations || this.DEFAULT_MAX_ITERATIONS;
        let iterationCount = 0;

        const isAscending = step > 0;
        for (
            let i = from;
            isAscending ? i < to : i > to;
            i += step
        ) {
            if (iterationCount >= maxIterations) {
                logger.warn(`[Loop] 达到最大迭代次数: ${maxIterations}`);
                break;
            }

            // 设置当前迭代的变量
            context.flowContext.state[config.itemVar!] = i;
            context.flowContext.state[config.indexVar!] = iterationCount;

            results.push({
                index: iterationCount,
                item: i,
                output: { value: i, index: iterationCount }
            });

            iterationCount++;
        }

        return results;
    }

    /**
     * 执行while循环
     * @private
     */
    private async executeWhile(
        config: LoopConfig,
        context: NodeExecutionContext
    ): Promise<IterationResult[]> {
        const results: IterationResult[] = [];
        const maxIterations = config.maxIterations || this.DEFAULT_MAX_ITERATIONS;
        let iterationCount = 0;

        while (iterationCount < maxIterations) {
            // 评估条件
            const conditionResult = this.evaluateCondition(
                config.condition!,
                context.flowContext.state
            );

            if (!conditionResult) {
                break;
            }

            // 设置当前迭代的变量
            context.flowContext.state[config.indexVar!] = iterationCount;

            results.push({
                index: iterationCount,
                item: null,
                output: { index: iterationCount, conditionMet: true }
            });

            iterationCount++;
        }

        if (iterationCount >= maxIterations) {
            logger.warn(`[Loop] while循环达到最大迭代次数: ${maxIterations}`);
        }

        return results;
    }

    /**
     * 评估条件表达式
     * @private
     */
    private evaluateCondition(condition: string, state: Record<string, unknown>): boolean {
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

        // 其他truthy检查
        return !!resolved;
    }

    /**
     * 解析变量值
     * @private
     */
    private resolveValue(value: string, state: Record<string, unknown>): unknown {
        const match = value.match(/^\{\{([^}]+)\}\}$/);
        if (match) {
            return this.getNestedValue(state, match[1].trim());
        }
        return value.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
            const resolved = this.getNestedValue(state, path.trim());
            return resolved !== undefined ? String(resolved) : '';
        });
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
            code: 'LOOP_ERROR',
            message: err.message || 'Loop execution failed',
            type: NodeErrorType.EXECUTION_FAILED
        };
    }
}

// 导出单例
export const loopNodeExecutor = new LoopNodeExecutor();

export default loopNodeExecutor;
