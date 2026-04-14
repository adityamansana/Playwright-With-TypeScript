import { allure } from 'allure-playwright';

/**
 * AllureHelper — thin wrappers around allure-playwright annotations.
 *
 * Provides a consistent, discoverable API so test authors don't need to
 * remember all allure method signatures.
 *
 * Usage:
 *   import { AllureHelper as A } from '@utils/AllureHelper';
 *   A.epic('LinkedIn').feature('Search').story('Initiation');
 *   A.critical();
 *   await A.step('Search for keyword', async () => { ... });
 */
export class AllureHelper {
  // ─── Labels ──────────────────────────────────────────────────────────────

  static epic(name: string): typeof AllureHelper {
    allure.epic(name);
    return AllureHelper;
  }

  static feature(name: string): typeof AllureHelper {
    allure.feature(name);
    return AllureHelper;
  }

  static story(name: string): typeof AllureHelper {
    allure.story(name);
    return AllureHelper;
  }

  static tag(...tags: string[]): typeof AllureHelper {
    tags.forEach((t) => allure.tag(t));
    return AllureHelper;
  }

  static description(text: string): typeof AllureHelper {
    allure.description(text);
    return AllureHelper;
  }

  // ─── Severity ────────────────────────────────────────────────────────────

  static blocker(): typeof AllureHelper {
    allure.severity('blocker');
    return AllureHelper;
  }

  static critical(): typeof AllureHelper {
    allure.severity('critical');
    return AllureHelper;
  }

  static normal(): typeof AllureHelper {
    allure.severity('normal');
    return AllureHelper;
  }

  static minor(): typeof AllureHelper {
    allure.severity('minor');
    return AllureHelper;
  }

  // ─── Parameters & Attachments ────────────────────────────────────────────

  static parameter(name: string, value: string): void {
    allure.parameter(name, value);
  }

  static attachText(name: string, content: string): void {
    allure.attachment(name, content, 'text/plain');
  }

  static attachJson(name: string, data: unknown): void {
    allure.attachment(name, JSON.stringify(data, null, 2), 'application/json');
  }

  static attachHtml(name: string, html: string): void {
    allure.attachment(name, html, 'text/html');
  }

  static attachImage(name: string, buffer: Buffer): void {
    allure.attachment(name, buffer, 'image/png');
  }

  // ─── Steps ───────────────────────────────────────────────────────────────

  static async step<T>(name: string, body: () => Promise<T>): Promise<T> {
    return allure.step(name, body);
  }

  // ─── Links ───────────────────────────────────────────────────────────────

  static link(name: string, url: string): void {
    allure.link(url, name);
  }

  static issue(id: string, url: string): void {
    allure.issue(id, url);
  }

  static testCase(id: string, url: string): void {
    allure.tms(id, url);
  }
}
