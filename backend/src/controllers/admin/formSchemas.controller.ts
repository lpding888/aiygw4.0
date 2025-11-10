import type { Request, Response } from 'express';
import { db } from '../../config/database.js';
import logger from '../../utils/logger.js';

type CountRow = { count?: string | number | bigint | null };
type MaxVersionRow = { max_version?: string | number | bigint | null };

const toInt = (value: unknown, fallback: number): number => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
};

const parseCount = (row?: CountRow): number => {
  if (!row || row.count == null) return 0;
  if (typeof row.count === 'number') return row.count;
  if (typeof row.count === 'bigint') return Number(row.count);
  const parsed = Number(row.count);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const parseVersionParam = (value: unknown): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
};

const handleUnexpectedError = (res: Response, context: string, error: unknown): void => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(`[FormSchemas] ${context}: ${err.message}`, err);
  res.status(500).json({
    success: false,
    error: {
      message: context,
      details: err.message
    }
  });
};

export const listFormSchemas = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = toInt(req.query.limit, 20);
    const offset = toInt(req.query.offset, 0);
    const publishStatus =
      typeof req.query.publish_status === 'string' ? req.query.publish_status : undefined;

    let query = db('form_schemas')
      .select(
        'schema_id',
        'version',
        'is_current',
        'version_description',
        'publish_status',
        'created_by',
        'created_at',
        'updated_at'
      )
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (publishStatus) {
      query = query.where({ publish_status: publishStatus });
    }

    const schemas = await query;
    const totalQuery = db('form_schemas').count<CountRow>('* as count');
    if (publishStatus) {
      totalQuery.where({ publish_status: publishStatus });
    }
    const totalRows = (await totalQuery) as CountRow[];
    const total = parseCount(totalRows[0]);

    res.json({
      success: true,
      data: {
        schemas,
        total,
        limit,
        offset
      }
    });
  } catch (error) {
    handleUnexpectedError(res, '表单Schema列表查询失败', error);
  }
};

export const getFormSchema = async (req: Request, res: Response): Promise<void> => {
  const { schemaId } = req.params;
  const version = parseVersionParam(req.query.version);

  try {
    let query = db('form_schemas').where({ schema_id: schemaId });
    if (version !== undefined) {
      query = query.where({ version });
    } else {
      query = query.where({ is_current: true });
    }

    const schema = await query.first();

    if (!schema) {
      res.status(404).json({ success: false, error: { message: 'Schema不存在' } });
      return;
    }

    res.json({ success: true, data: schema });
  } catch (error) {
    handleUnexpectedError(res, '表单Schema查询失败', error);
  }
};

export const getFormSchemaVersions = async (req: Request, res: Response): Promise<void> => {
  const { schemaId } = req.params;

  try {
    const versions = await db('form_schemas')
      .where({ schema_id: schemaId })
      .orderBy('version', 'desc')
      .select('version', 'version_description', 'publish_status', 'is_current', 'created_at');

    res.json({
      success: true,
      data: {
        versions,
        total: versions.length
      }
    });
  } catch (error) {
    handleUnexpectedError(res, '表单Schema版本列表查询失败', error);
  }
};

export const createFormSchema = async (req: Request, res: Response): Promise<void> => {
  const { schema_id, fields, version_description } = req.body ?? {};
  interface UserRequest {
    user_id?: string | number;
  }
  const userId = (req.user as unknown as UserRequest)?.user_id ?? 'system';

  if (!schema_id || !fields) {
    res.status(400).json({
      success: false,
      error: { message: 'schema_id和fields为必填项' }
    });
    return;
  }

  try {
    const existing = await db('form_schemas').where({ schema_id }).first();
    if (existing) {
      res.status(409).json({
        success: false,
        error: { message: 'Schema ID已存在，请使用不同的ID或创建新版本' }
      });
      return;
    }

    await db('form_schemas').insert({
      schema_id,
      fields: JSON.stringify(fields),
      version: 1,
      is_current: true,
      version_description,
      publish_status: 'draft',
      created_by: userId
    });

    const newSchema = await db('form_schemas').where({ schema_id, version: 1 }).first();

    res.status(201).json({
      success: true,
      data: newSchema
    });
  } catch (error) {
    handleUnexpectedError(res, '表单Schema创建失败', error);
  }
};

