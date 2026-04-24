import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './Logger';

const logger = Logger.getLogger('DataHelper');

/**
 * DataHelper — test data manipulation utilities.
 */
export class DataHelper {
  /**
   * Generate a unique identifier with an optional prefix.
   */
  static uniqueId(prefix = 'test'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Pick a random item from an array.
   */
  static randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Deep clone an object.
   */
  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Sanitize a string for use as a filename.
   */
  static sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '_').substring(0, 100);
  }

  /**
   * Wait for N ms (inline convenience).
   */
  static sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Format a duration in ms to a human-readable string.
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  }

  /**
   * Mask sensitive data for logging.
   */
  static maskSensitive(value: string, visibleChars = 3): string {
    if (value.length <= visibleChars) return '*'.repeat(value.length);
    return value.substring(0, visibleChars) + '*'.repeat(value.length - visibleChars);
  }
}

/**
 * FileUtil — filesystem helpers for test artifacts.
 */
export class FileUtil {
  static ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.debug(`Created directory: ${dirPath}`);
    }
  }

  static writeJson(filePath: string, data: unknown): void {
    FileUtil.ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    logger.debug(`Written JSON: ${filePath}`);
  }

  static readJson<T>(filePath: string): T {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  }

  static exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  static deleteIfExists(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug(`Deleted: ${filePath}`);
    }
  }

  static listFiles(dirPath: string, extension?: string): string[] {
    if (!fs.existsSync(dirPath)) return [];
    return fs
      .readdirSync(dirPath)
      .filter((f) => !extension || f.endsWith(extension))
      .map((f) => path.join(dirPath, f));
  }
}
