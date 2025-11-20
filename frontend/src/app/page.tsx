'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Row, Col, Divider } from 'antd';
import {
  ArrowRightOutlined,
  ThunderboltFilled,
  CameraOutlined,
  SkinOutlined,
  ScissorOutlined,
  GlobalOutlined,
  SafetyCertificateFilled,
  RocketFilled
} from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';

/**
 * HomePage - 首页 (Visionary Tech - Chinese Unicorn Edition)
 * 风格：Apple / OpenAI / Linear
 * 核心概念：未来时尚基础设施 + 顶级专业团队
 */
export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>

      {/* 1. 导航栏 (极简) */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(20px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid rgba(0,0,0,0.05)'
      }}>
        <div style={{ fontWeight: 700, fontSize: '20px', letterSpacing: '-0.5px' }}>
          AI.FASHION <span style={{ fontSize: '12px', fontWeight: 400, color: '#86868B', marginLeft: '8px' }}>PRO</span>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {user ? (
            <button className="btn-vision" onClick={() => router.push('/workspace')}>
              进入控制台
            </button>
          ) : (
            <>
              <button
                className="btn-vision-secondary"
                onClick={() => router.push('/login')}
                style={{ padding: '8px 20px', fontSize: '14px' }}
              >
                登录
              </button>
              <button
                className="btn-vision"
                onClick={() => router.push('/login')}
                style={{ padding: '8px 20px', fontSize: '14px' }}
              >
                免费试用
              </button>
            </>
          )}
        </div>
      </nav>

      {/* 2. Hero 区域 (定义标准) */}
      <section style={{
        padding: '180px 24px 120px',
        maxWidth: '1200px',
        margin: '0 auto',
        textAlign: 'center'
      }}>
        <div className="animate-fade-up">
          <div style={{
            display: 'inline-block',
            padding: '6px 16px',
            background: '#F5F5F7',
            borderRadius: '99px',
            color: '#0071E3',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '24px'
          }}>
            全新 4.0 版本发布
          </div>
          <h1 className="hero-title" style={{ marginBottom: '24px' }}>
            重塑电商视觉流，<br />
            定义未来时尚标准。
          </h1>
          <p className="hero-subtitle" style={{ maxWidth: '640px', margin: '0 auto 48px' }}>
            您的 AI 首席设计团队已就位。从拍摄到修图，全流程智能化。<br />
            基于百亿级时尚图库训练，懂面料，更懂光影。
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button
              className="btn-vision"
              onClick={() => router.push(user ? '/workspace' : '/login')}
              style={{ padding: '20px 48px', fontSize: '18px' }}
            >
              立即体验 <ArrowRightOutlined />
            </button>
          </div>
        </div>

        {/* 视觉演示 (Visual Demo) - 全球算力网络 */}
        <div className="animate-fade-up delay-200" style={{
          marginTop: '100px',
          borderRadius: '32px',
          overflow: 'hidden',
          boxShadow: '0 40px 80px rgba(0,0,0,0.12)',
          position: 'relative',
          background: '#000',
          aspectRatio: '21/9',
          color: '#FFF'
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'url(/images/global_network.png) center/cover',
            opacity: 0.8
          }} />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, #000 0%, transparent 100%)'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '40px',
            left: '40px',
            textAlign: 'left'
          }}>
            <div style={{ fontSize: '14px', color: '#86868B', marginBottom: '8px', letterSpacing: '1px' }}>INFRASTRUCTURE</div>
            <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>全球算力网络</div>
            <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)' }}>12 个数据中心 · 千卡集群 · 毫秒级响应</div>
          </div>
        </div>
      </section>

      {/* 3. Bento Grid 功能区 (专业团队) */}
      <section style={{
        padding: '120px 24px',
        background: '#F5F5F7'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '80px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-1px', marginBottom: '16px' }}>
              不仅仅是工具，<br />更是您的顶级创意团队。
            </h2>
            <p style={{ fontSize: '20px', color: '#86868B' }}>
              全天候待命，无需沟通成本，输出即是行业标准。
            </p>
          </div>

          {/* Grid 布局 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gridTemplateRows: 'repeat(2, minmax(320px, auto))',
            gap: '24px'
          }}>

            {/* 卡片 1: AI 首席摄影师 (大) */}
            <div className="bento-card bento-card-dark" style={{ gridColumn: 'span 8', gridRow: 'span 2' }}>
              {/* 背景图 */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'url(/images/photographer.png) center/cover',
                opacity: 0.7,
                transition: 'transform 0.7s ease'
              }} className="card-bg" />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 100%)',
                zIndex: 1
              }} />

              <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <CameraOutlined style={{ fontSize: '24px', color: '#FFF' }} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', letterSpacing: '1px' }}>CORE MODULE</span>
                  </div>
                  <h3 style={{ fontSize: '40px', fontWeight: 700, marginBottom: '16px' }}>AI 首席摄影师</h3>
                  <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.9)', maxWidth: '480px', lineHeight: '1.6' }}>
                    无需租赁影棚，无需预约模特。上传平铺图，即刻生成媲美《VOGUE》大片的商业摄影作品。支持全球 50+ 种地域面孔，完美适配跨境电商。
                  </p>
                </div>
                <div style={{ marginTop: '40px' }}>
                  <button className="btn-vision" style={{ background: '#FFF', color: '#000' }}>
                    开始创作 <ArrowRightOutlined />
                  </button>
                </div>
              </div>
            </div>

            {/* 卡片 2: AI 搭配总监 (中) */}
            <div className="bento-card" style={{ gridColumn: 'span 4', gridRow: 'span 1' }}>
              <div style={{ position: 'relative', zIndex: 2 }}>
                <SkinOutlined style={{ fontSize: '32px', color: '#0071E3', marginBottom: '24px' }} />
                <h3 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px' }}>AI 搭配总监</h3>
                <p style={{ color: '#86868B', lineHeight: '1.6', fontSize: '14px' }}>
                  洞察全球流行趋势，一键生成爆款搭配。让单品不再孤单，提升连带率。
                </p>
              </div>
              {/* 底部配图 */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                left: 0,
                height: '120px',
                background: 'url(/images/stylist.png) center/cover',
                maskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
                opacity: 0.8
              }} />
            </div>

            {/* 卡片 3: AI 视觉工程师 (中) */}
            <div className="bento-card" style={{ gridColumn: 'span 4', gridRow: 'span 1' }}>
              <div style={{ position: 'relative', zIndex: 2 }}>
                <ScissorOutlined style={{ fontSize: '32px', color: '#FF9500', marginBottom: '24px' }} />
                <h3 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px' }}>AI 视觉工程师</h3>
                <p style={{ color: '#86868B', lineHeight: '1.6', fontSize: '14px' }}>
                  像素级精修，自动处理复杂边缘与透明材质。还原面料真实质感，拒绝“塑料感”。
                </p>
              </div>
              {/* 底部配图 */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                left: 0,
                height: '120px',
                background: 'url(/images/engineer.png) center/cover',
                maskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
                opacity: 0.8
              }} />
            </div>

          </div>

          {/* 第二行 Grid (数据与安全) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
            marginTop: '24px'
          }}>
            <div className="bento-card">
              <GlobalOutlined style={{ fontSize: '32px', marginBottom: '24px', color: '#1D1D1F' }} />
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>全球网络</h3>
              <p style={{ color: '#86868B', fontSize: '14px' }}>CDN 节点覆盖全球，创意即刻送达。</p>
            </div>
            <div className="bento-card">
              <SafetyCertificateFilled style={{ fontSize: '32px', marginBottom: '24px', color: '#34C759' }} />
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>企业级安全</h3>
              <p style={{ color: '#86868B', fontSize: '14px' }}>银行级数据加密，保障设计资产安全。</p>
            </div>
            <div className="bento-card">
              <RocketFilled style={{ fontSize: '32px', marginBottom: '24px', color: '#5856D6' }} />
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>10倍效率</h3>
              <p style={{ color: '#86868B', fontSize: '14px' }}>从 3 天缩短至 3 分钟，上新快人一步。</p>
            </div>
          </div>

        </div>
      </section>

      {/* 4. 行业影响力 (Social Proof) */}
      <section style={{ padding: '100px 24px', textAlign: 'center', background: '#FFF' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#86868B', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '40px' }}>
            TRUSTED BY 500+ INDUSTRY LEADERS
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '60px', opacity: 0.4, filter: 'grayscale(100%)' }}>
            {/* 模拟 Logo */}
            <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'Arial' }}>NIKE</div>
            <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'Times New Roman' }}>ZARA</div>
            <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'Helvetica' }}>SHEIN</div>
            <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'Impact' }}>UNIQLO</div>
          </div>

          <div style={{ marginTop: '80px', padding: '40px', background: '#F5F5F7', borderRadius: '24px' }}>
            <p style={{ fontSize: '24px', fontWeight: 500, fontStyle: 'italic', color: '#1D1D1F', marginBottom: '24px' }}>
              "AI.FASHION 彻底改变了我们的上新流程。它不是一个工具，而是我们最核心的生产力部门。"
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', background: '#DDD', borderRadius: '50%' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>Sarah Chen</div>
                <div style={{ fontSize: '12px', color: '#86868B' }}>某跨境电商独角兽 运营总监</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 底部 CTA */}
      <section style={{ padding: '120px 24px', background: '#000', color: '#FFF', textAlign: 'center' }}>
        <h2 style={{ fontSize: '48px', fontWeight: 700, marginBottom: '24px' }}>
          准备好引领行业变革了吗？
        </h2>
        <p style={{ fontSize: '20px', color: '#86868B', marginBottom: '48px' }}>
          加入数千家先锋企业的行列，开启智能时尚时代。
        </p>
        <button
          className="btn-vision"
          style={{ background: '#FFF', color: '#000', padding: '20px 60px', fontSize: '20px' }}
          onClick={() => router.push('/login')}
        >
          立即开始
        </button>
      </section>

    </div>
  );
}
