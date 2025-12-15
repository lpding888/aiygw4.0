
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Spin, message, Result, Button, Alert } from 'antd';
import { ArrowLeftOutlined, ThunderboltFilled } from '@ant-design/icons';
import api from '@/lib/api';
import DynamicForm from '@/components/DynamicForm';
import { FormSchema, FormField } from '@/types';
import { realtime, ExecutionEvent } from '@/lib/socket';

// Helper to convert JSON Schema to internal FormSchema
const convertJsonSchemaToFormSchema = (pipeline: any): FormSchema | null => {
    const schema = pipeline.input_schema || pipeline.schema_definition?.input_schema;
    if (!schema || !schema.properties) return null;

    const fields: FormField[] = Object.entries(schema.properties).map(([key, value]: [string, any]) => ({
        name: key,
        label: value.title || key,
        type: mapJsonTypeToFormType(value.type, value.format),
        required: (schema.required || []).includes(key),
        helpText: value.description,
        defaultValue: value.default,
        options: value.enum ? value.enum.map((v: string) => ({ label: v, value: v })) : undefined
    }));

    return {
        feature_id: pipeline.id, // Pseudo ID
        display_name: pipeline.name,
        description: pipeline.description || 'Fill in the parameters to run this app.',
        quota_cost: 1, // Default cost, maybe fetch from connection?
        fields
    };
};

const mapJsonTypeToFormType = (type: string, format?: string): FormField['type'] => {
    if (type === 'string') {
        if (format === 'date' || format === 'date-time') return 'date';
        if (format === 'uri') return 'text'; // Or imageUpload if we detected it specifically
        return 'text';
    }
    if (type === 'number' || type === 'integer') return 'number';
    // Simple heuristics, can be improved
    return 'text';
};

