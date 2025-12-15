import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/adminAuth.middleware.js';

const router = Router();
router.use(authenticate, requireAdmin);

// Stub for analytics funnel
router.get('/funnel', (req, res) => {
    res.json({
        success: true,
        data: {
            steps: [],
            conversionRates: []
        }
    });
});

export default router;
