import COS from 'cos-nodejs-sdk-v5';

export interface CosConfig {
  bucket: string;
  region: string;
  imageDomain?: string;
}

const cosClient = new COS({
  SecretId: process.env.TENCENT_SECRET_ID ?? '',
  SecretKey: process.env.TENCENT_SECRET_KEY ?? ''
});

export const cosConfig: CosConfig = {
  bucket: process.env.COS_BUCKET ?? '',
  region: process.env.COS_REGION ?? '',
  imageDomain: process.env.COS_IMAGE_DOMAIN
};

export { cosClient };
