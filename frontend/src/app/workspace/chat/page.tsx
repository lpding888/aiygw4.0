/**
 * 聊天页面
 * 艹，SSE实时聊天，必须支持断线重连、IndexedDB存储、错误处理！
 *
 * @author 老王
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Input,
  Button,
  Select,
  Space,
  Typography,
  message,
  Spin,
  Alert,
  Tooltip,
  Divider
} from 'antd';
import {
  SendOutlined,
  StopOutlined,
  RobotOutlined,
  UserOutlined,
  CopyOutlined,
  ReloadOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { startSSE } from '@/lib/api/sse';
import { saveChat, getChat, getAllChats } from '@/lib/storage/chatDB';
import type { ApiError } from '@/lib/api/client';

const { TextArea } = Input;
const { Text } = Typography;

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sessionId: string;
  requestId?: string;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-3.5-turbo');
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>('');

  // 初始化
  useEffect(() => {
    // 生成新的会话ID
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionIdRef.current = newSessionId;
    setCurrentSessionId(newSessionId);

    // 加载模型列表
    loadModels();

    // 加载历史会话
    loadSessions();

    // 从IndexedDB恢复当前会话
    restoreSession();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 加载模型列表
  const loadModels = async () => {
    try {
      // 这里应该调用真实的API，现在用Mock
      const mockModels: AIModel[] = [
        { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', maxTokens: 8192 },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', maxTokens: 4096 },
        { id: 'claude-3-sonnet', name: 'Claude-3 Sonnet', provider: 'Anthropic', maxTokens: 4096 },
        { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google', maxTokens: 8192 }
      ];
      setModels(mockModels);
    } catch (err) {
      message.error('加载模型列表失败');
    }
  };

  // 加载历史会话
  const loadSessions = async () => {
    try {
      const allSessions = await getAllChats();
      setSessions(allSessions);
    } catch (err) {
      console.error('加载会话列表失败:', err);
    }
  };

  // 恢复会话
  const restoreSession = async () => {
    try {
      const session = await getChat(sessionIdRef.current);
      if (session && session.messages) {
        setMessages(session.messages);
      }
    } catch (err) {
      // 新会话，忽略错误
    }
  };

  // 保存会话到IndexedDB
  const saveCurrentSession = useCallback(async () => {
    try {
      if (messages.length > 0) {
        await saveChat({
          id: sessionIdRef.current,
          title: messages[0]?.content?.slice(0, 30) + '...' || '新对话',
          messages
        });
      }
    } catch (err) {
      console.error('保存会话失败:', err);
    }
  }, [messages]);

  // 监听消息变化，自动保存
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        saveCurrentSession();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [messages, saveCurrentSession]);

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      type: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      sessionId: sessionIdRef.current
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsGenerating(true);

    // 创建新的AbortController
    const controller = new AbortController();
    setAbortController(controller);

    try {
      console.log('🚀 开始发送消息:', { input: input.trim(), selectedModel, sessionId: sessionIdRef.current });

      // 添加助手消息占位
      const assistantMessageId = `msg_${Date.now()}_assistant`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        type: 'assistant',
        content: '',
        timestamp: Date.now(),
        sessionId: sessionIdRef.current
      };

      setMessages(prev => [...prev, assistantMessage]);

      console.log('📡 准备调用SSE...');
      // 调用SSE接口
      await startSSE({
        url: '/api/ai/chat',
        body: {
          message: input.trim(),
          model: selectedModel,
          sessionId: sessionIdRef.current
        },
        onDelta: (chunk: any) => {
          if (chunk.text) {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + chunk.text }
                : msg
            ));
          }
          if (chunk.requestId) {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, requestId: chunk.requestId }
                : msg
            ));
          }
        },
        onDone: () => {
          setIsGenerating(false);
          setAbortController(null);
        },
        onError: (err: ApiError) => {
          setError(err);
          setIsGenerating(false);
          setAbortController(null);

          // 移除空的助手消息
          setMessages(prev => prev.filter(msg =>
            !(msg.id === assistantMessageId && !msg.content)
          ));

          message.error(`聊天失败: ${err.message}`);
        },
        signal: controller.signal
      });

    } catch (err) {
      console.error('💥 发送消息失败:', err);
      setError({
        code: 'UNKNOWN_ERROR',
        message: '发送消息失败，请重试'
      });
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  // 停止生成
  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsGenerating(false);

      // 调用停止接口
      fetch('/api/ai/chat/stop', { method: 'POST' })
        .catch(err => console.error('停止生成失败:', err));
    }
  };

  // 复制错误信息
  const copyErrorInfo = (error: ApiError) => {
    const errorText = `错误代码: ${error.code}\n错误信息: ${error.message}\n请求ID: ${error.requestId || 'N/A'}\n时间: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(errorText).then(() => {
      message.success('错误信息已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // 新建会话
  const newSession = () => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionIdRef.current = newSessionId;
    setCurrentSessionId(newSessionId);
    setMessages([]);
    setError(null);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      {/* 顶部工具栏 */}
      <div style={{
        padding: '12px 16px',
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Space>
          <RobotOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <h3 style={{ margin: 0 }}>AI助手</h3>
        </Space>

        <Space>
          <Select
            value={selectedModel}
            onChange={setSelectedModel}
            style={{ width: 180 }}
            placeholder="选择模型"
            disabled={isGenerating}
          >
            {models.map(model => (
              <Select.Option key={model.id} value={model.id}>
                <div>
                  <div>{model.name}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {model.provider} · {model.maxTokens} tokens
                  </div>
                </div>
              </Select.Option>
            ))}
          </Select>

          <Tooltip title="新建对话">
            <Button icon={<ReloadOutlined />} onClick={newSession} disabled={isGenerating}>
              新对话
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* 消息区域 */}
      <div style={{
        flex: 1,
        padding: '16px',
        overflow: 'auto',
        maxWidth: 800,
        margin: '0 auto',
        width: '100%'
      }}>
        {messages.length === 0 ? (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#999'
          }}>
            <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <div>开始新的对话</div>
            <div style={{ fontSize: 12, marginTop: 8 }}>
              选择模型并输入您的问题
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={message.id} style={{
              marginBottom: 16,
              display: 'flex',
              justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                maxWidth: '70%',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                flexDirection: message.type === 'user' ? 'row-reverse' : 'row'
              }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: message.type === 'user' ? '#1890ff' : '#52c41a',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: '#fff',
                  flexShrink: 0
                }}>
                  {message.type === 'user' ? <UserOutlined /> : <RobotOutlined />}
                </div>

                <Card
                  size="small"
                  style={{
                    background: message.type === 'user' ? '#e6f7ff' : '#f6ffed',
                    border: `1px solid ${message.type === 'user' ? '#91d5ff' : '#b7eb8f'}`,
                    position: 'relative'
                  }}
                  styles={{ body: { padding: '12px' } }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {message.content || (
                      <Spin size="small" />
                    )}
                  </div>

                  {message.requestId && (
                    <div style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      fontSize: 10,
                      color: '#999'
                    }}>
                      <Tooltip title={`请求ID: ${message.requestId}`}>
                        <Button
                          type="text"
                          size="small"
                          icon={<CopyOutlined />}
                          style={{ height: 16, width: 16, fontSize: 10 }}
                          onClick={() => navigator.clipboard.writeText(message.requestId!)}
                        />
                      </Tooltip>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          ))
        )}

        {error && (
          <Alert
            type="error"
            message={`错误: ${error.message}`}
            description={
              <div>
                <div>错误代码: {error.code}</div>
                {error.requestId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span>请求ID: {error.requestId}</span>
                    <Button
                      type="link"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyErrorInfo(error)}
                    >
                      复制错误信息
                    </Button>
                  </div>
                )}
              </div>
            }
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setError(null)}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div style={{
        padding: '16px',
        background: '#fff',
        borderTop: '1px solid #f0f0f0'
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入您的问题..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={isGenerating}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            {isGenerating ? (
              <Button
                type="default"
                danger
                icon={<StopOutlined />}
                onClick={stopGeneration}
              >
                停止
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={sendMessage}
                disabled={!input.trim()}
              >
                发送
              </Button>
            )}
          </Space.Compact>

          <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
            按 Enter 发送，Shift+Enter 换行
          </div>
        </div>
      </div>
    </div>
  );
}