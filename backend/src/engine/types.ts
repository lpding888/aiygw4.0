/**
 * 流程引擎类型定义
 * 艹，这个SB文件定义流程引擎的所有核心类型！
 *
 * 类型：
 * - 节点类型
 * - 流程上下文
 * - 执行结果
 * - 错误类型
 */

/**
 * 节点类型枚举
 */
export enum NodeType {
  // LLM相关
  LLM_CHAT = 'LLM_CHAT',
  LLM_COMPLETION = 'LLM_COMPLETION',

  // MCP工具调用
  MCP_TOOL_CALL = 'MCP_TOOL_CALL',

  // RAG知识库
  KB_RETRIEVE = 'KB_RETRIEVE',

  // 数据处理
  DATA_TRANSFORM = 'DATA_TRANSFORM',
  DATA_FILTER = 'DATA_FILTER',

  // 控制流
  CONDITION = 'CONDITION',
  LOOP = 'LOOP',
  PARALLEL = 'PARALLEL',

  // 输入输出
  INPUT = 'INPUT',
  OUTPUT = 'OUTPUT',
}

/**
 * 节点状态枚举
 */
export enum NodeStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * 节点配置接口
 */
export interface NodeConfig {
  id: string; // 节点ID
  type: NodeType; // 节点类型
  name: string; // 节点名称
  config: Record<string, any>; // 节点配置（特定于节点类型）
  inputs?: NodeInput[]; // 输入连接
  outputs?: NodeOutput[]; // 输出连接
  retryPolicy?: RetryPolicy; // 重试策略
  timeout?: number; // 超时时间（毫秒）
}

/**
 * 节点输入
 */
export interface NodeInput {
  name: string; // 输入名称
  sourceNodeId: string; // 来源节点ID
  sourceOutputName: string; // 来源输出名称
  transform?: string; // 转换表达式（可选）
}

/**
 * 节点输出
 */
export interface NodeOutput {
  name: string; // 输出名称
  value?: any; // 输出值
}

/**
 * 重试策略
 */
export interface RetryPolicy {
  maxRetries: number; // 最大重试次数
  retryDelay: number; // 重试延迟（毫秒）
  backoff?: 'linear' | 'exponential'; // 退避策略
  retryableErrors?: string[]; // 可重试的错误类型
}

/**
 * 流程上下文
 */
export interface FlowContext {
  flowId: string; // 流程ID
  executionId: string; // 执行ID
  userId: string; // 用户ID
  state: Record<string, any>; // 流程状态（变量存储）
  metadata: Record<string, any>; // 元数据
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
}

/**
 * 节点执行上下文
 */
export interface NodeExecutionContext {
  node: NodeConfig; // 节点配置
  flowContext: FlowContext; // 流程上下文
  inputs: Record<string, any>; // 节点输入数据
  attempt: number; // 当前尝试次数
}

/**
 * 节点执行结果
 */
export interface NodeExecutionResult {
  success: boolean; // 是否成功
  outputs?: Record<string, any>; // 输出数据
  error?: NodeError; // 错误信息
  duration: number; // 执行时长（毫秒）
  metadata?: Record<string, any>; // 执行元数据
}

/**
 * 节点错误
 */
export interface NodeError {
  code: string; // 错误码
  message: string; // 错误信息
  type: NodeErrorType; // 错误类型
  details?: Record<string, any>; // 错误详情
  stack?: string; // 错误堆栈
}

/**
 * 节点错误类型
 */
export enum NodeErrorType {
  // 配置错误
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_INPUT = 'MISSING_INPUT',

  // 执行错误
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',

  // 外部服务错误
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  MCP_TOOL_ERROR = 'MCP_TOOL_ERROR',
  KB_RETRIEVE_ERROR = 'KB_RETRIEVE_ERROR',

  // 系统错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * 流程执行器接口
 */
export interface FlowExecutor {
  /**
   * 执行流程
   * @param flowConfig - 流程配置
   * @param inputs - 输入数据
   * @returns 执行结果
   */
  execute(
    flowConfig: FlowConfig,
    inputs: Record<string, any>
  ): Promise<FlowExecutionResult>;

  /**
   * 暂停流程
   * @param executionId - 执行ID
   */
  pause(executionId: string): Promise<void>;

  /**
   * 恢复流程
   * @param executionId - 执行ID
   */
  resume(executionId: string): Promise<void>;

  /**
   * 取消流程
   * @param executionId - 执行ID
   */
  cancel(executionId: string): Promise<void>;
}

/**
 * 流程配置
 */
export interface FlowConfig {
  id: string; // 流程ID
  name: string; // 流程名称
  description?: string; // 流程描述
  nodes: NodeConfig[]; // 节点列表
  edges: FlowEdge[]; // 边（连接）列表
  variables?: Record<string, any>; // 流程变量
  settings?: FlowSettings; // 流程设置
}

/**
 * 流程边（连接）
 */
export interface FlowEdge {
  id: string; // 边ID
  source: string; // 来源节点ID
  target: string; // 目标节点ID
  sourceOutput?: string; // 来源输出端口
  targetInput?: string; // 目标输入端口
  condition?: string; // 条件表达式（可选）
}

/**
 * 流程设置
 */
export interface FlowSettings {
  maxExecutionTime?: number; // 最大执行时间（毫秒）
  maxRetries?: number; // 最大重试次数
  errorHandling?: 'stop' | 'continue' | 'rollback'; // 错误处理策略
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    includeInputs: boolean;
    includeOutputs: boolean;
  };
}

/**
 * 流程执行结果
 */
export interface FlowExecutionResult {
  success: boolean; // 是否成功
  executionId: string; // 执行ID
  outputs?: Record<string, any>; // 输出数据
  error?: NodeError; // 错误信息
  duration: number; // 执行时长（毫秒）
  nodeResults: Record<string, NodeExecutionResult>; // 各节点执行结果
  metadata?: Record<string, any>; // 执行元数据
}

/**
 * 节点执行器接口
 */
export interface NodeExecutor {
  /**
   * 执行节点
   * @param context - 执行上下文
   * @returns 执行结果
   */
  execute(context: NodeExecutionContext): Promise<NodeExecutionResult>;

  /**
   * 验证节点配置
   * @param config - 节点配置
   * @returns 是否有效
   */
  validate(config: NodeConfig): boolean;
}

/**
 * 变量解析器接口
 */
export interface VariableResolver {
  /**
   * 解析变量
   * @param template - 变量模板（如 {{user.name}}）
   * @param context - 上下文数据
   * @returns 解析后的值
   */
  resolve(template: string, context: Record<string, any>): any;

  /**
   * 批量解析
   * @param data - 包含变量的数据对象
   * @param context - 上下文数据
   * @returns 解析后的数据对象
   */
  resolveAll(
    data: Record<string, any>,
    context: Record<string, any>
  ): Record<string, any>;
}