export const createFormSchemaVersion = async (req: Request, res: Response): Promise<void> => {
  const { schemaId } = req.params;
  const { fields, version_description } = req.body ?? {};
  interface UserRequest {
    user_id?: string | number;
  }
  const userId = (req.user as unknown as UserRequest)?.user_id ?? 'system';

  if (!fields) {
    res.status(400).json({
      success: false,
      error: { message: 'fields为必填项' }
    });
    return;
  }

  try {
    const maxVersionRow = (await db('form_schemas')
      .where({ schema_id: schemaId })
      .max('version as max_version')
      .first<MaxVersionRow>()) ?? { max_version: 0 };
    const newVersion = Number(maxVersionRow.max_version ?? 0) + 1;

    await db('form_schemas').where({ schema_id: schemaId }).update({ is_current: false });

    await db('form_schemas').insert({
      schema_id: schemaId,
      fields: JSON.stringify(fields),
      version: newVersion,
      is_current: true,
      version_description,
      publish_status: 'draft',
      created_by: userId
    });

    const newSchema = await db('form_schemas')
      .where({ schema_id: schemaId, version: newVersion })
      .first();

    res.status(201).json({
      success: true,
      data: newSchema
    });
  } catch (error) {
    handleUnexpectedError(res, '表单Schema创建版本失败', error);
  }
};

export const publishFormSchemaVersion = async (req: Request, res: Response): Promise<void> => {
  const { schemaId, version } = req.params;
  const targetVersion = parseVersionParam(version);

  if (targetVersion === undefined) {
    res.status(400).json({ success: false, error: { message: '版本号不合法' } });
    return;
  }

  try {
    const updated = await db('form_schemas')
      .where({ schema_id: schemaId, version: targetVersion })
      .update({ publish_status: 'published', updated_at: db.fn.now() });

    if (updated === 0) {
      res.status(404).json({
        success: false,
        error: { message: 'Schema版本不存在' }
      });
      return;
    }

    res.json({
      success: true,
      message: 'Schema已发布'
    });
  } catch (error) {
    handleUnexpectedError(res, '表单Schema发布失败', error);
  }
};

export const switchFormSchemaVersion = async (req: Request, res: Response): Promise<void> => {
  const { schemaId, version } = req.params;
  const targetVersion = parseVersionParam(version);

  if (targetVersion === undefined) {
    res.status(400).json({ success: false, error: { message: '版本号不合法' } });
    return;
  }

  try {
    const target = await db('form_schemas')
      .where({ schema_id: schemaId, version: targetVersion })
      .first();

    if (!target) {
      res.status(404).json({
        success: false,
        error: { message: 'Schema版本不存在' }
      });
      return;
    }

    await db('form_schemas').where({ schema_id: schemaId }).update({ is_current: false });

    await db('form_schemas')
      .where({ schema_id: schemaId, version: targetVersion })
      .update({ is_current: true, updated_at: db.fn.now() });

    res.json({
      success: true,
      message: `已切换到版本${targetVersion}`
    });
  } catch (error) {
    handleUnexpectedError(res, '表单Schema切换版本失败', error);
  }
};

export const deleteFormSchema = async (req: Request, res: Response): Promise<void> => {
  const { schemaId } = req.params;

  try {
    const updated = await db('form_schemas')
      .where({ schema_id: schemaId })
      .update({ publish_status: 'archived', updated_at: db.fn.now() });

    if (updated === 0) {
      res.status(404).json({
        success: false,
        error: { message: 'Schema不存在' }
      });
      return;
    }

    res.json({
      success: true,
      message: 'Schema已归档'
    });
  } catch (error) {
    handleUnexpectedError(res, '表单Schema删除失败', error);
  }
};

const formSchemasController = {
  listFormSchemas,
  getFormSchema,
  getFormSchemaVersions,
  createFormSchema,
  createFormSchemaVersion,
  publishFormSchemaVersion,
  switchFormSchemaVersion,
  deleteFormSchema
};

export default formSchemasController;
