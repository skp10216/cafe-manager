/**
 * Browser Manager
 * Playwright 브라우저 인스턴스 관리
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import { createLogger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

const logger = createLogger('BrowserManager');

export class BrowserManager {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();

  /**
   * 브라우저 초기화
   */
  async init(): Promise<Browser> {
    if (!this.browser) {
      const headless = process.env.PLAYWRIGHT_HEADLESS === 'true';
      
      logger.info(`브라우저 시작 (headless: ${headless})`);
      
      this.browser = await chromium.launch({
        headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });
    }
    return this.browser;
  }

  /**
   * 프로필 기반 컨텍스트 생성/재사용
   * 네이버 로그인 세션을 유지하기 위해 프로필 디렉토리 사용
   */
  async getContext(profileDir: string): Promise<BrowserContext> {
    // 이미 열린 컨텍스트가 있으면 재사용
    if (this.contexts.has(profileDir)) {
      return this.contexts.get(profileDir)!;
    }

    await this.init();

    // 프로필 디렉토리 절대 경로
    const profilePath = path.resolve(
      process.env.NAVER_PROFILE_DIR || './playwright-profiles',
      profileDir
    );

    // 디렉토리가 없으면 생성
    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true });
    }

    logger.info(`컨텍스트 생성: ${profileDir}`);

    const context = await this.browser!.newContext({
      storageState: fs.existsSync(path.join(profilePath, 'state.json'))
        ? path.join(profilePath, 'state.json')
        : undefined,
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });

    this.contexts.set(profileDir, context);
    return context;
  }

  /**
   * 컨텍스트 상태 저장
   */
  async saveContext(profileDir: string): Promise<void> {
    const context = this.contexts.get(profileDir);
    if (!context) return;

    const profilePath = path.resolve(
      process.env.NAVER_PROFILE_DIR || './playwright-profiles',
      profileDir
    );

    await context.storageState({
      path: path.join(profilePath, 'state.json'),
    });

    logger.info(`컨텍스트 저장: ${profileDir}`);
  }

  /**
   * 컨텍스트 닫기
   */
  async closeContext(profileDir: string): Promise<void> {
    const context = this.contexts.get(profileDir);
    if (context) {
      await this.saveContext(profileDir);
      await context.close();
      this.contexts.delete(profileDir);
    }
  }

  /**
   * 모든 리소스 정리
   */
  async closeAll(): Promise<void> {
    // 모든 컨텍스트 저장 후 닫기
    for (const profileDir of this.contexts.keys()) {
      await this.closeContext(profileDir);
    }

    // 브라우저 닫기
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    logger.info('모든 브라우저 리소스 정리 완료');
  }

  /**
   * 스크린샷 저장
   */
  async saveScreenshot(
    profileDir: string,
    filename: string
  ): Promise<string | null> {
    const context = this.contexts.get(profileDir);
    if (!context) return null;

    const pages = context.pages();
    if (pages.length === 0) return null;

    const screenshotDir = process.env.SCREENSHOT_DIR || './screenshots';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const screenshotPath = path.join(
      screenshotDir,
      `${filename}-${Date.now()}.png`
    );

    await pages[0].screenshot({ path: screenshotPath, fullPage: true });
    logger.info(`스크린샷 저장: ${screenshotPath}`);

    return screenshotPath;
  }
}









