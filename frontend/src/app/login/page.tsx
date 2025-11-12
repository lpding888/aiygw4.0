'use client';

import { useEffect, useState } from 'react';
import { Tabs, Form, Input, Button, message, Modal, Typography, Card } from 'antd';
import { MobileOutlined, SafetyOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const { Text, Title } = Typography;

type CodeLoginForm = {
  phone: string;
  code: string;
};

type PasswordLoginForm = {
  phone: string;
  password: string;
};

type SetPasswordForm = {
  password: string;
};

type EmailLoginForm = {
  email: string;
  code: string;
};

type EmailRegisterForm = {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
};

type EmailResetForm = {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
};

type EmailScene = 'login' | 'register' | 'reset';

export default function LoginPage() {
  const [codeForm] = Form.useForm<CodeLoginForm>();
  const [passwordForm] = Form.useForm<PasswordLoginForm>();
  const [setPasswordForm] = Form.useForm<SetPasswordForm>();
  const [emailLoginForm] = Form.useForm<EmailLoginForm>();
  const [emailRegisterForm] = Form.useForm<EmailRegisterForm>();
  const [emailResetForm] = Form.useForm<EmailResetForm>();

  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [mode, setMode] = useState<'code' | 'password' | 'email-login' | 'email-register'>('code');
  const [sendingCode, setSendingCode] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [codeLoading, setCodeLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [emailCountdowns, setEmailCountdowns] = useState<Record<EmailScene, number>>({
    login: 0,
    register: 0,
    reset: 0,
  });
  const [emailSendingScene, setEmailSendingScene] = useState<EmailScene | null>(null);
  const [emailLoginLoading, setEmailLoginLoading] = useState(false);
  const [emailRegisterLoading, setEmailRegisterLoading] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const emailRules = [
    { required: true, message: '请输入邮箱' },
    { type: 'email' as const, message: '请输入有效的邮箱地址' }
  ];

  useEffect(() => {
    if (codeCountdown <= 0) return;
    const timer = window.setTimeout(() => setCodeCountdown((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [codeCountdown]);

  useEffect(() => {
    if (!Object.values(emailCountdowns).some((value) => value > 0)) {
      return;
    }
    const timer = window.setTimeout(() => {
      setEmailCountdowns((prev) => {
        const next = { ...prev };
        (Object.keys(next) as EmailScene[]).forEach((key) => {
          if (next[key] > 0) {
            next[key] -= 1;
          }
        });
        return next;
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [emailCountdowns]);

  const handleSendCode = async () => {
    try {
      const phone = codeForm.getFieldValue('phone');
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        message.error('请输入正确的手机号');
        return;
      }
      setSendingCode(true);
      const response: any = await api.auth.sendCode(phone);
      if (response?.success) {
        message.success('验证码已发送');
        setCodeCountdown(60);
      } else {
        message.error(response?.error?.message || '验证码发送失败');
      }
    } catch (err: any) {
      message.error(err?.message || '验证码发送失败');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSendEmailCode = async (scene: EmailScene) => {
    const form =
      scene === 'login' ? emailLoginForm : scene === 'register' ? emailRegisterForm : emailResetForm;
    try {
      await form.validateFields(['email']);
      const email = form.getFieldValue('email');
      if (!email) {
        return;
      }
      setEmailSendingScene(scene);
      const response: any = await api.auth.sendEmailCode(email, scene);
      if (response?.success === false) {
        throw new Error(response?.error?.message || '验证码发送失败');
      }
      message.success('验证码已发送');
      setEmailCountdowns((prev) => ({ ...prev, [scene]: 60 }));
    } catch (err: any) {
      if (err?.errorFields) {
        return;
      }
      message.error(err?.message || '验证码发送失败');
    } finally {
      setEmailSendingScene(null);
    }
  };

  const onCodeLogin = async (values: CodeLoginForm) => {
    try {
      setCodeLoading(true);
      const response: any = await api.auth.loginWithCode(values.phone, values.code);
      if (!response?.success) {
        throw new Error(response?.error?.message || '登录失败，请重试');
      }
      handleLoginSuccess(response.data ?? response);
    } catch (err: any) {
      message.error(err?.message || '登录失败，请重试');
    } finally {
      setCodeLoading(false);
    }
  };

  const onPasswordLogin = async (values: PasswordLoginForm) => {
    try {
      setPasswordLoading(true);
      const response: any = await api.auth.loginWithPassword(values.phone, values.password);
      if (!response?.success) {
        throw new Error(response?.error?.message || '登录失败，请检查账号密码');
      }
      handleLoginSuccess(response.data ?? response);
    } catch (err: any) {
      message.error(err?.message || '登录失败，请重试');
    } finally {
      setPasswordLoading(false);
    }
  };

  const onEmailLogin = async (values: EmailLoginForm) => {
    try {
      setEmailLoginLoading(true);
      const response: any = await api.auth.loginWithEmailCode(values.email, values.code);
      if (!response?.success) {
        throw new Error(response?.error?.message || '登录失败，请重试');
      }
      handleLoginSuccess(response.data ?? response);
    } catch (err: any) {
      message.error(err?.message || '登录失败，请重试');
    } finally {
      setEmailLoginLoading(false);
    }
  };

  const onEmailRegister = async (values: EmailRegisterForm) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }
    try {
      setEmailRegisterLoading(true);
      const response: any = await api.auth.registerWithEmail(
        values.email,
        values.code,
        values.password
      );
      if (!response?.success) {
        throw new Error(response?.error?.message || '注册失败，请重试');
      }
      handleLoginSuccess(response.data ?? response);
    } catch (err: any) {
      message.error(err?.message || '注册失败，请重试');
    } finally {
      setEmailRegisterLoading(false);
    }
  };

  const onEmailReset = async (values: EmailResetForm) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }
    try {
      setResetSubmitting(true);
      const response: any = await api.auth.resetPassword({
        email: values.email,
        code: values.code,
        newPassword: values.newPassword
      });
      if (response?.success === false) {
        throw new Error(response?.error?.message || '密码重置失败');
      }
      message.success(response?.message || '密码重置成功');
      setResetModalOpen(false);
      emailResetForm.resetFields();
      setEmailCountdowns((prev) => ({ ...prev, reset: 0 }));
    } catch (err: any) {
      message.error(err?.message || '密码重置失败，请重试');
    } finally {
      setResetSubmitting(false);
    }
  };

  const openResetModal = () => {
    emailResetForm.resetFields();
    setEmailCountdowns((prev) => ({ ...prev, reset: 0 }));
    setResetModalOpen(true);
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

    if (payload.needSetPassword || user?.hasPassword === false) {
      message.success('登录成功，请设置密码');
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
      if (response?.success === false) {
        throw new Error(response?.error?.message || '密码设置失败');
      }
      message.success(response?.message || '密码设置成功');
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
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#F9FAFB',
      padding: '20px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: '400px',
          border: '1px solid var(--border-primary)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
          borderRadius: '12px'
        }}
        bodyStyle={{ padding: 32 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            AI服装处理平台
          </Title>
          <Text type="secondary">手机号 / 邮箱验证码或密码任你选，首次登录可立即设置密码</Text>
        </div>

        <Tabs
          activeKey={mode}
          onChange={(key) =>
            setMode(key as 'code' | 'password' | 'email-login' | 'email-register')
          }
          items={[
            {
              key: 'code',
              label: '验证码登录',
              children: (
                <Form
                  layout="vertical"
                  form={codeForm}
                  onFinish={onCodeLogin}
                  autoComplete="off"
                >
                  <Form.Item
                    name="phone"
                    label="手机号"
                    rules={[
                      { required: true, message: '请输入手机号' },
                      {
                        pattern: /^1[3-9]\d{9}$/,
                        message: '请输入正确的手机号',
                      },
                    ]}
                  >
                    <Input
                      prefix={<MobileOutlined />}
                      placeholder="请输入手机号"
                      maxLength={11}
                    />
                  </Form.Item>

                  <Form.Item
                    name="code"
                    label="验证码"
                    rules={[
                      { required: true, message: '请输入验证码' },
                      {
                        pattern: /^\d{6}$/,
                        message: '验证码为6位数字',
                      },
                    ]}
                  >
                    <Input
                      prefix={<SafetyOutlined />}
                      placeholder="请输入6位验证码"
                      maxLength={6}
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      block
                      onClick={handleSendCode}
                      disabled={codeCountdown > 0}
                      loading={sendingCode}
                    >
                      {codeCountdown > 0
                        ? `${codeCountdown}秒后重试`
                        : '获取验证码'}
                    </Button>
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={codeLoading}
                      block
                    >
                      登录
                    </Button>
                  </Form.Item>

                  <div style={{ textAlign: 'right' }}>
                    <Button
                      type="link"
                      onClick={() => setMode('password')}
                      style={{ padding: 0 }}
                    >
                      使用密码登录
                    </Button>
                  </div>
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
                >
                  <Form.Item
                    name="phone"
                    label="手机号"
                    rules={[
                      { required: true, message: '请输入手机号' },
                      {
                        pattern: /^1[3-9]\d{9}$/,
                        message: '请输入正确的手机号',
                      },
                    ]}
                  >
                    <Input
                      prefix={<MobileOutlined />}
                      placeholder="请输入手机号"
                      maxLength={11}
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label="密码"
                    rules={[
                      { required: true, message: '请输入密码' },
                      { min: 6, message: '密码不少于6位' },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="请输入密码"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={passwordLoading}
                      block
                    >
                      登录
                    </Button>
                  </Form.Item>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                      type="link"
                      onClick={() => setMode('code')}
                      style={{ padding: 0 }}
                    >
                      使用验证码登录
                    </Button>
                    <Button type="link" onClick={openResetModal} style={{ padding: 0 }}>
                      忘记密码？
                    </Button>
                  </div>
                </Form>
              ),
            },
            {
              key: 'email-login',
              label: '邮箱登录',
              children: (
                <Form
                  layout="vertical"
                  form={emailLoginForm}
                  onFinish={onEmailLogin}
                  autoComplete="off"
                >
                  <Form.Item name="email" label="邮箱" rules={emailRules}>
                    <Input
                      prefix={<MailOutlined />}
                      placeholder="请输入邮箱"
                      autoComplete="email"
                    />
                  </Form.Item>
                  <Form.Item label="验证码" required>
                    <Input.Group compact>
                      <Form.Item
                        name="code"
                        noStyle
                        rules={[
                          { required: true, message: '请输入验证码' },
                          {
                            pattern: /^\d{6}$/,
                            message: '验证码为6位数字',
                          },
                        ]}
                      >
                        <Input
                          placeholder="请输入6位验证码"
                          maxLength={6}
                          style={{ width: '60%' }}
                        />
                      </Form.Item>
                      <Button
                        style={{ width: '40%' }}
                        onClick={() => handleSendEmailCode('login')}
                        disabled={emailCountdowns.login > 0}
                        loading={emailSendingScene === 'login'}
                      >
                        {emailCountdowns.login > 0
                          ? `${emailCountdowns.login}秒后重试`
                          : '发送验证码'}
                      </Button>
                    </Input.Group>
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={emailLoginLoading}
                      block
                    >
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'email-register',
              label: '邮箱注册',
              children: (
                <Form
                  layout="vertical"
                  form={emailRegisterForm}
                  onFinish={onEmailRegister}
                  autoComplete="off"
                >
                  <Form.Item name="email" label="邮箱" rules={emailRules}>
                    <Input
                      prefix={<MailOutlined />}
                      placeholder="请输入常用邮箱"
                      autoComplete="email"
                    />
                  </Form.Item>
                  <Form.Item label="验证码" required>
                    <Input.Group compact>
                      <Form.Item
                        name="code"
                        noStyle
                        rules={[
                          { required: true, message: '请输入验证码' },
                          {
                            pattern: /^\d{6}$/,
                            message: '验证码为6位数字',
                          },
                        ]}
                      >
                        <Input
                          placeholder="请输入6位验证码"
                          maxLength={6}
                          style={{ width: '60%' }}
                        />
                      </Form.Item>
                      <Button
                        style={{ width: '40%' }}
                        onClick={() => handleSendEmailCode('register')}
                        disabled={emailCountdowns.register > 0}
                        loading={emailSendingScene === 'register'}
                      >
                        {emailCountdowns.register > 0
                          ? `${emailCountdowns.register}秒后重试`
                          : '发送验证码'}
                      </Button>
                    </Input.Group>
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label="设置密码"
                    rules={[
                      { required: true, message: '请输入密码' },
                      { min: 6, message: '密码不少于6位' },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="请输入至少6位的密码"
                    />
                  </Form.Item>
                  <Form.Item
                    name="confirmPassword"
                    label="确认密码"
                    dependencies={['password']}
                    rules={[
                      { required: true, message: '请再次输入密码' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('password') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('两次输入的密码不一致'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password placeholder="请再次输入密码" />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={emailRegisterLoading}
                      block
                    >
                      注册并登录
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />

        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <Button type="link" onClick={openResetModal} style={{ padding: 0 }}>
            使用邮箱验证码重置密码
          </Button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            登录即代表同意
            <a href="/legal/terms" style={{ color: '#92400E' }}> 用户协议 </a>
            和
            <a href="/legal/privacy" style={{ color: '#92400E' }}> 隐私政策</a>
          </Text>
        </div>

        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: '#F9FAFB',
          borderRadius: '8px'
        }}>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            <strong>提示:</strong>
            <br />
            • 手机/邮箱验证码1分钟内仅可发送1次，注意查收
            <br />
            • 首次登录将自动注册账号
            <br />
            • 新用户赠送3次免费体验
          </Text>
        </div>
      </Card>

      <Modal
        title="邮箱验证码重置密码"
        open={resetModalOpen}
        onCancel={() => setResetModalOpen(false)}
        okText="重置密码"
        onOk={() => emailResetForm.submit()}
        confirmLoading={resetSubmitting}
        destroyOnClose
      >
        <Form layout="vertical" form={emailResetForm} onFinish={onEmailReset}>
          <Form.Item name="email" label="邮箱" rules={emailRules}>
            <Input
              prefix={<MailOutlined />}
              placeholder="请输入注册邮箱"
              autoComplete="email"
            />
          </Form.Item>
          <Form.Item label="验证码" required>
            <Input.Group compact>
              <Form.Item
                name="code"
                noStyle
                rules={[
                  { required: true, message: '请输入验证码' },
                  { pattern: /^\d{6}$/, message: '验证码为6位数字' }
                ]}
              >
                <Input
                  placeholder="请输入6位验证码"
                  maxLength={6}
                  style={{ width: '60%' }}
                />
              </Form.Item>
              <Button
                style={{ width: '40%' }}
                onClick={() => handleSendEmailCode('reset')}
                disabled={emailCountdowns.reset > 0}
                loading={emailSendingScene === 'reset'}
              >
                {emailCountdowns.reset > 0
                  ? `${emailCountdowns.reset}秒后重试`
                  : '发送验证码'}
              </Button>
            </Input.Group>
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码不少于6位' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入至少6位的新密码"
            />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                }
              })
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="设置密码"
        open={pwdModalOpen}
        onCancel={() => setPwdModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Text type="secondary">
          首次登录建议设置密码，之后可直接使用密码快捷登录。
        </Text>
        <Form
          layout="vertical"
          form={setPasswordForm}
          onFinish={onSetPassword}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="password"
            label="设置新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码不少于6位' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入至少6位的密码"
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={settingPassword}
            block
          >
            保存
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
