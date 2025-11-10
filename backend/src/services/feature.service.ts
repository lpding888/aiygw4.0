/**
 * Feature Service - 功能卡片服务 - TypeScript版本
 * 负责功能卡片的查询、权限过滤等
 */

import { db } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * 功能卡片定义
 */
export interface FeatureDefinition {
  feature_id: string;
  display_name: string;
  category: string;
  description: string;
  plan_required: string;
  quota_cost: number;
  rate_limit_policy: string;
  output_type: string;
  save_to_asset_library: boolean;
  access_scope?: string;
  allowed_accounts?: string;
  is_enabled?: boolean;
  deleted_at?: Date | null;
  form_schema_ref?: string;
  pipeline_id?: string;
}

/**
 * 用户对象
 */
export interface User {
  id: string;
  isMember: boolean;
  quota_remaining: number;
  phone?: string;
  role?: string;
}

/**
 * 表单Schema
 */
export interface FormSchema {
  schema_id: string;
  fields: Record<string, unknown>;
}

/**
 * Pipeline Schema
 */
export interface PipelineSchema {
  pipeline_id: string;
  [key: string]: unknown;
}

/**
 * 错误对象
 */
interface ErrorObject {
  message?: string;
  statusCode?: number;
  errorCode?: number;
}

/**
 * 功能服务类
 * 艹,这个service管理功能卡片的查询和权限过滤!
 */
export class FeatureService {
  /**
   * 获取所有启用的功能卡片（公开接口，无需登录）
   * 艹,公开API,不用登录也能看到功能列表!
   * @returns 功能卡片列表
   */
  async getAllEnabledFeatures(): Promise<Partial<FeatureDefinition>[]> {
    try {
      // 查询所有启用且未删除的功能卡片
      const allFeatures = await db('feature_definitions')
        .where('is_enabled', true)
        .whereNull('deleted_at')
        .select(
          'feature_id',
          'display_name',
          'category',
          'description',
          'plan_required',
          'quota_cost',
          'rate_limit_policy',
          'output_type',
          'save_to_asset_library'
        );

      logger.info(`[FeatureService] 获取所有启用功能 count=${allFeatures.length}`);
      return allFeatures;
    } catch (error: unknown) {
      const err = error as ErrorObject;
      logger.error(`[FeatureService] 获取所有启用功能失败: ${err.message}`, { error });
      throw error;
    }
  }

  /**
   * 获取用户可用的功能卡片列表
   * 艹,根据用户会员等级和白名单过滤功能!
   * @param userId - 用户ID
   * @returns 功能卡片列表
   */
  async getAvailableFeatures(userId: string): Promise<Partial<FeatureDefinition>[]> {
    try {
      // 1. 获取用户信息(包括会员等级)
      const user = await db('users').where('id', userId).first();
      if (!user) {
        throw { statusCode: 404, errorCode: 1004, message: '用户不存在' };
      }

      // 2. 查询所有启用且未删除的功能卡片
      const allFeatures = await db('feature_definitions')
        .where('is_enabled', true)
        .whereNull('deleted_at')
        .select('*');

      // 3. 根据access_scope和用户权限过滤
      const availableFeatures = allFeatures.filter((feature: FeatureDefinition) => {
        // 如果是plan模式,检查用户会员等级
        if (feature.access_scope === 'plan') {
          return this.checkPlanAccess(user, feature.plan_required);
        }

        // 如果是whitelist模式,检查用户是否在白名单中
        if (feature.access_scope === 'whitelist') {
          return this.checkWhitelistAccess(userId, feature.allowed_accounts);
        }

        // 默认不可访问
        return false;
      });

      // 4. 格式化返回数据(不包含内部字段)
      const formattedFeatures = availableFeatures.map((feature: FeatureDefinition) => ({
        feature_id: feature.feature_id,
        display_name: feature.display_name,
        category: feature.category,
        description: feature.description,
        plan_required: feature.plan_required,
        quota_cost: feature.quota_cost,
        rate_limit_policy: feature.rate_limit_policy,
        output_type: feature.output_type,
        save_to_asset_library: feature.save_to_asset_library
      }));

      logger.info(
        `[FeatureService] 获取用户可用功能 userId=${userId} count=${formattedFeatures.length}`
      );
      return formattedFeatures;
    } catch (error: unknown) {
      const err = error as ErrorObject;
      logger.error(`[FeatureService] 获取可用功能失败: ${err.message}`, { userId, error });
      throw error;
    }
  }

