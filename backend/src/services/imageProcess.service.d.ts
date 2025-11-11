interface PicOperationRule {
  fileid: string;
  rule: string;
}

interface PicOperations {
  is_pic_info: number;
  rules: PicOperationRule[];
}

interface ImageInfo {
  format?: string;
  size?: number;
  width?: number;
  height?: number;
}

declare class ImageProcessService {
  processBasicClean(
    taskId: string,
    inputImageUrl: string,
    params?: Record<string, unknown>
  ): Promise<string[]>;
  buildPicOperations(taskId: string, params?: Record<string, unknown>): PicOperations;
  processCloudImage(imageUrl: string, picOperations: PicOperations): Promise<string[]>;
  processExternalImage(
    taskId: string,
    imageUrl: string,
    picOperations: PicOperations
  ): Promise<string[]>;
  downloadImage(url: string): Promise<Buffer>;
  uploadImageToCos(key: string, buffer: Buffer, originalUrl: string): Promise<void>;
  getImageInfo(imageUrl: string): Promise<ImageInfo>;
  validateImage(imageUrl: string): Promise<boolean>;
  retry<T>(fn: () => Promise<T>, maxRetries?: number, delay?: number): Promise<T>;
}

declare const imageProcessService: ImageProcessService;
export default imageProcessService;
