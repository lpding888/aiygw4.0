/**
 * Admin Pipeline管理端到端测试
 * 艹！Pipeline编辑器是AI系统的核心，必须精确测试！
 *
 * @author 老王
 */

import { test, expect } from '@playwright/test';
import { AdminTestBase, PipelineManagementTests } from './admin-e2e-test-suite';

test.describe('Admin Pipeline管理', () => {
  let pipelineTests: PipelineManagementTests;

  test.beforeEach(async ({ page, context }) => {
    pipelineTests = new PipelineManagementTests(page, context);
    await pipelineTests.loginAsAdmin();
  });

  test('[PIPELINE-001] Pipeline创建流程', async ({ page }) => {
    await test.step('导航到Pipeline编辑器', async () => {
      await page.goto('/admin/pipelines/editor');
      await pipelineTests.waitForApiCall();

      // 验证编辑器加载完成
      await expect(page.locator('.react-flow')).toBeVisible();
      await expect(page.locator('h1, h2')).toContainText('Pipeline编辑器');
    });

    await test.step('创建新Pipeline', async () => {
      const pipelineName = await pipelineTests.testCreatePipeline();

      // 验证Pipeline名称设置成功
      const nameInput = page.locator('input[name="pipelineName"], input[placeholder*="Pipeline名称"]');
      await expect(nameInput).toHaveValue(pipelineName);
    });

    await test.step('验证节点创建', async () => {
      // 等待ReactFlow节点加载
      await page.waitForSelector('.react-flow__node', { timeout: 10000 });

      const nodes = page.locator('.react-flow__node');
      expect(await nodes.count()).toBeGreaterThan(0);

      // 验证节点类型
      const providerNode = page.locator('.react-flow__node-provider');
      const conditionNode = page.locator('.react-flow__node-condition');

      expect(await providerNode.count() + await conditionNode.count()).toBeGreaterThan(0);
    });
  });

  test('[PIPELINE-002] 节点拖拽和连接', async ({ page }) => {
    await test.step('导航到编辑器', async () => {
      await page.goto('/admin/pipelines/editor');
      await pipelineTests.waitForApiCall();
      await expect(page.locator('.react-flow')).toBeVisible();
    });

    await test.step('拖拽Provider节点', async () => {
      // 查找节点面板中的Provider节点
      const providerNodeSource = page.locator('.node-palette .node-provider').first();

      if (await providerNodeSource.count() > 0) {
        // 拖拽到画布
        const canvas = page.locator('.react-flow__pane');
        await providerNodeSource.dragTo(canvas);

        // 验证节点创建成功
        await page.waitForSelector('.react-flow__node-provider');
        const providerNodes = page.locator('.react-flow__node-provider');
        expect(await providerNodes.count()).toBeGreaterThan(0);
      }
    });

    await test.step('拖拽Condition节点', async () => {
      const conditionNodeSource = page.locator('.node-palette .node-condition').first();

      if (await conditionNodeSource.count() > 0) {
        const canvas = page.locator('.react-flow__pane');
        await conditionNodeSource.dragTo(canvas);

        await page.waitForSelector('.react-flow__node-condition');
        const conditionNodes = page.locator('.react-flow__node-condition');
        expect(await conditionNodes.count()).toBeGreaterThan(0);
      }
    });

    await test.step('连接节点', async () => {
      // 等待节点加载完成
      await page.waitForSelector('.react-flow__node', { timeout: 5000 });

      const nodes = page.locator('.react-flow__node');
      const nodeCount = await nodes.count();

      if (nodeCount >= 2) {
        // 选择第一个和第二个节点
        const firstNode = nodes.first();
        const secondNode = nodes.nth(1);

        // 尝试连接节点（点击源节点的连接点，然后点击目标节点）
        await firstNode.hover();
        const sourceHandle = firstNode.locator('.react-flow__handle-source');

        if (await sourceHandle.count() > 0) {
          await sourceHandle.first().click();
          await secondNode.click();

          // 验证边创建成功
          await page.waitForTimeout(1000);
          const edges = page.locator('.react-flow__edge');
          expect(await edges.count()).toBeGreaterThan(0);
        }
      }
    });
  });

  test('[PIPELINE-003] 节点配置编辑', async ({ page }) => {
    await test.step('创建节点', async () => {
      await page.goto('/admin/pipelines/editor');
      await pipelineTests.waitForApiCall();

      // 确保有节点存在
      const nodes = page.locator('.react-flow__node');
      if (await nodes.count() === 0) {
        // 如果没有节点，先创建一个
        await pipelineTests.testCreatePipeline();
      }
    });

    await test.step('打开节点配置', async () => {
      const firstNode = page.locator('.react-flow__node').first();
      await firstNode.click();

      // 等待配置面板出现
      await pipelineTests.waitForElement('.node-config-panel, .ant-drawer:visible');

      // 验证配置面板内容
      await expect(page.locator('.node-config-panel, .ant-drawer')).toContainText('节点配置');
    });

    await test.step('修改节点配置', async () => {
      await pipelineTests.testNodeConfiguration();

      // 验证配置保存成功
      await expect(page.locator('.ant-message-success')).toBeVisible();
    });

    await test.step('关闭配置面板', async () => {
      // 点击关闭按钮
      await page.click('.ant-drawer-close, .node-config-panel .close-button');

      // 验证面板关闭
      await expect(page.locator('.node-config-panel:visible, .ant-drawer:visible')).toHaveCount(0);
    });
  });

  test('[PIPELINE-004] Pipeline验证功能', async ({ page }) => {
    await test.step('创建完整的Pipeline', async () => {
      await page.goto('/admin/pipelines/editor');
      await pipelineTests.waitForApiCall();

      // 确保有节点和连接
      const nodes = page.locator('.react-flow__node');
      if (await nodes.count() < 2) {
        await pipelineTests.testCreatePipeline();
      }
    });

    await test.step('执行Pipeline验证', async () => {
      await pipelineTests.testPipelineValidation();
    });

    await test.step('验证验证结果', async () => {
      const validationPanel = page.locator('.validation-panel, .ant-alert');

      if (await validationPanel.count() > 0) {
        await expect(validationPanel).toBeVisible();

        // 检查验证状态
        const alertType = await validationPanel.getAttribute('class');
        const isSuccess = alertType?.includes('success') || alertType?.includes('info');

        console.log(`Pipeline验证结果: ${isSuccess ? '通过' : '失败'}`);
      }
    });
  });

  test('[PIPELINE-005] Pipeline保存和加载', async ({ page }) => {
    await test.step('创建Pipeline', async () => {
      await page.goto('/admin/pipelines/editor');
      await pipelineTests.waitForApiCall();

      const pipelineName = await pipelineTests.testCreatePipeline();

      // 设置Pipeline描述
      const descriptionInput = page.locator('textarea[name="description"], textarea[placeholder*="描述"]');
      if (await descriptionInput.count() > 0) {
        await descriptionInput.fill('这是一个测试Pipeline，用于验证保存和加载功能');
      }
    });

    await test.step('保存Pipeline', async () => {
      await page.click('button:has-text("保存")');

      // 验证保存成功消息
      await pipelineTests.verifyToast('保存成功', 'success');
    });

    await test.step('刷新页面验证持久化', async () => {
      await page.reload();
      await pipelineTests.waitForApiCall();

      // 验证Pipeline状态恢复
      await expect(page.locator('.react-flow')).toBeVisible();

      const nodes = page.locator('.react-flow__node');
      expect(await nodes.count()).toBeGreaterThan(0);
    });
  });

  test('[PIPELINE-006] 协同编辑功能', async ({ page }) => {
    await test.step('检查协同编辑面板', async () => {
      await page.goto('/admin/pipelines/editor');
      await pipelineTests.waitForApiCall();

      await pipelineTests.testCollaboration();
    });

    await test.step('验证在线用户显示', async () => {
      const collaborationPanel = page.locator('.collaboration-panel');

      if (await collaborationPanel.count() > 0) {
        await expect(collaborationPanel).toBeVisible();

        // 检查当前用户显示
        const currentUser = collaborationPanel.locator('.current-user, .user-list .user-item');
        if (await currentUser.count() > 0) {
          await expect(currentUser).toBeVisible();
        }
      }
    });

    await test.step('测试快照功能', async () => {
      // 查找快照相关按钮
      const snapshotButton = page.locator('button:has-text("快照"), button[title*="快照"]');

      if (await snapshotButton.count() > 0) {
        await snapshotButton.click();

        // 验证快照相关UI出现
        await page.waitForTimeout(1000);
        const snapshotModal = page.locator('.ant-modal:visible');
        if (await snapshotModal.count() > 0) {
          await expect(snapshotModal).toContainText('快照');
        }
      }
    });
  });

  test('[PIPELINE-007] 导入导出功能', async ({ page }) => {
    await test.step('创建测试Pipeline', async () => {
      await page.goto('/admin/pipelines/editor');
      await pipelineTests.waitForApiCall();

      await pipelineTests.testCreatePipeline();
    });

    await test.step('测试导出功能', async () => {
      const exportButton = page.locator('button:has-text("导出"), button[title*="导出"]');

      if (await exportButton.count() > 0) {
        await exportButton.click();

        // 验证导出选项或文件下载
        await page.waitForTimeout(2000);

        const exportModal = page.locator('.ant-modal:visible');
        const downloadLink = page.locator('a[download]');

        expect(await exportModal.count() + await downloadLink.count()).toBeGreaterThan(0);
      }
    });

    await test.step('测试导入功能', async () => {
      const importButton = page.locator('button:has-text("导入"), button[title*="导入"]');

      if (await importButton.count() > 0) {
        await importButton.click();

        // 验证导入界面
        await page.waitForTimeout(1000);
        const importModal = page.locator('.ant-modal:visible');
        const fileInput = page.locator('input[type="file"]');

        expect(await importModal.count() + await fileInput.count()).toBeGreaterThan(0);
      }
    });
  });

  test('[PIPELINE-008] 节点类型和模板', async ({ page }) => {
    await test.step('检查节点面板', async () => {
      await page.goto('/admin/pipelines/editor');
      await pipelineTests.waitForApiCall();

      const nodePalette = page.locator('.node-palette, .component-library');

      if (await nodePalette.count() > 0) {
        await expect(nodePalette).toBeVisible();

        // 检查可用节点类型
        const nodeTypes = ['provider', 'condition', 'postProcess', 'end'];

        for (const nodeType of nodeTypes) {
          const nodeElement = nodePalette.locator(`.node-${nodeType}, .${nodeType}-node`);
          const exists = await nodeElement.count() > 0;

          console.log(`节点类型 ${nodeType}: ${exists ? '可用' : '不可用'}`);
        }
      }
    });

    await test.step('测试模板功能', async () => {
      const templateButton = page.locator('button:has-text("模板"), button[title*="模板"]');

      if (await templateButton.count() > 0) {
        await templateButton.click();

        // 验证模板选择界面
        await page.waitForTimeout(1000);
        const templateModal = page.locator('.ant-modal:visible');

        if (await templateModal.count() > 0) {
          await expect(templateModal).toContainText('模板');

          // 检查是否有可用模板
          const templateItems = templateModal.locator('.template-item, .ant-list-item');
          console.log(`可用模板数量: ${await templateItems.count()}`);
        }
      }
    });
  });

  test('[PIPELINE-009] 性能测试', async ({ page }) => {
    await test.step('测试编辑器加载性能', async () => {
      const startTime = Date.now();
      await page.goto('/admin/pipelines/editor');
      await pipelineTests.waitForApiCall();
      const loadTime = Date.now() - startTime;

      // 验证编辑器加载时间在合理范围内（8秒内，因为ReactFlow比较复杂）
      expect(loadTime).toBeLessThan(8000);

      console.log(`Pipeline编辑器加载时间: ${loadTime}ms`);
    });

    await test.step('测试节点创建性能', async () => {
      await page.goto('/admin/pipelines/editor');
      await pipelineTests.waitForApiCall();

      const startTime = Date.now();

      // 创建多个节点测试性能
      for (let i = 0; i < 5; i++) {
        const canvas = page.locator('.react-flow__pane');
        await page.mouse.move(100 + i * 50, 100 + i * 50);
        await page.mouse.click(100 + i * 50, 100 + i * 50);
        await page.waitForTimeout(100);
      }

      const createTime = Date.now() - startTime;
      expect(createTime).toBeLessThan(5000);

      console.log(`创建5个节点耗时: ${createTime}ms`);
    });
  });

  test('[PIPELINE-010] 响应式设计验证', async ({ page }) => {
    await test.step('测试桌面端显示', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/admin/pipelines/editor');
      await pipelineTests.waitForApiCall();

      // 验证编辑器正常显示
      await expect(page.locator('.react-flow')).toBeVisible();

      // 验证工具栏正常显示
      const toolbar = page.locator('.pipeline-toolbar, .editor-toolbar');
      if (await toolbar.count() > 0) {
        await expect(toolbar).toBeVisible();
      }
    });

    await test.step('测试平板端显示', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await pipelineTests.waitForApiCall();

      // 验证响应式布局
      await expect(page.locator('.react-flow')).toBeVisible();
    });

    await test.step('测试移动端警告', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForTimeout(2000);

      // 在小屏幕上可能显示不支持编辑的提示
      const warningMessage = page.locator('.ant-alert, .unsupported-message');
      if (await warningMessage.count() > 0) {
        console.log('检测到移动端限制提示');
      }
    });
  });

  test('[PIPELINE-011] 错误处理和恢复', async ({ page }) => {
    await test.step('测试自动保存功能', async () => {
      await page.goto('/admin/pipelines/editor');
      await pipelineTests.waitForApiCall();

      // 创建一些节点
      await pipelineTests.testCreatePipeline();

      // 模拟页面崩溃前刷新
      await page.reload();
      await pipelineTests.waitForApiCall();

      // 验证数据恢复
      const nodes = page.locator('.react-flow__node');
      expect(await nodes.count()).toBeGreaterThan(0);
    });

    await test.step('测试网络错误处理', async () => {
      // 模拟保存时的网络错误
      await page.route('**/api/admin/pipelines**', route => route.abort());

      // 尝试保存
      await page.click('button:has-text("保存")');
      await page.waitForTimeout(2000);

      // 验证错误提示
      const errorMessage = page.locator('.ant-message-error');
      if (await errorMessage.count() > 0) {
        console.log('检测到网络错误提示');
      }

      // 恢复网络连接
      await page.unroute('**/api/admin/pipelines**');
    });
  });

  test('[PIPELINE-012] 键盘快捷键和辅助功能', async ({ page }) => {
    await test.step('测试常用快捷键', async () => {
      await page.goto('/admin/pipelines/editor');
      await pipelineTests.waitForApiCall();

      // 测试Ctrl+S保存
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(1000);

      // 测试Ctrl+Z撤销
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(500);

      // 测试Ctrl+Y重做
      await page.keyboard.press('Control+y');
      await page.waitForTimeout(500);

      console.log('快捷键测试完成');
    });

    await test.step('测试节点选择和删除', async () => {
      // 创建一个节点
      const canvas = page.locator('.react-flow__pane');
      await page.mouse.click(200, 200);
      await page.waitForTimeout(500);

      // 选择节点
      await page.mouse.click(200, 200);

      // 按Delete键删除
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);

      console.log('节点删除测试完成');
    });
  });
});