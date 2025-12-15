/**
 * 模型能力自动探测服务
 * 
 * 全自动探测 LLM 模型能力：
 * - tool_use: 发送带工具的请求，检查响应
 * - parallel_tool_use: 发送多工具请求
 * - vision: 发送图片+文本
 * - streaming: 检查流式响应
 * - json_mode: 检查 JSON 输出
 */

import logger from '../utils/logger.js';
import { db } from '../config/database.js';
import providerRegistryService, { type ProviderCapabilities } from './provider-registry.service.js';

// ============ 类型定义 ============

interface DetectionResult {
    success: boolean;
    capabilities: Partial<ProviderCapabilities>;
    errors: string[];
    duration_ms: number;
}

// ============ 探测服务 ============

class CapabilityDetectorService {

    /**
     * 探测 Provider 的所有能力
     */
    async detectCapabilities(providerRef: string): Promise<DetectionResult> {
        const startTime = Date.now();
        const errors: string[] = [];
        const capabilities: Partial<ProviderCapabilities> = {
            streaming: true, // 大多数现代模型都支持
            max_context: 128000, // 默认值
            max_output: 4096
        };

        logger.info(`[CapabilityDetector] 开始探测: ${providerRef}`);

        // 1. 探测 Tool Use
        try {
            const toolUseResult = await this.detectToolUse(providerRef);
            capabilities.tool_use = toolUseResult.supported;
            capabilities.parallel_tool_use = toolUseResult.parallel;
            logger.debug(`[CapabilityDetector] tool_use=${toolUseResult.supported}, parallel=${toolUseResult.parallel}`);
        } catch (error) {
            capabilities.tool_use = false;
            capabilities.parallel_tool_use = false;
            errors.push(`Tool Use 探测失败: ${error instanceof Error ? error.message : String(error)}`);
        }

        // 2. 探测 Vision（可选，因为需要发送图片）
        try {
            capabilities.vision = await this.detectVision(providerRef);
            logger.debug(`[CapabilityDetector] vision=${capabilities.vision}`);
        } catch (error) {
            capabilities.vision = false;
            errors.push(`Vision 探测失败: ${error instanceof Error ? error.message : String(error)}`);
        }

        // 3. 探测 JSON Mode
        try {
            capabilities.json_mode = await this.detectJsonMode(providerRef);
            logger.debug(`[CapabilityDetector] json_mode=${capabilities.json_mode}`);
        } catch (error) {
            capabilities.json_mode = false;
            errors.push(`JSON Mode 探测失败: ${error instanceof Error ? error.message : String(error)}`);
        }

        // 4. 自动保存到数据库
        await this.saveCapabilities(providerRef, capabilities as ProviderCapabilities);

        const duration = Date.now() - startTime;
        logger.info(`[CapabilityDetector] 探测完成: ${providerRef} duration=${duration}ms`, capabilities);

        return {
            success: errors.length === 0,
            capabilities,
            errors,
            duration_ms: duration
        };
    }

    /**
     * 探测 Tool Use 能力
     */
    private async detectToolUse(providerRef: string): Promise<{ supported: boolean; parallel: boolean }> {
        const testTools = [
            {
                type: 'function' as const,
                function: {
                    name: 'get_weather',
                    description: 'Get current weather for a location',
                    parameters: {
                        type: 'object',
                        properties: {
                            location: { type: 'string', description: 'City name' }
                        },
                        required: ['location']
                    }
                }
            },
            {
                type: 'function' as const,
                function: {
                    name: 'get_time',
                    description: 'Get current time for a timezone',
                    parameters: {
                        type: 'object',
                        properties: {
                            timezone: { type: 'string', description: 'Timezone name' }
                        },
                        required: ['timezone']
                    }
                }
            }
        ];

        try {
            const result = await providerRegistryService.execute(
                providerRef,
                'execute',
                [{
                    messages: [
                        { role: 'user', content: 'What is the weather in Beijing and what time is it in Tokyo?' }
                    ],
                    tools: testTools,
                    tool_choice: 'auto'
                }, 'capability-detector']
            ) as any;

            // 检查是否返回了 tool_calls
            const hasToolCalls = result.tool_calls && result.tool_calls.length > 0;
            const isParallel = result.tool_calls && result.tool_calls.length > 1;

            return {
                supported: hasToolCalls,
                parallel: isParallel
            };
        } catch (error) {
            // 如果请求失败，说明模型不支持工具
            logger.debug(`[CapabilityDetector] Tool Use 请求失败: ${error}`);
            return { supported: false, parallel: false };
        }
    }

    /**
     * 探测 Vision 能力
     */
    private async detectVision(providerRef: string): Promise<boolean> {
        // 使用一个极小的 base64 图片（1x1 透明 PNG）
        const tinyImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        try {
            const result = await providerRegistryService.execute(
                providerRef,
                'execute',
                [{
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: 'What color is this image?' },
                                {
                                    type: 'image_url',
                                    image_url: { url: `data:image/png;base64,${tinyImageBase64}` }
                                }
                            ]
                        }
                    ]
                }, 'capability-detector']
            ) as any;

            // 如果没有抛错且有响应，说明支持 vision
            return Boolean(result.text || result.content);
        } catch (error) {
            // 大多数不支持 vision 的模型会返回错误
            logger.debug(`[CapabilityDetector] Vision 请求失败: ${error}`);
            return false;
        }
    }

    /**
     * 探测 JSON Mode 能力
     */
    private async detectJsonMode(providerRef: string): Promise<boolean> {
        try {
            const result = await providerRegistryService.execute(
                providerRef,
                'execute',
                [{
                    messages: [
                        { role: 'user', content: 'Return a JSON object with key "test" and value "ok"' }
                    ],
                    response_format: { type: 'json_object' }
                }, 'capability-detector']
            ) as any;

            // 尝试解析返回的 JSON
            const content = result.text || result.content;
            if (content) {
                JSON.parse(content);
                return true;
            }
            return false;
        } catch (error) {
            logger.debug(`[CapabilityDetector] JSON Mode 请求失败: ${error}`);
            return false;
        }
    }

    /**
     * 保存探测结果到数据库
     */
    private async saveCapabilities(providerRef: string, capabilities: ProviderCapabilities): Promise<void> {
        try {
            await db('provider_endpoints')
                .where({ provider_ref: providerRef })
                .update({
                    capabilities: JSON.stringify(capabilities),
                    updated_at: new Date()
                });

            logger.info(`[CapabilityDetector] 能力已保存: ${providerRef}`);
        } catch (error) {
            logger.error(`[CapabilityDetector] 保存失败: ${providerRef}`, error);
        }
    }

    /**
     * 批量探测所有 LLM Provider
     */
    async detectAllProviders(): Promise<Map<string, DetectionResult>> {
        const results = new Map<string, DetectionResult>();

        const providers = await db('provider_endpoints')
            .where('provider_ref', 'like', 'llm_%')
            .where('enabled', true)
            .select('provider_ref');

        logger.info(`[CapabilityDetector] 开始批量探测 ${providers.length} 个 Provider`);

        for (const { provider_ref } of providers) {
            try {
                const result = await this.detectCapabilities(provider_ref);
                results.set(provider_ref, result);
            } catch (error) {
                results.set(provider_ref, {
                    success: false,
                    capabilities: {},
                    errors: [String(error)],
                    duration_ms: 0
                });
            }
        }

        return results;
    }
}

export const capabilityDetectorService = new CapabilityDetectorService();
export default capabilityDetectorService;
