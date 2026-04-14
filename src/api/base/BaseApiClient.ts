import type { APIRequestContext } from '@playwright/test';
import { Logger } from '../../utils/Logger';
import { WaitUtil } from '../../utils/WaitUtil';
import type { ApiRequestOptions, ApiResponse } from '../../types';

/**
 * BaseApiClient — foundation for all API clients.
 *
 * Wraps Playwright's APIRequestContext with:
 *  - Retry logic
 *  - Response timing
 *  - Error normalisation
 *  - Structured logging
 */
export abstract class BaseApiClient {
  protected readonly logger = Logger.getLogger(this.constructor.name);

  constructor(
    protected readonly request: APIRequestContext,
    protected readonly baseUrl: string,
  ) {}

  protected async get<T = unknown>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<ApiResponse<T>> {
    return this.execute<T>('GET', path, undefined, options);
  }

  protected async post<T = unknown>(
    path: string,
    body: unknown,
    options: ApiRequestOptions = {},
  ): Promise<ApiResponse<T>> {
    return this.execute<T>('POST', path, body, options);
  }

  protected async put<T = unknown>(
    path: string,
    body: unknown,
    options: ApiRequestOptions = {},
  ): Promise<ApiResponse<T>> {
    return this.execute<T>('PUT', path, body, options);
  }

  protected async delete<T = unknown>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<ApiResponse<T>> {
    return this.execute<T>('DELETE', path, undefined, options);
  }

  private async execute<T>(
    method: string,
    path: string,
    body: unknown,
    options: ApiRequestOptions,
  ): Promise<ApiResponse<T>> {
    const { retries = 0, timeout = 30_000, headers = {}, params = {} } = options;
    const url = `${this.baseUrl}${path}`;

    return WaitUtil.retry(
      async () => {
        const startTime = Date.now();
        this.logger.debug(`${method} ${url}`, { params });

        const response = await this.request.fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...headers,
          },
          data: body ? JSON.stringify(body) : undefined,
          params,
          timeout,
        });

        const duration = Date.now() - startTime;
        const responseHeaders: Record<string, string> = {};
        response.headersArray().forEach(({ name, value }) => {
          responseHeaders[name] = value;
        });

        let data: T;
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          data = (await response.json()) as T;
        } else {
          data = (await response.text()) as unknown as T;
        }

        const apiResponse: ApiResponse<T> = {
          status: response.status(),
          statusText: response.statusText(),
          data,
          headers: responseHeaders,
          duration,
        };

        this.logger.info(`${method} ${url} → ${response.status()} (${duration}ms)`);

        if (!response.ok()) {
          throw new Error(`API error ${response.status()} for ${method} ${url}: ${response.statusText()}`);
        }

        return apiResponse;
      },
      retries + 1,
      1000,
      `${method} ${path}`,
    );
  }
}
