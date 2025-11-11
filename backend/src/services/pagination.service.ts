import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import type { Knex } from 'knex';

/**
 * 排序规则
 */
export interface OrderSpec {
  column: string;
  direction?: 'asc' | 'desc';
}

/**
 * JOIN规则
 */
export interface JoinSpec {
  type: 'inner' | 'left';
  table: string;
  first: string;
  operator: string;
  second: string;
}

/**
 * WHERE条件类型(对象形式或函数形式)
 */
export type WhereCondition = Record<string, unknown> | ((this: Knex.QueryBuilder) => void);

/**
 * 游标分页选项
 */
export interface CursorPaginateOptions {
  table: string;
  columns?: string[];
  where?: WhereCondition;
  orderBy?: OrderSpec[];
  cursor?: string | null;
  limit?: number;
  joins?: JoinSpec[];
}

/**
 * OFFSET分页选项
 */
export interface OffsetPaginateOptions {
  table: string;
  columns?: string[];
  where?: WhereCondition;
  orderBy?: OrderSpec[];
  page?: number;
  limit?: number;
  joins?: JoinSpec[];
}

/**
 * 游标分页元信息
 */
export interface CursorPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
  nextCursor: string | null;
  limit: number;
  totalCount: number;
}

/**
 * OFFSET分页元信息
 */
export interface OffsetPageInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  limit: number;
  offset: number;
  itemCount: number;
}

/**
 * 游标分页结果
 */
export interface CursorPaginateResult<T = Record<string, unknown>> {
  data: T[];
  pageInfo: CursorPageInfo;
  paginationType: 'cursor';
}

/**
 * OFFSET分页结果
 */
export interface OffsetPaginateResult<T = Record<string, unknown>> {
  data: T[];
  pageInfo: OffsetPageInfo;
  paginationType: 'offset';
}

/**
 * 查询分析结果
 */
export interface QueryAnalysis {
  sql: string;
  bindings: unknown[];
  explain: unknown[];
}

/**
 * 游标数据
 */
export interface CursorData {
  [columnName: string]: unknown;
}

/**
 * 任务过滤器
 */
export interface TaskFilters {
  status?: string;
  type?: string;
  userId?: string;
  createdRange?: {
    start?: string;
    end?: string;
  };
  [key: string]: unknown;
}

/**
 * 配额交易过滤器
 */
export interface QuotaTransactionFilters {
  phase?: string;
}

class PaginationService {
  private readonly defaultLimit = 20;
  private readonly maxLimit = 100;
  private readonly defaultOrder: 'asc' | 'desc' = 'desc';

  async cursorPaginate<T = Record<string, unknown>>(
    options: CursorPaginateOptions
  ): Promise<CursorPaginateResult<T>> {
    const {
      table,
      columns = ['*'],
      where = {},
      orderBy = [
        { column: 'created_at', direction: 'desc' },
        { column: 'id', direction: 'desc' }
      ],
      cursor,
      limit = this.defaultLimit,
      joins = []
    } = options;
    try {
      const validatedLimit = Math.min(Math.max(limit, 1), this.maxLimit);
      let query: Knex.QueryBuilder = db(table).select(columns);
      joins.forEach((join) => {
        query =
          join.type === 'inner'
            ? query.innerJoin(join.table, join.first, join.operator, join.second)
            : query.leftJoin(join.table, join.first, join.operator, join.second);
      });
      if (typeof where === 'function') {
        query = query.where(where);
      } else {
        Object.keys(where).forEach((key) => {
          const val = (where as Record<string, unknown>)[key];
          if (val !== null && val !== undefined) {
            Array.isArray(val)
              ? (query = query.whereIn(key, val))
              : (query = query.where(key, val));
          }
        });
      }
      if (cursor) query = this.buildCursorCondition(query, orderBy, cursor);
      orderBy.forEach((o) => {
        query = query.orderBy(o.column, o.direction || this.defaultOrder);
      });
      query = query.limit(validatedLimit + 1);
      const startTime = Date.now();
      const results = (await query) as T[];
      const queryTime = Date.now() - startTime;
      const hasNextPage = results.length > validatedLimit;
      if (hasNextPage) results.pop();
      let nextCursor: string | null = null;
      if (hasNextPage && results.length > 0)
        nextCursor = this.buildCursor(results[results.length - 1] as Record<string, unknown>, orderBy);
      const pageInfo: CursorPageInfo = {
        hasNextPage,
        hasPreviousPage: !!cursor,
        startCursor: results.length > 0 ? this.buildCursor(results[0] as Record<string, unknown>, orderBy) : null,
        endCursor:
          results.length > 0 ? this.buildCursor(results[results.length - 1] as Record<string, unknown>, orderBy) : null,
        nextCursor,
        limit: validatedLimit,
        totalCount: results.length
      };
      logger.debug('[PaginationService] 游标分页查询完成', {
        table,
        limit: validatedLimit,
        resultCount: results.length,
        hasNextPage,
        queryTime: `${queryTime}ms`,
        hasCursor: !!cursor
      });
      return { data: results, pageInfo, paginationType: 'cursor' };
    } catch (error) {
      logger.error('[PaginationService] 游标分页查询失败', {
        table,
        error: error instanceof Error ? error.message : String(error),
        options
      });
      throw error;
    }
  }

