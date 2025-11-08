/**
 * 插件运行时加载器
 * 艹！这个加载器负责动态加载插件、权限验证、错误隔离！
 *
 * @author 老王
 */

/**
 * 插件权限
 */
export type PluginPermission =
  | 'storage' // 本地存储
  | 'network' // 网络请求
  | 'ui' // UI渲染
  | 'ai' // AI调用
  | 'file' // 文件操作
  | 'notification'; // 通知

/**
 * 插件清单
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  entry: string; // 入口文件URL
  permissions: PluginPermission[]; // 所需权限
  dependencies?: Record<string, string>; // 依赖版本
  icon?: string;
  category?: string;
  enabled?: boolean;
}

/**
 * 插件上下文
 */
export interface PluginContext {
  manifest: PluginManifest;
  permissions: Set<PluginPermission>;
  storage: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    remove: (key: string) => Promise<void>;
  };
  ui: {
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    showDialog: (title: string, content: string) => Promise<boolean>;
  };
  network: {
    fetch: (url: string, options?: RequestInit) => Promise<Response>;
  };
  ai: {
    generate: (prompt: string, options?: any) => Promise<any>;
  };
}

/**
 * 插件实例
 */
export interface Plugin {
  manifest: PluginManifest;
  activate?: (context: PluginContext) => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * 插件加载器类
 */
export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();
  private contexts: Map<string, PluginContext> = new Map();
  private loadedScripts: Set<string> = new Set();

  /**
   * 从清单加载插件
   */
  async loadFromManifest(manifest: PluginManifest): Promise<Plugin> {
    console.log('[PluginLoader] 加载插件:', manifest.name);

    try {
      // 检查是否已加载
      if (this.plugins.has(manifest.id)) {
        console.warn('[PluginLoader] 插件已加载:', manifest.id);
        return this.plugins.get(manifest.id)!;
      }

      // 验证权限
      this.validatePermissions(manifest.permissions);

      // 动态加载插件脚本
      const plugin = await this.loadPluginScript(manifest);

      // 创建插件上下文
      const context = this.createPluginContext(manifest);
      this.contexts.set(manifest.id, context);

      // 激活插件
      if (plugin.activate) {
        await this.safeCall(
          () => plugin.activate!(context),
          `激活插件 ${manifest.name} 失败`
        );
      }

      // 保存插件
      this.plugins.set(manifest.id, plugin);

      console.log('[PluginLoader] 插件加载成功:', manifest.name);
      return plugin;
    } catch (error: any) {
      console.error('[PluginLoader] 插件加载失败:', error);
      throw new Error(`加载插件失败: ${error.message}`);
    }
  }

