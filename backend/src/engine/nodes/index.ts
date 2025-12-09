/**
 * 节点注册表
 * 统一管理所有节点执行器的注册和获取
 */

import { NodeType, NodeExecutor } from '../types.js';
import logger from '../../utils/logger.js';

// 导入所有节点执行器
import kbRetrieveExecutor from './kb-retrieve.js';
import mcpToolCallExecutor from './mcp-tool-call.js';
import conditionNodeExecutor from './condition.js';
import httpApiNodeExecutor from './http-api.js';
import loopNodeExecutor from './loop.js';
import agentNodeExecutor from './agent-node.js';

/**
 * 节点注册表
 */
class NodeRegistry {
    private executors: Map<string, NodeExecutor> = new Map();

    constructor() {
        this.registerBuiltinNodes();
    }

    /**
     * 注册内置节点
     * @private
     */
    private registerBuiltinNodes(): void {
        // RAG知识库节点
        this.register(NodeType.KB_RETRIEVE, kbRetrieveExecutor);

        // MCP工具调用节点
        this.register(NodeType.MCP_TOOL_CALL, mcpToolCallExecutor);

        // 控制流节点
        this.register(NodeType.CONDITION, conditionNodeExecutor);
        this.register(NodeType.LOOP, loopNodeExecutor);

        // HTTP API节点
        this.register(NodeType.HTTP_API, httpApiNodeExecutor);

        // 智能 Agent 节点
        this.register(NodeType.AGENT, agentNodeExecutor);

        logger.info(`[NodeRegistry] 已注册 ${this.executors.size} 个节点执行器`);
    }

    /**
     * 注册节点执行器
     */
    register(nodeType: NodeType | string, executor: NodeExecutor): void {
        if (this.executors.has(nodeType)) {
            logger.warn(`[NodeRegistry] 覆盖已存在的节点类型: ${nodeType}`);
        }
        this.executors.set(nodeType, executor);
        logger.debug(`[NodeRegistry] 注册节点: ${nodeType}`);
    }

    /**
     * 获取节点执行器
     */
    get(nodeType: NodeType | string): NodeExecutor | undefined {
        return this.executors.get(nodeType);
    }

    /**
     * 检查节点类型是否已注册
     */
    has(nodeType: NodeType | string): boolean {
        return this.executors.has(nodeType);
    }

    /**
     * 获取所有已注册的节点类型
     */
    getRegisteredTypes(): string[] {
        return Array.from(this.executors.keys());
    }

    /**
     * 注销节点执行器
     */
    unregister(nodeType: NodeType | string): boolean {
        return this.executors.delete(nodeType);
    }
}

// 导出单例
export const nodeRegistry = new NodeRegistry();

export default nodeRegistry;
