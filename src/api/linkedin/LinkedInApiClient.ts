import type { APIRequestContext } from '@playwright/test';
import { BaseApiClient } from '../base/BaseApiClient';

/**
 * LinkedInApiClient — thin client for LinkedIn's internal Voyager API.
 *
 * NOTE: LinkedIn's internal API is undocumented and may change without notice.
 * These endpoints are used for supplemental validation in API tests.
 * Primary test automation uses the UI layer.
 */
export class LinkedInApiClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request, 'https://www.linkedin.com');
  }

  /**
   * Check if the current session is authenticated.
   * Uses a lightweight metadata endpoint.
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const response = await this.get<{ status: string }>('/voyager/api/identity/me', {
        headers: {
          'x-restli-protocol-version': '2.0.0',
          'x-li-lang': 'en_US',
        },
        timeout: 10_000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Perform a search via the Voyager API (bypasses UI for validation).
   * Returns raw search results for API-layer assertions.
   */
  async searchPeople(keyword: string, start = 0, count = 10): Promise<VoyagerSearchResponse> {
    const response = await this.get<VoyagerSearchResponse>(
      `/voyager/api/search/blended?keywords=${encodeURIComponent(keyword)}&origin=GLOBAL_SEARCH_HEADER&q=all&start=${start}&count=${count}`,
      {
        headers: {
          'x-restli-protocol-version': '2.0.0',
          'x-li-lang': 'en_US',
          Accept: 'application/vnd.linkedin.normalized+json+2.1',
        },
      },
    );
    return response.data;
  }
}

// ─── Voyager API types (partial) ──────────────────────────────────────────────

export interface VoyagerSearchResponse {
  data?: {
    paging?: {
      count: number;
      start: number;
      total: number;
    };
    elements?: VoyagerSearchElement[];
  };
}

export interface VoyagerSearchElement {
  type?: string;
  hitInfo?: {
    publicIdentifier?: string;
    firstName?: string;
    lastName?: string;
    occupation?: string;
  };
}
