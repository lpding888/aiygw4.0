'use client';

import HeroSection from '@/components/home/HeroSection';
import WorkflowSection from '@/components/home/WorkflowSection';
import FeatureShowcase from '@/components/home/FeatureShowcase';
import Testimonials from '@/components/home/Testimonials';
import Footer from '@/components/home/Footer';

/**
 * HomePage - 首页
 * 
 * 重构后的现代化首页，采用 Tailwind CSS + Framer Motion
 * 包含 Hero, Workflow, Features, Testimonials, Footer 五大板块
 */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <HeroSection />
      <WorkflowSection />
      <FeatureShowcase />
      <Testimonials />
      <Footer />
    </main>
  );
}
