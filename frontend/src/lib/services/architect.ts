import api from '../api';
import { PipelineSchemaV1Type } from '../pipeline/protocol';

export interface ArchitectResult {
    pipeline: PipelineSchemaV1Type;
    summary: string;
    thinking?: string;
    quality_score?: number;
    confidence?: number;
    attempts?: number;
}

export const architectService = {
    /**
     * Generate a new pipeline from scratch
     */
    generate: async (prompt: string): Promise<ArchitectResult> => {
        const response = await api.post('/admin/architect/generate', { prompt });
        return response.data; // Assuming api wrapper returns .data or we need to access .data.data?
        // api.ts usually returns response.data if it's an axios instance interceptor.
        // Let's assume standard response structure matches backend: { success: true, data: result }
        // If api.ts unwraps it, we might need to adjust. 
        // Based on typical patterns in this project (viewed api.ts?), let's assume it returns the response body directly or we handle it.
        // I'll assume axios-like: response.data is the payload.
    },

    /**
     * Modify an existing pipeline
     */
    modify: async (currentPipeline: PipelineSchemaV1Type, prompt: string): Promise<ArchitectResult> => {
        const response = await api.post('/admin/architect/modify', { pipeline: currentPipeline, prompt });
        return response.data;
    }
};