  async offsetPaginate<T = Record<string, unknown>>(
    options: OffsetPaginateOptions
  ): Promise<OffsetPaginateResult<T>> {
    const {
      table,
      columns = ['*'],
      where = {},
      orderBy = [{ column: 'created_at', direction: 'desc' }],
      page = 1,
      limit = this.defaultLimit,
      joins = []
    } = options;
    try {
      const validatedPage = Math.max(page, 1);
      const validatedLimit = Math.min(Math.max(limit, 1), this.maxLimit);
      const offset = (validatedPage - 1) * validatedLimit;
      let countQuery: Knex.QueryBuilder = db(table);
      joins.forEach((join) => {
        countQuery =
          join.type === 'inner'
            ? countQuery.innerJoin(join.table, join.first, join.operator, join.second)
            : countQuery.leftJoin(join.table, join.first, join.operator, join.second);
      });
      if (typeof where === 'function') {
        countQuery = countQuery.where(where);
      } else {
        Object.keys(where).forEach((key) => {
          const val = (where as Record<string, unknown>)[key];
          if (val !== null && val !== undefined) {
            Array.isArray(val)
              ? (countQuery = countQuery.whereIn(key, val))
              : (countQuery = countQuery.where(key, val));
          }
        });
      }
      const totalCountRow = (await countQuery.count('* as total').first()) as { total: number };
      let dataQuery: Knex.QueryBuilder = db(table).select(columns);
      joins.forEach((join) => {
        dataQuery =
          join.type === 'inner'
            ? dataQuery.innerJoin(join.table, join.first, join.operator, join.second)
            : dataQuery.leftJoin(join.table, join.first, join.operator, join.second);
      });
      if (typeof where === 'function') {
        dataQuery = dataQuery.where(where);
      } else {
        Object.keys(where).forEach((key) => {
          const val = (where as Record<string, unknown>)[key];
          if (val !== null && val !== undefined) {
            Array.isArray(val)
              ? (dataQuery = dataQuery.whereIn(key, val))
              : (dataQuery = dataQuery.where(key, val));
          }
        });
      }
      orderBy.forEach((o) => {
        dataQuery = dataQuery.orderBy(o.column, o.direction || this.defaultOrder);
      });
      dataQuery = dataQuery.limit(validatedLimit).offset(offset);
      const startTime = Date.now();
      const results = (await dataQuery) as T[];
      const queryTime = Date.now() - startTime;
      const totalItems = parseInt(String(totalCountRow?.total ?? '0')) || 0;
      const totalPages = Math.ceil(totalItems / validatedLimit);
      const hasNextPage = validatedPage < totalPages;
      const hasPreviousPage = validatedPage > 1;
      const pageInfo: OffsetPageInfo = {
        currentPage: validatedPage,
        totalPages,
        totalItems,
        hasNextPage,
        hasPreviousPage,
        limit: validatedLimit,
        offset,
        itemCount: results.length
      };
      logger.debug('[PaginationService] OFFSET分页查询完成', {
        table,
        page: validatedPage,
        limit: validatedLimit,
        totalItems,
        totalPages,
        queryTime: `${queryTime}ms`
      });
      return { data: results, pageInfo, paginationType: 'offset' };
    } catch (error) {
      logger.error('[PaginationService] OFFSET分页查询失败', {
        table,
        error: error instanceof Error ? error.message : String(error),
        options
      });
      throw error;
    }
  }

  private buildCursorCondition(
    query: Knex.QueryBuilder,
    orderBy: OrderSpec[],
    cursor: string
  ): Knex.QueryBuilder {
    const cursorData = this.parseCursor(cursor);
    if (!cursorData || orderBy.length === 0) return query;
    const conditions: string[] = [];
    const bindings: unknown[] = [];
    for (let i = 0; i < orderBy.length; i++) {
      const { column, direction } = orderBy[i];
      const value = cursorData[column];
      if (value === undefined) continue;
      const operator = (direction || this.defaultOrder) === 'desc' ? '<' : '>';
      if (i === 0) {
        conditions.push(`${column} ${operator} ?`);
        bindings.push(value);
      } else {
        let prevConditions = '';
        const prevBindings: unknown[] = [];
        for (let j = 0; j < i; j++) {
          const prevColumn = orderBy[j].column;
          const prevValue = cursorData[prevColumn];
          if (prevValue !== undefined) {
            prevConditions += prevConditions ? ' AND ' : '';
            prevConditions += `${prevColumn} = ?`;
            prevBindings.push(prevValue);
          }
        }
        if (prevConditions) {
          conditions.push(`(${prevConditions} AND ${column} ${operator} ?)`);
          bindings.push(...prevBindings, value);
        } else {
          conditions.push(`${column} ${operator} ?`);
          bindings.push(value);
        }
      }
    }
    if (conditions.length > 0) query = query.whereRaw(`(${conditions.join(' OR ')})`, bindings);
    return query;
  }

