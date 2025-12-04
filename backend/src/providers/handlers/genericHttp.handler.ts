/**
 * GenericHTTP Provider
 * 艹，这个Provider能处理99%的HTTP请求场景！
 * 支持模板变量替换、extractPath、超时重试、智能轮询
 */

import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import { BaseProvider } from '../base/base-provider.js';
import { ExecContext, ExecResult, ProviderErrorCode, ProviderError } from '../types.js';
import { replaceVariables, extractValue } from '../../utils/template.js';

/**
 * 轮询配置接口
 */
export interface PollingConfig {
  /** 轮询URL（支持{{var}}变量替换，可引用初始请求的响应） */
  url: string;

  /** 轮询HTTP方法（默认GET） */
  method?: string;

  /** 轮询请求头（支持{{var}}） */
  headers?: Record<string, string>;

  /** 轮询请求体（支持{{var}}） */
  body?: unknown;

  /** 轮询间隔（毫秒，默认3000） */
  interval?: number;

  /** 最大轮询超时（毫秒，默认300000 - 5分钟） */
  timeout?: number;

  /** 成功条件（JSONPath表达式或简单的字段值匹配，如 "status == 'SUCCESS'"） */
  successCondition: string;

  /** 失败条件（如 "status == 'FAILED'"） */
  failCondition?: string;

  /** 结果提取路径（从轮询响应中提取最终结果） */
  resultPath?: string;
}

/**
 * 请求模板接口
 */
export interface HttpRequestTemplate {
  /** HTTP方法（GET/POST/PUT/DELETE/PATCH） */
  method: string;

  /** 请求URL（支持{{var}}变量替换） */
  url: string;

  /** 请求头（支持{{var}}变量替换） */
  headers?: Record<string, string>;

  /** 请求体（支持{{var}}变量替换） */
  body?: unknown;

  /** 查询参数（支持{{var}}变量替换） */
  params?: Record<string, string>;

  /** 从响应中提取数据的路径（JSONPath或点路径，如 result.url）*/
  extractPath?: string;

  /** 超时时间（毫秒），不传则使用默认值 */
  timeout?: number;

  /** 轮询配置（可选，用于异步任务） */
  polling?: PollingConfig;
}

/**
 * GenericHTTP Provider输入格式
 */
export interface GenericHttpInput {
  /** 请求模板 */
  req_template: HttpRequestTemplate;

  /** 变量字典（用于替换模板中的{{var}}） */
  variables?: Record<string, unknown>;
}

/**
 * GenericHTTP Provider实现
 * 继承BaseProvider，自动获得重试、超时控制、日志等能力
 */
export class GenericHttpProvider extends BaseProvider {
  public readonly key = 'generic-http';
  public readonly name = 'Generic HTTP Provider';

  /**
   * 参数校验
   * @param input - 输入数据
   * @returns 校验错误信息，null表示校验通过
   */
  public validate(input: unknown): string | null {
    if (!input || typeof input !== 'object') {
      return '输入参数必须是对象';
    }

    const { req_template } = input as GenericHttpInput;

    if (!req_template) {
      return '缺少必填字段: req_template';
    }

    if (!req_template.method) {
      return '缺少必填字段: req_template.method';
    }

    if (!req_template.url) {
      return '缺少必填字段: req_template.url';
    }

    // 验证HTTP方法
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    const method = req_template.method.toUpperCase();
    if (!validMethods.includes(method)) {
      return `不支持的HTTP方法: ${req_template.method}`;
    }

    // 验证轮询配置
    if (req_template.polling) {
      if (!req_template.polling.url) return '轮询配置缺少url';
      if (!req_template.polling.successCondition) return '轮询配置缺少successCondition';
    }

    return null;
  }

