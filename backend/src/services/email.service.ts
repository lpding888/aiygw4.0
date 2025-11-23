import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT ?? 465);
const smtpSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : true;
const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;
const smtpFrom = process.env.SMTP_FROM || smtpUser;
const smtpFromName = process.env.SMTP_FROM_NAME || 'AI衣柜';

function ensureConfig(): void {
  if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
    throw new Error('SMTP 配置缺失，请检查 SMTP_HOST/SMTP_USER/SMTP_PASSWORD/SMTP_FROM');
  }
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  // 在开发环境，如果配置了SMTP，也尝试发送邮件
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`[Email] 开发环境 - 准备发送验证码到 ${to}: ${code}`);
    // 如果没有配置SMTP，则只记录日志并返回
    if (!smtpHost || !smtpUser || !smtpPassword) {
      logger.info(`[Email] 未配置SMTP，仅打印验证码: ${code}`);
      return;
    }
    logger.info(`[Email] 已配置SMTP，尝试发送邮件...`);
  }

  ensureConfig();

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPassword
    }
  });

  const html = `
    <p>亲爱的用户您好：</p>
    <p>您正在使用 AI衣柜 平台进行登录/操作验证，本次验证码为：</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
    <p>请在 5 分钟内完成输入，验证码仅供本人使用，请勿转发他人。</p>
    <p>如果这不是您的操作，请忽略本邮件或及时联系客服。</p>
    <p>—— AI衣柜团队</p>
  `;

  await transporter.sendMail({
    from: `${smtpFromName} <${smtpFrom}>`,
    to,
    subject: '【AI衣柜】您的登录验证码',
    html,
    text: `您的验证码为 ${code} ，5 分钟内有效。如非本人操作请忽略。`
  });
}
