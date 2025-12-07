import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/adminAuth.middleware.js';

const router = Router();
router.use(authenticate, requireAdmin);

// Stub for prompts list
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: []
  });
});

// Stub for prompts stats
router.get('/stats', (req, res) => {
  res.json({
    success: true,
    data: {
       total: 0,
       active: 0
    }
  });
});

export default router;
