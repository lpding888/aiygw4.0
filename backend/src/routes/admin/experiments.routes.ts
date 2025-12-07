import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/adminAuth.middleware.js';

const router = Router();
router.use(authenticate, requireAdmin);

// Stub for experiments list
router.get('/', (req, res) => {
    res.json({
        success: true,
        data: []
    });
});

export default router;
