/**
 * CDN资产URL工具
 * 艹！这个工具负责COS到CDN的URL映射、签名URL生成！
 *
 * @author 老王
 */

/**
 * CDN配置
 */
interface CDNConfig {
  enabled: boolean;
  cos_domain: string; // COS域名
  cdn_domain: string; // CDN域名
  sign_key?: string; // 签名密钥
  default_expires?: number; // 默认过期时间（秒），默认3600
}

/**
 * URL转换选项
 */
interface URLTransformOptions {
  signed?: boolean; // 是否需要签名
  expires?: number; // 过期时间（秒）
  width?: number; // 图片宽度（图片处理）
  height?: number; // 图片高度
  quality?: number; // 图片质量（1-100）
  format?: 'jpg' | 'png' | 'webp' | 'avif'; // 图片格式
}

/**
 * CDN URL工具类
 */
export class CDNUrlUtil {
  private config: Required<CDNConfig>;

  constructor(config: Partial<CDNConfig> = {}) {
    this.config = {
      enabled: true,
      cos_domain: 'https://my-bucket.cos.ap-shanghai.myqcloud.com',
      cdn_domain: 'https://cdn.example.com',
      sign_key: 'your-secret-key',
      default_expires: 3600,
      ...config,
    };
  }

  /**
   * COS URL转CDN URL
   */
  toCDN(cosUrl: string, options: URLTransformOptions = {}): string {
    if (!this.config.enabled || !cosUrl) {
      return cosUrl;
    }

    try {
      // 替换域名
      let cdnUrl = cosUrl.replace(this.config.cos_domain, this.config.cdn_domain);

      // 添加图片处理参数
      cdnUrl = this.addImageParams(cdnUrl, options);

      // 添加签名
      if (options.signed) {
        cdnUrl = this.signURL(cdnUrl, options.expires);
      }

      return cdnUrl;
    } catch (error) {
      console.error('[CDN] URL转换失败:', error);
      return cosUrl;
    }
  }

  /**
   * 批量转换URL
   */
  batchToCDN(cosUrls: string[], options: URLTransformOptions = {}): string[] {
    return cosUrls.map((url) => this.toCDN(url, options));
  }

  /**
   * 添加图片处理参数
   */
  private addImageParams(url: string, options: URLTransformOptions): string {
    const params: string[] = [];

    if (options.width) {
      params.push(`w_${options.width}`);
    }

    if (options.height) {
      params.push(`h_${options.height}`);
    }

    if (options.quality) {
      params.push(`q_${Math.min(100, Math.max(1, options.quality))}`);
    }

    if (options.format) {
      params.push(`f_${options.format}`);
    }

    if (params.length === 0) {
      return url;
    }

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}imageMogr2/${params.join('/')}`;
  }

  /**
   * 生成签名URL
   */
  private signURL(url: string, expiresIn?: number): string {
    const expires = Math.floor(Date.now() / 1000) + (expiresIn || this.config.default_expires);

    // 简化版签名算法（实际生产环境应该使用更安全的算法）
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;
    const sign = this.generateSign(path, expires);

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}sign=${sign}&expires=${expires}`;
  }

  /**
   * 生成签名
   */
  private generateSign(path: string, expires: number): string {
    // 简化版签名：MD5(key + path + expires)
    // 实际生产环境应该使用crypto库和更安全的算法
    const str = `${this.config.sign_key}${path}${expires}`;
    return this.simpleHash(str);
  }

  /**
   * 简单哈希（仅用于演示，生产环境应使用crypto.subtle或crypto-js）
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 验证URL是否已过期
   */
  isExpired(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const expires = urlObj.searchParams.get('expires');

      if (!expires) {
        return false; // 无过期时间的URL永不过期
      }

      const now = Math.floor(Date.now() / 1000);
      return parseInt(expires, 10) < now;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取URL剩余有效时间（秒）
   */
  getRemainingTime(url: string): number | null {
    try {
      const urlObj = new URL(url);
      const expires = urlObj.searchParams.get('expires');

      if (!expires) {
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      const remaining = parseInt(expires, 10) - now;
      return Math.max(0, remaining);
    } catch (error) {
      return null;
    }
  }

  /**
   * 判断URL是否为COS URL
   */
  isCOSUrl(url: string): boolean {
    return url.includes(this.config.cos_domain);
  }

  /**
   * 判断URL是否为CDN URL
   */
  isCDNUrl(url: string): boolean {
    return url.includes(this.config.cdn_domain);
  }

  /**
   * 追踪CDN命中
   */
  trackHit(url: string, hit: boolean): void {
    // 发送命中率追踪
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob(
        [JSON.stringify({ url, hit, timestamp: Date.now() })],
        { type: 'application/json' }
      );
      navigator.sendBeacon('/api/cdn/track', blob);
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CDNConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<CDNConfig> {
    return { ...this.config };
  }
}

/**
 * 全局CDN工具实例
 */
export const cdnUtil = new CDNUrlUtil({
  enabled: true,
  cos_domain: 'https://my-bucket.cos.ap-shanghai.myqcloud.com',
  cdn_domain: 'https://cdn.example.com',
  sign_key: 'demo-secret-key',
  default_expires: 3600,
});

/**
 * React Hook for CDN URL
 */
export function useCDNUrl(cosUrl: string | undefined, options: URLTransformOptions = {}) {
  const [cdnUrl, setCdnUrl] = React.useState<string>('');

  React.useEffect(() => {
    if (cosUrl) {
      const url = cdnUtil.toCDN(cosUrl, options);
      setCdnUrl(url);
    }
  }, [cosUrl, JSON.stringify(options)]);

  return cdnUrl;
}

/**
 * React Hook for 批量CDN URL
 */
export function useCDNUrls(cosUrls: string[], options: URLTransformOptions = {}) {
  const [cdnUrls, setCdnUrls] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (cosUrls && cosUrls.length > 0) {
      const urls = cdnUtil.batchToCDN(cosUrls, options);
      setCdnUrls(urls);
    }
  }, [JSON.stringify(cosUrls), JSON.stringify(options)]);

  return cdnUrls;
}

// 导入React
import React from 'react';
