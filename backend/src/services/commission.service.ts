/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Knex } from 'knex';
import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import { generateId } from '../utils/generator.js';

type OrderCountRow = {
  count?: string | number;
};

type ReferralRelationship = {
  referred_user_id: string;
  referrer_distributor_id: string;
};

type DistributorRecord = {
  id: string;
  status: 'active' | 'inactive' | string;
  total_commission: number;
  available_commission: number;
};

type DistributionSettings = {
  commission_rate?: number;
  freeze_days?: number;
};

type CommissionRecord = {
  id: string;
  distributor_id: string;
  order_id: string;
  referred_user_id: string;
  order_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: 'frozen' | 'available' | 'cancelled';
  freeze_until: Date;
  settled_at?: Date;
};

type CommissionStatus = 'frozen' | 'available' | 'cancelled';

const DUP_ENTRY_ERROR_CODES = new Set(['ER_DUP_ENTRY', '23505']);

const toNumber = (value: string | number | undefined): number =>
  value === undefined ? 0 : typeof value === 'number' ? value : Number(value);

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

class CommissionService {
  async calculateAndCreateCommission(
    trx: Knex.Transaction,
    userId: string,
    orderId: string,
    orderAmount: number
  ): Promise<string | null> {
    try {
      const orderCountRow = (await trx<OrderCountRow>('orders')
        .where('userId', userId)
        .andWhere('status', 'paid')
        .count('id as count')
        .first()) as OrderCountRow | undefined;

      if (toNumber(orderCountRow?.count) > 1) {
        logger.info(`不是首单,不计佣: userId=${userId}, orderId=${orderId}`);
        return null;
      }

      const relation = (await trx<ReferralRelationship>('referral_relationships')
        .where('referred_user_id', userId)
        .first()) as ReferralRelationship | undefined;

      if (!relation) {
        logger.info(`没有推荐人,不计佣: userId=${userId}`);
        return null;
      }

      const distributor = (await trx<DistributorRecord>('distributors')
        .where('id', relation.referrer_distributor_id)
        .first()) as DistributorRecord | undefined;

      if (!distributor || distributor.status !== 'active') {
        logger.info(
          `分销员不存在或已禁用,不计佣: distributorId=${relation.referrer_distributor_id}`
        );
        return null;
      }

      const settings = (await trx<DistributionSettings>('distribution_settings')
        .where('id', 1)
        .first()) as DistributionSettings | undefined;

      const commissionRate = settings?.commission_rate ?? 15;
      const commissionAmount = Number(((orderAmount * commissionRate) / 100).toFixed(2));

      const freezeDays = settings?.freeze_days ?? 7;
      const freezeUntil = new Date();
      freezeUntil.setDate(freezeUntil.getDate() + freezeDays);

      const commissionId = generateId(8);
      try {
        await trx('commissions').insert({
          id: commissionId,
          distributor_id: distributor.id,
          order_id: orderId,
          referred_user_id: userId,
          order_amount: orderAmount,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          status: 'frozen' satisfies CommissionStatus,
          freeze_until: freezeUntil,
          created_at: new Date()
        });
      } catch (error: any) {
        if (error?.code && DUP_ENTRY_ERROR_CODES.has(error.code)) {
          logger.warn(`订单已计佣,跳过: orderId=${orderId}`);
          return null;
        }
        throw error;
      }

      await trx('distributors')
        .where('id', distributor.id)
        .increment('total_commission', commissionAmount);

      logger.info(
        `佣金计算成功: commissionId=${commissionId}, amount=${commissionAmount}, freezeUntil=${freezeUntil.toISOString()}`
      );

      return commissionId;
    } catch (error) {
      logger.error(
        `佣金计算失败: userId=${userId}, orderId=${orderId}, error=${getErrorMessage(error)}`
      );
      throw error;
    }
  }

  async unfreezeCommissions(): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        const frozenCommissions = (await trx<CommissionRecord>('commissions')
          .where('status', 'frozen')
          .where('freeze_until', '<=', new Date())
          .forUpdate()
          .select('*')) as CommissionRecord[];

        if (frozenCommissions.length === 0) {
          logger.info('没有需要解冻的佣金');
          return;
        }

        for (const commission of frozenCommissions) {
          const distributor = (await trx<DistributorRecord>('distributors')
            .where('id', commission.distributor_id)
            .forUpdate()
            .first()) as DistributorRecord | undefined;

          if (!distributor) {
            logger.error(`分销员不存在,跳过解冻: distributorId=${commission.distributor_id}`);
            continue;
          }

          await trx('commissions').where('id', commission.id).update({
            status: 'available',
            settled_at: new Date()
          });

          await trx('distributors')
            .where('id', commission.distributor_id)
            .increment('available_commission', commission.commission_amount);

          logger.info(
            `佣金解冻: commissionId=${commission.id}, amount=${commission.commission_amount}`
          );
        }

        logger.info(`✓ 解冻佣金${frozenCommissions.length}条`);
      });
    } catch (error) {
      logger.error(`解冻佣金失败: error=${getErrorMessage(error)}`);
      throw error;
    }
  }

  async cancelFrozenCommission(trx: Knex.Transaction, orderId: string): Promise<string | null> {
    try {
      const commission = (await trx<CommissionRecord>('commissions')
        .where('order_id', orderId)
        .andWhere('status', 'frozen')
        .first()) as CommissionRecord | undefined;

      if (!commission) {
        logger.info(`订单无冻结佣金,跳过: orderId=${orderId}`);
        return null;
      }

      await trx('commissions').where('id', commission.id).update({
        status: 'cancelled',
        settled_at: new Date()
      });

      await trx('distributors')
        .where('id', commission.distributor_id)
        .decrement('total_commission', commission.commission_amount);

      logger.info(`佣金取消: commissionId=${commission.id}, orderId=${orderId}`);
      return commission.id;
    } catch (error) {
      logger.error(`取消佣金失败: orderId=${orderId}, error=${getErrorMessage(error)}`);
      throw error;
    }
  }
}

const commissionService = new CommissionService();
export default commissionService;
