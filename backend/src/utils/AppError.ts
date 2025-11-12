import {
  ERROR_CODES,
  ERROR_METADATA,
  type ErrorCategory,
  type ErrorCode,
  type ErrorSeverity
} from '../config/error-codes.js';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type LocaleMessages,
  type SupportedLanguageCode
} from '../config/i18n-messages.js';

export interface AppErrorOptions {
  isOperational?: boolean;
  shouldLog?: boolean;
  shouldNotify?: boolean;
}

export type AppErrorContext = Record<string, unknown>;

export interface AppErrorJSON {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    timestamp: string;
  };
  metadata: {
    category: ErrorCategory;
    severity: ErrorSeverity;
  };
  requestId?: string | null;
  debug?: {
    context: AppErrorContext;
    stack?: string;
    statusCode: number;
  };
}

const DEFAULT_METADATA: {
  category: ErrorCategory;
  severity: ErrorSeverity;
} = {
  category: 'unknown' as ErrorCategory,
  severity: 'medium' as ErrorSeverity
};

const SYSTEM_ERROR_CODES = new Set<ErrorCode>([
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  ERROR_CODES.DATABASE_ERROR,
  ERROR_CODES.CACHE_ERROR,
  ERROR_CODES.QUEUE_ERROR,
  ERROR_CODES.EXTERNAL_SERVICE_ERROR,
  ERROR_CODES.LOGIN_ATTEMPTS_EXCEEDED,
  ERROR_CODES.TASK_PROCESSOR_UNAVAILABLE,
  ERROR_CODES.PAYMENT_GATEWAY_ERROR,
  ERROR_CODES.COMMISSION_CALCULATION_FAILED,
  ERROR_CODES.DATABASE_MIGRATION_FAILED,
  ERROR_CODES.ENVIRONMENT_VARIABLE_MISSING,
  ERROR_CODES.CONNECTION_FAILED,
  ERROR_CODES.REQUEST_TIMEOUT,
  ERROR_CODES.DNS_RESOLUTION_FAILED,
  ERROR_CODES.SSL_VERIFICATION_FAILED,
  ERROR_CODES.PROXY_ERROR,
  ERROR_CODES.BANDWIDTH_LIMIT_EXCEEDED,
  ERROR_CODES.WEBSOCKET_CONNECTION_FAILED,
  ERROR_CODES.NOTIFICATION_SEND_FAILED,
  ERROR_CODES.RATE_LIMIT_CONFIG_INVALID,
  ERROR_CODES.CACHE_VERSION_CONFLICT
] as ErrorCode[]);

const mapStatusCode = (code: ErrorCode): number => {
  if (code === ERROR_CODES.SUCCESS) return 200;
  if (code >= 1000 && code < 1999) {
    switch (code) {
      case ERROR_CODES.INVALID_REQUEST:
      case ERROR_CODES.MISSING_PARAMETERS:
      case ERROR_CODES.INVALID_PARAMETERS:
        return 400;
      case ERROR_CODES.RATE_LIMIT_EXCEEDED:
        return 429;
      case ERROR_CODES.INTERNAL_SERVER_ERROR:
      case ERROR_CODES.DATABASE_ERROR:
      case ERROR_CODES.CACHE_ERROR:
      case ERROR_CODES.QUEUE_ERROR:
        return 500;
      case ERROR_CODES.EXTERNAL_SERVICE_ERROR:
        return 502;
      default:
        return 500;
    }
  }

  if (code >= 2000 && code < 2999) {
    switch (code) {
      case ERROR_CODES.UNAUTHORIZED:
      case ERROR_CODES.INVALID_TOKEN:
      case ERROR_CODES.TOKEN_EXPIRED:
      case ERROR_CODES.TOKEN_BLACKLISTED:
      case ERROR_CODES.INVALID_CREDENTIALS:
      case ERROR_CODES.LOGIN_REQUIRED:
        return 401;
      case ERROR_CODES.PERMISSION_DENIED:
      case ERROR_CODES.INSUFFICIENT_PERMISSIONS:
      case ERROR_CODES.ADMIN_REQUIRED:
        return 403;
      default:
        return 401;
    }
  }

  if (code >= 3000 && code < 3999) {
    switch (code) {
      case ERROR_CODES.USER_NOT_FOUND:
        return 404;
      case ERROR_CODES.USER_ALREADY_EXISTS:
      case ERROR_CODES.EMAIL_ALREADY_EXISTS:
      case ERROR_CODES.PHONE_ALREADY_EXISTS:
        return 409;
      default:
        return 400;
    }
  }

  if (code >= 4000 && code < 4999) {
    switch (code) {
      case ERROR_CODES.TASK_NOT_FOUND:
      case ERROR_CODES.FILE_NOT_FOUND:
        return 404;
      case ERROR_CODES.FILE_TOO_LARGE:
      case ERROR_CODES.FILE_TYPE_NOT_SUPPORTED:
        return 400;
      default:
        return 500;
    }
  }

  if (code >= 5000 && code < 5999) {
    switch (code) {
      case ERROR_CODES.PAYMENT_REQUIRED:
        return 402;
      case ERROR_CODES.PAYMENT_FAILED:
      case ERROR_CODES.PAYMENT_TIMEOUT:
        return 400;
      case ERROR_CODES.ORDER_NOT_FOUND:
        return 404;
      default:
        return 500;
    }
  }

  if (code >= 6000 && code < 6999) {
    return 400;
  }

  if (code >= 7000 && code < 7999) {
    return 500;
  }

  if (code >= 8000 && code < 8999) {
    return 500;
  }

  if (code >= 9000 && code < 9999) {
    return 400;
  }

  return 500;
};

