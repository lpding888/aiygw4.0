/**
 * 文本切块器 - 中英文混排切块
 * 艹，这个憨批负责把长文本切成合适大小的chunk！
 */

import logger from '../../utils/logger.js';

export interface ChunkOptions {
  chunkSize?: number; // 块大小（默认400）
  overlap?: number; // 重叠大小（默认50）
  minChunkSize?: number; // 最小块大小（默认100）
}

export interface Chunk {
  text: string;
  index: number;
  metadata: {
    start: number;
    end: number;
    length: number;
  };
}

export class TextChunker {
  /**
   * 切块
   */
  chunk(text: string, options: ChunkOptions = {}): Chunk[] {
    const { chunkSize = 400, overlap = 50, minChunkSize = 100 } = options;

    // 按句子分割（中英文混排）
    const sentences = this.splitSentences(text);
    const chunks: Chunk[] = [];
    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (
        currentChunk.length + sentence.length > chunkSize &&
        currentChunk.length >= minChunkSize
      ) {
        // 保存当前chunk
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex++,
          metadata: {
            start: currentStart,
            end: currentStart + currentChunk.length,
            length: currentChunk.length
          }
        });

        // 重叠部分
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + sentence;
        currentStart += currentChunk.length - overlap - sentence.length;
      } else {
        currentChunk += sentence;
      }
    }

    // 添加最后一个chunk
    if (currentChunk.trim().length >= minChunkSize) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        metadata: {
          start: currentStart,
          end: currentStart + currentChunk.length,
          length: currentChunk.length
        }
      });
    }

    logger.info(
      `[Chunker] 切块完成: ${chunks.length} chunks, avg_length=${Math.round(chunks.reduce((sum, c) => sum + c.metadata.length, 0) / chunks.length)}`
    );

    return chunks;
  }

  /**
   * 分割句子（中英文混排）
   */
  private splitSentences(text: string): string[] {
    // 中文标点
    const cnPunctuation = '[。！？；]';
    // 英文标点
    const enPunctuation = '[.!?;]';
    // 混合分割
    const regex = new RegExp(`(${cnPunctuation}|${enPunctuation}\\s+)`, 'g');

    return text.split(regex).filter((s) => s.trim().length > 0);
  }
}

export const chunker = new TextChunker();
export default chunker;
