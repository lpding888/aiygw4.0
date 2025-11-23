/**
 * Admin 后台配置
 * 集中管理品牌名称、面包屑映射等配置项
 */

/**
 * 品牌配置
 */
export const ADMIN_BRAND = {
  /** 应用名称 */
  APP_NAME: 'AI照',
  /** 后台标识 */
  APP_SUFFIX: 'Admin',
  /** Logo 背景渐变 */
  LOGO_GRADIENT: 'linear-gradient(135deg, #0071E3 0%, #42A5F5 100%)',
  /** Logo 文字 */
  LOGO_LETTER: 'A',
} as const;

/**
 * 面包屑路径映射
 * key: 路由路径
 * value: 显示名称
 */
export const BREADCRUMB_MAP: Record<string, string> = {
  // 一级页面
  '/admin': '管理后台',
  '/admin/dashboard': '仪表盘',

  // 应用管理
  '/admin/features': '功能列表',
  '/admin/features/new': '新建AI应用',

  // 核心引擎
  '/admin/forms': '表单管理',
  '/admin/forms/builder': '表单设计器',
  '/admin/pipelines': '流程管理',
  '/admin/pipelines/editor': '流程编辑器',

  // 用户中心
  '/admin/users': '用户管理',
  '/admin/distributors': '分销管理',
  '/admin/withdrawals': '提现审核',

  // 系统运维
  '/admin/system': '系统设置',
  '/admin/system/config': '系统配置',
  '/admin/system/audit': '审计日志',
  '/admin/providers': '模型服务商',

  // 内容运营
  '/admin/announcements': '公告管理',
  '/admin/banners': 'Banner管理',
};

/**
 * 根据路径获取面包屑项
 * @param pathname 当前路由路径
 * @returns 面包屑数组
 */
export function getBreadcrumbItems(pathname: string): Array<{ title: string; path?: string }> {
  const segments = pathname.split('/').filter(Boolean);
  const items: Array<{ title: string; path?: string }> = [
    { title: '首页', path: '/admin/dashboard' },
  ];

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;

    // 跳过 /admin 本身，已经有首页了
    if (currentPath === '/admin') continue;

    const title = BREADCRUMB_MAP[currentPath];
    if (title) {
      items.push({ title, path: currentPath });
    } else {
      // 如果没有映射，使用首字母大写的 segment
      items.push({ title: segment.charAt(0).toUpperCase() + segment.slice(1) });
    }
  }

  return items;
}

/**
 * 侧边栏菜单展开映射
 * key: 路由前缀
 * value: 对应的父菜单 key
 */
export const MENU_OPEN_KEYS_MAP: Record<string, string> = {
  '/admin/features': 'app-management',
  '/admin/forms': 'core-engine',
  '/admin/pipelines': 'core-engine',
  '/admin/users': 'user-center',
  '/admin/distributors': 'user-center',
  '/admin/withdrawals': 'user-center',
  '/admin/system': 'system-ops',
  '/admin/providers': 'system-ops',
  '/admin/announcements': 'content-ops',
  '/admin/banners': 'content-ops',
};

/**
 * 获取当前路由对应的展开菜单 keys
 * @param pathname 当前路由路径
 */
export function getMenuOpenKeys(pathname: string): string[] {
  const matchedKey = Object.keys(MENU_OPEN_KEYS_MAP).find(k => pathname.startsWith(k));
  if (!matchedKey) return [];
  const value = MENU_OPEN_KEYS_MAP[matchedKey];
  return value ? [value] : [];
}
