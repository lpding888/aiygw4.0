/**
 * Prompt服务 - Handlebars渲染与预览 (CMS-303)
 * 艹！受限Handlebars渲染，禁止任意代码执行！
 */

import Handlebars, { type HelperDelegate } from 'handlebars';
import logger from '../utils/logger.js';

/**
 * 安全Helpers白名单
 * 艹！只允许这些helpers，禁止eval等危险操作！
 */
const SAFE_HELPERS: Record<string, HelperDelegate> = {
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  lt: (a, b) => a < b,
  gt: (a, b) => a > b,
  lte: (a, b) => a <= b,
  gte: (a, b) => a >= b,
  and: (...args: unknown[]) => {
    const operands = args.slice(0, -1);
    return operands.every(Boolean);
  },
  or: (...args: unknown[]) => {
    const operands = args.slice(0, -1);
    return operands.some(Boolean);
  },
  not: (value) => !value,
  uppercase: (str) => (str ?? '').toString().toUpperCase(),
  lowercase: (str) => (str ?? '').toString().toLowerCase(),
  capitalize: (str) => {
    const s = (str ?? '').toString();
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
  trim: (str) => (str ?? '').toString().trim(),
  truncate: (str, length) => {
    const s = (str ?? '').toString();
    return s.length > Number(length) ? `${s.substring(0, Number(length))}...` : s;
  },
  join: (arr, separator = ',') => {
    if (!Array.isArray(arr)) return '';
    return arr.join(separator as string);
  },
  length: (value) => {
    if (Array.isArray(value)) return value.length;
    if (typeof value === 'string') return value.length;
    if (typeof value === 'object' && value !== null) return Object.keys(value).length;
    return 0;
  },
  first: (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : null),
  last: (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : null),
  json: (obj) => JSON.stringify(obj),
  jsonPretty: (obj) => JSON.stringify(obj, null, 2),
  formatDate: (date, format = 'YYYY-MM-DD') => {
    const d = date instanceof Date ? date : new Date(date ?? '');
    if (Number.isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  },
  add: (a, b) => Number(a) + Number(b),
  subtract: (a, b) => Number(a) - Number(b),
  multiply: (a, b) => Number(a) * Number(b),
  divide: (a, b) => (Number(b) !== 0 ? Number(a) / Number(b) : 0),
  default: (value, defaultValue) => (value !== null && value !== undefined ? value : defaultValue)
};

type TemplateVariables = Record<string, unknown>;

type RenderTemplateSuccess = {
  success: true;
  result: string;
  missingVars?: string[];
};

type RenderTemplateFailure = {
  success: false;
  error: string;
};

export type RenderTemplateResult = RenderTemplateSuccess | RenderTemplateFailure;

type ValidateTemplateResult = { valid: true } | { valid: false; error: string };

function createSafeHandlebars(): typeof Handlebars {
  const hbs = Handlebars.create();

  Object.entries(SAFE_HELPERS).forEach(([name, fn]) => {
    hbs.registerHelper(name, fn);
  });

  const compilerProto = (
    hbs as typeof Handlebars & {
      JavaScriptCompiler?: { prototype: { quotedString: (value: string) => string } };
    }
  ).JavaScriptCompiler?.prototype;

  if (compilerProto) {
    compilerProto.quotedString = (str: string) =>
      `"${str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')}"`;
  }

  return hbs;
}

export function extractVariables(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    const content = match[1].trim();

    if (content.startsWith('#') || content.startsWith('/') || content.startsWith('!')) {
      continue;
    }

    const parts = content.split(/\s+/);
    parts.forEach((part) => {
      if (/^["']/.test(part) || /^\d+$/.test(part)) return;

      const varPath = part.split('.')[0];
      if (varPath && !(varPath in SAFE_HELPERS)) {
        variables.add(part);
      }
    });
  }

  return Array.from(variables);
}

function isVariableAvailable(varPath: string, context: TemplateVariables): boolean {
  const parts = varPath.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object' ||
      !(part in current)
    ) {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return true;
}

export function renderTemplate(
  template: string,
  variables: TemplateVariables = {}
): RenderTemplateResult {
  try {
    const hbs = createSafeHandlebars();
    const extractedVars = extractVariables(template);
    const missingVars = extractedVars.filter((varPath) => !isVariableAvailable(varPath, variables));

    const compiled = hbs.compile(template, {
      noEscape: false,
      strict: false
    });

    const result = compiled(variables);

    logger.info('[PromptService] 模板渲染成功', {
      templateLength: template.length,
      varsCount: extractedVars.length,
      missingVarsCount: missingVars.length
    });

    return {
      success: true,
      result,
      missingVars: missingVars.length > 0 ? missingVars : undefined
    };
  } catch (error) {
    logger.error('[PromptService] 模板渲染失败', error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message
    };
  }
}

export function validateTemplate(template: string): ValidateTemplateResult {
  try {
    const hbs = createSafeHandlebars();
    hbs.compile(template);
    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      valid: false,
      error: message
    };
  }
}

export { SAFE_HELPERS };
