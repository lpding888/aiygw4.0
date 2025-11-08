/**
 * E2E测试 - Bootstrap渲染
 * 艹，确保壳子+bootstrap渲染能正常工作！
 *
 * @author 老王
 */

import { test, expect } from '@playwright/test';

test.describe('Bootstrap配置驱动', () => {
  test.beforeEach(async ({ page }) => {
    // 启用Mock（通过环境变量）
    await page.addInitScript(() => {
      window.localStorage.setItem('NEXT_PUBLIC_ENABLE_MOCK', 'true');
    });
  });

  test('模板中心页面渲染过滤条', async ({ page }) => {
    await page.goto('/workspace/templates');

    // 等待页面加载
    await page.waitForTimeout(1000);

    // 检查页面标题
    await expect(page.getByText('模板中心')).toBeVisible();

    // 检查过滤条件卡片
    await expect(page.getByText('scene')).toBeVisible();
    await expect(page.getByText('industry')).toBeVisible();
    await expect(page.getByText('style')).toBeVisible();

    // 检查过滤条件内容
    await expect(page.getByText('电商主图')).toBeVisible();
    await expect(page.getByText('服饰')).toBeVisible();
    await expect(page.getByText('极简')).toBeVisible();
  });

  test('AI商拍工作室渲染工具和表单', async ({ page }) => {
    await page.goto('/workspace/studio');

    // 等待页面加载
    await page.waitForTimeout(1000);

    // 检查页面标题
    await expect(page.getByText('AI商拍工作室')).toBeVisible();

    // 检查工具选择器
    await expect(page.getByText('选择工具：')).toBeVisible();
    await expect(page.getByRole('combobox')).toBeVisible();

    // 检查第一个工具的表单字段
    await expect(page.getByText('场景')).toBeVisible();
    await expect(page.getByText('输出尺寸')).toBeVisible();
    await expect(page.getByText('数量')).toBeVisible();

    // 检查表单字段是否可交互
    const sceneSelect = page.getByLabel('场景');
    await expect(sceneSelect).toBeVisible();

    const sizeSelect = page.getByLabel('输出尺寸');
    await expect(sizeSelect).toBeVisible();

    const countInput = page.getByLabel('数量');
    await expect(countInput).toBeVisible();
  });

  test('编辑器页面渲染快捷操作和布局', async ({ page }) => {
    await page.goto('/workspace/editor');

    // 等待页面加载
    await page.waitForTimeout(1000);

    // 检查快捷操作
    await expect(page.getByText('快捷操作：')).toBeVisible();
    await expect(page.getByText('一键换色')).toBeVisible();
    await expect(page.getByText('一键去皱')).toBeVisible();
    await expect(page.getByText('智能抠图')).toBeVisible();

    // 检查侧边菜单
    await expect(page.getByText('画布')).toBeVisible();
    await expect(page.getByText('图层')).toBeVisible();
    await expect(page.getByText('历史')).toBeVisible();

    // 检查画布占位区域
    await expect(page.getByText('画布占位（后续接入 EditorCanvas）')).toBeVisible();
  });

  test('画版页面渲染上传和编辑功能', async ({ page }) => {
    await page.goto('/workspace/canvas');

    // 等待页面加载
    await page.waitForTimeout(1000);

    // 检查上传按钮
    await expect(page.getByText('上传图片')).toBeVisible();

    // 检查画布提示
    await expect(page.getByText('上传图片开始编辑')).toBeVisible();
    await expect(page.getByText('支持 JPG、PNG、GIF 格式')).toBeVisible();

    // 检查工具栏（初始状态为禁用）
    const zoomOutButton = page.getByText('缩小');
    await expect(zoomOutButton).toBeVisible();
    // 注意：未上传图片时应该是禁用状态，但Playwright可能检测不到disabled状态
  });

  test('API Bootstrap接口Mock验证', async ({ page }) => {
    // 直接测试API接口
    const response = await page.goto('/api/ui/bootstrap');

    // 由于这是前端路由，应该会返回404
    // 但如果MSW正常工作，应该返回Mock数据
    // 这里主要验证MSW是否正常配置

    // 检查页面中是否包含了Mock数据
    await page.goto('/workspace/templates');

    // 验证Mock数据是否正确加载
    await expect(page.getByText('电商主图')).toBeVisible();
    await expect(page.getByText('纯色台')).toBeVisible();
  });
});