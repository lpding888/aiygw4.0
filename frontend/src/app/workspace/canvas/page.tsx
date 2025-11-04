/**
 * 画版页面
 * 艹，图片上传+预览+缩放拖拽，基础功能！
 *
 * @author 老王
 */

'use client';

import React, { useState, useRef } from 'react';
import {
  Upload,
  Button,
  Space,
  Typography,
  Slider,
  message
} from 'antd';
import {
  UploadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined
} from '@ant-design/icons';

export default function CanvasPage() {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageUrl(result);
      setScale(1);
      setPosition({ x: 0, y: 0 });
      message.success('图片加载成功');
    };
    reader.readAsDataURL(file);
    return false; // 阻止默认上传行为
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.1, 0.1));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageUrl) return;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageUrl) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const deltaX = e.movementX;
    const deltaY = e.movementY;

    setPosition(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div style={{ padding: 24, height: '100vh' }}>
      <h2>画版</h2>

      {/* 工具栏 */}
      <Space style={{ marginBottom: 16 }}>
        <Upload
          accept="image/*"
          beforeUpload={handleUpload}
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />}>
            上传图片
          </Button>
        </Upload>

        {imageUrl && (
          <>
            <Button
              icon={<ZoomOutOutlined />}
              onClick={handleZoomOut}
              disabled={scale <= 0.1}
            >
              缩小
            </Button>

            <div style={{ width: 120 }}>
              <Slider
                min={0.1}
                max={3}
                step={0.1}
                value={scale}
                onChange={setScale}
                tooltip={{ formatter: (value) => `${Math.round((value as number) * 100)}%` }}
              />
            </div>

            <Button
              icon={<ZoomInOutlined />}
              onClick={handleZoomIn}
              disabled={scale >= 3}
            >
              放大
            </Button>

            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </>
        )}
      </Space>

      {/* 画布区域 */}
      <div
        ref={containerRef}
        style={{
          height: 'calc(100vh - 160px)',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          overflow: 'hidden',
          position: 'relative',
          background: imageUrl ? '#f5f5f5' : '#fafafa',
          cursor: imageUrl ? (isDragging ? 'grabbing' : 'grab') : 'default'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {imageUrl ? (
          <img
            ref={imageRef}
            src={imageUrl}
            alt="画布图片"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              userSelect: 'none',
              pointerEvents: 'none'
            }}
            draggable={false}
          />
        ) : (
          <div style={{
            height: '100%',
            display: 'grid',
            placeItems: 'center',
            color: '#999'
          }}>
            <div style={{ textAlign: 'center' }}>
              <UploadOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <div>上传图片开始编辑</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>
                支持 JPG、PNG、GIF 格式
              </div>
            </div>
          </div>
        )}

        {/* 状态信息 */}
        {imageUrl && (
          <div style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12
          }}>
            缩放: {Math.round(scale * 100)}% |
            位置: ({Math.round(position.x)}, {Math.round(position.y)})
          </div>
        )}
      </div>
    </div>
  );
}