import { db } from '../config/database.js';
import logger from '../utils/logger.js';

type OrderSpec = { column: string; direction?: 'asc' | 'desc' };
type JoinSpec = {
  type: 'inner' | 'left';
  table: string;
  first: string;
  operator: string;
  second: string;
};

class PaginationService {
  private readonly defaultLimit = 20;
  private readonly maxLimit = 100;
  private readonly defaultOrder: 'asc' | 'desc' = 'desc';

  async cursorPaginate(options: {
    table: string;
    columns?: string[];
    where?: Record<string, any> | ((this: any) => void);
    orderBy?: OrderSpec[];
    cursor?: string | null;
    limit?: number;
    joins?: JoinSpec[];
  }): Promise<{ data: any[]; pageInfo: any; paginationType: 'cursor' }> {
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
      let query: any = db(table).select(columns);
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
          const val = (where as any)[key];
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
      const results: any[] = await query;
      const queryTime = Date.now() - startTime;
      const hasNextPage = results.length > validatedLimit;
      if (hasNextPage) results.pop();
      let nextCursor: string | null = null;
      if (hasNextPage && results.length > 0)
        nextCursor = this.buildCursor(results[results.length - 1], orderBy);
      const pageInfo = {
        hasNextPage,
        hasPreviousPage: !!cursor,
        startCursor: results.length > 0 ? this.buildCursor(results[0], orderBy) : null,
        endCursor:
          results.length > 0 ? this.buildCursor(results[results.length - 1], orderBy) : null,
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
    } catch (error: any) {
      logger.error('[PaginationService] 游标分页查询失败', {
        table,
        error: error.message,
        options
      });
      throw error;
    }
  }

