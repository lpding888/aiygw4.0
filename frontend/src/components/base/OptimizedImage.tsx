/**
 * PERF-P2-SSR-204: 优化的图片组件
 * 艹!统一封装next/image,自动优化WebP/AVIF,懒加载,占位符!
 *
 * @author 老王
 */

'use client';

import Image, { ImageProps } from 'next/image';
import React, { useState } from 'react';
import { Spin } from 'antd';

interface OptimizedImageProps extends Omit<ImageProps, 'placeholder'> {
  /**
   * 艹!占位符类型
   * - blur: 模糊占位(需要blurDataURL)
   * - shimmer: 闪烁动画
   * - spin: Ant Design Spin组件
   * - empty: 无占位符
   */
  placeholderType?: 'blur' | 'shimmer' | 'spin' | 'empty';
  /**
   * 艹!是否显示加载状态
   */
  showLoading?: boolean;
  /**
   * 艹!加载失败时的fallback图片
   */
  fallbackSrc?: string;
}

/**
 * 艹!生成shimmer占位符SVG
 */
const shimmer = (w: number, h: number) => `
<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#f6f7f8" offset="0%" />
      <stop stop-color="#edeef1" offset="20%" />
      <stop stop-color="#f6f7f8" offset="40%" />
      <stop stop-color="#f6f7f8" offset="100%" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#f6f7f8" />
  <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
  <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite"  />
</svg>`;

/**
 * 艹!转换SVG为base64
 */
const toBase64 = (str: string) =>
  typeof window === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str);

/**
 * 艹!优化的图片组件
 *
 * 特性:
 * 1. 自动WebP/AVIF优化
 * 2. 懒加载(默认)
 * 3. 占位符支持
 * 4. 加载失败fallback
 * 5. 加载状态显示
 */
export default function OptimizedImage({
  placeholderType = 'shimmer',
  showLoading = false,
  fallbackSrc,
  width,
  height,
  alt,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // 艹!计算占位符
  const getPlaceholder = (): ImageProps['placeholder'] => {
    if (placeholderType === 'blur' && props.blurDataURL) {
      return 'blur';
    }
    if (placeholderType === 'shimmer') {
      return 'blur';
    }
    return 'empty';
  };

  // 艹!计算占位符数据URL
  const getPlaceholderDataURL = (): string | undefined => {
    if (placeholderType === 'shimmer' && typeof width === 'number' && typeof height === 'number') {
      return `data:image/svg+xml;base64,${toBase64(shimmer(width, height))}`;
    }
    return props.blurDataURL;
  };

  // 艹!处理图片加载完成
  const handleLoad = () => {
    setIsLoading(false);
  };

  // 艹!处理图片加载失败
  const handleError = () => {
    setError(true);
    setIsLoading(false);
  };

  // 艹!如果有错误且有fallback,显示fallback图片
  if (error && fallbackSrc) {
    return (
      <Image
        {...props}
        src={fallbackSrc}
        width={width}
        height={height}
        alt={alt || 'Fallback image'}
        onLoad={handleLoad}
      />
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <Image
        {...props}
        src={error && fallbackSrc ? fallbackSrc : props.src}
        width={width}
        height={height}
        alt={alt}
        placeholder={getPlaceholder()}
        blurDataURL={getPlaceholderDataURL()}
        onLoad={handleLoad}
        onError={handleError}
        // 艹!默认懒加载
        loading={props.loading || 'lazy'}
        // 艹!优先使用现代格式
        quality={props.quality || 85}
      />

      {/* 艹!加载状态覆盖层 */}
      {showLoading && isLoading && placeholderType === 'spin' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.8)',
            borderRadius: props.style?.borderRadius || 0,
          }}
        >
          <Spin size="small" />
        </div>
      )}
    </div>
  );
}

/**
 * 艹!Avatar图片组件(针对头像优化)
 */
export function OptimizedAvatar({
  src,
  alt = 'Avatar',
  size = 40,
  ...props
}: Omit<OptimizedImageProps, 'width' | 'height'> & { size?: number }) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      placeholderType="shimmer"
      style={{
        borderRadius: '50%',
        objectFit: 'cover',
        ...props.style,
      }}
      {...props}
    />
  );
}

/**
 * 艹!缩略图组件(针对卡片缩略图优化)
 */
export function OptimizedThumbnail({
  src,
  alt = 'Thumbnail',
  width = 300,
  height = 200,
  ...props
}: OptimizedImageProps) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      placeholderType="shimmer"
      style={{
        objectFit: 'cover',
        ...props.style,
      }}
      {...props}
    />
  );
}
