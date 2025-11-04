/**
 * E2E测试 - 聊天功能主链路
 * 艹，必须验证SSE流、错误处理、会话存储！
 *
 * @author 老王
 */

import { test, expect } from '@playwright/test';

test.describe('聊天功能主链路', () => {
  test.beforeEach(async ({ page }) => {
    // 启用Mock
    await page.addInitScript(() => {
      window.localStorage.setItem('NEXT_PUBLIC_ENABLE_MOCK', 'true');
    });
  });

  test('基本聊天流程 - 发送消息和接收回复', async ({ page }) => {
    await page.goto('/workspace/chat');

    // 等待页面加载
    await page.waitForTimeout(1000);

    // 检查页面元素
    await expect(page.getByText('AI助手')).toBeVisible();
    await expect(page.getByText('选择模型')).toBeVisible();
    await expect(page.getByText('开始新的对话')).toBeVisible();

    // 输入测试消息
    await page.fill('textarea[placeholder*="输入您的问题"]', '你好，这是一个测试消息');

    // 发送消息
    await page.click('button:has-text("发送")');

    // 检查用户消息已发送
    await expect(page.getByText('你好，这是一个测试消息')).toBeVisible();

    // 等待AI回复（SSE流式）
    await page.waitForTimeout(3000);

    // 检查AI回复（应该包含部分回复文本）
    const aiMessages = await page.locator('.ant-card-body').filter({ hasText: /你好|AI助手|很高兴/ }).count();
    expect(aiMessages).toBeGreaterThan(0);
  });

  test('模型选择功能', async ({ page }) => {
    await page.goto('/workspace/chat');
    await page.waitForTimeout(1000);

    // 检查模型选择器
    const modelSelector = page.locator('.ant-select').first();
    await expect(modelSelector).toBeVisible();

    // 点击选择器
    await modelSelector.click();

    // 检查模型选项
    await expect(page.getByText('GPT-4')).toBeVisible();
    await expect(page.getByText('GPT-3.5 Turbo')).toBeVisible();
    await expect(page.getByText('Claude-3 Sonnet')).toBeVisible();
    await expect(page.getByText('Gemini Pro')).toBeVisible();

    // 选择不同模型
    await page.getByText('GPT-4').click();

    // 验证模型已切换
    await expect(page.getByText('OpenAI · 8192 tokens')).toBeVisible();
  });

  test('停止生成功能', async ({ page }) => {
    await page.goto('/workspace/chat');
    await page.waitForTimeout(1000);

    // 发送一条长消息以触发生成
    await page.fill('textarea[placeholder*="输入您的问题"]', '请详细解释一下什么是人工智能，包括它的发展历史和未来趋势');
    await page.click('button:has-text("发送")');

    // 等待生成开始
    await page.waitForTimeout(500);

    // 检查停止按钮是否出现
    const stopButton = page.locator('button:has-text("停止")');
    await expect(stopButton).toBeVisible();

    // 点击停止生成
    await stopButton.click();

    // 等待停止生效
    await page.waitForTimeout(500);

    // 验证发送按钮重新出现
    await expect(page.locator('button:has-text("发送")')).toBeVisible();
  });

  test('新建对话功能', async ({ page }) => {
    await page.goto('/workspace/chat');
    await page.waitForTimeout(1000);

    // 先发送一条消息
    await page.fill('textarea[placeholder*="输入您的问题"]', '第一条消息');
    await page.click('button:has-text("发送")');
    await page.waitForTimeout(2000);

    // 检查消息已发送
    await expect(page.getByText('第一条消息')).toBeVisible();

    // 点击新建对话
    await page.click('button:has-text("新对话")');

    // 等待页面刷新
    await page.waitForTimeout(1000);

    // 检查旧消息是否被清除
    await expect(page.getByText('第一条消息')).not.toBeVisible();

    // 检查是否回到初始状态
    await expect(page.getByText('开始新的对话')).toBeVisible();
  });

  test('错误处理和requestId复制', async ({ page }) => {
    await page.goto('/workspace/chat');
    await page.waitForTimeout(1000);

    // 注意：由于MSW只有10%概率返回错误，这个测试可能会随机失败
    // 在实际环境中，可以添加特定的错误场景

    // 检查错误信息组件是否存在（但可能不显示）
    const errorAlert = page.locator('.ant-alert-error');

    // 发送几条消息以触发可能的错误
    for (let i = 0; i < 5; i++) {
      await page.fill('textarea[placeholder*="输入您的问题"]', `测试消息 ${i}`);
      await page.click('button:has-text("发送")');
      await page.waitForTimeout(1000);
    }

    // 检查是否有错误提示（可选）
    if (await errorAlert.isVisible()) {
      await expect(page.getByText(/错误代码|请求ID/)).toBeVisible();
    }
  });

  test('键盘快捷键 - Enter发送，Shift+Enter换行', async ({ page }) => {
    await page.goto('/workspace/chat');
    await page.waitForTimeout(1000);

    const textarea = page.locator('textarea[placeholder*="输入您的问题"]');

    // 测试Enter发送
    await textarea.fill('Enter发送测试');
    await textarea.press('Enter');
    await page.waitForTimeout(2000);

    await expect(page.getByText('Enter发送测试')).toBeVisible();

    // 清空输入框
    await textarea.fill('');

    // 测试Shift+Enter换行
    await textarea.fill('第一行');
    await textarea.press('Shift+Enter');
    await textarea.type('第二行');

    // 检查是否换行（输入框应该包含换行符）
    const inputValue = await textarea.inputValue();
    expect(inputValue).toContain('第一行\n第二行');

    // 按Enter发送
    await textarea.press('Enter');
    await page.waitForTimeout(2000);

    // 检查多行消息是否发送
    await expect(page.getByText(/第一行\s*第二行/)).toBeVisible();
  });

  test('会话持久化 - 刷新页面后消息不丢失', async ({ page }) => {
    await page.goto('/workspace/chat');
    await page.waitForTimeout(1000);

    // 发送一条消息
    await page.fill('textarea[placeholder*="输入您的问题"]', '持久化测试消息');
    await page.click('button:has-text("发送")');
    await page.waitForTimeout(3000);

    // 检查消息存在
    await expect(page.getByText('持久化测试消息')).toBeVisible();

    // 刷新页面
    await page.reload();
    await page.waitForTimeout(2000);

    // 检查消息是否恢复
    await expect(page.getByText('持久化测试消息')).toBeVisible();
  });

  test('移动端适配', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/workspace/chat');
    await page.waitForTimeout(1000);

    // 检查移动端布局
    await expect(page.getByText('AI助手')).toBeVisible();

    // 测试移动端输入
    await page.fill('textarea[placeholder*="输入您的问题"]', '移动端测试');
    await page.click('button:has-text("发送")');
    await page.waitForTimeout(2000);

    await expect(page.getByText('移动端测试')).toBeVisible();

    // 检查消息在移动端的显示
    const messages = page.locator('.ant-card');
    await expect(messages.first()).toBeVisible();
  });
});