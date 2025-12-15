/**
 * HTTP API调用节点执行器
 * 调用外部HTTP API并合并结果到流程状态
 *
 * 功能：
 * - 支持GET/POST/PUT/DELETE等方法
 * - 支持变量模板解析（URL、Headers、Body）
 * - 支持重试策略
 * - 支持超时控制
 * - 响应数据转换
 */

import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
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
 * HTTP API调用配置
 */
interface HttpApiConfig {
    url: string; // 请求URL（支持变量模板）
    method: Method; // HTTP方法
    headers?: Record<string, string>; // 请求头（支持变量模板）
    body?: unknown; // 请求体（支持变量模板）
    queryParams?: Record<string, string>; // 查询参数（支持变量模板）
    timeout?: number; // 超时时间（毫秒）
    outputKey?: string; // 输出键名
    responseType?: 'json' | 'text' | 'blob'; // 响应类型
    extractPath?: string; // 从响应中提取的路径（如 'data.items'）
    validateStatus?: number[]; // 有效的状态码列表
}

/**
 * HTTP API调用节点执行器
 */
class HttpApiNodeExecutor implements NodeExecutor {
    /**
     * 执行HTTP API调用节点
     */
    async execute(context: NodeExecutionContext): Promise<NodeExecutionResult> {
        const startTime = Date.now();

        try {
            const config = this.parseConfig(context.node);

            logger.info(
                `[HttpApi] 开始执行: flowId=${context.flowContext.flowId} ` +
                `nodeId=${context.node.id} url=${config.url}`
            );

            // 解析变量模板
            const resolvedUrl = this.resolveValue(config.url, context.flowContext.state) as string;
            const resolvedHeaders = config.headers
                ? this.resolveRecord(config.headers, context.flowContext.state)
                : undefined;
            const resolvedBody = config.body
                ? this.resolveValue(config.body, context.flowContext.state)
                : undefined;
            const resolvedParams = config.queryParams
                ? this.resolveRecord(config.queryParams, context.flowContext.state)
                : undefined;

            // 构建请求配置
            const axiosConfig: AxiosRequestConfig = {
                url: resolvedUrl,
                method: config.method,
                headers: resolvedHeaders,
                data: resolvedBody,
                params: resolvedParams,
                timeout: config.timeout || context.node.timeout || 30000,
                responseType: config.responseType === 'blob' ? 'arraybuffer' : config.responseType || 'json',
                validateStatus: (status) => {
                    if (config.validateStatus && config.validateStatus.length > 0) {
                        return config.validateStatus.includes(status);
                    }
                    return status >= 200 && status < 300;
                }
            };

            // 执行API调用（支持重试）
            const response = await this.executeWithRetry(axiosConfig, context);

            // 提取响应数据
            let responseData = response.data;
            if (config.extractPath) {
                responseData = this.extractFromPath(response.data, config.extractPath);
            }

            // 合并结果到流程状态
            const outputKey = config.outputKey || 'apiResponse';
            context.flowContext.state[outputKey] = responseData;
            context.flowContext.state[`${outputKey}_status`] = response.status;
            context.flowContext.state[`${outputKey}_headers`] = response.headers;

            const duration = Date.now() - startTime;

            logger.info(
                `[HttpApi] 执行成功: nodeId=${context.node.id} ` +
                `status=${response.status} duration=${duration}ms`
            );

            return {
                success: true,
                outputs: {
                    [outputKey]: responseData,
                    status: response.status,
                    headers: response.headers
                },
                duration,
                metadata: {
                    url: resolvedUrl,
                    method: config.method,
                    statusCode: response.status
                }
            };
        } catch (error: unknown) {
            const duration = Date.now() - startTime;

            logger.error(`[HttpApi] 执行失败: nodeId=${context.node.id}`, error);

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
            logger.error('[HttpApi] 配置验证失败:', error);
            return false;
        }
    }