  /**
   * 获取功能的表单Schema
   * 艹,查询功能的表单定义并验证用户权限!
   * @param featureId - 功能ID
   * @param userId - 用户ID(用于权限验证)
   * @returns 表单Schema
   */
  async getFormSchema(featureId: string, userId: string): Promise<Partial<FormSchema>> {
    try {
      // 1. 查询功能定义
      const feature = await db('feature_definitions').where('feature_id', featureId).first();

      if (!feature) {
        throw { statusCode: 404, errorCode: 4001, message: '功能不存在' };
      }

      if (!feature.is_enabled || feature.deleted_at) {
        throw { statusCode: 403, errorCode: 4002, message: '功能已下线' };
      }

      // 2. 验证用户权限
      const user = await db('users').where('id', userId).first();
      if (!user) {
        throw { statusCode: 404, errorCode: 1004, message: '用户不存在' };
      }

      const hasAccess = this.checkFeatureAccess(user, userId, feature);
      if (!hasAccess) {
        throw { statusCode: 403, errorCode: 4003, message: '无权访问该功能' };
      }

      // 3. 查询表单Schema
      const formSchema = await db('form_schemas')
        .where('schema_id', feature.form_schema_ref)
        .first();

      if (!formSchema) {
        throw { statusCode: 500, errorCode: 5001, message: '表单Schema不存在' };
      }

      logger.info(`[FeatureService] 获取表单Schema featureId=${featureId} userId=${userId}`);
      return {
        schema_id: formSchema.schema_id,
        fields: formSchema.fields
      };
    } catch (error: unknown) {
      const err = error as ErrorObject;
      logger.error(`[FeatureService] 获取表单Schema失败: ${err.message}`, {
        featureId,
        userId,
        error
      });
      throw error;
    }
  }

  /**
   * 检查套餐权限
   * 艹,检查用户是不是会员!
   * @param user - 用户对象
   * @param planRequired - 所需套餐级别
   * @returns 是否有权限
   */
  checkPlanAccess(user: User, planRequired: string): boolean {
    // 如果不是会员,无法访问
    if (!user.isMember) {
      return false;
    }

    // TODO: 这里可以根据实际的套餐等级进行更精细的判断
    // 目前简化处理:只要是会员就可以访问
    // 未来可以扩展: 基础会员/PRO会员/企业会员等
    return true;
  }

  /**
   * 检查白名单权限
   * 艹,检查用户ID是否在白名单JSON里!
   * @param userId - 用户ID
   * @param allowedAccountsJson - 白名单JSON字符串
   * @returns 是否在白名单
   */
  checkWhitelistAccess(userId: string, allowedAccountsJson?: string): boolean {
    if (!allowedAccountsJson) {
      return false;
    }

    try {
      const allowedAccounts = JSON.parse(allowedAccountsJson);
      return allowedAccounts.includes(userId);
    } catch (error: unknown) {
      const err = error as ErrorObject;
      logger.error(`[FeatureService] 解析白名单失败: ${err.message}`);
      return false;
    }
  }

  /**
   * 检查用户对功能的访问权限
   * 艹,综合判断用户能不能用这个功能!
   * @param user - 用户对象
   * @param userId - 用户ID
   * @param feature - 功能对象
   * @returns 是否有权限
   */
  checkFeatureAccess(user: User, userId: string, feature: FeatureDefinition): boolean {
    if (feature.access_scope === 'plan') {
      return this.checkPlanAccess(user, feature.plan_required);
    }

    if (feature.access_scope === 'whitelist') {
      return this.checkWhitelistAccess(userId, feature.allowed_accounts);
    }

    return false;
  }

  /**
   * 检查用户访问权限(异步版本,用于TaskService)
   * 艹,异步查询用户并判断权限!
   * @param userId - 用户ID
   * @param feature - 功能对象
   * @returns 是否有权限
   */
  async checkUserAccess(userId: string, feature: FeatureDefinition): Promise<boolean> {
    try {
      const user = await db('users').where('id', userId).first();
      if (!user) {
        return false;
      }

      return this.checkFeatureAccess(user, userId, feature);
    } catch (error: unknown) {
      const err = error as ErrorObject;
      logger.error(`[FeatureService] 检查用户权限失败: ${err.message}`, { userId, error });
      return false;
    }
  }

  /**
   * 获取功能定义(内部使用,包含完整信息)
   * 艹,内部方法查完整功能定义!
   * @param featureId - 功能ID
   * @returns 功能定义
   */
  async getFeatureDefinition(featureId: string): Promise<FeatureDefinition> {
    try {
      const feature = await db('feature_definitions').where('feature_id', featureId).first();

      if (!feature) {
        throw { statusCode: 404, errorCode: 4001, message: '功能不存在' };
      }

      if (!feature.is_enabled || feature.deleted_at) {
        throw { statusCode: 403, errorCode: 4002, message: '功能已下线' };
      }

      return feature;
    } catch (error: unknown) {
      const err = error as ErrorObject;
      logger.error(`[FeatureService] 获取功能定义失败: ${err.message}`, { featureId, error });
      throw error;
    }
  }

  /**
   * 获取Pipeline Schema(内部使用)
   * 艹,查询Pipeline的Schema定义!
   * @param pipelineId - Pipeline ID
   * @returns Pipeline Schema
   */
  async getPipelineSchema(pipelineId: string): Promise<PipelineSchema> {
    try {
      const pipeline = await db('pipeline_schemas').where('pipeline_id', pipelineId).first();

      if (!pipeline) {
        throw { statusCode: 500, errorCode: 5002, message: 'Pipeline Schema不存在' };
      }

      return pipeline;
    } catch (error: unknown) {
      const err = error as ErrorObject;
      logger.error(`[FeatureService] 获取Pipeline Schema失败: ${err.message}`, {
        pipelineId,
        error
      });
      throw error;
    }
  }
}

// 艹,单例导出!
const featureService = new FeatureService();

export default featureService;