  /**
   * 执行HTTP请求
   * @param context - 执行上下文
   * @returns Promise<ExecResult> - 执行结果
   */
  protected async doExecute(context: ExecContext): Promise<ExecResult> {
    const input = context.input as GenericHttpInput;
    const { req_template, variables = {} } = input;

    try {
      // 1. 初始请求 - 变量替换
      const method = req_template.method.toUpperCase();
      const url = replaceVariables(req_template.url, variables) as string;
      const headers = replaceVariables(req_template.headers || {}, variables) as Record<
        string,
        string
      >;
      const params = replaceVariables(req_template.params || {}, variables) as Record<
        string,
        string
      >;

      let body = req_template.body;
      if (body) {
        body = replaceVariables(body, variables);
      }

      this.logger.debug(`[${this.key}] 准备发送HTTP请求`, {
        taskId: context.taskId,
        method,
        url,
        hasBody: !!body
      });

      // 2. 构建axios配置
      const axiosConfig: AxiosRequestConfig = {
        method: method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS',
        url,
        headers,
        params,
        timeout: req_template.timeout || this.defaultTimeout
      };

      if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
        axiosConfig.data = body;
      }

      if (context.signal) {
        (axiosConfig as Record<string, unknown>).signal = context.signal;
      }

      // 3. 执行初始请求
      const response = await axios(axiosConfig);

      this.logger.info(`[${this.key}] 初始HTTP请求成功`, {
        taskId: context.taskId,
        statusCode: response.status,
        url
      });

      // 4. 处理轮询（如果配置了）
      if (req_template.polling) {
        return await this.handlePolling(
          req_template.polling,
          response.data, // 初始响应数据作为变量源
          variables,
          context
        );
      }

      // 5. 无轮询，直接提取结果
      let resultData = response.data;
      if (req_template.extractPath) {
        resultData = extractValue(response.data, req_template.extractPath);
        if (resultData === undefined) {
          this.logger.warn(`[${this.key}] extractPath未找到数据: ${req_template.extractPath}`, {
            taskId: context.taskId
          });
        }
      }

      return {
        success: true,
        data: {
          statusCode: response.status,
          headers: response.headers,
          body: resultData,
          fullResponse: response.data
        }
      };
    } catch (error: unknown) {
      return this.handleError(error, context, req_template);
    }
  }

  /**
   * 处理轮询逻辑
   */
  private async handlePolling(
    config: PollingConfig,
    initialResponse: unknown,
    baseVariables: Record<string, unknown>,
    context: ExecContext
  ): Promise<ExecResult> {
    const {
      interval = 3000,
      timeout = 300000, // 5分钟
      successCondition,
      failCondition,
      resultPath
    } = config;

    const startTime = Date.now();
    const combinedVariables = { ...baseVariables, ...{ lastResponse: initialResponse } };

    // 替换轮询URL和参数中的变量
    const pollUrl = replaceVariables(config.url, combinedVariables) as string;
    const pollMethod = (config.method || 'GET').toUpperCase();
    const pollHeaders = replaceVariables(config.headers || {}, combinedVariables) as Record<
      string,
      string
    >;
    const pollBody = config.body ? replaceVariables(config.body, combinedVariables) : undefined;

    this.logger.info(`[${this.key}] 开始轮询`, {
      taskId: context.taskId,
      url: pollUrl,
      interval,
      timeout
    });

    while (Date.now() - startTime < timeout) {
      // 检查是否中止
      if (context.signal?.aborted) {
        throw new Error('轮询被中止');
      }

      try {
        // 执行轮询请求
        const pollResponse = await axios({
          method: pollMethod,
          url: pollUrl,
          headers: pollHeaders,
          data: pollBody,
          timeout: interval * 2, // 单次请求超时设为间隔的2倍
          signal: context.signal
        });

        const data = pollResponse.data;

        // 检查成功条件
        if (this.checkCondition(successCondition, data)) {
          this.logger.info(`[${this.key}] 轮询成功`, { taskId: context.taskId });
          const finalResult = resultPath ? extractValue(data, resultPath) : data;
          return {
            success: true,
            data: {
              body: finalResult,
              fullResponse: data
            }
          };
        }

        // 检查失败条件
        if (failCondition && this.checkCondition(failCondition, data)) {
          throw new Error(`轮询满足失败条件: ${failCondition}`);
        }

        // 继续等待
        await new Promise((resolve) => setTimeout(resolve, interval));
      } catch (error) {
        // 如果是中止错误，直接抛出
        if (axios.isCancel(error) || context.signal?.aborted) {
          throw error;
        }

        // 这里的错误可能是网络波动，记录日志但不中断轮询（除非是致命错误）
        // 简单起见，这里暂时视为继续尝试，除非超时
        this.logger.warn(`[${this.key}] 轮询请求异常，继续尝试`, {
          taskId: context.taskId,
          error: String(error)
        });
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }

    throw new Error(`轮询超时 (${timeout}ms)`);
  }

  /**
   * 简单的条件检查
   * 支持:
   * 1. "field == 'value'"
   * 2. "field != 'value'"
   * 3. "field" (检查存在且为真)
   */
  private checkCondition(condition: string, data: unknown): boolean {
    // 简单解析： status == 'SUCCESS'
    const eqMatch = condition.match(/([a-zA-Z0-9_.]+)\s*==\s*['"]?([^'"]+)['"]?/);
    if (eqMatch) {
      const path = eqMatch[1];
      const expectValue = eqMatch[2];
      const actualValue = extractValue(data, path);
      return String(actualValue) === expectValue;
    }

    const neqMatch = condition.match(/([a-zA-Z0-9_.]+)\s*!=\s*['"]?([^'"]+)['"]?/);
    if (neqMatch) {
      const path = neqMatch[1];
      const expectValue = neqMatch[2];
      const actualValue = extractValue(data, path);
      return String(actualValue) !== expectValue;
    }

    // 默认检查字段是否存在且为Truthy
    const val = extractValue(data, condition.trim());
    return !!val;
  }

  private handleError(
    error: unknown,
    context: ExecContext,
    template: HttpRequestTemplate
  ): ExecResult {
    const err = error instanceof Error ? error : new Error(String(error));
    this.logger.error(`[${this.key}] HTTP请求失败`, {
      taskId: context.taskId,
      error: err.message,
      url: template.url
    });

    if (axios.isAxiosError(error)) {
      return this.handleAxiosError(error, context.taskId);
    }

    if (
      (typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        (error as Record<string, unknown>).name === 'AbortError') ||
      axios.isCancel(error)
    ) {
      return {
        success: false,
        error: {
          code: ProviderErrorCode.ERR_PROVIDER_TIMEOUT,
          message: `HTTP请求/轮询超时`,
          details: { timeout: template.timeout }
        }
      };
    }

    return {
      success: false,
      error: {
        code: ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED,
        message: err.message || 'HTTP请求执行失败',
        details: { stack: err instanceof Error ? err.stack : undefined }
      }
    };
  }

  /**
   * 处理Axios错误（归一化错误码）
   * @param error - Axios错误对象
   * @param taskId - 任务ID
   * @returns ExecResult - 执行结果
   */
  private handleAxiosError(error: AxiosError, taskId: string): ExecResult {
    const response = error.response;

    // 艹，根据HTTP状态码归一化错误信息
    if (response) {
      const statusCode = response.status;
      let errorCode = ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED;
      let message = `HTTP请求失败 (${statusCode})`;

      // HTTP状态码归一化
      if (statusCode >= 400 && statusCode < 500) {
        // 4xx 客户端错误
        message = `客户端错误 (${statusCode}): ${this.getStatusText(statusCode)}`;
      } else if (statusCode >= 500) {
        // 5xx 服务器错误
        message = `服务器错误 (${statusCode}): ${this.getStatusText(statusCode)}`;
      }

      return {
        success: false,
        error: {
          code: errorCode,
          message,
          details: {
            statusCode,
            statusText: response.statusText,
            responseData: response.data,
            requestUrl: error.config?.url
          }
        }
      };
    }

    // 网络错误（没有响应）
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return {
        success: false,
        error: {
          code: ProviderErrorCode.ERR_PROVIDER_TIMEOUT,
          message: '请求超时',
          details: {
            requestUrl: error.config?.url,
            timeout: error.config?.timeout
          }
        }
      };
    }

    // 网络连接失败
    return {
      success: false,
      error: {
        code: ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED,
        message: `网络错误: ${error.message}`,
        details: {
          requestUrl: error.config?.url,
          errorCode: error.code
        }
      }
    };
  }

  /**
   * 获取HTTP状态码的文本描述
   * @param statusCode - HTTP状态码
   * @returns 状态描述
   */
  private getStatusText(statusCode: number): string {
    const statusTexts: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      408: 'Request Timeout',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    };

    return statusTexts[statusCode] || 'Unknown';
  }

  /**
   * 健康检查（可选）
   * 这里简单返回true，子类可以override实现真正的健康检查
   */
  public async healthCheck(): Promise<boolean> {
    // 乖乖，这里可以ping一个健康检查端点
    return true;
  }
}

// 导出默认实例（兼容旧代码）
export default GenericHttpProvider;
