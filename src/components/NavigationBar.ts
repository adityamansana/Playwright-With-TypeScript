import type { Page } from '@playwright/test';
import { BaseComponent } from './base/BaseComponent';
import { WaitUtil } from '../utils/WaitUtil';

/**
 * NavigationBar — wraps LinkedIn's global top navigation.
 */
export class NavigationBar extends BaseComponent {
  private readonly NAV_HOME = 'a[href="/feed/"], a[data-link-to="home"]';
  private readonly NAV_NETWORK = 'a[href="/mynetwork/"]';
  private readonly NAV_JOBS = 'a[href="/jobs/"]';
  private readonly NAV_MESSAGING = 'a[href="/messaging/"]';
  private readonly NAV_NOTIFICATIONS = 'a[href="/notifications/"]';
  private readonly PROFILE_AVATAR = 'button.global-nav__primary-link--profile, div.global-nav__me-photo';
  private readonly SIGN_OUT_BTN = 'a[href*="logout"], a[data-control-name="nav_settings_signout"]';
  private readonly DROPDOWN_MENU = 'div.profile-nav-flyout, div#global-nav-flyout';

  constructor(page: Page) {
    super(page, 'header#global-nav, nav[aria-label="Global navigation"]');
  }

  async goHome(): Promise<void> {
    this.logger.info('Navigating to Home feed');
    await this.page.locator(this.NAV_HOME).first().click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async goToNetwork(): Promise<void> {
    await this.page.locator(this.NAV_NETWORK).first().click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async goToJobs(): Promise<void> {
    await this.page.locator(this.NAV_JOBS).first().click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async goToMessaging(): Promise<void> {
    await this.page.locator(this.NAV_MESSAGING).first().click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async openProfileMenu(): Promise<void> {
    this.logger.info('Opening profile dropdown menu');
    await this.page.locator(this.PROFILE_AVATAR).first().click();
    await WaitUtil.sleep(500);
  }

  async signOut(): Promise<void> {
    this.logger.info('Signing out');
    await this.openProfileMenu();
    const dropdown = this.page.locator(this.DROPDOWN_MENU);
    await dropdown.waitFor({ state: 'visible', timeout: 5_000 });
    await this.page.locator(this.SIGN_OUT_BTN).first().click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.locator(this.PROFILE_AVATAR).first().waitFor({ state: 'visible', timeout: 5_000 });
      return true;
    } catch {
      return false;
    }
  }

  async isNavVisible(): Promise<boolean> {
    return this.isVisible();
  }
}
