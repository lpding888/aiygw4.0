'use client';

import { useEffect, useState, Suspense } from 'react';
import { Tabs, Form, Input, Button, message, Modal, Typography, Segmented } from 'antd';
import { MobileOutlined, SafetyOutlined, LockOutlined, MailOutlined, GiftOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const { Text, Title } = Typography;

type PhoneCodeForm = {
  phone: string;
  code: string;
  referralCode?: string;
};

type PhonePasswordForm = {
  phone: string;
  password: string;
};

type EmailCodeForm = {
  email: string;
  code: string;
};

type EmailRegisterForm = {
  email: string;
  code: string;
  password: string;
  referralCode?: string;
};

type SetPasswordForm = {
  password: string;
};

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  // ========== 邀请码处理 ==========
  const initialReferralCode = searchParams?.get('ref') || searchParams?.get('referralCode') || '';

  // ========== 外层：登录/注册模式 ==========
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // ========== 内层：具体方式 ==========
  const [loginMethod, setLoginMethod] = useState<'code' | 'password' | 'email'>('email');
  const [registerMethod, setRegisterMethod] = useState<'phone' | 'email'>('email');

  // ========== 表单实例 ==========
  const [phoneCodeForm] = Form.useForm<PhoneCodeForm>();
  const [phonePasswordForm] = Form.useForm<PhonePasswordForm>();
  const [emailCodeForm] = Form.useForm<EmailCodeForm>();
  const [emailRegisterForm] = Form.useForm<EmailRegisterForm>();
  const [setPasswordForm] = Form.useForm<SetPasswordForm>();

  // ========== 状态管理 ==========
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [phoneCodeCountdown, setPhoneCodeCountdown] = useState(0);
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [emailCodeCountdown, setEmailCodeCountdown] = useState(0);
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);

  // ========== 倒计时逻辑 ==========
  useEffect(() => {
    if (phoneCodeCountdown <= 0) return;
    const timer = window.setTimeout(() => setPhoneCodeCountdown((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phoneCodeCountdown]);

  useEffect(() => {
    if (emailCodeCountdown <= 0) return;
    const timer = window.setTimeout(() => setEmailCodeCountdown((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [emailCodeCountdown]);

  // ========== 发送手机验证码 ==========
  const handleSendPhoneCode = async () => {
    try {
      const phone = phoneCodeForm.getFieldValue('phone');
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        message.error('请输入正确的手机号');
        return;
      }
      setSendingPhoneCode(true);
      const response: any = await api.auth.sendCode(phone);

      if (response?.success === true) {
        message.success('验证码已发送');
        setPhoneCodeCountdown(60);
      } else {
        message.error(response?.error?.message || '验证码发送失败');
      }
    } catch (err: any) {
      message.error(err?.message || '验证码发送失败');
    } finally {
      setSendingPhoneCode(false);
    }
  };

  // ========== 发送邮箱验证码 ==========
  const handleSendEmailCode = async () => {
    try {
      const email = authMode === 'login'
        ? emailCodeForm.getFieldValue('email')
        : emailRegisterForm.getFieldValue('email');

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        message.error('请输入正确的邮箱地址');
        return;
      }
      setSendingEmailCode(true);

      const response: any = await api.auth.sendEmailCode(email);

      if (process.env.NODE_ENV === 'development') {
        console.log('[EmailCode] 响应数据:', response);
      }

      if (response && (response.success === true || response.success === 'true')) {
        message.success('验证码已发送到邮箱，请查收');
        setEmailCodeCountdown(60);
      } else {
        const errorMsg = response?.error?.message || response?.message || '验证码发送失败，请重试';
        if (process.env.NODE_ENV === 'development') {
          console.error('[EmailCode] 发送失败:', { response, errorMsg });
        }
        message.error(errorMsg);
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[EmailCode] 捕获异常:', err);
      }
      const errorMsg = err?.message || err?.error?.message || '网络错误，请检查连接后重试';
      message.error(errorMsg);
    } finally {
      setSendingEmailCode(false);
    }
  };

  // ========== 手机号验证码登录 ==========
  const onPhoneCodeLogin = async (values: PhoneCodeForm) => {
    try {
      setLoginLoading(true);
      const response: any = await api.auth.loginWithCode(values.phone, values.code);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || '登录失败，请重试');
      }
      handleLoginSuccess(response.data.data ?? response.data);
    } catch (err: any) {
      message.error(err?.message || '登录失败，请重试');
    } finally {
      setLoginLoading(false);
    }
  };

  // ========== 手机号密码登录 ==========
  const onPhonePasswordLogin = async (values: PhonePasswordForm) => {
    try {
      setLoginLoading(true);
      const response: any = await api.auth.loginWithPassword(values.phone, values.password);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || '登录失败，请检查账号密码');
      }
      handleLoginSuccess(response.data.data ?? response.data);
    } catch (err: any) {
      message.error(err?.message || '登录失败，请重试');
    } finally {
      setLoginLoading(false);
    }
  };

  // ========== 邮箱验证码登录 ==========
  const onEmailCodeLogin = async (values: EmailCodeForm) => {
    try {
      setLoginLoading(true);
      const response: any = await api.auth.loginWithEmail(values.email, values.code);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || '登录失败，请重试');
      }

      handleLoginSuccess(response.data?.data || response.data);
    } catch (err: any) {
      message.error(err?.message || '登录失败，请重试');
    } finally {
      setLoginLoading(false);
    }
  };

  // ========== 手机号验证码注册 ==========
  const onPhoneRegister = async (values: PhoneCodeForm) => {
    try {
      setRegisterLoading(true);
      const response: any = await api.auth.loginWithCode(
        values.phone,
        values.code,
        values.referralCode || null
      );
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || '注册失败，请重试');
      }
      handleLoginSuccess(response.data.data ?? response.data, true);
    } catch (err: any) {
      message.error(err?.message || '注册失败，请重试');
    } finally {
      setRegisterLoading(false);
    }
  };

  // ========== 邮箱+验证码+密码注册 ==========
  const onEmailRegister = async (values: EmailRegisterForm) => {
    try {
      setRegisterLoading(true);
      const response: any = await api.auth.registerWithEmail(
        values.email,
        values.code,
        values.password,
        values.referralCode || null
      );
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || '注册失败，请重试');
      }
      handleLoginSuccess(response.data.data ?? response.data, true);
    } catch (err: any) {
      message.error(err?.message || '注册失败，请重试');
    } finally {
      setRegisterLoading(false);
    }
  };

  // ========== 登录/注册成功处理 ==========
  const handleLoginSuccess = (payload: any, isRegister: boolean = false) => {
    if (!payload) {
      message.error('登录失败，未获取到登录信息');
      return;
    }

    const accessToken = payload.accessToken || payload.token || payload.access_token || null;
    const refreshToken = payload.refreshToken || payload.refresh_token || null;
    const user = payload.user || null;

    if (!accessToken) {
      message.error('登录失败，缺少访问凭证');
      return;
    }

    setAuth(user, accessToken, refreshToken);

    if (isRegister || payload.needSetPassword || user?.hasPassword === false) {
      message.success(isRegister ? '注册成功！建议设置密码以便后续快捷登录' : '登录成功，请设置密码');
      setPwdModalOpen(true);
    } else {
      message.success(isRegister ? '注册成功！' : '登录成功');
      router.push('/workspace');
    }
  };

  // ========== 设置密码 ==========
  const onSetPassword = async (values: SetPasswordForm) => {
    try {
      setSettingPassword(true);
      const response: any = await api.auth.setPassword(values.password);
      if (response.data?.success === false) {
        throw new Error(response.data?.error?.message || '密码设置失败');
      }
      message.success(response.data?.message || '密码设置成功');
      setPwdModalOpen(false);
      router.push('/workspace');
    } catch (err: any) {
      message.error(err?.message || '密码设置失败，请重试');
    } finally {
      setSettingPassword(false);
    }
  };

  // ========== 渲染登录表单 ==========
  const renderLoginForms = () => {
    const items = [
      {
        key: 'email',
        label: '邮箱',
        children: (
          <Form layout="vertical" form={emailCodeForm} onFinish={onEmailCodeLogin} autoComplete="off" requiredMark={false}>
            <Form.Item
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '请输入正确的邮箱地址' },
              ]}
            >
              <Input prefix={<MailOutlined style={{ color: '#86868B' }} />} placeholder="企业邮箱地址" size="large" />
            </Form.Item>

            <Form.Item
              name="code"
              rules={[
                { required: true, message: '请输入验证码' },
                { pattern: /^\d{6}$/, message: '验证码为6位数字' },
              ]}
            >
              <div style={{ display: 'flex', gap: '12px' }}>
                <Input prefix={<SafetyOutlined style={{ color: '#86868B' }} />} placeholder="6位验证码" maxLength={6} size="large" />
                <Button
                  size="large"
                  onClick={handleSendEmailCode}
                  disabled={emailCodeCountdown > 0}
                  loading={sendingEmailCode}
                  style={{ width: '120px', borderRadius: '12px' }}
                >
                  {emailCodeCountdown > 0 ? `${emailCodeCountdown}s` : '获取'}
                </Button>
              </div>
            </Form.Item>

            <div style={{ marginBottom: '16px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                * 未注册邮箱验证后将自动创建账号
              </Text>
            </div>

            <Form.Item>
              <Button
                htmlType="submit"
                loading={loginLoading}
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
        key: 'code',
        label: '手机验证码',
        children: (
          <Form layout="vertical" form={phoneCodeForm} onFinish={onPhoneCodeLogin} autoComplete="off" requiredMark={false}>
            <Form.Item
              name="phone"
              rules={[
                { required: true, message: '请输入手机号' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
              ]}
            >
              <Input prefix={<MobileOutlined style={{ color: '#86868B' }} />} placeholder="请输入手机号" maxLength={11} size="large" />
            </Form.Item>

            <Form.Item
              name="code"
              rules={[
                { required: true, message: '请输入验证码' },
                { pattern: /^\d{6}$/, message: '验证码为6位数字' },
              ]}
            >
              <div style={{ display: 'flex', gap: '12px' }}>
                <Input prefix={<SafetyOutlined style={{ color: '#86868B' }} />} placeholder="6位验证码" maxLength={6} size="large" />
                <Button
                  size="large"
                  onClick={handleSendPhoneCode}
                  disabled={phoneCodeCountdown > 0}
                  loading={sendingPhoneCode}
                  style={{ width: '120px', borderRadius: '12px' }}
                >
                  {phoneCodeCountdown > 0 ? `${phoneCodeCountdown}s` : '获取'}
                </Button>
              </div>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loginLoading}
                block
                className="btn-vision"
                style={{ height: '48px', fontSize: '16px' }}
              >
                登录
              </Button>
            </Form.Item>
          </Form>
        ),
      },
      {
        key: 'password',
        label: '密码',
        children: (
          <Form layout="vertical" form={phonePasswordForm} onFinish={onPhonePasswordLogin} autoComplete="off" requiredMark={false}>
            <Form.Item
              name="phone"
              rules={[
                { required: true, message: '请输入手机号' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
              ]}
            >
              <Input prefix={<MobileOutlined style={{ color: '#86868B' }} />} placeholder="请输入手机号" maxLength={11} size="large" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码不少于6位' },
              ]}
            >
              <Input.Password prefix={<LockOutlined style={{ color: '#86868B' }} />} placeholder="请输入密码" size="large" />
            </Form.Item>

            <div style={{ textAlign: 'right', marginBottom: '16px' }}>
              <a
                onClick={() => {
                  message.info('请使用邮箱验证码登录后重置密码');
                  setLoginMethod('email');
                }}
                style={{ color: '#86868B', fontSize: '14px' }}
              >
                忘记密码？
              </a>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loginLoading}
                block
                className="btn-vision"
                style={{ height: '48px', fontSize: '16px' }}
              >
                登录
              </Button>
            </Form.Item>
          </Form>
        ),
      },
    ];

    return <Tabs activeKey={loginMethod} onChange={(key: any) => setLoginMethod(key)} items={items} />;
  };

  // ========== 渲染注册表单 ==========
  const renderRegisterForms = () => {
    const items = [
      {
        key: 'email',
        label: '邮箱注册',
        children: (
          <Form
            layout="vertical"
            form={emailRegisterForm}
            onFinish={onEmailRegister}
            autoComplete="off"
            requiredMark={false}
            initialValues={{ referralCode: initialReferralCode }}
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '请输入正确的邮箱地址' },
              ]}
            >
              <Input prefix={<MailOutlined style={{ color: '#86868B' }} />} placeholder="企业邮箱地址" size="large" />
            </Form.Item>

            <Form.Item
              name="code"
              rules={[
                { required: true, message: '请输入验证码' },
                { pattern: /^\d{6}$/, message: '验证码为6位数字' },
              ]}
            >
              <div style={{ display: 'flex', gap: '12px' }}>
                <Input prefix={<SafetyOutlined style={{ color: '#86868B' }} />} placeholder="6位验证码" maxLength={6} size="large" />
                <Button
                  size="large"
                  onClick={handleSendEmailCode}
                  disabled={emailCodeCountdown > 0}
                  loading={sendingEmailCode}
                  style={{ width: '120px', borderRadius: '12px' }}
                >
                  {emailCodeCountdown > 0 ? `${emailCodeCountdown}s` : '获取'}
                </Button>
              </div>
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请设置密码' },
                { min: 6, message: '密码不少于6位' },
              ]}
            >
              <Input.Password prefix={<LockOutlined style={{ color: '#86868B' }} />} placeholder="请设置至少6位的密码" size="large" />
            </Form.Item>

            <Form.Item name="referralCode">
              <Input prefix={<GiftOutlined style={{ color: '#86868B' }} />} placeholder="邀请码（选填）" size="large" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={registerLoading}
                block
                className="btn-vision"
                style={{ height: '48px', fontSize: '16px' }}
              >
                注册
              </Button>
            </Form.Item>
          </Form>
        ),
      },
      {
        key: 'phone',
        label: '手机号注册',
        children: (
          <Form
            layout="vertical"
            form={phoneCodeForm}
            onFinish={onPhoneRegister}
            autoComplete="off"
            requiredMark={false}
            initialValues={{ referralCode: initialReferralCode }}
          >
            <Form.Item
              name="phone"
              rules={[
                { required: true, message: '请输入手机号' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
              ]}
            >
              <Input prefix={<MobileOutlined style={{ color: '#86868B' }} />} placeholder="请输入手机号" maxLength={11} size="large" />
            </Form.Item>

            <Form.Item
              name="code"
              rules={[
                { required: true, message: '请输入验证码' },
                { pattern: /^\d{6}$/, message: '验证码为6位数字' },
              ]}
            >
              <div style={{ display: 'flex', gap: '12px' }}>
                <Input prefix={<SafetyOutlined style={{ color: '#86868B' }} />} placeholder="6位验证码" maxLength={6} size="large" />
                <Button
                  size="large"
                  onClick={handleSendPhoneCode}
                  disabled={phoneCodeCountdown > 0}
                  loading={sendingPhoneCode}
                  style={{ width: '120px', borderRadius: '12px' }}
                >
                  {phoneCodeCountdown > 0 ? `${phoneCodeCountdown}s` : '获取'}
                </Button>
              </div>
            </Form.Item>

            <Form.Item name="referralCode">
              <Input prefix={<GiftOutlined style={{ color: '#86868B' }} />} placeholder="邀请码（选填）" size="large" />
            </Form.Item>

            <div style={{ marginBottom: '16px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                * 注册成功后可以选择设置密码，方便下次快捷登录
              </Text>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={registerLoading}
                block
                className="btn-vision"
                style={{ height: '48px', fontSize: '16px' }}
              >
                注册
              </Button>
            </Form.Item>
          </Form>
        ),
      },
    ];

    return <Tabs activeKey={registerMethod} onChange={(key: any) => setRegisterMethod(key)} items={items} />;
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
        width: '480px',
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

        {/* 登录/注册模式切换 */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
          <Segmented
            options={[
              { label: '登录', value: 'login' },
              { label: '注册', value: 'register' },
            ]}
            value={authMode}
            onChange={(value) => setAuthMode(value as 'login' | 'register')}
            size="large"
            style={{
              fontWeight: 500,
              background: 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(10px)'
            }}
          />
        </div>

        {/* 表单区域 */}
        {authMode === 'login' ? renderLoginForms() : renderRegisterForms()}

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

      {/* 设置密码弹窗 */}
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
            设置后，您可以使用密码直接登录。
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F5F5F7'
      }}>
        <div className="glass-panel" style={{
          width: '480px',
          padding: '48px',
          background: 'rgba(255,255,255,0.8)',
          textAlign: 'center'
        }}>
          <Title level={2} style={{ color: '#86868B' }}>加载中...</Title>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