  /**
   * 卸载插件
   */
  async unload(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件不存在: ${pluginId}`);
    }

    console.log('[PluginLoader] 卸载插件:', plugin.manifest.name);

    try {
      // 停用插件
      if (plugin.deactivate) {
        await this.safeCall(
          () => plugin.deactivate!(),
          `停用插件 ${plugin.manifest.name} 失败`
        );
      }

      // 移除插件
      this.plugins.delete(pluginId);
      this.contexts.delete(pluginId);

      console.log('[PluginLoader] 插件已卸载:', plugin.manifest.name);
    } catch (error: any) {
      console.error('[PluginLoader] 卸载插件失败:', error);
      throw error;
    }
  }

  /**
   * 重新加载插件
   */
  async reload(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件不存在: ${pluginId}`);
    }

    await this.unload(pluginId);
    await this.loadFromManifest(plugin.manifest);
  }

  /**
   * 获取已加载的插件
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * 获取所有插件
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 动态加载插件脚本
   */
  private async loadPluginScript(manifest: PluginManifest): Promise<Plugin> {
    // 检查是否已加载脚本
    if (this.loadedScripts.has(manifest.entry)) {
      // 从全局获取插件
      const plugin = (window as any)[`plugin_${manifest.id}`];
      if (plugin) {
        return plugin;
      }
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = manifest.entry;
      script.async = true;

      script.onload = () => {
        this.loadedScripts.add(manifest.entry);

        // 从全局获取插件
        const plugin = (window as any)[`plugin_${manifest.id}`];
        if (!plugin) {
          reject(new Error('插件未正确导出'));
          return;
        }

        // 验证插件结构
        plugin.manifest = manifest;
        resolve(plugin);
      };

      script.onerror = () => {
        reject(new Error('插件脚本加载失败'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * 创建插件上下文
   */
  private createPluginContext(manifest: PluginManifest): PluginContext {
    const permissions = new Set(manifest.permissions);

    return {
      manifest,
      permissions,

      // 存储API
      storage: {
        get: async (key: string) => {
          this.checkPermission(permissions, 'storage');
          const data = localStorage.getItem(`plugin_${manifest.id}_${key}`);
          return data ? JSON.parse(data) : null;
        },
        set: async (key: string, value: any) => {
          this.checkPermission(permissions, 'storage');
          localStorage.setItem(`plugin_${manifest.id}_${key}`, JSON.stringify(value));
        },
        remove: async (key: string) => {
          this.checkPermission(permissions, 'storage');
          localStorage.removeItem(`plugin_${manifest.id}_${key}`);
        },
      },

      // UI API
      ui: {
        showToast: (message: string, type: 'success' | 'error' | 'info' = 'info') => {
          this.checkPermission(permissions, 'ui');
          // 实际应该调用全局toast组件
          console.log(`[Plugin ${manifest.name}] Toast:`, message, type);
        },
        showDialog: async (title: string, content: string) => {
          this.checkPermission(permissions, 'ui');
          // 实际应该调用全局dialog组件
          return window.confirm(`${title}\n\n${content}`);
        },
      },

      // 网络API
      network: {
        fetch: async (url: string, options?: RequestInit) => {
          this.checkPermission(permissions, 'network');
          // 添加插件标识
          const headers = {
            ...options?.headers,
            'X-Plugin-Id': manifest.id,
            'X-Plugin-Version': manifest.version,
          };
          return fetch(url, { ...options, headers });
        },
      },

      // AI API
      ai: {
        generate: async (prompt: string, options?: any) => {
          this.checkPermission(permissions, 'ai');
          const response = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Plugin-Id': manifest.id,
            },
            body: JSON.stringify({ prompt, ...options }),
          });

          if (!response.ok) {
            throw new Error('AI生成失败');
          }

          return response.json();
        },
      },
    };
  }

  /**
   * 验证权限
   */
  private validatePermissions(permissions: PluginPermission[]): void {
    const validPermissions: PluginPermission[] = [
      'storage',
      'network',
      'ui',
      'ai',
      'file',
      'notification',
    ];

    for (const permission of permissions) {
      if (!validPermissions.includes(permission)) {
        throw new Error(`无效的权限: ${permission}`);
      }
    }
  }

  /**
   * 检查权限
   */
  private checkPermission(permissions: Set<PluginPermission>, required: PluginPermission): void {
    if (!permissions.has(required)) {
      throw new Error(`插件缺少权限: ${required}`);
    }
  }

  /**
   * 安全调用
   */
  private async safeCall<T>(fn: () => T | Promise<T>, errorMessage: string): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      console.error(errorMessage, error);
      throw error;
    }
  }

  /**
   * 清理所有插件
   */
  async cleanup(): Promise<void> {
    const pluginIds = Array.from(this.plugins.keys());

    for (const pluginId of pluginIds) {
      try {
        await this.unload(pluginId);
      } catch (error) {
        console.error('[PluginLoader] 清理插件失败:', pluginId, error);
      }
    }

    this.plugins.clear();
    this.contexts.clear();
  }

  /**
   * 获取插件统计
   */
  getStats() {
    return {
      total: this.plugins.size,
      loaded: this.loadedScripts.size,
      plugins: this.getAllPlugins().map((p) => ({
        id: p.manifest.id,
        name: p.manifest.name,
        version: p.manifest.version,
        enabled: p.manifest.enabled,
      })),
    };
  }
}

/**
 * 全局插件加载器实例
 */
export const pluginLoader = new PluginLoader();
