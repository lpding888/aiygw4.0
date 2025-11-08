import { Router } from 'express';
import { checkAll } from '../services/health.service.js';

const router = Router();

router.get('/healthz', async (_req, res, next) => {
  try {
    const report = await checkAll();
    const statusCode = report.status === 'healthy' ? 200 : report.status === 'degraded' ? 200 : 500;
    res.status(statusCode).json(report);
  } catch (e) {
    next(e);
  }
});

export default router;
