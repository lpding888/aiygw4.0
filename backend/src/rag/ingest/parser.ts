/**
 * 文档解析器 - 支持Markdown/HTML/PDF
 * 艹，这个憨批负责解析各种文档格式，去噪并输出干净文本！
 */

import logger from '../../utils/logger.js';

export interface ParseResult {
  text: string;
  metadata: {
    format: string;
    length: number;
    title?: string;
    sections?: string[];
  };
}

export class DocumentParser {
  /**
   * 解析文档
   */
  async parse(content: string | Buffer, format: 'markdown' | 'html' | 'pdf'): Promise<ParseResult> {
    switch (format) {
      case 'markdown':
        return this.parseMarkdown(content.toString());
      case 'html':
        return this.parseHTML(content.toString());
      case 'pdf':
        return this.parsePDF(Buffer.isBuffer(content) ? content : Buffer.from(content));
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private parseMarkdown(content: string): ParseResult {
    // 去除代码块
    let text = content.replace(/```[\s\S]*?```/g, '');
    // 去除链接但保留文本
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // 去除图片
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
    // 去除HTML标签
    text = text.replace(/<[^>]+>/g, '');
    // 标题提取
    const sections = content.match(/^#+\s+(.+)$/gm)?.map((h) => h.replace(/^#+\s+/, '')) || [];

    logger.info(`[Parser] Markdown解析完成: length=${text.length}, sections=${sections.length}`);

    return {
      text: text.trim(),
      metadata: {
        format: 'markdown',
        length: text.length,
        sections
      }
    };
  }

  private parseHTML(content: string): ParseResult {
    // 简化HTML解析：去除script、style标签，提取文本
    let text = content
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');

    return {
      text: text.trim(),
      metadata: {
        format: 'html',
        length: text.length
      }
    };
  }

  private parsePDF(content: Buffer): ParseResult {
    // 简化PDF解析（实际应使用pdf-parse库）
    const text = content.toString('utf-8');

    return {
      text: text.trim(),
      metadata: {
        format: 'pdf',
        length: text.length
      }
    };
  }
}

export const parser = new DocumentParser();
export default parser;
