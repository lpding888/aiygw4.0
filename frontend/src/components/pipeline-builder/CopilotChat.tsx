import React, { useState, useRef, useEffect } from 'react';
import { FloatButton, Drawer, Input, Button, List, Card, Typography, Spin, Tag, message } from 'antd';
import { RobotOutlined, SendOutlined, CheckCircleOutlined, EditOutlined, BulbOutlined } from '@ant-design/icons';
import { usePipelineStore } from '@/stores/usePipelineStore';
import { architectService, ArchitectResult } from '@/lib/services/architect';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    pipelineResult?: ArchitectResult; // If this message contains a generated pipeline
}

export default function CopilotChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: '我是你的 AI 架构师。告诉我你想要什么样的图片处理工作流？例如："生成一张猫的图片并配上一首诗"。'
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { currentPipeline, loadPipeline } = usePipelineStore();

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setLoading(true);

        try {
            let result: ArchitectResult;

            // Determine intent: Create vs Modify
            // Heuristic: If pipeline has nodes > 0, assume modify, unless user says "new" or "reset" (simple logic for now)
            // Ideally backend handles this, but we have separate endpoints.
            // Let's use currentPipeline state. If it's empty, Generate. If not, Modify.
            const hasContent = currentPipeline && currentPipeline.nodes.length > 0;

            if (hasContent) {
                // Modify
                result = await architectService.modify(currentPipeline!, userMsg.content);
            } else {
                // Generate (0 -> 1)
                result = await architectService.generate(userMsg.content);
            }

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: result.thinking || '已为您生成工作流方案。',
                pipelineResult: result
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (error: any) {
            console.error('Architect Error:', error);
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'system',
                content: `Error: ${error.message || 'Unknown error occurred'}`
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async (result: ArchitectResult) => {
        if (!result.pipeline) return;
        try {
            await loadPipeline(result.pipeline);
            message.success('工作流已应用到画布');
            setIsOpen(false); // Optional: close chat or keep open
        } catch (e) {
            message.error('应用失败');
        }
    };

    return (
        <>
            <FloatButton
                icon={<RobotOutlined />}
                type="primary"
                style={{ right: 24, bottom: 84 }}
                onClick={() => setIsOpen(true)}
                tooltip="AI Architect"
            />

            <Drawer
                title={
                    <div className="flex items-center gap-2">
                        <RobotOutlined className="text-blue-500" />
                        <span>AI Architect Copilot</span>
                    </div>
                }
                placement="right"
                onClose={() => setIsOpen(false)}
                open={isOpen}
                width={400}
                mask={false} // Allow interacting with canvas while chat is open
                styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
            >
                {/* Chat History */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

                            {/* Message Bubble */}
                            <div
                                className={`max-w-[85%] rounded-lg p-3 ${msg.role === 'user'
                                        ? 'bg-blue-500 text-white'
                                        : msg.role === 'system'
                                            ? 'bg-red-50 text-red-600 border border-red-100'
                                            : 'bg-white border border-gray-200 shadow-sm text-gray-800'
                                    }`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="mb-1 text-xs text-gray-400 flex items-center gap-1">
                                        <RobotOutlined /> Architect
                                    </div>
                                )}
                                <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                            </div>

                            {/* Pipeline Preview Card */}
                            {msg.pipelineResult && (
                                <Card
                                    size="small"
                                    className="mt-2 w-full max-w-[95%] border-blue-100 shadow-sm"
                                    title={
                                        <div className="flex items-center gap-2 text-blue-600 text-sm">
                                            <BulbOutlined />
                                            {msg.pipelineResult.pipeline.meta.name}
                                        </div>
                                    }
                                    actions={[
                                        <Button
                                            key="apply"
                                            type="primary"
                                            size="small"
                                            icon={<CheckCircleOutlined />}
                                            onClick={() => handleApply(msg.pipelineResult!)}
                                        >
                                            Apply to Canvas
                                        </Button>
                                    ]}
                                >
                                    <div className="space-y-2 text-xs text-gray-600">
                                        <div>Nodes: {msg.pipelineResult.pipeline.nodes.length}</div>
                                        <div>Edges: {msg.pipelineResult.pipeline.edges.length}</div>
                                        {msg.pipelineResult.quality_score && (
                                            <div className="flex items-center gap-1">
                                                Quality: <Tag color="green">{msg.pipelineResult.quality_score}</Tag>
                                            </div>
                                        )}
                                        <Paragraph ellipsis={{ rows: 2 }} className="text-gray-500 m-0">
                                            {msg.pipelineResult.pipeline.meta.description}
                                        </Paragraph>
                                    </div>
                                </Card>
                            )}
                        </div>
                    ))}
                    {loading && (
                        <div className="flex items-center gap-2 text-gray-400 text-sm p-2">
                            <Spin size="small" /> Is Thinking...
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-gray-100">
                    <div className="flex gap-2">
                        <TextArea
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onPressEnter={e => {
                                if (!e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Describe your pipeline..."
                            autoSize={{ minRows: 1, maxRows: 4 }}
                            disabled={loading}
                            className="resize-none"
                        />
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={handleSend}
                            loading={loading}
                            className="h-auto"
                        />
                    </div>
                    <div className="text-xs text-gray-400 mt-2 text-center">
                        Shift + Enter for new line
                    </div>
                </div>
            </Drawer>
        </>
    );
}
