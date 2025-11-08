import type { Knex } from 'knex';
import { db } from '../db/index.js';
import logger from '../utils/logger.js';

type AssetQueryParams = {
  userId: string;
  type?: string;
  featureId?: string;
  startDate?: string;
  endDate?: string;
  page?: number | string;
  limit?: number | string;
};

type AllAssetQueryParams = AssetQueryParams & {
  userId?: string;
};

type AssetRecord = {
  asset_id: string;
  user_id: string;
  task_id: string;
  feature_id: string;
  type: string;
  url: string;
  thumbnail_url: string;
  metadata: unknown;
  created_at: Date;
};

class AssetService {
  private readonly table = 'assets';

  async getAssets(params: AssetQueryParams) {
    const { userId, type, featureId, startDate, endDate, page = 1, limit = 20 } = params;

    try {
      let query = db(this.table)
        .leftJoin('feature_definitions', 'assets.feature_id', 'feature_definitions.feature_id')
        .select(
          'assets.asset_id',
          'assets.task_id',
          'assets.feature_id',
          'feature_definitions.display_name as feature_name',
          'assets.type',
          'assets.url',
          'assets.thumbnail_url',
          'assets.metadata',
          'assets.created_at'
        )
        .where('assets.user_id', userId)
        .orderBy('assets.created_at', 'desc');

      if (type) query = query.where('assets.type', type);
      if (featureId) query = query.where('assets.feature_id', featureId);
      if (startDate) query = query.where('assets.created_at', '>=', startDate);
      if (endDate) query = query.where('assets.created_at', '<=', endDate);

      const parsedLimit = Number(limit);
      const parsedPage = Number(page);
      const offset = (parsedPage - 1) * parsedLimit;
      const assets = await query.limit(parsedLimit).offset(offset);

      let countQuery = db(this.table).where('user_id', userId);
      if (type) countQuery = countQuery.where('type', type);
      if (featureId) countQuery = countQuery.where('feature_id', featureId);
      if (startDate) countQuery = countQuery.where('created_at', '>=', startDate);
      if (endDate) countQuery = countQuery.where('created_at', '<=', endDate);

      const [{ count }] = await countQuery.count<{ count: string | number }[]>('* as count');

      return {
        assets,
        total: Number(count),
        page: parsedPage,
        limit: parsedLimit
      };
    } catch (error) {
      const err = error as Error;
      logger.error(`[AssetService] 查询素材列表失败: ${err.message}`, { userId, error: err });
      throw err;
    }
  }

  async deleteAsset(assetId: string, userId: string): Promise<boolean> {
    try {
      const asset = await db<AssetRecord>(this.table)
        .where('asset_id', assetId)
        .where('user_id', userId)
        .first();

      if (!asset) {
        throw { errorCode: 4004, message: '素材不存在或无权删除' };
      }

      await db(this.table).where('asset_id', assetId).delete();

      logger.info(`[AssetService] 素材删除成功 assetId=${assetId} userId=${userId}`);

      return true;
    } catch (error) {
      const err = error as Error;
      logger.error(`[AssetService] 删除素材失败: ${err.message}`, { assetId, userId, error: err });
      throw err;
    }
  }

  async getAllAssets(params: AllAssetQueryParams) {
    const { userId, type, featureId, startDate, endDate, page = 1, limit = 20 } = params;

    try {
      let query = db(this.table)
        .leftJoin('feature_definitions', 'assets.feature_id', 'feature_definitions.feature_id')
        .leftJoin('users', 'assets.user_id', 'users.id')
        .select(
          'assets.asset_id',
          'assets.user_id',
          'users.phone as user_phone',
          'assets.task_id',
          'assets.feature_id',
          'feature_definitions.display_name as feature_name',
          'assets.type',
          'assets.url',
          'assets.thumbnail_url',
          'assets.metadata',
          'assets.created_at'
        )
        .orderBy('assets.created_at', 'desc');

      if (userId && userId !== 'all') query = query.where('assets.user_id', userId);
      if (type) query = query.where('assets.type', type);
      if (featureId) query = query.where('assets.feature_id', featureId);
      if (startDate) query = query.where('assets.created_at', '>=', startDate);
      if (endDate) query = query.where('assets.created_at', '<=', endDate);

      const parsedLimit = Number(limit);
      const parsedPage = Number(page);
      const offset = (parsedPage - 1) * parsedLimit;
      const assets = await query.limit(parsedLimit).offset(offset);

      let countQuery = db(this.table);
      if (userId && userId !== 'all') countQuery = countQuery.where('user_id', userId);
      if (type) countQuery = countQuery.where('type', type);
      if (featureId) countQuery = countQuery.where('feature_id', featureId);
      if (startDate) countQuery = countQuery.where('created_at', '>=', startDate);
      if (endDate) countQuery = countQuery.where('created_at', '<=', endDate);

      const [{ count }] = await countQuery.count<{ count: string | number }[]>('* as count');

      return {
        assets,
        total: Number(count),
        page: parsedPage,
        limit: parsedLimit
      };
    } catch (error) {
      const err = error as Error;
      logger.error(`[AssetService] 查询所有素材列表失败: ${err.message}`, err);
      throw err;
    }
  }
}

const assetService = new AssetService();
export default assetService;
