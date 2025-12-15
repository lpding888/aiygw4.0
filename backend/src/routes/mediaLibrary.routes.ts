/**
 * 媒体库管理路由
 */
import { Router } from 'express';
import mediaLibraryController from '../controllers/mediaLibrary.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// 文件夹管理
router.get(
  '/admin/media-library/folders',
  authenticate,
  requireAdmin,
  mediaLibraryController.listFolders.bind(mediaLibraryController)
);
router.post(
  '/admin/media-library/folders',
  authenticate,
  requireAdmin,
  mediaLibraryController.createFolder.bind(mediaLibraryController)
);
router.put(
  '/admin/media-library/folders/:id',
  authenticate,
  requireAdmin,
  mediaLibraryController.updateFolder.bind(mediaLibraryController)
);
router.delete(
  '/admin/media-library/folders/:id',
  authenticate,
  requireAdmin,
  mediaLibraryController.deleteFolder.bind(mediaLibraryController)
);

// 文件管理
router.get(
  '/admin/media-library/files',
  authenticate,
  requireAdmin,
  mediaLibraryController.listFiles.bind(mediaLibraryController)
);
router.get(
  '/admin/media-library/files/:id',
  authenticate,
  requireAdmin,
  mediaLibraryController.getFile.bind(mediaLibraryController)
);
router.post(
  '/admin/media-library/files',
  authenticate,
  requireAdmin,
  mediaLibraryController.createFile.bind(mediaLibraryController)
);
router.put(
  '/admin/media-library/files/:id',
  authenticate,
  requireAdmin,
  mediaLibraryController.updateFile.bind(mediaLibraryController)
);
router.delete(
  '/admin/media-library/files/:id',
  authenticate,
  requireAdmin,
  mediaLibraryController.deleteFile.bind(mediaLibraryController)
);

// 统计
router.get(
  '/admin/media-library/stats',
  authenticate,
  requireAdmin,
  mediaLibraryController.getStats.bind(mediaLibraryController)
);

export default router;
