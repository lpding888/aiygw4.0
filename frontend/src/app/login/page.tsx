'use client';

import { useEffect, useState } from 'react';
import { Tabs, Form, Input, Button, message, Modal, Typography } from 'antd';
import { MailOutlined, SafetyOutlined, LockOutlined, ArrowLeftOutlined, UserOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const { Text } = Typography;

type EmailLoginForm = {
  email: string;
  code: string;
};

type PasswordLoginForm = {
  account: string;
  password: string;
};

type SetPasswordForm = {
  password: string;
};

export default function LoginPage() {
  const [emailForm] = Form.useForm<EmailLoginForm>();
  const [passwordForm] = Form.useForm<PasswordLoginForm>();
  const [setPasswordForm] = Form.useForm<SetPasswordForm>();

  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [mode, setMode] = useState<'email' | 'password'>('email');
  const [sendingCode, setSendingCode] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);

  useEffect(() => {
    if (codeCountdown <= 0) return;
    const timer = window.setTimeout(() => setCodeCountdown((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [codeCountdown]);

  const handleSendEmailCode = async () => {
    try {
      const email = emailForm.getFieldValue('email');
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        message.error('请输入正确的邮箱地址');
        return;
      }
      setSendingCode(true);
      const response: any = await api.auth.sendEmailCode(email);
      if (response.data?.success || response.success) {
        message.success('验证码已发送到您的邮箱');
        setCodeCountdown(60);
      } else {
        message.error(response.data?.error?.message || response.message || '验证码发送失败');
      }
    } catch (err: any) {
      message.error(err?.message || '验证码发送失败，请检查网络连接');
    } finally {
      setSendingCode(false);
    }
  };

  const onEmailLogin = async (values: EmailLoginForm) => {
    try {
      setLoading(true);
      // 邮箱验证码登录（自动注册）
      const response: any = await api.auth.loginWithEmailCode(values.email, values.code);

      if (!response.success && !response.data?.success) {
        throw new Error(response.data?.error?.message || response.message || '登录失败，请重试');
      }

      handleLoginSuccess(response.data?.data || response.data);
    } catch (err: any) {
      message.error(err?.message || '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const onPasswordLogin = async (values: PasswordLoginForm) => {
    try {
      setLoading(true);
      // 密码登录（支持手机/邮箱）
      // 注意：后端 loginWithPassword 现在接受 account 参数
      const response: any = await api.auth.loginWithPassword(values.account, values.password);

      if (!response.success && !response.data?.success) {
        throw new Error(response.data?.error?.message || response.message || '登录失败，请检查账号密码');
      }

      handleLoginSuccess(response.data?.data || response.data);
    } catch (err: any) {
      message.error(err?.message || '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (payload: any) => {
    if (!payload) {
      message.error('登录失败，未获取到登录信息');
      return;
    }

    const accessToken =
      payload.accessToken ||
      payload.token ||
      payload.access_token ||
      null;
    const refreshToken =
      payload.refreshToken ||
      payload.refresh_token ||
      null;
    const user = payload.user || null;

    if (!accessToken) {
      message.error('登录失败，缺少访问凭证');
      return;
    }

    setAuth(user, accessToken, refreshToken);

    // 检查是否需要设置密码 (后端 SafeUser 现在包含 hasPassword)
    if (user?.hasPassword === false) {
      message.success('登录成功，建议您设置登录密码');
      setPwdModalOpen(true);
    } else {
      message.success('登录成功');
      router.push('/workspace');
    }
  };

  const onSetPassword = async (values: SetPasswordForm) => {
    try {
      setSettingPassword(true);
      const response: any = await api.auth.setPassword(values.password);
      if (response.data?.success === false) {
        throw new Error(response.data?.error?.message || '密码设置失败');
      }
      message.success(response.data?.message || '密码设置成功');
      setPasswordForm.resetFields();
      setPwdModalOpen(false);
      router.push('/workspace');
    } catch (err: any) {
      message.error(err?.message || '密码设置失败，请重试');
    } finally {
      setSettingPassword(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F5F5F7',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 背景装饰 - 模糊光斑 */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        left: '-10%',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(0,113,227,0.1) 0%, transparent 70%)',
        filter: 'blur(80px)',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-20%',
        right: '-10%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(255,149,0,0.05) 0%, transparent 70%)',
        filter: 'blur(80px)',
        zIndex: 0
      }} />

      {/* 登录卡片 */}
      <div className="glass-panel" style={{
        width: '440px',
        padding: '48px',
        background: 'rgba(255,255,255,0.8)',
        zIndex: 1,
        boxShadow: '0 20px 60px rgba(0,0,0,0.05)'
      }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div style={{
            fontSize: '24px',
            fontWeight: 700,
            marginBottom: '8px',
            letterSpacing: '-0.5px'
          }}>
            登录控制台
          </div>
          <div style={{ color: '#86868B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span>AI.FASHION</span>
            <span style={{ width: '4px', height: '4px', background: '#86868B', borderRadius: '50%' }} />
            <span>ENTERPRISE</span>
          </div>
        </div>

        <Tabs
          activeKey={mode}
          onChange={(key) => setMode(key as 'email' | 'password')}
          centered
          items={[
            {
              key: 'email',
              label: '邮箱登录/注册',
              children: (
                <Form
                  layout="vertical"
                  form={emailForm}
                  onFinish={onEmailLogin}
                  autoComplete="off"
                  requiredMark={false}
                  style={{ marginTop: '24px' }}
                >
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱地址' },
                      { type: 'email', message: '邮箱格式不正确' },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined style={{ color: '#86868B' }} />}
                      placeholder="企业邮箱地址"
                      size="large"
                    />
                  </Form.Item>

                  <Form.Item
                    name="code"
                    rules={[
                      { required: true, message: '请输入验证码' },
                      { pattern: /^\d{6}$/, message: '验证码格式不正确' },
                    ]}
                  >
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <Input
                        prefix={<SafetyOutlined style={{ color: '#86868B' }} />}
                        placeholder="6位验证码"
                        maxLength={6}
                        size="large"
                      />
                      <Button
                        size="large"
                        onClick={handleSendEmailCode}
                        disabled={codeCountdown > 0}
                        loading={sendingCode}
                        style={{ width: '120px', borderRadius: '12px' }}
                      >
                        {codeCountdown > 0 ? `${codeCountdown}s` : '获取'}
                      </Button>
                    </div>
                  </Form.Item>

                  <div style={{ marginBottom: '24px' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      * 未注册邮箱验证后将自动创建账号
                    </Text>
                  </div>

                  <Form.Item>
                    <Button
                      htmlType="submit"
                      loading={loading}
                      block
                      className="btn-vision"
                      style={{ height: '48px', fontSize: '16px', width: '100%' }}
                    >
                      登录 / 注册
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'password',
              label: '密码登录',
              children: (
                <Form
                  layout="vertical"
                  form={passwordForm}
                  onFinish={onPasswordLogin}
                  autoComplete="off"
                  requiredMark={false}
                  style={{ marginTop: '24px' }}
                >
                  <Form.Item
                    name="account"
                    rules={[{ required: true, message: '请输入手机号或邮箱' }]}
                  >
                    <Input
                      prefix={<UserOutlined style={{ color: '#86868B' }} />}
                      placeholder="手机号 / 邮箱"
                      size="large"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined style={{ color: '#86868B' }} />}
                      placeholder="密码"
                      size="large"
                    />
                  </Form.Item>

                  <div style={{ textAlign: 'right', marginBottom: '24px' }}>
                    <a
                      onClick={() => {
                        message.info('请使用邮箱验证码登录后重置密码');
                        setMode('email');
                      }}
                      style={{ color: '#86868B', fontSize: '14px' }}
                    >
                      忘记密码？
                    </a>
                  </div>

                  <Form.Item>
                    <Button
                      htmlType="submit"
                      loading={loading}
                      block
                      className="btn-vision"
                      style={{ height: '48px', fontSize: '16px', width: '100%' }}
                    >
                      登 录
                    </Button>
                  </Form.Item>
                </Form>
              ),
            }
          ]}
        />

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/')}
            style={{ color: '#86868B' }}
          >
            返回首页
          </Button>
        </div>
      </div>

      <Modal
        title="设置登录密码"
        open={pwdModalOpen}
        onCancel={() => {
          setPwdModalOpen(false);
          router.push('/workspace');
        }}
        footer={null}
        destroyOnClose
        centered
        maskClosable={false}
      >
        <div style={{ marginBottom: '24px' }}>
          <Text type="secondary">
            为了方便下次登录，建议您设置一个登录密码。
            <br />
            设置后，您可以使用 <b>邮箱+密码</b> 或 <b>手机号+密码</b> 直接登录。
          </Text>
        </div>
        <Form
          layout="vertical"
          form={setPasswordForm}
          onFinish={onSetPassword}
        >
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码不少于6位' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入至少6位的密码"
              size="large"
            />
          </Form.Item>
          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <Button
              block
              size="large"
              onClick={() => {
                setPwdModalOpen(false);
                router.push('/workspace');
              }}
            >
              暂不设置
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={settingPassword}
              block
              size="large"
              className="btn-vision"
            >
              确认设置
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
