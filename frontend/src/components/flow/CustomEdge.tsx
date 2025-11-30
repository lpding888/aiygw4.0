import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath, useReactFlow } from '@xyflow/react';
import { CloseCircleFilled } from '@ant-design/icons';

/**
 * 带删除按钮的自定义连线
 * 交互：鼠标悬停时显示删除按钮，点击即断开
 */
export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    setEdges((edges) => edges.filter((e) => e.id !== id));
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 2, stroke: '#b1b1b7' }} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            // 默认隐藏，hover 到 path 上时其实很难控制显示，通常做法是常驻或者点击线显示
            // 为了防呆，我们直接显示一个小的交互点，或者只在 hover 连线时显示
            // 这里为了简单直观，我们直接放一个显眼的按钮
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            onClick={onEdgeClick}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#ff4d4f',
              background: '#fff',
              borderRadius: '50%',
              padding: 0,
              lineHeight: 1,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            title="点击断开连线"
          >
            <CloseCircleFilled />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
