import * as dotenv from 'dotenv';
import * as path from 'path';
import type { TestConfig, LogLevel } from '../types';

/**
 * ConfigManager — singleton that loads and exposes all env-based configuration.
 * Supports multi-environment (dev | staging | prod) via TEST_ENV variable.
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: TestConfig;

  private constructor() {
    const env = process.env.TEST_ENV || 'dev';
    const envFile = path.resolve(__dirname, `environments/${env}.env`);
    dotenv.config({ path: envFile });

    this.config = {
      baseUrl: process.env.BASE_URL || 'https://www.linkedin.com',
      credentials: {
        email: process.env.LINKEDIN_EMAIL || '',
        password: process.env.LINKEDIN_PASSWORD || '',
      },
      timeouts: {
        default: parseInt(process.env.DEFAULT_TIMEOUT || '90000', 10),
        navigation: parseInt(process.env.NAVIGATION_TIMEOUT || '30000', 10),
        action: parseInt(process.env.ACTION_TIMEOUT || '15000', 10),
      },
      retries: parseInt(process.env.RETRY_COUNT || '1', 10),
      headless: process.env.HEADLESS !== 'false',
      logLevel: (process.env.LOG_LEVEL || 'info') as LogLevel,
      authStateFile: process.env.AUTH_STATE_FILE || 'reports/auth/linkedin-auth.json',
    };

    this.validate();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  getConfig(): TestConfig {
    return this.config;
  }

  get<K extends keyof TestConfig>(key: K): TestConfig[K] {
    return this.config[key];
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  getCredentials(): TestConfig['credentials'] {
    return this.config.credentials;
  }

  getTimeout(type: keyof TestConfig['timeouts'] = 'default'): number {
    return this.config.timeouts[type];
  }

  getEnvironment(): string {
    return process.env.TEST_ENV || 'dev';
  }

  isCI(): boolean {
    return !!process.env.CI;
  }

  private validate(): void {
    const warnings: string[] = [];
    if (!this.config.credentials.email) {
      warnings.push('LINKEDIN_EMAIL is not set — authentication tests will fail');
    }
    if (!this.config.credentials.password) {
      warnings.push('LINKEDIN_PASSWORD is not set — authentication tests will fail');
    }
    if (warnings.length > 0) {
      console.warn('[ConfigManager] Warnings:\n' + warnings.map(w => `  ⚠ ${w}`).join('\n'));
    }
  }
}

export const config = ConfigManager.getInstance();