export default function AppRunnerPage() {
    const params = useParams();
    const router = useRouter();
    const pipelineId = params.pipelineId as string;

    const [loading, setLoading] = useState(true);
    const [pipeline, setPipeline] = useState<any>(null);
    const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
    const [execution, setExecution] = useState<any>(null);
    const [running, setRunning] = useState(false);
    const [logs, setLogs] = useState<ExecutionEvent[]>([]);

    // Connect to socket once
    useEffect(() => {
        realtime.connect();
        return () => {
            realtime.disconnect();
        };
    }, []);

    // Join room when execution starts
    useEffect(() => {
        if (execution?.id && running) {
            console.log('Joining execution room:', execution.id);
            realtime.joinExecution(execution.id);
            setLogs([]); // Clear logs for new run

            const handleEvent = (event: ExecutionEvent) => {
                console.log('Received event:', event);
                setLogs(prev => [...prev, event]);

                if (event.type === 'execution:completed') {
                    setRunning(false);
                    message.success('Execution completed!');
                    setExecution((prev: any) => ({
                        ...prev,
                        status: 'completed',
                        output_data: event.output_data
                    }));
                } else if (event.type === 'execution:failed') {
                    setRunning(false);
                    message.error('Execution failed!');
                    setExecution((prev: any) => ({
                        ...prev,
                        status: 'failed',
                        error_message: event.error_message
                    }));
                } else if (event.type === 'execution:cancelled') {
                    setRunning(false);
                    setExecution((prev: any) => ({ ...prev, status: 'cancelled' }));
                }
            };

            realtime.onExecutionEvent(handleEvent);

            return () => {
                realtime.leaveExecution(execution.id);
                realtime.offExecutionEvent(handleEvent);
            };
        }
    }, [execution?.id, running]);

    // Poll for execution status (Backup)
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (running && execution?.id) {
            interval = setInterval(async () => {
                try {
                    const res = await api.pipeline.getExecution(execution.id) as any;
                    if (res.success && res.data) {
                        const status = res.data.status;
                        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                            setExecution(res.data);
                            setRunning(false);
                            if (status === 'completed') {
                                message.success('Execution completed!');
                            } else {
                                message.error('Execution failed: ' + (res.data.error_message || 'Unknown error'));
                            }
                        }
                    }
                } catch (e) {
                    console.error('Polling error', e);
                }
            }, 5000); // Slower polling since we have websockets
        }
        return () => clearInterval(interval);
    }, [running, execution]);

    // Fetch Pipeline
    useEffect(() => {
        if (!pipelineId) return;
        const fetchPipeline = async () => {
            try {
                setLoading(true);
                const res = await api.pipeline.getSchemaById(pipelineId);
                // Assume res is compatible or cast it? 
                // Using loose check. access property 'data' might trigger strictness if generic is inferred
                // But generally schema fetching works.
                if ((res as any).success && (res as any).data) {
                    setPipeline((res as any).data);
                    const fs = convertJsonSchemaToFormSchema((res as any).data);
                    setFormSchema(fs);
                } else {
                    message.error('Failed to load app definition');
                }
            } catch (error) {
                console.error(error);
                message.error('Error loading app');
            } finally {
                setLoading(false);
            }
        };
        fetchPipeline();
    }, [pipelineId]);

    const handleRun = async (formData: any) => {
        try {
            setRunning(true);
            setLogs([]);
            // Clean up formData if needed
            const res = await api.pipeline.createAndStartExecution({
                schema_id: pipelineId,
                input_data: formData,
                metadata: { source: 'app_runner' }
            }) as any;

            if (res.success && res.data) {
                setExecution(res.data);
                message.loading('App is running...', 1);
            } else {
                throw new Error(res.message || 'Failed to start');
            }
        } catch (error: any) {
            console.error(error);
            message.error(error.message || 'Failed to run app');
            setRunning(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900">
                <Spin size="large" tip="Loading App..." />
            </div>
        );
    }

    if (!pipeline) {
        return (
            <Result
                status="404"
                title="App Not Found"
                subTitle="The app you are looking for does not exist or has been deleted."
                extra={<Button type="primary" onClick={() => router.push('/')}>Back Home</Button>}
            />
        );
    }

    return (
        <div className="min-h-screen bg-[#0E1117] p-6 text-white">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="mb-8 flex items-center">
                    <Button
                        type="text"
                        icon={<ArrowLeftOutlined className="text-white" />}
                        onClick={() => router.back()}
                        className="mr-4"
                    />
                    <div>
                        <h1 className="text-2xl font-bold">{pipeline.name}</h1>
                        <p className="text-gray-400">{pipeline.description}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    {/* Left: Input Form */}
                    <div>
                        <Card
                            title={<span><ThunderboltFilled className="mr-2 text-cyan-400" /> Configure & Run</span>}
                            bordered={false}
                            className="bg-[#161b22] border-gray-800"
                            headStyle={{ borderBottom: '1px solid #30363d', color: 'white' }}
                            bodyStyle={{ padding: '24px' }}
                        >
                            {formSchema ? (
                                <DynamicForm
                                    schema={formSchema}
                                    onSubmit={handleRun}
                                    loading={running}
                                />
                            ) : (
                                <div className="text-center py-10 text-gray-500">
                                    No input parameters required.
                                    <Button type="primary" className="mt-4 block mx-auto" onClick={() => handleRun({})} loading={running}>
                                        Run App
                                    </Button>
                                </div>
                            )}
                        </Card>

                        {/* Real-time Logs */}
                        <div className="mt-6">
                            <h3 className="mb-2 text-lg font-semibold text-gray-300">Execution Logs</h3>
                            <div className="h-64 overflow-y-auto rounded-lg bg-[#0d1117] p-4 text-xs font-mono text-gray-400 border border-gray-800">
                                {logs.length === 0 ? (
                                    <span className="text-gray-600">Waiting for logs...</span>
                                ) : (
                                    logs.map((log, index) => (
                                        <div key={index} className="mb-1">
                                            <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                                            <span className={
                                                log.type.includes('failed') ? 'text-red-400' :
                                                    log.type.includes('completed') ? 'text-green-400' :
                                                        log.type.includes('started') ? 'text-blue-400' : 'text-gray-300'
                                            }>
                                                {log.type}
                                            </span>
                                            {!!log.node_id && <span className="text-yellow-600 ml-2">[{log.node_id as string}]</span>}
                                            {!!log.error_message && <span className="text-red-400 ml-2">{log.error_message as string}</span>}
                                        </div>
                                    ))
                                )}
                                {running && <div className="animate-pulse mt-2">_</div>}
                            </div>
                        </div>
                    </div>

                    {/* Right: Output / Status */}
                    <div>
                        {execution ? (
                            <Card
                                title="Result"
                                bordered={false}
                                className="bg-[#161b22] border-gray-800"
                                headStyle={{ borderBottom: '1px solid #30363d', color: 'white' }}
                            >
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-gray-400">Status:</span>
                                        <span className={`font-bold flex items-center ${execution.status === 'completed' ? 'text-green-400' :
                                            execution.status === 'failed' ? 'text-red-400' :
                                                'text-blue-400'
                                            }`}>
                                            {execution.status === 'running' && <Spin size="small" className="mr-2" />}
                                            {execution.status.toUpperCase()}
                                        </span>
                                    </div>
                                </div>

                                {execution.output_data && (
                                    <div className="bg-[#0d1117] p-4 rounded overflow-auto max-h-[500px]">
                                        <pre className="text-sm text-gray-300 font-mono">
                                            {JSON.stringify(execution.output_data, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {execution.error_message && (
                                    <Alert type="error" message={execution.error_message} className="mt-4" />
                                )}

                            </Card>
                        ) : (
                            <div className="h-full flex items-center justify-center p-12 border-2 border-dashed border-gray-800 rounded-lg text-gray-600">
                                Run the app to see results here
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
