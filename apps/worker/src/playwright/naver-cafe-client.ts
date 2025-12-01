/**
 * Naver Cafe Client
 * 네이버 카페 관련 Playwright 자동화
 */

import { Page, BrowserContext } from 'playwright';
import { createLogger } from '../utils/logger';
import { NAVER_CAFE_URLS } from '../constants';

const logger = createLogger('NaverCafeClient');

/** 동기화된 게시글 정보 */
export interface SyncedPostInfo {
  cafeId: string;
  boardId: string;
  articleId: string;
  articleUrl: string;
  title: string;
  createdAtRemote?: Date;
}

/**
 * 네이버 카페 클라이언트
 * 로그인, 글쓰기, 내가 쓴 글 동기화 등을 처리
 */
export class NaverCafeClient {
  private page: Page | null = null;

  constructor(private readonly context: BrowserContext) {}

  /**
   * 페이지 가져오기 (없으면 새로 생성)
   */
  private async getPage(): Promise<Page> {
    if (!this.page || this.page.isClosed()) {
      this.page = await this.context.newPage();
    }
    return this.page;
  }

  /**
   * 네이버 로그인 상태 확인
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      const page = await this.getPage();
      await page.goto('https://www.naver.com', { waitUntil: 'domcontentloaded' });
      
      // 로그인 버튼이 있으면 로그인 안됨
      const loginButton = await page.$('.MyView-module__link_login___HpHMW');
      return !loginButton;
    } catch (error) {
      logger.error('로그인 상태 확인 실패:', error);
      return false;
    }
  }

  /**
   * 네이버 로그인 페이지로 이동 (수동 로그인용)
   * 실제 로그인은 사용자가 직접 수행해야 함 (CAPTCHA, 2FA 등)
   */
  async navigateToLogin(): Promise<void> {
    const page = await this.getPage();
    await page.goto(NAVER_CAFE_URLS.LOGIN, { waitUntil: 'domcontentloaded' });
    logger.info('네이버 로그인 페이지로 이동');
  }

  /**
   * 로그인 완료 대기 (수동 로그인 후)
   */
  async waitForLogin(timeoutMs: number = 300000): Promise<boolean> {
    const page = await this.getPage();
    
    try {
      // 네이버 메인으로 리다이렉트될 때까지 대기
      await page.waitForURL('https://www.naver.com/**', {
        timeout: timeoutMs,
      });
      
      // 추가 확인
      const isLoggedIn = await this.isLoggedIn();
      if (isLoggedIn) {
        logger.info('네이버 로그인 성공');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('로그인 대기 시간 초과');
      return false;
    }
  }

  /**
   * 게시글 작성
   */
  async createPost(
    cafeId: string,
    boardId: string,
    title: string,
    content: string
  ): Promise<string | null> {
    const page = await this.getPage();
    
    try {
      // 글쓰기 페이지로 이동
      const writeUrl = NAVER_CAFE_URLS.WRITE(cafeId, boardId);
      logger.info(`글쓰기 페이지 이동: ${writeUrl}`);
      
      await page.goto(writeUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000); // 에디터 로딩 대기

      // 제목 입력
      const titleInput = await page.waitForSelector('input[placeholder*="제목"]', {
        timeout: 10000,
      });
      await titleInput?.fill(title);

      // 본문 입력 (에디터 iframe 내부)
      const editorFrame = page.frameLocator('.se-component-content iframe').first();
      await editorFrame.locator('body').fill(content);

      await page.waitForTimeout(1000);

      // 등록 버튼 클릭
      const submitButton = await page.$('button:has-text("등록")');
      if (submitButton) {
        await submitButton.click();
        await page.waitForNavigation({ waitUntil: 'networkidle' });
      }

      // 작성된 게시글 URL 추출
      const currentUrl = page.url();
      logger.info(`게시글 작성 완료: ${currentUrl}`);
      
      return currentUrl;
    } catch (error) {
      logger.error('게시글 작성 실패:', error);
      return null;
    }
  }

  /**
   * "내가 쓴 글" 목록 동기화
   */
  async syncMyPosts(cafeId: string): Promise<SyncedPostInfo[]> {
    const page = await this.getPage();
    const posts: SyncedPostInfo[] = [];
    
    try {
      // 내가 쓴 글 페이지로 이동
      const myPostsUrl = NAVER_CAFE_URLS.MY_POSTS(cafeId);
      logger.info(`내가 쓴 글 페이지 이동: ${myPostsUrl}`);
      
      await page.goto(myPostsUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 게시글 목록 파싱
      const articleElements = await page.$$('.article-board .inner_list');
      
      for (const element of articleElements) {
        try {
          const titleEl = await element.$('.article');
          const title = await titleEl?.textContent() || '';
          const href = await titleEl?.getAttribute('href') || '';
          
          // URL에서 articleId 추출
          const articleIdMatch = href.match(/articleid=(\d+)/i);
          const articleId = articleIdMatch ? articleIdMatch[1] : '';

          if (articleId) {
            posts.push({
              cafeId,
              boardId: '', // 추후 파싱 필요
              articleId,
              articleUrl: `https://cafe.naver.com${href}`,
              title: title.trim(),
            });
          }
        } catch (parseError) {
          // 개별 게시글 파싱 실패는 무시
          continue;
        }
      }

      logger.info(`동기화 완료: ${posts.length}개 게시글`);
      return posts;
    } catch (error) {
      logger.error('내가 쓴 글 동기화 실패:', error);
      return [];
    }
  }

  /**
   * 페이지 닫기
   */
  async close(): Promise<void> {
    if (this.page && !this.page.isClosed()) {
      await this.page.close();
      this.page = null;
    }
  }
}

