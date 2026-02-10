import { isDebugMode } from './debug';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function normalizeLogLevel(value: unknown): LogLevel | null {
  if (typeof value !== 'string') {
    return null;
  }

  const lower = value.toLowerCase();
  if (lower === 'debug' || lower === 'info' || lower === 'warn' || lower === 'error') {
    return lower;
  }
  return null;
}

function getGlobalLogLevel(): LogLevel {
  if (typeof window !== 'undefined') {
    const win = window as unknown as Record<string, unknown>;
    const explicitLevel = normalizeLogLevel(win.LOG_LEVEL);
    if (explicitLevel) {
      return explicitLevel;
    }

    if (isDebugMode()) {
      return 'debug';
    }
  }

  return 'info';
}

function shouldLog(level: LogLevel): boolean {
  const currentLevel = getGlobalLogLevel();
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

function formatPrefix(scope: string): string {
  return `[${scope}]`;
}

function emit(level: LogLevel, scope: string, args: unknown[]): void {
  if (!shouldLog(level)) {
    return;
  }

  const prefix = formatPrefix(scope);
  if (level === 'debug' || level === 'info') {
    console.log(prefix, ...args);
    return;
  }
  if (level === 'warn') {
    console.warn(prefix, ...args);
    return;
  }
  console.error(prefix, ...args);
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (...args: unknown[]) => emit('debug', scope, args),
    info: (...args: unknown[]) => emit('info', scope, args),
    warn: (...args: unknown[]) => emit('warn', scope, args),
    error: (...args: unknown[]) => emit('error', scope, args),
  };
}