const resolveMetadata = (code: ErrorCode) => {
  const metadataEntry = (ERROR_METADATA as unknown as Record<ErrorCode, typeof DEFAULT_METADATA>)[
    code
  ];
  return metadataEntry ?? DEFAULT_METADATA;
};

const getMessagesForLanguage = (language: SupportedLanguageCode): LocaleMessages => {
  const messages = SUPPORTED_LANGUAGES[language]?.messages;
  if (messages) {
    return messages;
  }
  return SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE as SupportedLanguageCode].messages;
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly metadata: ReturnType<typeof resolveMetadata>;
  public readonly context: AppErrorContext;
  public readonly timestamp: string;
  public readonly requestId: string | null;
  public readonly userId: string | null;
  public readonly options: Required<AppErrorOptions>;
  public readonly statusCode: number;
  public readonly exposeToClient: boolean;

  constructor(
    code: ErrorCode,
    customMessage: string | null = null,
    context: AppErrorContext = {},
    options: AppErrorOptions = {}
  ) {
    const messages = getMessagesForLanguage(DEFAULT_LANGUAGE as SupportedLanguageCode);
    const message =
      customMessage ?? (messages as unknown as Record<ErrorCode, string>)[code] ?? '未知错误';
    super(message);

    this.name = 'AppError';
    this.code = code;
    this.metadata = resolveMetadata(code);
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.requestId = (context.requestId as string | undefined) ?? null;
    this.userId = (context.userId as string | undefined) ?? null;
    this.options = {
      isOperational: true,
      shouldLog: true,
      shouldNotify: false,
      ...options
    };
    this.statusCode = mapStatusCode(code);
    this.exposeToClient = !SYSTEM_ERROR_CODES.has(code);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  public getDefaultMessage(
    language: SupportedLanguageCode = DEFAULT_LANGUAGE as SupportedLanguageCode
  ): string {
    const messages = getMessagesForLanguage(language);
    return (messages as unknown as Record<ErrorCode, string>)[this.code] ?? this.message;
  }

  public getLocalizedMessage(language: SupportedLanguageCode): string {
    return this.getDefaultMessage(language);
  }

  public toJSON(
    language: SupportedLanguageCode = DEFAULT_LANGUAGE as SupportedLanguageCode
  ): AppErrorJSON {
    const response: AppErrorJSON = {
      success: false,
      error: {
        code: this.code,
        message: this.getLocalizedMessage(language),
        timestamp: this.timestamp
      },
      metadata: {
        category: this.metadata.category,
        severity: this.metadata.severity
      }
    };

    if (this.requestId) {
      response.requestId = this.requestId;
    }

    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        context: this.context,
        stack: this.stack,
        statusCode: this.statusCode
      };
    }

    return response;
  }

  public toLogFormat(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.metadata.category,
      severity: this.metadata.severity,
      context: this.context,
      requestId: this.requestId,
      userId: this.userId,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  public static create(
    code: ErrorCode,
    context: AppErrorContext = {},
    options: AppErrorOptions = {}
  ): AppError {
    return new AppError(code, null, context, options);
  }

  public static custom(
    code: ErrorCode,
    message: string,
    context: AppErrorContext = {},
    options: AppErrorOptions = {}
  ): AppError {
    return new AppError(code, message, context, options);
  }

  public static fromError(
    error: unknown,
    fallbackCode: ErrorCode = ERROR_CODES.UNKNOWN_ERROR,
    context: AppErrorContext = {}
  ): AppError {
    if (error instanceof AppError) {
      return error;
    }

    const originalError = error as Error;

    const enhancedContext: AppErrorContext = {
      originalError: originalError?.name,
      originalMessage: originalError?.message,
      ...context
    };

    return new AppError(fallbackCode, originalError?.message ?? '未知错误', enhancedContext, {
      shouldLog: true,
      isOperational: false
    });
  }

  public static isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
  }
}

export default AppError;
