import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import type { ILogger } from '../types';

const LOG_DIR = path.resolve(process.cwd(), 'reports/logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const stackStr = stack ? `\n${stack}` : '';
  return `[${ts}] [${level.toUpperCase()}] ${message}${metaStr}${stackStr}`;
});

/**
 * Framework-wide logger — wraps winston with named child loggers.
 * Usage:
 *   const logger = Logger.getLogger('LoginPage');
 *   logger.info('Navigating to login page');
 */
class LoggerFactory {
  private static loggers = new Map<string, winston.Logger>();
  private static rootLogger: winston.Logger;

  private static createRootLogger(): winston.Logger {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        logFormat,
      ),
      transports: [
        new winston.transports.Console({
          format: combine(
            colorize({ all: true }),
            errors({ stack: true }),
            timestamp({ format: 'HH:mm:ss.SSS' }),
            logFormat,
          ),
        }),
        new winston.transports.File({
          filename: path.join(LOG_DIR, 'error.log'),
          level: 'error',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: path.join(LOG_DIR, 'combined.log'),
          maxsize: 20 * 1024 * 1024,
          maxFiles: 10,
        }),
      ],
    });
  }

  static getLogger(name: string): ILogger {
    if (!LoggerFactory.rootLogger) {
      LoggerFactory.rootLogger = LoggerFactory.createRootLogger();
    }

    if (!LoggerFactory.loggers.has(name)) {
      const child = LoggerFactory.rootLogger.child({ logger: name });
      LoggerFactory.loggers.set(name, child);
    }

    const winstonLogger = LoggerFactory.loggers.get(name)!;

    return {
      debug: (msg, meta) => winstonLogger.debug(msg, meta),
      info: (msg, meta) => winstonLogger.info(msg, meta),
      warn: (msg, meta) => winstonLogger.warn(msg, meta),
      error: (msg, meta) => winstonLogger.error(msg, meta),
    };
  }
}

export const Logger = LoggerFactory;