    /**
     * 解析节点配置
     * @private
     */
    private parseConfig(node: NodeConfig): HttpApiConfig {
        const rawConfig = node.config as Record<string, unknown> | undefined;
        if (!rawConfig || typeof rawConfig !== 'object') {
            throw new Error('HTTP API配置无效');
        }

        const url = rawConfig.url;
        if (typeof url !== 'string' || url.trim().length === 0) {
            throw new Error('HTTP API url不能为空');
        }

        const method = (rawConfig.method as Method) || 'GET';
        const validMethods: Method[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        if (!validMethods.includes(method.toUpperCase() as Method)) {
            throw new Error(`无效的HTTP方法: ${method}`);
        }

        return {
            url,
            method: method.toUpperCase() as Method,
            headers: rawConfig.headers as Record<string, string> | undefined,
            body: rawConfig.body,
            queryParams: rawConfig.queryParams as Record<string, string> | undefined,
            timeout: typeof rawConfig.timeout === 'number' ? rawConfig.timeout : undefined,
            outputKey: typeof rawConfig.outputKey === 'string' ? rawConfig.outputKey : undefined,
            responseType: rawConfig.responseType as 'json' | 'text' | 'blob' | undefined,
            extractPath: typeof rawConfig.extractPath === 'string' ? rawConfig.extractPath : undefined,
            validateStatus: Array.isArray(rawConfig.validateStatus)
                ? (rawConfig.validateStatus as number[])
                : undefined
        };
    }

    /**
     * 执行带重试的API调用
     * @private
     */
    private async executeWithRetry(
        config: AxiosRequestConfig,
        context: NodeExecutionContext
    ): Promise<AxiosResponse> {
        const maxRetries = context.node.retryPolicy?.maxRetries || 0;
        const retryDelay = context.node.retryPolicy?.retryDelay || 1000;

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    logger.info(`[HttpApi] 重试请求: attempt=${attempt}/${maxRetries}`);
                    await this.sleep(retryDelay * attempt);
                }

                return await axios(config);
            } catch (error: unknown) {
                lastError = error as Error;

                // 判断是否可重试
                if (!this.isRetryableError(error) || attempt >= maxRetries) {
                    throw error;
                }
            }
        }

        throw lastError;
    }

    /**
     * 判断是否可重试的错误
     * @private
     */
    private isRetryableError(error: unknown): boolean {
        if (!axios.isAxiosError(error)) {
            return false;
        }

        // 网络错误可重试
        if (!error.response) {
            return true;
        }

        // 5xx服务器错误可重试
        if (error.response.status >= 500) {
            return true;
        }

        // 429 Too Many Requests可重试
        if (error.response.status === 429) {
            return true;
        }

        return false;
    }

    /**
     * 从路径提取数据
     * @private
     */
    private extractFromPath(data: unknown, path: string): unknown {
        const keys = path.split('.');
        let value: unknown = data;

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
     * 解析变量值
     * @private
     */
    private resolveValue(value: unknown, state: Record<string, unknown>): unknown {
        if (typeof value === 'string') {
            return value.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
                const resolved = this.getNestedValue(state, path.trim());
                return resolved !== undefined ? String(resolved) : '';
            });
        }

        if (Array.isArray(value)) {
            return value.map((item) => this.resolveValue(item, state));
        }

        if (typeof value === 'object' && value !== null) {
            const resolved: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(value)) {
                resolved[k] = this.resolveValue(v, state);
            }
            return resolved;
        }

        return value;
    }

    /**
     * 解析Record类型
     * @private
     */
    private resolveRecord(
        record: Record<string, string>,
        state: Record<string, unknown>
    ): Record<string, string> {
        const resolved: Record<string, string> = {};
        for (const [key, value] of Object.entries(record)) {
            resolved[key] = this.resolveValue(value, state) as string;
        }
        return resolved;
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
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                return {
                    code: 'HTTP_TIMEOUT',
                    message: `HTTP request timeout: ${error.message}`,
                    type: NodeErrorType.TIMEOUT
                };
            }

            if (error.response) {
                return {
                    code: 'HTTP_ERROR',
                    message: `HTTP ${error.response.status}: ${error.response.statusText}`,
                    type: NodeErrorType.PROVIDER_ERROR,
                    details: {
                        status: error.response.status,
                        statusText: error.response.statusText,
                        data: error.response.data
                    }
                };
            }

            return {
                code: 'HTTP_NETWORK_ERROR',
                message: `Network error: ${error.message}`,
                type: NodeErrorType.PROVIDER_ERROR
            };
        }

        const err = error instanceof Error ? error : new Error(String(error));
        return {
            code: 'HTTP_API_ERROR',
            message: err.message || 'HTTP API call failed',
            type: NodeErrorType.EXECUTION_FAILED
        };
    }

    /**
     * 延迟函数
     * @private
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

// 导出单例
export const httpApiNodeExecutor = new HttpApiNodeExecutor();

export default httpApiNodeExecutor;
