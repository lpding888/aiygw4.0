#!/usr/bin/env node

/**
 * Lighthouse 可访问性自动化检查脚本
 * 用于检查关键页面的可访问性得分
 *
 * 使用方法：
 * node scripts/lighthouse-a11y.js
 *
 * 环境变量：
 * BASE_URL - 网站基础URL（默认：http://localhost:3000）
 * MIN_SCORE - 最低可访问性得分（默认：90）
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const MIN_SCORE = parseInt(process.env.MIN_SCORE || '90', 10);
const REPORT_DIR = path.join(__dirname, '../lighthouse-reports');

// 需要检查的关键页面
const PAGES_TO_CHECK = [
  { url: '/', name: '首页' },
  { url: '/workspace/templates', name: '模板中心' },
  { url: '/workspace/studio', name: 'AI商拍工作室' },
  { url: '/workspace/editor', name: '画布编辑器' },
  { url: '/workspace/lookbook', name: 'Lookbook生成' },
  { url: '/tools/short-video', name: '短视频生成' },
  { url: '/tools/image-translate', name: '图片翻译' },
];

// Lighthouse配置
const lighthouseConfig = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['accessibility'],
    formFactor: 'desktop',
    screenEmulation: {
      mobile: false,
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      disabled: false,
    },
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
  },
};

/**
 * 启动Chrome并运行Lighthouse检查
 */
async function runLighthouse(url) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
  });

  try {
    const runnerResult = await lighthouse(url, {
      port: chrome.port,
      ...lighthouseConfig,
    });

    return runnerResult;
  } finally {
    await chrome.kill();
  }
}

/**
 * 保存报告
 */
function saveReport(pageName, report, score) {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${pageName}-${timestamp}.html`;
  const filepath = path.join(REPORT_DIR, filename);

  fs.writeFileSync(filepath, report);
  console.log(`📄 报告已保存: ${filepath}`);
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始可访问性检查...\n');
  console.log(`📍 基础URL: ${BASE_URL}`);
  console.log(`🎯 最低得分要求: ${MIN_SCORE}\n`);

  const results = [];
  let allPassed = true;

  for (const page of PAGES_TO_CHECK) {
    const url = `${BASE_URL}${page.url}`;
    console.log(`\n🔍 检查中: ${page.name} (${url})`);

    try {
      const runnerResult = await runLighthouse(url);
      const { lhr, report } = runnerResult;

      // 获取可访问性得分（0-100）
      const a11yScore = lhr.categories.accessibility.score * 100;
      const passed = a11yScore >= MIN_SCORE;

      results.push({
        name: page.name,
        url: page.url,
        score: a11yScore,
        passed,
      });

      // 保存详细报告
      saveReport(page.name.replace(/\s+/g, '-'), report, a11yScore);

      // 打印结果
      const emoji = passed ? '✅' : '❌';
      console.log(`${emoji} ${page.name}: ${a11yScore.toFixed(1)} 分`);

      // 打印主要问题
      if (!passed) {
        allPassed = false;
        const audits = lhr.categories.accessibility.auditRefs;
        const failedAudits = audits
          .filter((ref) => {
            const audit = lhr.audits[ref.id];
            return audit.score !== null && audit.score < 1;
          })
          .slice(0, 5); // 只显示前5个问题

        if (failedAudits.length > 0) {
          console.log('  主要问题:');
          failedAudits.forEach((ref) => {
            const audit = lhr.audits[ref.id];
            console.log(`  - ${audit.title}`);
          });
        }
      }
    } catch (error) {
      console.error(`❌ 检查失败: ${error.message}`);
      allPassed = false;
    }
  }

  // 打印总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 检查总结\n');

  results.forEach((result) => {
    const emoji = result.passed ? '✅' : '❌';
    console.log(`${emoji} ${result.name}: ${result.score.toFixed(1)} 分`);
  });

  console.log('\n' + '='.repeat(60));

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const passRate = ((passedCount / totalCount) * 100).toFixed(1);

  console.log(`\n通过率: ${passedCount}/${totalCount} (${passRate}%)`);

  if (allPassed) {
    console.log('\n🎉 所有页面可访问性检查通过！');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分页面未达标，请查看详细报告进行优化。');
    console.log(`📁 报告目录: ${REPORT_DIR}`);
    process.exit(1);
  }
}

// 检查是否安装了lighthouse
try {
  require.resolve('lighthouse');
  require.resolve('chrome-launcher');
} catch (error) {
  console.error('❌ 缺少依赖，请先安装：');
  console.error('npm install --save-dev lighthouse chrome-launcher');
  process.exit(1);
}

// 运行主函数
main().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
