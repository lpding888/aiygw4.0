const COS = require('cos-nodejs-sdk-v5');

const cosClient = new COS({
  SecretId: process.env.TENCENT_SECRET_ID,
  SecretKey: process.env.TENCENT_SECRET_KEY
});

const cosConfig = {
  bucket: process.env.COS_BUCKET,
  region: process.env.COS_REGION,
  imageDomain: process.env.COS_IMAGE_DOMAIN
};

module.exports = {
  cosClient,
  cosConfig
};