  private buildCursor(row: Record<string, unknown>, orderBy: OrderSpec[]): string {
    const cursorData: CursorData = {};
    orderBy.forEach((o) => {
      const col = o.column;
      const v = row[col];
      if (v !== undefined && v !== null) cursorData[col] = v;
    });
    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  private parseCursor(cursor: string): CursorData | null {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as CursorData;
    } catch (error) {
      logger.warn('[PaginationService] 游标解析失败', { cursor, error });
      return null;
    }
  }

  async getUserTasks(userId: string, options: Partial<CursorPaginateOptions> = {}) {
    return this.cursorPaginate({
      table: 'tasks',
      columns: ['id', 'userId', 'type', 'status', 'created_at', 'completed_at', 'resultUrls'],
      where: { userId },
      orderBy: [
        { column: 'created_at', direction: 'desc' },
        { column: 'id', direction: 'desc' }
      ],
      ...options
    });
  }

  async getTaskList(filters: TaskFilters = {}, options: Partial<OffsetPaginateOptions> = {}) {
    const baseWhere: Record<string, unknown> = {};
    if (filters.status) baseWhere.status = filters.status;
    if (filters.type) baseWhere.type = filters.type;
    if (filters.userId) baseWhere.userId = filters.userId;

    const hasRange = Boolean(filters.createdRange?.start || filters.createdRange?.end);
    const whereCondition = hasRange
      ? function (this: Knex.QueryBuilder) {
          Object.entries(baseWhere).forEach(([column, value]) => {
            if (value !== undefined && value !== null) {
              this.where(column, value as string);
            }
          });
          const { start, end } = filters.createdRange ?? {};
          if (start && end) {
            this.whereBetween('created_at', [start, end]);
          } else if (start) {
            this.where('created_at', '>=', start);
          } else if (end) {
            this.where('created_at', '<=', end);
          }
        }
      : baseWhere;
    return this.offsetPaginate({
      table: 'tasks',
      columns: ['id', 'userId', 'type', 'status', 'created_at', 'completed_at'],
      where: whereCondition,
      orderBy: [
        { column: 'created_at', direction: 'desc' },
        { column: 'id', direction: 'desc' }
      ],
      ...options
    });
  }

  async getQuotaTransactions(
    userId: string | null = null,
    filters: QuotaTransactionFilters = {},
    options: Partial<OffsetPaginateOptions> = {}
  ) {
    const where: Record<string, unknown> = {};
    if (userId) where.user_id = userId;
    if (filters.phase) where.phase = filters.phase;
    return this.offsetPaginate({
      table: 'quota_transactions',
      columns: ['id', 'task_id', 'user_id', 'amount', 'phase', 'created_at'],
      where,
      orderBy: [
        { column: 'created_at', direction: 'desc' },
        { column: 'id', direction: 'desc' }
      ],
      ...options
    });
  }

  async searchTasks(searchTerm: string, options: Partial<OffsetPaginateOptions> = {}) {
    if (!searchTerm || searchTerm.trim().length === 0) return this.getTaskList({}, options);
    const whereFn = function (this: Knex.QueryBuilder) {
      this.where('tasks.type', 'like', `%${searchTerm}%`)
        .orWhere('tasks.status', 'like', `%${searchTerm}%`)
        .orWhere('tasks.errorReason', 'like', `%${searchTerm}%`);
    };
    return this.offsetPaginate({
      table: 'tasks',
      columns: ['id', 'userId', 'type', 'status', 'created_at', 'errorReason'],
      where: whereFn,
      orderBy: [
        { column: 'created_at', direction: 'desc' },
        { column: 'id', direction: 'desc' }
      ],
      ...options
    });
  }

  async getIndexUsageStats(): Promise<unknown[]> {
    try {
      const stats = await (db as Knex).raw('SELECT * FROM v_index_usage');
      return (stats?.[0] as unknown[]) || [];
    } catch (error) {
      logger.error('[PaginationService] 获取索引统计失败', error);
      return [];
    }
  }

  async analyzeQuery(
    table: string,
    where: Record<string, unknown> = {},
    orderBy: OrderSpec[] = []
  ): Promise<QueryAnalysis> {
    try {
      let query: Knex.QueryBuilder = db(table).select('*');
      Object.keys(where).forEach((k) => {
        const v = where[k];
        if (v !== null && v !== undefined) {
          query = query.where(k, v);
        }
      });
      orderBy.forEach((o) => {
        query = query.orderBy(o.column, o.direction || 'desc');
      });
      const sql = query.toSQL();
      const explainSql = `EXPLAIN ${sql.sql}`;
      const explainResult = await (db as Knex).raw(explainSql, sql.bindings);
      logger.debug('[PaginationService] 查询分析完成', {
        table,
        where,
        orderBy,
        explainPlan: explainResult?.[0]
      });
      return {
        sql: sql.sql,
        bindings: sql.bindings as unknown[],
        explain: (explainResult?.[0] as unknown[]) || []
      };
    } catch (error) {
      logger.error('[PaginationService] 查询分析失败', {
        table,
        where,
        orderBy,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

const paginationService = new PaginationService();
export default paginationService;
