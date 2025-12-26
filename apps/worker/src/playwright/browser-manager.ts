/**
 * Browser Manager
 * Playwright 브라우저 인스턴스 관리
 * 
 * 운영형 SaaS 고도화:
 * - 기본: Headless 모드
 * - 디버그: Headed 모드 + 아티팩트 저장
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import { createLogger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

const logger = createLogger('BrowserManager');

export class BrowserManager {
  private headlessBrowser: Browser | null = null;
  private headedBrowser: Browser | null = null;
  private contexts: Map<string, { context: BrowserContext; headed: boolean }> = new Map();

  /**
   * Headless 브라우저 초기화
   */
  async initHeadless(): Promise<Browser> {
    if (!this.headlessBrowser) {
      logger.info('Headless 브라우저 시작');

      this.headlessBrowser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });
    }
    return this.headlessBrowser;
  }

  /**
   * Headed 브라우저 초기화 (디버그 모드용)
   */
  async initHeaded(): Promise<Browser> {
    if (!this.headedBrowser) {
      logger.info('Headed 브라우저 시작 (디버그 모드)');

      this.headedBrowser = await chromium.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
        slowMo: 100,  // 디버그 시 동작을 느리게 해서 관찰 용이
      });
    }
    return this.headedBrowser;
  }

  /**
   * 레거시 init (headless 기본값 유지)
   */
  async init(): Promise<Browser> {
    const forceHeaded = process.env.PLAYWRIGHT_HEADLESS === 'false';
    return forceHeaded ? this.initHeaded() : this.initHeadless();
  }

  /**
   * 프로필 기반 컨텍스트 생성/재사용
   * @param profileDir 프로필 디렉토리
   * @param headed true면 디버그 모드 (headed)
   */
  async getContext(profileDir: string, headed = false): Promise<BrowserContext> {
    const contextKey = `${profileDir}:${headed ? 'headed' : 'headless'}`;

    // 이미 열린 컨텍스트가 있으면 재사용
    const existing = this.contexts.get(contextKey);
    if (existing) {
      return existing.context;
    }

    // 브라우저 선택
    const browser = headed ? await this.initHeaded() : await this.initHeadless();

    // 프로필 디렉토리 절대 경로
    const profilePath = path.resolve(
      process.env.NAVER_PROFILE_DIR || './playwright-profiles',
      profileDir
    );

    // 디렉토리가 없으면 생성
    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true });
    }

    logger.info(`컨텍스트 생성: ${profileDir} (headed=${headed})`);

    const context = await browser.newContext({
      storageState: fs.existsSync(path.join(profilePath, 'state.json'))
        ? path.join(profilePath, 'state.json')
        : undefined,
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      // 디버그 모드: 비디오 녹화 (선택적)
      ...(headed && process.env.DEBUG_VIDEO === 'true' ? {
        recordVideo: {
          dir: path.join(process.env.ARTIFACTS_DIR || './artifacts', 'videos'),
          size: { width: 1280, height: 720 },
        },
      } : {}),
    });

    this.contexts.set(contextKey, { context, headed });
    return context;
  }

  /**
   * 컨텍스트 상태 저장
   */
  async saveContext(profileDir: string): Promise<void> {
    // headless와 headed 둘 다 체크
    for (const [key, value] of this.contexts.entries()) {
      if (key.startsWith(profileDir)) {
        const profilePath = path.resolve(
          process.env.NAVER_PROFILE_DIR || './playwright-profiles',
          profileDir
        );

        await value.context.storageState({
          path: path.join(profilePath, 'state.json'),
        });

        logger.info(`컨텍스트 저장: ${profileDir}`);
        return;
      }
    }
  }

  /**
   * 컨텍스트 닫기
   */
  async closeContext(profileDir: string): Promise<void> {
    // headless와 headed 둘 다 체크
    const keysToDelete: string[] = [];

    for (const [key, value] of this.contexts.entries()) {
      if (key.startsWith(profileDir)) {
        await this.saveContext(profileDir);
        await value.context.close();
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.contexts.delete(key));
  }

  /**
   * 모든 리소스 정리
   */
  async closeAll(): Promise<void> {
    // 모든 컨텍스트 저장 후 닫기
    const profileDirs = new Set<string>();
    for (const key of this.contexts.keys()) {
      const profileDir = key.split(':')[0];
      profileDirs.add(profileDir);
    }

    for (const profileDir of profileDirs) {
      await this.closeContext(profileDir);
    }

    // 브라우저들 닫기
    if (this.headlessBrowser) {
      await this.headlessBrowser.close();
      this.headlessBrowser = null;
    }

    if (this.headedBrowser) {
      await this.headedBrowser.close();
      this.headedBrowser = null;
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
    // 해당 프로필의 컨텍스트 찾기
    let context: BrowserContext | null = null;
    for (const [key, value] of this.contexts.entries()) {
      if (key.startsWith(profileDir)) {
        context = value.context;
        break;
      }
    }

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

  /**
   * HTML 스냅샷 저장 (디버그용)
   */
  async saveHtmlSnapshot(
    profileDir: string,
    filename: string
  ): Promise<string | null> {
    let context: BrowserContext | null = null;
    for (const [key, value] of this.contexts.entries()) {
      if (key.startsWith(profileDir)) {
        context = value.context;
        break;
      }
    }

    if (!context) return null;

    const pages = context.pages();
    if (pages.length === 0) return null;

    const artifactsDir = process.env.ARTIFACTS_DIR || './artifacts';
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    const htmlPath = path.join(
      artifactsDir,
      `${filename}-${Date.now()}.html`
    );

    const html = await pages[0].content();
    fs.writeFileSync(htmlPath, html, 'utf-8');
    logger.info(`HTML 스냅샷 저장: ${htmlPath}`);

    return htmlPath;
  }

  /**
   * 에러 발생 시 아티팩트 일괄 저장
   */
  async saveErrorArtifacts(
    profileDir: string,
    jobId: string
  ): Promise<{ screenshot: string | null; html: string | null }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = `error-${jobId}-${timestamp}`;

    const [screenshot, html] = await Promise.all([
      this.saveScreenshot(profileDir, prefix),
      this.saveHtmlSnapshot(profileDir, prefix),
    ]);

    return { screenshot, html };
  }
}
