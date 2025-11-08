import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * 请求ID中间件
 * 给每个请求贴上唯一ID，方便日志和链路追踪。
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = uuidv4();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  if (process.env.NODE_ENV === 'development') {
    patchConsoleWithRequestId(req, requestId);
    res.on('finish', () => restoreConsole());
    res.on('close', () => restoreConsole());
  }

  next();
}

type ConsoleMethod = (...args: unknown[]) => void;

type ConsolePatchKey = 'log' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const originalConsole: Record<ConsolePatchKey, ConsoleMethod> = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
  trace: console.trace.bind(console)
};

let consolePatched = false;

function patchConsoleWithRequestId(req: Request, requestId: string): void {
  if (consolePatched) {
    return;
  }

  const wrapMethod = (method: ConsoleMethod): ConsoleMethod => {
    return (...args: unknown[]) => {
      const prefix = req.id ?? requestId;
      method(`[${prefix}]`, ...args);
    };
  };

  console.log = wrapMethod(originalConsole.log);
  console.error = wrapMethod(originalConsole.error);
  console.warn = wrapMethod(originalConsole.warn);
  console.info = wrapMethod(originalConsole.info);
  console.debug = wrapMethod(originalConsole.debug);
  console.trace = wrapMethod(originalConsole.trace);
  consolePatched = true;
}

function restoreConsole(): void {
  if (!consolePatched) {
    return;
  }

  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
  console.trace = originalConsole.trace;
  consolePatched = false;
}

export default requestIdMiddleware;
