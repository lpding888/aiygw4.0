import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError.js';
import { ERROR_CODES } from '../../config/error-codes.js';
import mcpEndpointsService from '../../services/mcp-endpoints.service.js';

class MCPController {
    async listEndpoints(req: Request, res: Response, next: NextFunction) {
        try {
            const { status, enabled, healthy, page, limit } = req.query as any;
            const filters = {
                status,
                enabled: enabled !== undefined ? enabled === 'true' : undefined,
                healthy: healthy !== undefined ? healthy === 'true' : undefined,
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20
            };

            const result = await mcpEndpointsService.getEndpoints(filters);
            res.json({ success: true, data: result.endpoints, total: result.total });
        } catch (error) {
            next(error);
        }
    }

    async getEndpoint(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const endpoint = await mcpEndpointsService.getEndpoint(id);
            if (!endpoint) {
                throw AppError.custom(ERROR_CODES.RESOURCE_NOT_FOUND, 'MCP Endpoint not found');
            }
            res.json({ success: true, data: endpoint });
        } catch (error) {
            next(error);
        }
    }

    async createEndpoint(req: Request, res: Response, next: NextFunction) {
        try {
            const { name, endpointUrl, apiKey, description, protocolVersion } = req.body;
            const endpoint = await mcpEndpointsService.createEndpoint(
                { name, endpointUrl, description, protocolVersion },
                { apiKey: apiKey || '' },
                (req as any).user?.id || 'system'
            );
            res.json({ success: true, data: endpoint });
        } catch (error) {
            next(error);
        }
    }

    async updateEndpoint(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const endpoint = await mcpEndpointsService.updateEndpoint(
                id,
                req.body,
                (req as any).user?.id || 'system'
            );
            res.json({ success: true, data: endpoint });
        } catch (error) {
            next(error);
        }
    }

    async deleteEndpoint(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            await mcpEndpointsService.deleteEndpoint(id, (req as any).user?.id || 'system');
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    }

    async testEndpoint(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const result = await mcpEndpointsService.testEndpoint(id);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
}

export default new MCPController();
