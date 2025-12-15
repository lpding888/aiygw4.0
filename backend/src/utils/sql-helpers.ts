/**
 * SQL 安全工具函数
 */

/**
 * 转义 LIKE 模式中的特殊字符
 *
 * LIKE 查询中 % 和 _ 是通配符，如果用户输入包含这些字符需要转义
 * 否则可能导致意外匹配或 SQL 注入
 *
 * @param pattern - 用户输入的搜索字符串
 * @returns 转义后的安全字符串
 */
export function escapeLikePattern(pattern: string): string {
  if (!pattern || typeof pattern !== 'string') {
    return '';
  }

  // 转义 LIKE 模式的特殊字符: % _ \
  return pattern
    .replace(/\\/g, '\\\\') // 先转义反斜杠
    .replace(/%/g, '\\%') // 转义百分号
    .replace(/_/g, '\\_'); // 转义下划线
}

/**
 * 安全地将字符串转换为整数 ID
 *
 * @param value - 输入值
 * @param defaultValue - 解析失败时返回的默认值
 * @returns 解析后的整数或默认值
 */
export function safeParseInt(value: unknown, defaultValue: number | null = null): number | null {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const str = String(value).trim();
  if (!/^\d+$/.test(str)) {
    return defaultValue;
  }

  const num = parseInt(str, 10);
  return Number.isFinite(num) ? num : defaultValue;
}

/**
 * 安全地将字符串转换为正整数 ID（必须 > 0）
 *
 * @param value - 输入值
 * @returns 正整数或 null
 */
export function safeParsePositiveInt(value: unknown): number | null {
  const num = safeParseInt(value);
  return num !== null && num > 0 ? num : null;
}
