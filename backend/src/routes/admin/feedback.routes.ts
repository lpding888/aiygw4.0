import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/adminAuth.middleware.js';

const router = Router();
router.use(authenticate, requireAdmin);

// Stub for NPS stats
router.get('/nps-stats', (req, res) => {
    res.json({
        success: true,
        data: {
            score: 0,
            breakdown: { promoters: 0, passives: 0, detractors: 0 }
        }
    });
});

// Stub for feedback records
router.get('/records', (req, res) => {
    res.json({
        success: true,
        data: {
            items: [],
            total: 0
        }
    });
});

export default router;
