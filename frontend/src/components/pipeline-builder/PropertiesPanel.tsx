import React, { useState } from 'react';
import { usePipelineStore } from '../../stores/usePipelineStore';

// Simple binding selector modal/popover could be added here, 
// but for V1 we'll just show a list of potential sources in a dropdown if "Link" is active.

export function PropertiesPanel() {
    const {
        currentPipeline,
        selectedNodeId,
        updateNodeData,
        updateNodeBindings
    } = usePipelineStore();

    const node = currentPipeline?.nodes.find(n => n.id === selectedNodeId);

    if (!node) {
        return (
            <div className="propertiesPanel" style={{ width: 300, padding: 20 }}>
                <div className="neonText" style={{ fontSize: 14, marginBottom: 20 }}>PROPERTIES</div>
                <div style={{ marginTop: 20, padding: 15, border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 8, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    NO NODE SELECTED
                </div>
            </div>
        );
    }

    // Get potential upstream nodes (simple filter: valid nodes excluding self)
    // In a real topo sort, we'd only show actual ancestors.
    const upstreamNodes = currentPipeline?.nodes.filter(n => n.id !== node.id) || [];

    const handleDataChange = (field: string, value: any) => {
        updateNodeData(node.id, { [field]: value });
    };

    const handleBindingChange = (field: string, sourceNodeId: string, sourceOutput: string) => {
        const newBindings = { ...(node.bindings || {}) };
        if (sourceNodeId === '') {
            delete newBindings[field];
        } else {
            newBindings[field] = { sourceNode: sourceNodeId, sourceOutput };
        }
        updateNodeBindings(node.id, newBindings);
    };

    const renderField = (label: string, field: string, type: 'text' | 'number' | 'select' = 'text', options: string[] = []) => {
        const value = (node.data as any)[field];
        const binding = node.bindings?.[field];

        return (
            <div style={{ marginBottom: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <label style={{ fontSize: 12, opacity: 0.8 }}>{label}</label>
                    <div style={{ fontSize: 10, cursor: 'pointer', color: '#0ff' }}>
                        {binding ? 'Bound' : 'Static'}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 5 }}>
                    {binding ? (
                        <div style={{ flex: 1, background: 'rgba(0,255,255,0.1)', border: '1px solid #0ff', padding: '5px 8px', borderRadius: 4, fontSize: 12, color: '#0ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>🔗 {upstreamNodes.find(n => n.id === binding.sourceNode)?.label || binding.sourceNode}.{binding.sourceOutput}</span>
                            <button
                                onClick={() => handleBindingChange(field, '', '')}
                                style={{ background: 'transparent', border: 'none', color: '#ff0066', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                ×
                            </button>
                        </div>
                    ) : (
                        <>
                            {type === 'select' ? (
                                <select
                                    value={value || ''}
                                    onChange={e => handleDataChange(field, e.target.value)}
                                    style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 4, padding: 5 }}
                                >
                                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            ) : (
                                <input
                                    type={type}
                                    value={value || ''}
                                    onChange={e => handleDataChange(field, type === 'number' ? Number(e.target.value) : e.target.value)}
                                    style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 4, padding: 5 }}
                                />
                            )}

                            {/* Binding Trigger - Simple Dropdown for Demo */}
                            <select
                                onChange={(e) => {
                                    if (e.target.value) {
                                        const parts = e.target.value.split(':');
                                        if (parts.length === 2 && parts[0] && parts[1]) {
                                            handleBindingChange(field, parts[0], parts[1]);
                                        }
                                    }
                                }}
                                value=""
                                style={{ width: 20, opacity: 0, position: 'absolute', right: 25 }} // Hacky overlay or custom UI
                            >
                                <option value="">Link...</option>
                                {upstreamNodes.map(up => (
                                    <option key={up.id} value={`${up.id}:result`}>
                                        {up.label} (result)
                                    </option>
                                ))}
                            </select>
                            <button style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 4, cursor: 'pointer', width: 30 }} title="Bind Data">
                                🔗
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="propertiesPanel" style={{ width: 300, padding: 20 }}>
            <div className="neonText" style={{ fontSize: 14, marginBottom: 20 }}>PROPERTIES</div>

            <div style={{ marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: 16, fontWeight: 'bold' }}>{node.label}</div>
                <div style={{ fontSize: 10, opacity: 0.5, textTransform: 'uppercase' }}>ID: {node.id.slice(0, 8)}...</div>
            </div>

            {node.type === 'llm' && (
                <>
                    {renderField('Model', 'model', 'select', ['gpt-3.5-turbo', 'gpt-4', 'claude-3-opus'])}
                    {renderField('System Prompt', 'system_prompt')}
                    {renderField('User Prompt', 'prompt')}
                    {renderField('Temperature', 'temperature', 'number')}
                </>
            )}

            {node.type === 'image_gen' && (
                <>
                    {renderField('Model', 'model', 'select', ['flux-pro', 'sd-xl', 'midjourney'])}
                    {renderField('Prompt', 'prompt')}
                    {renderField('Negative Prompt', 'negative_prompt')}
                    {renderField('Aspect Ratio', 'aspect_ratio', 'select', ['1:1', '16:9', '9:16', '3:4', '4:3'])}
                </>
            )}

            {node.type === 'code' && (
                <>
                    {renderField('Code Loop', 'code')}
                </>
            )}
        </div>
    );
}
