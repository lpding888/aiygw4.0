import { Request, Response, NextFunction } from 'express';
import pipelineGeneratorService from '../../services/pipelineGenerator.service.js';
import logger from '../../utils/logger.js';

class AIArchitectController {
    /**
     * POST /api/admin/architect/generate
     * Generate a new pipeline from natural language
     */
    async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { prompt } = req.body;
            if (!prompt) {
                res.status(400).json({ success: false, message: 'Prompt is required' });
                return;
            }

            const result = await pipelineGeneratorService.generatePipeline(prompt);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/admin/architect/modify
     * Modify an existing pipeline
     */
    async modify(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { pipeline, prompt } = req.body;
            if (!pipeline || !prompt) {
                res.status(400).json({ success: false, message: 'Pipeline and Prompt are required' });
                return;
            }

            const result = await pipelineGeneratorService.modifyPipeline(pipeline, prompt);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new AIArchitectController();
