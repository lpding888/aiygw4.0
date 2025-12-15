import logger from './logger.js';

/**
 * VariableMapper (变量映射器)
 * 核心作用：让 Pipeline 的步骤之间可以传递数据。
 *
 * 语法说明：
 * - 纯变量引用： "{{step1.output.url}}" -> 返回原始类型（可能是对象、数组或字符串）
 * - 字符串嵌入： "提示词是: {{step1.output.text}}" -> 返回替换后的字符串
 */
export class VariableMapper {
  /**
   * 映射主入口
   * @param template - 定义在 Schema 中的配置模板 (可能是静态值，也可能包含 {{变量}})
   * @param context - 当前 Pipeline 的运行时上下文 (包含所有已完成步骤的结果)
   * @returns 解析后的实际值
   */
  static map(template: unknown, context: Record<string, unknown>): unknown {
    // 1. 如果是字符串，尝试解析变量
    if (typeof template === 'string') {
      return this.resolveString(template, context);
    }

    // 2. 如果是数组，递归处理每一项
    if (Array.isArray(template)) {
      return template.map((item) => this.map(item, context));
    }

    // 3. 如果是对象（且不是 null），递归处理每一个属性
    if (typeof template === 'object' && template !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.map(value, context);
      }
      return result;
    }

    // 4. 其他基本类型（数字、布尔值等），直接返回
    return template;
  }

  /**
   * 解析字符串中的变量
   */
  private static resolveString(str: string, context: Record<string, unknown>): unknown {
    const trimmed = str.trim();

    // 情况 A: 整个字符串就是一个变量引用 "{{step1.data}}"
    // 这种情况下，我们要返回原始类型（比如对象或数组），而不是转成字符串
    const exactMatch = trimmed.match(/^\{\{([\w\.]+)\}\}$/);
    if (exactMatch) {
      const path = exactMatch[1];
      return this.getValueByPath(context, path);
    }

    // 情况 B: 字符串里包含变量 "Hello {{user.name}}"
    // 这种情况下，只能返回字符串
    if (str.includes('{{')) {
      return str.replace(/\{\{([\w\.]+)\}\}/g, (_, path) => {
        const val = this.getValueByPath(context, path);
        // 如果值不存在，返回空字符串，避免 undefined 出现在文本中
        if (val === undefined || val === null) return '';
        // 如果是对象，尝试 JSON 序列化，否则直接转字符串
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      });
    }

    // 情况 C: 普通字符串，没有变量
    return str;
  }

  /**
   * 根据点号路径获取值
   * 例如: getValueByPath(context, "step1.output.resultUrls.0")
   */
  private static getValueByPath(obj: any, path: string): unknown {
    if (!obj) return undefined;

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }
}
