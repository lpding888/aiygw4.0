import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { body, param } from 'express-validator';
import userProfileController from '../controllers/user-profile.controller.js';
import { authenticate as authenticateToken } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';

const router = Router();

// 文件上传配置
interface FileWithMimetype {
  mimetype: string;
}

type FileFilterCallback = (err: Error | null, acceptFile?: boolean) => void;

const upload = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: Request, file: FileWithMimetype, cb: FileFilterCallback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('只支持 JPG、PNG、GIF、WebP 格式的图片'));
  }
});

// 认证
router.use(authenticateToken);

// 验证规则
const userIdValidation = [param('userId').optional().isUUID().withMessage('用户ID格式无效')];
const educationIdValidation = [param('educationId').isUUID().withMessage('教育经历ID格式无效')];
const workIdValidation = [param('workId').isUUID().withMessage('工作经历ID格式无效')];
const skillIdValidation = [param('skillId').isUUID().withMessage('技能ID格式无效')];

const updateBasicInfoValidation = [
  body('first_name').optional().isString().isLength({ max: 50 }).withMessage('名最多50个字符'),
  body('last_name').optional().isString().isLength({ max: 50 }).withMessage('姓最多50个字符'),
  body('birth_date').optional().isISO8601().withMessage('出生日期格式无效'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
    .withMessage('无效的性别选项'),
  body('phone').optional().isMobilePhone('zh-CN').withMessage('手机号格式无效'),
  body('email').optional().isEmail().withMessage('邮箱格式无效'),
  body('country').optional().isString().isLength({ max: 50 }).withMessage('国家名称最多50个字符'),
  body('state').optional().isString().isLength({ max: 50 }).withMessage('省/州名称最多50个字符'),
  body('city').optional().isString().isLength({ max: 50 }).withMessage('城市名称最多50个字符'),
  body('address').optional().isString().isLength({ max: 200 }).withMessage('详细地址最多200个字符'),
  body('postal_code')
    .optional()
    .isString()
    .isLength({ max: 20 })
    .withMessage('邮政编码最多20个字符'),
  body('occupation')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('职业名称最多100个字符'),
  body('company').optional().isString().isLength({ max: 100 }).withMessage('公司名称最多100个字符'),
  body('industry').optional().isString().isLength({ max: 50 }).withMessage('行业名称最多50个字符'),
  body('education_level')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('教育程度最多50个字符'),
  body('university')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('大学名称最多100个字符'),
  body('bio').optional().isString().isLength({ max: 1000 }).withMessage('个人简介最多1000个字符'),
  body('avatar_url').optional().isURL().withMessage('头像URL格式无效'),
  body('banner_url').optional().isURL().withMessage('横幅图片URL格式无效'),
  body('language')
    .optional()
    .isIn(['zh-CN', 'en-US', 'ja-JP', 'ko-KR'])
    .withMessage('无效的语言选项'),
  body('timezone').optional().isString().isLength({ max: 50 }).withMessage('时区格式无效'),
  body('profile_public').optional().isBoolean().withMessage('资料公开设置必须为布尔值'),
  body('show_email').optional().isBoolean().withMessage('邮箱显示设置必须为布尔值'),
  body('show_phone').optional().isBoolean().withMessage('手机号显示设置必须为布尔值')
];

const addEducationValidation = [
  body('school_name')
    .notEmpty()
    .withMessage('学校名称不能为空')
    .isString()
    .isLength({ max: 200 })
    .withMessage('学校名称最多200个字符'),
  body('degree').optional().isString().isLength({ max: 100 }).withMessage('学位名称最多100个字符'),
  body('major').optional().isString().isLength({ max: 100 }).withMessage('专业名称最多100个字符'),
  body('education_level')
    .optional()
    .isIn(['high_school', 'bachelor', 'master', 'phd', 'other'])
    .withMessage('无效的教育水平选项'),
  body('start_date').optional().isISO8601().withMessage('开始日期格式无效'),
  body('end_date').optional().isISO8601().withMessage('结束日期格式无效'),
  body('is_current').optional().isBoolean().withMessage('是否在读必须为布尔值'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('描述最多1000个字符'),
  body('gpa').optional().isFloat({ min: 0, max: 4.0 }).withMessage('GPA必须在0-4.0之间'),
  body('activities')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('课外活动最多500个字符'),
  body('achievements')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('成就最多1000个字符'),
  body('is_public').optional().isBoolean().withMessage('是否公开必须为布尔值')
];

const addWorkExperienceValidation = [
  body('company_name')
    .notEmpty()
    .withMessage('公司名称不能为空')
    .isString()
    .isLength({ max: 200 })
    .withMessage('公司名称最多200个字符'),
  body('position')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('职位名称最多100个字符'),
  body('start_date').optional().isISO8601().withMessage('开始日期格式无效'),
  body('end_date').optional().isISO8601().withMessage('结束日期格式无效'),
  body('is_current').optional().isBoolean().withMessage('是否在职必须为布尔值'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('描述最多1000个字符')
];

const addSkillValidation = [
  body('name')
    .notEmpty()
    .withMessage('技能名称不能为空')
    .isString()
    .isLength({ max: 100 })
    .withMessage('技能名称最多100个字符'),
  body('level')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('无效的技能等级'),
  body('years').optional().isInt({ min: 0, max: 50 }).withMessage('年限必须在0-50之间')
];

const batchUpdateValidation = [
  body('basicInfo').optional().isObject().withMessage('basicInfo必须是对象'),
  body('education').optional().isArray().withMessage('education必须是数组'),
  body('workExperience').optional().isArray().withMessage('workExperience必须是数组'),
  body('skills').optional().isArray().withMessage('skills必须是数组')
];

// 基础信息
router.get('/full/:userId?', userIdValidation, validate, userProfileController.getUserFullProfile);
router.get('/basic/:userId?', userIdValidation, validate, userProfileController.getUserBasicInfo);
router.put(
  '/basic',
  updateBasicInfoValidation,
  validate,
  userProfileController.updateUserBasicInfo
);

// 批量更新
router.put('/batch', batchUpdateValidation, validate, userProfileController.batchUpdateProfile);

// 教育经历
router.get(
  '/education/:userId?',
  userIdValidation,
  validate,
  userProfileController.getUserEducation
);
router.post('/education', addEducationValidation, validate, userProfileController.addEducation);
router.put(
  '/education/:educationId',
  educationIdValidation,
  addEducationValidation,
  validate,
  userProfileController.updateEducation
);
router.delete(
  '/education/:educationId',
  educationIdValidation,
  validate,
  userProfileController.deleteEducation
);

// 工作经历
router.get(
  '/work/:userId?',
  userIdValidation,
  validate,
  userProfileController.getUserWorkExperience
);
router.post(
  '/work',
  addWorkExperienceValidation,
  validate,
  userProfileController.addWorkExperience
);
router.put(
  '/work/:workId',
  workIdValidation,
  addWorkExperienceValidation,
  validate,
  userProfileController.updateWorkExperience
);
router.delete(
  '/work/:workId',
  workIdValidation,
  validate,
  userProfileController.deleteWorkExperience
);

// 技能
router.get('/skills/:userId?', userIdValidation, validate, userProfileController.getUserSkills);
router.post('/skills', addSkillValidation, validate, userProfileController.addSkill);
router.put(
  '/skills/:skillId',
  skillIdValidation,
  addSkillValidation,
  validate,
  userProfileController.updateSkill
);
router.delete('/skills/:skillId', skillIdValidation, validate, userProfileController.deleteSkill);

// 兴趣、社交
router.get(
  '/interests/:userId?',
  userIdValidation,
  validate,
  userProfileController.getUserInterests
);
router.get(
  '/social/:userId?',
  userIdValidation,
  validate,
  userProfileController.getUserSocialLinks
);

// 资料完整度
router.get(
  '/completeness/:userId?',
  userIdValidation,
  validate,
  userProfileController.getUserProfileCompleteness
);
router.post('/completeness/recalculate', userProfileController.recalculateProfileCompleteness);
router.get('/suggestions', userProfileController.getProfileSuggestions);

// 文件上传
router.post('/upload/avatar', upload.single('avatar'), userProfileController.uploadAvatar);
router.post('/upload/banner', upload.single('banner'), userProfileController.uploadBanner);

// Multer错误处理
interface MulterError extends Error {
  code?: string;
  name: string;
}

router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  const err = error as MulterError | null;
  if (err && err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, error: '文件大小超过限制（最大5MB）' });
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({ success: false, error: '文件数量超过限制' });
      return;
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({ success: false, error: '意外的文件字段' });
      return;
    }
  }
  if (err && err.message === '只支持 JPG、PNG、GIF、WebP 格式的图片') {
    res.status(400).json({ success: false, error: err.message });
    return;
  }
  next(error);
});

export default router;