  async offsetPaginate(options: {
    table: string;
    columns?: string[];
    where?: Record<string, any> | ((this: any) => void);
    orderBy?: OrderSpec[];
    page?: number;
    limit?: number;
    joins?: JoinSpec[];
  }): Promise<{ data: any[]; pageInfo: any; paginationType: 'offset' }> {
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
      let countQuery: any = db(table);
      joins.forEach((join) => {
        countQuery =
          join.type === 'inner'
            ? countQuery.innerJoin(join.table, join.first, join.operator, join.second)
            : countQuery.leftJoin(join.table, join.first, join.operator, join.second);
      });
      if (typeof where === 'function') {
        countQuery = countQuery.where(where as any);
      } else {
        Object.keys(where).forEach((key) => {
          const val = (where as any)[key];
          if (val !== null && val !== undefined) {
            Array.isArray(val)
              ? (countQuery = countQuery.whereIn(key, val))
              : (countQuery = countQuery.where(key, val));
          }
        });
      }
      const totalCountRow: any = await countQuery.count('* as total').first();
      let dataQuery: any = db(table).select(columns);
      joins.forEach((join) => {
        dataQuery =
          join.type === 'inner'
            ? dataQuery.innerJoin(join.table, join.first, join.operator, join.second)
            : dataQuery.leftJoin(join.table, join.first, join.operator, join.second);
      });
      if (typeof where === 'function') {
        dataQuery = dataQuery.where(where as any);
      } else {
        Object.keys(where).forEach((key) => {
          const val = (where as any)[key];
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
      const results: any[] = await dataQuery;
      const queryTime = Date.now() - startTime;
      const totalItems = parseInt(String(totalCountRow?.total ?? '0')) || 0;
      const totalPages = Math.ceil(totalItems / validatedLimit);
      const hasNextPage = validatedPage < totalPages;
      const hasPreviousPage = validatedPage > 1;
      const pageInfo = {
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
    } catch (error: any) {
      logger.error('[PaginationService] OFFSET分页查询失败', {
        table,
        error: error.message,
        options
      });
      throw error;
    }
  }

  private buildCursorCondition(query: any, orderBy: OrderSpec[], cursor: string) {
    const cursorData = this.parseCursor(cursor) as Record<string, any> | null;
    if (!cursorData || orderBy.length === 0) return query;
    const conditions: string[] = [];
    const bindings: any[] = [];
    for (let i = 0; i < orderBy.length; i++) {
      const { column, direction } = orderBy[i];
      const value = (cursorData as any)[column];
      if (value === undefined) continue;
      const operator = (direction || this.defaultOrder) === 'desc' ? '<' : '>';
      if (i === 0) {
        conditions.push(`${column} ${operator} ?`);
        bindings.push(value);
      } else {
        let prevConditions = '';
        const prevBindings: any[] = [];
        for (let j = 0; j < i; j++) {
          const prevColumn = orderBy[j].column;
          const prevValue = (cursorData as any)[prevColumn];
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

  private buildCursor(row: Record<string, any>, orderBy: OrderSpec[]): string {
    const cursorData: Record<string, any> = {};
    orderBy.forEach((o) => {
      const col = o.column;
      const v = (row as any)[col];
      if (v !== undefined && v !== null) cursorData[col] = v;
    });
    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  private parseCursor(cursor: string): Record<string, any> | null {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    } catch (error: any) {
      logger.warn('[PaginationService] 游标解析失败', { cursor, error });
      return null;
    }
  }

  async getUserTasks(userId: string, options: Record<string, any> = {}) {
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

  async getTaskList(filters: Record<string, any> = {}, options: Record<string, any> = {}) {
    const where: Record<string, any> = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.userId) where.userId = filters.userId;
    return this.offsetPaginate({
      table: 'tasks',
      columns: ['id', 'userId', 'type', 'status', 'created_at', 'completed_at'],
      where,
      orderBy: [
        { column: 'created_at', direction: 'desc' },
        { column: 'id', direction: 'desc' }
      ],
      ...options
    });
  }

  async getQuotaTransactions(
    userId: string | null = null,
    filters: Record<string, any> = {},
    options: Record<string, any> = {}
  ) {
    const where: Record<string, any> = {};
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

  async searchTasks(searchTerm: string, options: Record<string, any> = {}) {
    if (!searchTerm || searchTerm.trim().length === 0) return this.getTaskList({}, options);
    const whereFn = function (this: any) {
      this.where('tasks.type', 'like', `%${searchTerm}%`)
        .orWhere('tasks.status', 'like', `%${searchTerm}%`)
        .orWhere('tasks.errorReason', 'like', `%${searchTerm}%`);
    };
    return this.offsetPaginate({
      table: 'tasks',
      columns: ['id', 'userId', 'type', 'status', 'created_at', 'errorReason'],
      where: whereFn as any,
      orderBy: [
        { column: 'created_at', direction: 'desc' },
        { column: 'id', direction: 'desc' }
      ],
      ...options
    });
  }

  async getIndexUsageStats(): Promise<any[]> {
    try {
      const stats: any = await (db as any).raw('SELECT * FROM v_index_usage');
      return stats?.[0] || [];
    } catch (error: any) {
      logger.error('[PaginationService] 获取索引统计失败', error);
      return [];
    }
  }

  async analyzeQuery(table: string, where: Record<string, any> = {}, orderBy: OrderSpec[] = []) {
    try {
      let query: any = db(table).select('*');
      Object.keys(where).forEach((k) => {
        const v = (where as any)[k];
        if (v !== null && v !== undefined) {
          query = query.where(k, v);
        }
      });
      orderBy.forEach((o) => {
        query = query.orderBy(o.column, o.direction || 'desc');
      });
      const sql = query.toSQL();
      const explainSql = `EXPLAIN ${sql.sql}`;
      const explainResult: any = await (db as any).raw(explainSql, sql.bindings);
      logger.debug('[PaginationService] 查询分析完成', {
        table,
        where,
        orderBy,
        explainPlan: explainResult?.[0]
      });
      return { sql: sql.sql, bindings: sql.bindings, explain: explainResult?.[0] };
    } catch (error: any) {
      logger.error('[PaginationService] 查询分析失败', {
        table,
        where,
        orderBy,
        error: error.message
      });
      throw error;
    }
  }
}

const paginationService = new PaginationService();
export default paginationService;
