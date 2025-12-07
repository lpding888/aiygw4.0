'use client';

import React, { useEffect } from 'react';
import { Space } from 'antd';
import { FlowCanvas } from '@/components/pipeline-builder/FlowCanvas';
import { PropertiesPanel } from '@/components/pipeline-builder/PropertiesPanel';
import CopilotChat from '@/components/pipeline-builder/CopilotChat';
import { usePipelineStore } from '@/stores/usePipelineStore';
import './pipeline-builder.css';

export default function PipelineBuilderPage() {
    const { initNewPipeline, addNode, validate, validationErrors, validationWarnings, isDirty } = usePipelineStore();

    useEffect(() => {
        initNewPipeline("New V1 Pipeline");
    }, []);

    const handleAddNode = (type: 'llm' | 'image_gen' | 'code') => {
        // Random position for now
        addNode(type, { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 });
    };

    const handleValidate = () => {
        const isValid = validate();
        if (isValid) {
            alert("Pipeline is VALID strict V1!");
        }
    };

    return (
        <div className="builderContainer">
            {/* Header */}
            <div className="headerPanel" style={{ height: 60, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="neonText" style={{ fontSize: 20, fontWeight: 'bold' }}>AI-Native Factory</div>
                    <div style={{ fontSize: 12, opacity: 0.5, border: '1px solid #0ff', padding: '2px 6px', borderRadius: 4 }}>BETA V1.0</div>
                </div>

                <Space>
                    <button
                        className={`neonButton ${validationErrors.length > 0 ? 'neonButtonDanger' : ''}`}
                        onClick={handleValidate}
                        style={{ padding: '8px 16px', cursor: 'pointer', borderRadius: 6 }}
                    >
                        {validationErrors.length > 0 ? 'Protocol Violation' : 'Validate Protocol'}
                    </button>
                    <button
                        className="neonButton"
                        disabled={!isDirty}
                        style={{ padding: '8px 16px', cursor: 'pointer', borderRadius: 6, opacity: isDirty ? 1 : 0.5 }}
                    >
                        Save Pipeline
                    </button>
                </Space>
            </div>

            <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
                {/* Sidebar Palette */}
                <div className="sidebarPanel" style={{ width: 220, padding: 20, display: 'flex', flexDirection: 'column', gap: 15 }}>
                    <div className="neonText" style={{ fontSize: 14, marginBottom: 10 }}>COMPONENT LIBRARY</div>

                    <button className="neonButton" onClick={() => handleAddNode('llm')} style={{ padding: 12, textAlign: 'left', borderRadius: 8 }}>
                        <span className="type-llm">✦</span> LLM Processor
                    </button>
                    <button className="neonButton" onClick={() => handleAddNode('image_gen')} style={{ padding: 12, textAlign: 'left', borderRadius: 8 }}>
                        <span className="type-image_gen">🖼</span> Image Generator
                    </button>
                    <button className="neonButton" onClick={() => handleAddNode('code')} style={{ padding: 12, textAlign: 'left', borderRadius: 8 }}>
                        <span className="type-code">⌨</span> Custom Code
                    </button>

                    {validationErrors.length > 0 && (
                        <div style={{ marginTop: 'auto', border: '1px solid #ff0066', padding: 10, borderRadius: 8, background: 'rgba(255,0,100,0.1)' }}>
                            <div style={{ color: '#ff0066', fontSize: 12, marginBottom: 5 }}>CRITICAL ERRORS</div>
                            <ul style={{ paddingLeft: 15, color: '#ffb3d9', fontSize: 11, margin: 0 }}>
                                {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    )}

                    {validationWarnings.length > 0 && (
                        <div style={{ marginTop: 10, border: '1px solid #ffaa00', padding: 10, borderRadius: 8, background: 'rgba(255,170,0,0.1)' }}>
                            <div style={{ color: '#ffaa00', fontSize: 12, marginBottom: 5 }}>RECOMMENDATIONS</div>
                            <ul style={{ paddingLeft: 15, color: '#ffdd99', fontSize: 11, margin: 0 }}>
                                {validationWarnings.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Main Canvas */}
                <div style={{ flex: 1, position: 'relative' }}>
                    <FlowCanvas />
                </div>

                {/* Properties Panel */}
                <PropertiesPanel />
            </div>
            <CopilotChat />
        </div>
    );
}
