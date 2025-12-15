import axios from 'axios';
import { Readable } from 'node:stream';

import mcpEndpointsService from '../../src/services/mcp-endpoints.service.js';
import configCacheService from '../../src/cache/config-cache.js';
import kmsService from '../../src/services/kms.service.js';
import { db } from '../../src/config/database.js';

jest.mock('axios');
jest.mock('../../src/cache/config-cache.js', () => ({
  __esModule: true,
  default: {
    getOrSet: jest.fn(),
    invalidate: jest.fn()
  }
}));
jest.mock('../../src/services/kms.service.js', () => ({
  __esModule: true,
  default: {
    encrypt: jest.fn(),
    decrypt: jest.fn()
  }
}));
jest.mock('../../src/utils/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedCache = configCacheService as unknown as {
  getOrSet: jest.MockedFunction<any>;
  invalidate: jest.MockedFunction<any>;
};
const mockedKms = kmsService as unknown as {
  encrypt: jest.MockedFunction<any>;
  decrypt: jest.MockedFunction<any>;
};
const mockedDb = db as unknown as any;

const jsonStream = (payload: unknown) => Readable.from([JSON.stringify(payload)]);
const textStream = (text: string) => Readable.from([text]);

describe('MCPEndpointsService (Streamable HTTP JSON-RPC)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCache.getOrSet.mockImplementation(
      async (_opts: unknown, fetcher: () => Promise<unknown>) => fetcher()
    );
    mockedCache.invalidate.mockResolvedValue(undefined);
    mockedKms.encrypt.mockResolvedValue({ id: 'mock-encrypted-id' });
    mockedKms.decrypt.mockResolvedValue('mock-token');
    (mcpEndpointsService as any).sessionCache?.clear?.();
  });

  it('testEndpoint 应该完成 initialize + tools/list（application/json）', async () => {
    const endpointId = 'ep_test_json';
    mockedDb.first.mockResolvedValueOnce({
      id: endpointId,
      name: 'Test MCP',
      description: '',
      endpoint_url: 'https://example.com/mcp',
      api_key: null,
      protocol_version: '2025-06-18',
      capabilities: '{}',
      supported_tools: '[]',
      status: 'inactive',
      healthy: false,
      timeout_ms: 30000,
      max_retries: 0,
      enabled: true,
      metadata: '{}',
      created_by: 'u1',
      updated_by: 'u1',
      created_at: new Date(),
      updated_at: new Date()
    });
    mockedDb.update.mockResolvedValueOnce(1);

    mockedAxios.post.mockImplementation(async (_url, body: any) => {
      if (body.method === 'initialize') {
        return {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'mcp-session-id': 'sess-json'
          },
          data: jsonStream({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              protocolVersion: '2025-06-18',
              capabilities: { tools: { listChanged: true } }
            }
          })
        } as any;
      }

      if (body.method === 'notifications/initialized') {
        return {
          status: 204,
          headers: { 'content-type': 'application/json' },
          data: textStream('')
        } as any;
      }

      if (body.method === 'tools/list') {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          data: jsonStream({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              tools: [
                {
                  name: 'echo',
                  description: 'Echo tool',
                  inputSchema: { type: 'object', properties: {} }
                }
              ]
            }
          })
        } as any;
      }

      throw new Error(`unexpected method: ${body.method}`);
    });

    const result = await mcpEndpointsService.testEndpoint(endpointId);

    expect(result.success).toBe(true);
    expect(result.toolsCount).toBe(1);
    expect(result.sampleTools).toContain('echo');
  });

  it('executeTool 应该支持 SSE（text/event-stream）并优先返回 structuredContent', async () => {
    const endpointId = 'ep_test_sse';
    mockedDb.first.mockResolvedValueOnce({
      id: endpointId,
      name: 'Test MCP SSE',
      description: '',
      endpoint_url: 'https://example.com/mcp',
      api_key: null,
      protocol_version: '2025-06-18',
      capabilities: '{}',
      supported_tools: JSON.stringify([
        {
          name: 'echo',
          description: 'Echo tool',
          inputSchema: { type: 'object', properties: {} },
          category: 'general',
          enabled: true,
          parameters: []
        }
      ]),
      status: 'active',
      healthy: true,
      timeout_ms: 30000,
      max_retries: 0,
      enabled: true,
      metadata: '{}',
      created_by: 'u1',
      updated_by: 'u1',
      created_at: new Date(),
      updated_at: new Date()
    });

    mockedAxios.post.mockImplementation(async (_url, body: any) => {
      if (body.method === 'initialize') {
        return {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'mcp-session-id': 'sess-sse'
          },
          data: jsonStream({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              protocolVersion: '2025-06-18',
              capabilities: { tools: { listChanged: true } }
            }
          })
        } as any;
      }

      if (body.method === 'notifications/initialized') {
        return {
          status: 204,
          headers: { 'content-type': 'application/json' },
          data: textStream('')
        } as any;
      }

      if (body.method === 'tools/call') {
        const response = {
          jsonrpc: '2.0',
          id: body.id,
          result: {
            structuredContent: { ok: true, value: 123 }
          }
        };
        const sse = `data: ${JSON.stringify(response)}\n\n`;
        return {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
          data: textStream(sse)
        } as any;
      }

      throw new Error(`unexpected method: ${body.method}`);
    });

    const result = await mcpEndpointsService.executeTool(endpointId, 'echo', {}, 'u1');
    expect(result).toEqual({ ok: true, value: 123 });
  });

  it('executeTool 遇到 isError=true 应抛出工具错误文本', async () => {
    const endpointId = 'ep_test_error';
    mockedDb.first.mockResolvedValueOnce({
      id: endpointId,
      name: 'Test MCP Error',
      description: '',
      endpoint_url: 'https://example.com/mcp',
      api_key: null,
      protocol_version: '2025-06-18',
      capabilities: '{}',
      supported_tools: JSON.stringify([
        {
          name: 'boom',
          description: 'Boom tool',
          inputSchema: { type: 'object', properties: {} },
          category: 'general',
          enabled: true,
          parameters: []
        }
      ]),
      status: 'active',
      healthy: true,
      timeout_ms: 30000,
      max_retries: 0,
      enabled: true,
      metadata: '{}',
      created_by: 'u1',
      updated_by: 'u1',
      created_at: new Date(),
      updated_at: new Date()
    });

    mockedAxios.post.mockImplementation(async (_url, body: any) => {
      if (body.method === 'initialize') {
        return {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'mcp-session-id': 'sess-error'
          },
          data: jsonStream({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              protocolVersion: '2025-06-18',
              capabilities: { tools: { listChanged: true } }
            }
          })
        } as any;
      }

      if (body.method === 'notifications/initialized') {
        return {
          status: 204,
          headers: { 'content-type': 'application/json' },
          data: textStream('')
        } as any;
      }

      if (body.method === 'tools/call') {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          data: jsonStream({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              isError: true,
              content: [{ type: 'text', text: 'boom' }]
            }
          })
        } as any;
      }

      throw new Error(`unexpected method: ${body.method}`);
    });

    await expect(mcpEndpointsService.executeTool(endpointId, 'boom', {}, 'u1')).rejects.toThrow(
      'boom'
    );
  });
});
