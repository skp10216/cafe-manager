/**
 * Naver Cafe Client
 * 네이버 카페 관련 Playwright 자동화
 * 
 * 주요 기능:
 * - 로그인 상태 확인 및 자동 로그인
 * - 게시글 작성 (이미지 첨부 포함)
 * - 내가 쓴 글 동기화
 * - 게시글 삭제
 */

import { Page, BrowserContext } from 'playwright';
import { createLogger } from '../utils/logger';
import { NAVER_CAFE_URLS } from '../constants';
import {
  SELECTORS,
  findElement,
  findElements,
  waitForElement,
} from './selector-registry';

const logger = createLogger('NaverCafeClient');

// ============================================
// 타입 정의
// ============================================

/** 동기화된 게시글 정보 */
export interface SyncedPostInfo {
  cafeId: string;
  boardId: string;
  articleId: string;
  articleUrl: string;
  title: string;
  createdAtRemote?: Date;
}

/** 네이버 프로필 정보 */
export interface NaverProfile {
  nickname: string;
  profileImageUrl?: string;
}

/** 게시글 작성 파라미터 */
export interface CreatePostParams {
  cafeId: string;
  boardId: string;
  title: string;
  content: string;
  imagePaths?: string[];
  price?: number;
  tradeMethod?: 'DIRECT' | 'DELIVERY' | 'BOTH';
  tradeLocation?: string;
}

/** 게시글 작성 결과 */
export interface CreatePostResult {
  success: boolean;
  articleUrl?: string;
  articleId?: string;
  error?: string;
  uploadedImages?: number;
}

// ============================================
// NaverCafeClient 클래스
// ============================================

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

  // ============================================
  // 로그인 관련 메서드
  // ============================================

  /**
   * 네이버 로그인 상태 확인
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      const page = await this.getPage();
      
      // "내정보" 페이지 접근 시 로그인 페이지로 리다이렉트 되는지 확인
      await page.goto('https://nid.naver.com/user2/help/myInfo', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      const url = page.url();
      if (url.includes('nidlogin.login') || url.includes('nidlogin')) {
        return false;
      }

      // 로그인 폼이 보이면 로그인 안됨
      const hasLoginForm =
        (await page.$('#id')) ||
        (await page.$('#pw')) ||
        (await page.$('input[name="id"]')) ||
        (await page.$('input[type="password"]'));

      if (hasLoginForm) return false;

      // 쿠키 기반 보조 확인
      try {
        const cookies = await this.context.cookies([
          'https://www.naver.com',
          'https://nid.naver.com',
        ]);
        const hasNidAut = cookies.some((c) => c.name === 'NID_AUT' && c.value);
        const hasNidSes = cookies.some((c) => c.name === 'NID_SES' && c.value);
        if (hasNidAut && hasNidSes) return true;
      } catch {
        // 쿠키 조회 실패는 치명적이지 않음
      }

      return true;
    } catch (error) {
      logger.error('로그인 상태 확인 실패:', error);
      return false;
    }
  }

  /**
   * 네이버 자동 로그인
   */
  async login(loginId: string, password: string): Promise<{ success: boolean; error?: string }> {
    const page = await this.getPage();

    try {
      logger.info(`네이버 로그인 시도: ${loginId}`);

      await page.goto(NAVER_CAFE_URLS.LOGIN, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // 아이디 입력
      const idInput = await page.$('#id');
      if (!idInput) {
        throw new Error('아이디 입력 필드를 찾을 수 없습니다');
      }
      await idInput.click();
      
      // 클립보드 방식 시도
      const idClipboardOk = await page.evaluate(async (id) => {
        const nav = (globalThis as any).navigator as any;
        if (nav?.clipboard?.writeText) {
          try {
            await nav.clipboard.writeText(id);
            return true;
          } catch {
            return false;
          }
        }
        return false;
      }, loginId);
      
      if (idClipboardOk) {
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyV');
        await page.keyboard.up('Control');
      } else {
        await page.fill('#id', loginId);
      }
      await page.waitForTimeout(300);

      // 비밀번호 입력
      const pwInput = await page.$('#pw');
      if (!pwInput) {
        throw new Error('비밀번호 입력 필드를 찾을 수 없습니다');
      }
      await pwInput.click();
      
      const pwClipboardOk = await page.evaluate(async (pw) => {
        const nav = (globalThis as any).navigator as any;
        if (nav?.clipboard?.writeText) {
          try {
            await nav.clipboard.writeText(pw);
            return true;
          } catch {
            return false;
          }
        }
        return false;
      }, password);
      
      if (pwClipboardOk) {
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyV');
        await page.keyboard.up('Control');
      } else {
        await page.fill('#pw', password);
      }
      await page.waitForTimeout(300);

      // 로그인 버튼 클릭
      const loginButton = await page.$('#log\\.login');
      if (!loginButton) {
        throw new Error('로그인 버튼을 찾을 수 없습니다');
      }
      await loginButton.click();

      // 로그인 결과 대기
      try {
        await page.waitForURL('https://www.naver.com/**', { timeout: 30000 });
        
        const isLoggedIn = await this.isLoggedIn();
        if (isLoggedIn) {
          logger.info(`네이버 로그인 성공: ${loginId}`);
          return { success: true };
        }
        return { success: false, error: '로그인 후 상태 확인 실패' };
      } catch {
        // 로그인 실패 처리
        const errorEl = await page.$('.error_message, .err_msg');
        const errorText = errorEl ? (await errorEl.textContent())?.trim() : null;

        if (errorText && !errorText.includes('Caps Lock')) {
          logger.error(`네이버 로그인 실패: ${errorText}`);
          return { success: false, error: errorText };
        }

        // CAPTCHA/2FA 감지
        const captchaEl = await page.$('#captcha');
        if (captchaEl) {
          return { success: false, error: 'CAPTCHA 인증이 필요합니다. 수동 로그인이 필요합니다.' };
        }

        const twoFactorEl = await page.$('[class*="two_factor"], [class*="auth_"]');
        if (twoFactorEl) {
          return { success: false, error: '2단계 인증이 필요합니다. 수동 로그인이 필요합니다.' };
        }

        const url = page.url();
        return {
          success: false,
          error: `수동 로그인이 필요합니다. url=${url}`,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`네이버 로그인 오류: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 네이버 로그인 페이지로 이동 (수동 로그인용)
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
      await page.waitForURL('https://www.naver.com/**', { timeout: timeoutMs });
      return await this.isLoggedIn();
    } catch {
      logger.error('로그인 대기 시간 초과');
      return false;
    }
  }

  // ============================================
  // 프로필 관련 메서드
  // ============================================

  /**
   * 네이버 프로필 정보 가져오기
   * 여러 방법을 순차적으로 시도하여 안정적으로 닉네임을 가져옴
   */
  async getProfile(): Promise<NaverProfile | null> {
    try {
      const page = await this.getPage();
      let nickname: string | null = null;
      let profileImageUrl: string | undefined;

      logger.info('프로필 확인 시작');
      
      // 방법 1: 네이버 메인 페이지에서 프로필 정보 가져오기
      nickname = await this.getProfileFromNaverMain(page);
      
      // 방법 2: 네이버 프로필 API 호출 시도
      if (!nickname) {
        nickname = await this.getProfileFromNaverApi(page);
      }
      
      // 방법 3: 네이버 MY 페이지에서 가져오기
      if (!nickname) {
        nickname = await this.getProfileFromMyPage(page);
      }
      
      // 방법 4: 내정보 페이지에서 닉네임 찾기 (레거시)
      if (!nickname) {
        nickname = await this.getProfileFromMyInfo(page);
      }

      if (nickname) {
        logger.info(`프로필 확인 성공: ${nickname}`);
        return { nickname, profileImageUrl };
      }

      logger.warn('네이버 닉네임을 가져올 수 없습니다');
      return null;
    } catch (error) {
      logger.error('프로필 정보 가져오기 실패:', error);
      return null;
    }
  }

  /**
   * 네이버 메인 페이지에서 로그인된 사용자 닉네임 가져오기
   */
  private async getProfileFromNaverMain(page: Page): Promise<string | null> {
    try {
      await page.goto('https://www.naver.com', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      await page.waitForTimeout(1000);

      // 네이버 메인 상단의 로그인된 사용자 영역에서 닉네임 찾기
      const mainSelectors = [
        // 네이버 메인 MY 영역
        '.MyView-module__my_name___Bfg5u',
        '[class*="my_name"]',
        // 로그인 버튼 옆 사용자명
        '.login_profile .name',
        '.MyView-module__link_login___HpHMW span',
        // 프로필 영역
        '[class*="profile_name"]',
        '.gnb_my_namebox .gnb_name',
      ];

      for (const selector of mainSelectors) {
        try {
          const el = await page.$(selector);
          if (el) {
            const text = await el.textContent();
            if (text && text.trim().length > 0 && text.trim().length < 30) {
              logger.debug(`네이버 메인에서 닉네임 발견 (${selector}): ${text.trim()}`);
              return text.trim();
            }
          }
        } catch {
          // 셀렉터 실패 시 다음 시도
        }
      }
      return null;
    } catch (error) {
      logger.debug('네이버 메인에서 프로필 가져오기 실패:', error);
      return null;
    }
  }

  /**
   * 네이버 프로필 API를 통해 닉네임 가져오기
   */
  private async getProfileFromNaverApi(page: Page): Promise<string | null> {
    try {
      // 네이버 프로필 API 직접 호출
      const response = await page.evaluate(async () => {
        try {
          const res = await fetch('https://nid.naver.com/user2/api/profile', {
            credentials: 'include',
          });
          if (res.ok) {
            const data = await res.json() as { result?: { nickname?: string; name?: string } };
            return data?.result?.nickname || data?.result?.name || null;
          }
        } catch {
          // API 호출 실패
        }
        return null;
      });

      if (response) {
        logger.debug(`네이버 API에서 닉네임 발견: ${response}`);
        return response;
      }
      return null;
    } catch (error) {
      logger.debug('네이버 API 프로필 가져오기 실패:', error);
      return null;
    }
  }

  /**
   * 네이버 MY 페이지에서 닉네임 가져오기
   */
  private async getProfileFromMyPage(page: Page): Promise<string | null> {
    try {
      await page.goto('https://my.naver.com', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      await page.waitForTimeout(1000);

      const myPageSelectors = [
        '.profile_area .name',
        '.my_profile_area .name',
        '[class*="profile"] [class*="name"]',
        '.user_name',
        '.nickname',
      ];

      for (const selector of myPageSelectors) {
        try {
          const el = await page.$(selector);
          if (el) {
            const text = await el.textContent();
            if (text && text.trim().length > 0 && text.trim().length < 30) {
              logger.debug(`MY 페이지에서 닉네임 발견 (${selector}): ${text.trim()}`);
              return text.trim();
            }
          }
        } catch {
          // 셀렉터 실패 시 다음 시도
        }
      }
      return null;
    } catch (error) {
      logger.debug('MY 페이지에서 프로필 가져오기 실패:', error);
      return null;
    }
  }

  /**
   * 네이버 내정보 페이지에서 닉네임 가져오기 (레거시)
   */
  private async getProfileFromMyInfo(page: Page): Promise<string | null> {
    try {
      await page.goto('https://nid.naver.com/user2/help/myInfo', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      await page.waitForTimeout(1200);

      const nicknameSelectors = [
        // 새로운 UI 셀렉터들
        '.nickname_row input',
        '[data-testid="nickname"]',
        'input[name="nickname"]',
        'input#nickname',
        // 클래스 기반
        '[class*="nickname"] input',
        '[class*="nickname"]',
        '.nickname',
        // 테이블 형태 UI
        'td input[type="text"]',
        '.info_data input',
      ];

      for (const selector of nicknameSelectors) {
        try {
          const el = await page.$(selector);
          if (!el) continue;
          const tagName = await el.evaluate((e) => e.tagName.toLowerCase());
          const text = tagName === 'input' 
            ? await el.getAttribute('value') 
            : await el.textContent();
          if (text && text.trim().length > 0 && text.trim().length < 30) {
            logger.debug(`내정보 페이지에서 닉네임 발견 (${selector}): ${text.trim()}`);
            return text.trim();
          }
        } catch {
          // 셀렉터 실패 시 다음 시도
        }
      }
      return null;
    } catch (error) {
      logger.debug('내정보 페이지에서 프로필 가져오기 실패:', error);
      return null;
    }
  }

  /**
   * 세션 검증
   */
  async verifySession(): Promise<{ isValid: boolean; profile?: NaverProfile; error?: string }> {
    try {
      const isLoggedIn = await this.isLoggedIn();
      
      if (!isLoggedIn) {
        return { isValid: false, error: '로그인되어 있지 않습니다' };
      }
      
      const profile = await this.getProfile();
      
      return {
        isValid: true,
        profile: profile || undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { isValid: false, error: errorMessage };
    }
  }

  // ============================================
  // 게시글 작성 메서드
  // ============================================

  /**
   * 게시글 작성 (이미지 첨부 포함)
   */
  async createPost(params: CreatePostParams): Promise<CreatePostResult> {
    const { cafeId, boardId, title, content, imagePaths = [] } = params;
    const page = await this.getPage();
    let uploadedImages = 0;
    
    try {
      // 1. 글쓰기 페이지로 이동
      const writeUrl = NAVER_CAFE_URLS.WRITE(cafeId, boardId);
      logger.info(`글쓰기 페이지 이동: ${writeUrl}`);
      
      await page.goto(writeUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      // 에디터 로딩 대기 (충분한 시간)
      logger.info('에디터 로딩 대기 중...');
      await page.waitForTimeout(5000);
      
      // 디버깅: 페이지 스크린샷 저장
      await this.saveScreenshot('write-page-loaded');
      
      // 2. 제목 입력
      logger.info('제목 입력 필드 찾는 중...');
      
      // 먼저 모든 가능한 제목 필드 확인
      let titleInput = await waitForElement(page, 'WRITE_TITLE', 10000);
      
      // 찾지 못한 경우 추가 시도
      if (!titleInput) {
        logger.warn('기본 셀렉터로 제목 필드를 찾지 못함. 추가 시도...');
        
        // 페이지 내 모든 input/textarea 로깅 (디버깅용)
        const inputs = await page.$$('input, textarea');
        for (const input of inputs) {
          const tagName = await input.evaluate(el => el.tagName);
          const className = await input.getAttribute('class') || '';
          const placeholder = await input.getAttribute('placeholder') || '';
          const name = await input.getAttribute('name') || '';
          logger.info(`[DEBUG] Found ${tagName}: class="${className}", placeholder="${placeholder}", name="${name}"`);
        }
        
        // 직접 시도: textarea 또는 input 중 제목 관련 요소
        titleInput = await page.$('textarea') || await page.$('input[type="text"]:not([type="hidden"])');
      }
      
      if (!titleInput) {
        await this.saveScreenshot('title-not-found');
        throw new Error('제목 입력 필드를 찾을 수 없습니다. 페이지 구조가 변경되었을 수 있습니다.');
      }
      
      // 제목 입력
      await titleInput.click();
      await page.waitForTimeout(300);
      
      // fill이 안되면 type으로 시도
      try {
        await titleInput.fill(title);
      } catch {
        logger.info('fill 실패, keyboard.type으로 시도');
        await page.keyboard.type(title, { delay: 30 });
      }
      
      logger.info(`제목 입력 완료: ${title}`);

      // 3. 이미지 업로드 (이미지가 있는 경우)
      if (imagePaths.length > 0) {
        logger.info(`이미지 업로드 시작: ${imagePaths.length}개`);
        uploadedImages = await this.uploadImages(page, imagePaths);
        logger.info(`이미지 업로드 완료: ${uploadedImages}개`);
      }

      // 4. 본문 입력
      logger.info('본문 입력 중...');
      await this.inputContent(page, content);
      logger.info('본문 입력 완료');

      // 5. 게시 버튼 클릭
      await page.waitForTimeout(1000);
      
      // 혹시 열린 다이얼로그(파일 탐색기 등)가 있으면 닫기
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      logger.info('등록 버튼 찾는 중...');
      
      // 등록 버튼 찾기 (여러 방법 시도)
      let submitClicked = false;
      
      // ============================================
      // 중요: 등록 버튼은 <a> 태그이고 클래스가 BaseButton--skinGreen!
      // <a role="button" class="BaseButton BaseButton--skinGreen">
      //   <span class="BaseButton__txt">등록</span>
      // </a>
      // ============================================
      
      // 방법 1: JavaScript로 <a> 태그 포함 모든 버튼 검색
      const jsResult = await page.evaluate(() => {
        // button과 a[role="button"] 모두 검색
        const allClickables = Array.from(document.querySelectorAll<HTMLElement>('button, a[role="button"], a.BaseButton'));
        
        console.log(`[DEBUG] 클릭 가능 요소 수: ${allClickables.length}`);
        
        // 1차: BaseButton--skinGreen 클래스 + "등록" 텍스트 (가장 정확)
        for (const el of allClickables) {
          const isSkinGreen = el.className.includes('skinGreen') || el.className.includes('skin-green');
          const span = el.querySelector('span.BaseButton__txt');
          const spanText = span?.textContent?.trim();
          
          if (isSkinGreen && spanText === '등록') {
            console.log('[방법1] skinGreen 등록 버튼 발견!');
            el.click();
            return { success: true, method: 'skinGreen + span' };
          }
        }
        
        // 2차: span.BaseButton__txt 내부 텍스트가 정확히 "등록"
        for (const el of allClickables) {
          const span = el.querySelector('span.BaseButton__txt');
          if (span && span.textContent?.trim() === '등록') {
            if (!el.textContent?.includes('임시')) {
              console.log('[방법2] span.BaseButton__txt 등록 버튼 발견');
              el.click();
              return { success: true, method: 'span.BaseButton__txt' };
            }
          }
        }
        
        // 3차: green/Green 클래스 + 등록 텍스트
        for (const el of allClickables) {
          const hasGreen = el.className.toLowerCase().includes('green');
          const text = el.textContent?.trim() || '';
          if (hasGreen && text.includes('등록') && !text.includes('임시')) {
            console.log('[방법3] green 클래스 등록 버튼 발견:', text);
            el.click();
            return { success: true, method: 'green-class' };
          }
        }
        
        // 4차: 텍스트가 정확히 "등록"만 있는 요소
        for (const el of allClickables) {
          const text = el.textContent?.trim();
          if (text === '등록') {
            console.log('[방법4] 정확히 "등록" 텍스트 버튼 발견');
            el.click();
            return { success: true, method: 'exact-text' };
          }
        }
        
        // 5차: "등록" 포함 + "임시" 미포함 (마지막 것 = 우측 버튼)
        const registerEls = allClickables.filter(el => {
          const text = el.textContent?.trim() || '';
          return text.includes('등록') && !text.includes('임시');
        });
        
        if (registerEls.length > 0) {
          const lastEl = registerEls[registerEls.length - 1];
          console.log('[방법5] 등록 버튼 (마지막) 발견:', lastEl.textContent?.trim());
          lastEl.click();
          return { success: true, method: 'last-register' };
        }
        
        // 디버깅: 찾은 요소 정보
        const debugInfo = allClickables.map(el => ({
          tag: el.tagName,
          class: el.className,
          text: el.textContent?.trim().substring(0, 30),
        }));
        
        return { success: false, method: 'none', count: allClickables.length, debug: debugInfo };
      });
      
      if (jsResult.success) {
        logger.info(`등록 버튼 클릭 성공 (${jsResult.method})`);
        submitClicked = true;
      } else {
        logger.warn(`JavaScript 버튼 찾기 실패: ${JSON.stringify(jsResult)}`);
      }
      
      // 방법 2: Playwright Locator 사용 (백업)
      if (!submitClicked) {
        logger.info('Playwright Locator로 등록 버튼 찾기 시도...');
        
        const selectors = [
          // <a> 태그 + skinGreen 클래스
          'a.BaseButton--skinGreen:has(span.BaseButton__txt)',
          'a[role="button"]:has(span:text("등록"))',
          // button 태그
          'button.BaseButton--skinGreen',
          'button.BaseButton--green',
          // 범용
          '.BaseButton--skinGreen',
          '[role="button"]:has-text("등록"):not(:has-text("임시"))',
        ];
        
        for (const selector of selectors) {
          try {
            const btn = page.locator(selector).last();
            const isVisible = await btn.isVisible({ timeout: 1000 }).catch(() => false);
            if (isVisible) {
              const text = await btn.textContent().catch(() => '');
              if (!text?.includes('임시')) {
                logger.info(`등록 버튼 클릭 (Locator: ${selector})`);
                await btn.click({ timeout: 5000 });
                submitClicked = true;
                break;
              }
            }
          } catch {
            continue;
          }
        }
      }
      
      if (!submitClicked) {
        await this.saveScreenshot('submit-button-not-found');
        throw new Error('등록 버튼을 찾거나 클릭할 수 없습니다');
      }

      // 6. 게시 완료 대기 및 결과 확인
      logger.info('게시 완료 대기 중...');
      
      let articleUrl: string | undefined;
      let articleId: string | undefined;
      
      // 6-1. URL 변경 대기 (최대 15초)
      try {
        await page.waitForURL(
          (url) => {
            const urlStr = url.toString();
            // 글쓰기 페이지가 아닌 다른 페이지로 이동했는지 확인
            const isNotWritePage = !urlStr.includes('/articles/write') && !urlStr.includes('/write');
            // 게시글 페이지 또는 목록 페이지로 이동
            const isArticlePage = /\/articles\/\d+/.test(urlStr) || urlStr.includes('articleid=');
            const isListPage = urlStr.includes('/articles') && !urlStr.includes('/write');
            return isNotWritePage && (isArticlePage || isListPage);
          },
          { timeout: 15000 }
        );
        
        const newUrl = page.url();
        logger.info(`페이지 이동 감지: ${newUrl}`);
        
        // articleId 추출
        const articleIdMatch = newUrl.match(/\/articles\/(\d+)|articleid=(\d+)/i);
        if (articleIdMatch) {
          articleId = articleIdMatch[1] || articleIdMatch[2];
          articleUrl = newUrl;
        }
      } catch {
        // URL이 변경되지 않은 경우 - 다른 방법으로 확인
        logger.warn('URL 변경 감지 실패. 다른 방법으로 게시 결과 확인...');
      }
      
      // 6-2. 확인 팝업/토스트 메시지 처리
      await page.waitForTimeout(1000);
      
      // 성공 메시지 확인
      const successMessages = [
        '등록되었습니다',
        '작성되었습니다',
        '게시되었습니다',
        '완료되었습니다',
      ];
      
      const pageText = await page.textContent('body') || '';
      const hasSuccessMessage = successMessages.some(msg => pageText.includes(msg));
      
      if (hasSuccessMessage) {
        logger.info('게시 성공 메시지 확인됨');
        
        // 확인 버튼이 있으면 클릭
        try {
          const confirmBtn = page.locator('button:has-text("확인")').first();
          const hasConfirm = await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false);
          if (hasConfirm) {
            await confirmBtn.click();
            await page.waitForTimeout(2000);
            
            // 확인 후 URL 다시 체크
            const finalUrl = page.url();
            const finalMatch = finalUrl.match(/\/articles\/(\d+)|articleid=(\d+)/i);
            if (finalMatch) {
              articleId = finalMatch[1] || finalMatch[2];
              articleUrl = finalUrl;
            }
          }
        } catch {
          // 무시
        }
      }
      
      // 6-3. 에러 메시지 확인 (게시 관련 에러만)
      const postErrorMessages = [
        '제목을 입력',
        '내용을 입력',
        '입력해 주세요',
        '선택해 주세요',
        '게시판을 선택',
        '등록할 수 없',
        '권한이 없습니다',
      ];
      
      const hasPostError = postErrorMessages.some(msg => pageText.includes(msg));
      
      // 6-4. 최종 결과 판단
      const finalUrl = page.url();
      const isStillOnWritePage = finalUrl.includes('/articles/write') || finalUrl.includes('/write');
      
      // ============================================
      // 성공 조건 (우선순위 순서):
      // 1. articleId가 있으면 무조건 성공
      // 2. 성공 메시지가 있고 게시 관련 에러가 없으면 성공
      // 3. 글쓰기 페이지에서 벗어났으면 성공
      // ============================================
      
      // 조건 1: articleId가 있으면 성공
      if (articleId) {
        if (!articleUrl) {
          articleUrl = `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles/${articleId}`;
        }
        logger.info(`게시글 작성 완료: articleId=${articleId}, url=${articleUrl}`);
        return {
          success: true,
          articleUrl,
          articleId,
          uploadedImages,
        };
      }
      
      // 조건 2: 성공 메시지가 있고 게시 에러가 없으면 성공 (articleId 없어도)
      if (hasSuccessMessage && !hasPostError) {
        logger.info('게시글 작성 완료 (성공 메시지 확인, articleId 미확인)');
        
        // 게시 후 잠시 대기 후 URL 재확인
        await page.waitForTimeout(2000);
        const retryUrl = page.url();
        const retryMatch = retryUrl.match(/\/articles\/(\d+)|articleid=(\d+)/i);
        
        if (retryMatch) {
          articleId = retryMatch[1] || retryMatch[2];
          articleUrl = retryUrl;
          logger.info(`articleId 재확인 성공: ${articleId}`);
        }
        
        return {
          success: true,
          articleUrl: articleUrl || retryUrl,
          articleId,
          uploadedImages,
        };
      }
      
      // 조건 3: 글쓰기 페이지에서 벗어났으면 성공
      if (!isStillOnWritePage) {
        logger.info('게시글 작성 완료 (페이지 이동 확인)');
        
        const urlMatch = finalUrl.match(/\/articles\/(\d+)|articleid=(\d+)/i);
        if (urlMatch) {
          articleId = urlMatch[1] || urlMatch[2];
        }
        
        return {
          success: true,
          articleUrl: finalUrl,
          articleId,
          uploadedImages,
        };
      }
      
      // ============================================
      // 실패 처리
      // ============================================
      await this.saveScreenshot('post-failed');
      
      // 게시 관련 에러 메시지만 추출 (관련 없는 팝업 제외)
      let errorText: string | null = null;
      
      // SE 에디터 에러 메시지 확인
      const seErrorEl = await page.$('.se-alert-message, .se-popup-alert, [class*="error_message"]');
      if (seErrorEl) {
        errorText = await seErrorEl.textContent();
      }
      
      // 게시 관련 에러가 있으면 해당 메시지 사용
      if (!errorText && hasPostError) {
        for (const errMsg of postErrorMessages) {
          if (pageText.includes(errMsg)) {
            // 해당 에러 메시지 주변 텍스트 추출
            const idx = pageText.indexOf(errMsg);
            errorText = pageText.substring(Math.max(0, idx - 20), Math.min(pageText.length, idx + 50)).trim();
            break;
          }
        }
      }
      
      // 페이지 상태 로깅
      logger.error(`게시 실패 - 현재 URL: ${finalUrl}`);
      logger.error(`게시 실패 - 글쓰기 페이지 여부: ${isStillOnWritePage}`);
      logger.error(`게시 실패 - 성공 메시지 여부: ${hasSuccessMessage}`);
      logger.error(`게시 실패 - 에러 메시지: ${errorText || '없음'}`);
      
      throw new Error(errorText?.trim() || '게시글 등록에 실패했습니다. 등록 버튼이 클릭되었지만 페이지가 이동하지 않았습니다.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('게시글 작성 실패:', errorMessage);
      return { 
        success: false, 
        error: errorMessage,
        uploadedImages,
      };
    }
  }

  /**
   * 이미지 업로드
   * 
   * 네이버 카페 SE ONE 에디터는 여러 방식의 이미지 업로드를 지원합니다:
   * 1. 숨겨진 file input에 직접 설정 (가장 안정적)
   * 2. 이미지 버튼 클릭 + fileChooser 이벤트 처리
   * 3. 드래그 앤 드롭 (구현 복잡)
   */
  private async uploadImages(page: Page, imagePaths: string[]): Promise<number> {
    if (imagePaths.length === 0) return 0;
    
    let uploadedCount = 0;
    
    try {
      // 방법 1: 숨겨진 file input 찾기
      const fileInputSelectors = [
        'input[type="file"][accept*="image"]',
        'input[type="file"][multiple]',
        'input.se-image-file-input',
        '.se-image-uploader input[type="file"]',
        'input[type="file"]',
      ];
      
      let fileInput: any = null;
      for (const selector of fileInputSelectors) {
        const inputs = await page.$$(selector);
        for (const input of inputs) {
          // accept 속성이 image를 포함하는지 확인
          const accept = await input.getAttribute('accept');
          if (!accept || accept.includes('image')) {
            fileInput = input;
            logger.info(`파일 input 발견: ${selector}`);
            break;
          }
        }
        if (fileInput) break;
      }
      
      if (fileInput) {
        // 숨겨진 input에 파일 직접 설정
        await fileInput.setInputFiles(imagePaths);
        uploadedCount = imagePaths.length;
        logger.info(`이미지 ${uploadedCount}개 업로드 설정 완료 (input 방식)`);
      } else {
        // 방법 2: 이미지 버튼 클릭 + fileChooser 이벤트
        logger.info('파일 input을 찾을 수 없음. 이미지 버튼 클릭 방식 시도...');
        
        const imageButtonSelectors = [
          'button[data-name="image"]',
          'button[data-log="image"]',
          '.se-toolbar-item-image',
          '[aria-label*="사진"]',
          '[aria-label*="이미지"]',
          'button[class*="image"]',
        ];
        
        let imageButton: any = null;
        for (const selector of imageButtonSelectors) {
          imageButton = await page.$(selector);
          if (imageButton) {
            const isVisible = await imageButton.isVisible().catch(() => false);
            if (isVisible) {
              logger.info(`이미지 버튼 발견: ${selector}`);
              break;
            }
            imageButton = null;
          }
        }
        
        if (imageButton) {
          // fileChooser 이벤트 대기하면서 버튼 클릭
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 5000 }),
            imageButton.click(),
          ]);
          
          // 파일 선택
          await fileChooser.setFiles(imagePaths);
          uploadedCount = imagePaths.length;
          logger.info(`이미지 ${uploadedCount}개 파일 선택 완료 (fileChooser 방식)`);
          
          // 이미지 업로드 대기 (네트워크 전송 시간)
          await page.waitForTimeout(2000);
          
          // ============================================
          // 중요: "사진 첨부 방식" 모달 처리
          // ============================================
          // 네이버 카페는 여러 이미지 선택 시 레이아웃 선택 모달이 나타남
          // - 개별사진 (선택해야 함)
          // - 콜라주
          // - 슬라이드
          
          logger.info('"사진 첨부 방식" 모달 확인 중...');
          
          // "사진 첨부 방식" 모달이 나타나는지 확인
          let layoutModalHandled = false;
          
          // 모달 텍스트 확인
          const modalText = await page.textContent('body').catch(() => '');
          const hasLayoutModal = modalText?.includes('사진 첨부 방식') || 
                                 modalText?.includes('레이아웃');
          
          if (hasLayoutModal) {
            logger.info('"사진 첨부 방식" 모달 발견. "개별사진" 선택...');
            
            // "개별사진" 옵션 클릭 시도
            const layoutSelectors = [
              // 텍스트로 찾기
              'text=개별사진',
              ':text("개별사진")',
              // 첫 번째 옵션 (일반적으로 개별사진)
              '[class*="layout"] > *:first-child',
              '[class*="option"]:first-child',
              '[class*="item"]:first-child',
              // 이미지/썸네일 클릭
              '[class*="layout"] img:first-of-type',
              '[class*="thumb"]:first-child',
            ];
            
            // 방법 1: Locator로 클릭
            for (const selector of layoutSelectors) {
              try {
                const option = page.locator(selector).first();
                const isVisible = await option.isVisible({ timeout: 1000 }).catch(() => false);
                if (isVisible) {
                  logger.info(`개별사진 옵션 클릭: ${selector}`);
                  await option.click({ timeout: 3000 });
                  layoutModalHandled = true;
                  break;
                }
              } catch {
                continue;
              }
            }
            
            // 방법 2: JavaScript로 첫 번째 옵션 클릭
            if (!layoutModalHandled) {
              logger.info('개별사진 옵션 JavaScript 클릭 시도...');
              layoutModalHandled = await page.evaluate(() => {
                // "개별사진" 텍스트가 있는 요소 찾기
                const allElements = document.querySelectorAll<HTMLElement>('*');
                for (const el of allElements) {
                  if (el.textContent?.trim() === '개별사진') {
                    // 부모 요소나 자신을 클릭
                    const clickTarget = (el.closest('button, a, [role="button"], li, div[class*="item"], div[class*="option"]') || el) as HTMLElement;
                    clickTarget.click();
                    return true;
                  }
                }
                
                // 모달 내 첫 번째 클릭 가능한 옵션 찾기
                const modal = document.querySelector('[class*="modal"], [class*="popup"], [class*="layer"]');
                if (modal) {
                  const firstOption = modal.querySelector<HTMLElement>('[class*="item"], [class*="option"], [class*="layout"] > *:first-child');
                  if (firstOption) {
                    firstOption.click();
                    return true;
                  }
                }
                
                return false;
              });
            }
            
            // 방법 3: 모달 내 첫 번째 이미지/영역 클릭
            if (!layoutModalHandled) {
              logger.info('모달 내 첫 번째 영역 클릭 시도...');
              try {
                // 모달 영역에서 클릭 가능한 첫 번째 요소 찾기
                const modalArea = page.locator('[class*="modal"], [class*="popup"], [class*="layer"], [role="dialog"]').first();
                const firstClickable = modalArea.locator('div, button, img').first();
                await firstClickable.click({ timeout: 2000 });
                layoutModalHandled = true;
              } catch {
                // 무시
              }
            }
            
            await page.waitForTimeout(1000);
          }
          
          // 아직 모달이 열려있으면 ESC로 닫기
          const stillHasModal = await page.textContent('body').then(t => t?.includes('사진 첨부 방식')).catch(() => false);
          if (stillHasModal) {
            logger.warn('모달이 아직 열려있음. ESC로 닫기 시도...');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }
          
          // 모달 닫힘 대기
          await page.waitForTimeout(1000);
          
        } else {
          logger.warn('이미지 버튼을 찾을 수 없습니다. 이미지 업로드를 건너뜁니다.');
          return 0;
        }
      }
      
      // 업로드 처리 대기
      await page.waitForTimeout(2000);
      
      // 업로드 완료 확인 (에디터 내 이미지)
      const imagePreviewSelectors = [
        '.se-image-resource',
        '.se-component.se-image',
        'img[src*="pstatic"]',
        'img[src*="post-phinf"]',
      ];
      
      for (const selector of imagePreviewSelectors) {
        const previews = await page.$$(selector);
        if (previews.length > 0) {
          logger.info(`에디터 내 이미지 확인: ${previews.length}개 (${selector})`);
          break;
        }
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`이미지 업로드 중 오류: ${errorMsg}`);
      
      // 혹시 열린 다이얼로그/모달이 있으면 ESC로 닫기
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape'); // 한 번 더 시도
        await page.waitForTimeout(500);
      } catch {
        // 무시
      }
    }
    
    return uploadedCount;
  }

  /**
   * 본문 내용 입력
   */
  private async inputContent(page: Page, content: string): Promise<void> {
    logger.info('본문 입력 영역 찾는 중...');
    
    // 방법 1: SE ONE 에디터 (contenteditable, iframe 아님)
    // 새 네이버 카페 에디터는 주로 이 방식 사용
    const seOneEditorSelectors = [
      '.se-component.se-text .se-text-paragraph',
      '.se-content [contenteditable="true"]',
      '.se-component-content',
      '.ProseMirror',
    ];
    
    for (const selector of seOneEditorSelectors) {
      try {
        const editor = await page.$(selector);
        if (editor) {
          const isVisible = await editor.isVisible();
          if (isVisible) {
            await editor.click();
            await page.waitForTimeout(300);
            await this.typeContent(page, content);
            logger.info(`본문 입력 완료 (SE ONE: ${selector})`);
            return;
          }
        }
      } catch {
        // 다음 셀렉터 시도
      }
    }
    
    // 방법 2: 범용 contenteditable 요소
    const editableElements = await page.$$('[contenteditable="true"]');
    for (const el of editableElements) {
      try {
        const isVisible = await el.isVisible();
        const box = await el.boundingBox();
        // 충분히 큰 영역이어야 에디터로 간주 (최소 100x50)
        if (isVisible && box && box.width > 100 && box.height > 50) {
          await el.click();
          await page.waitForTimeout(300);
          await this.typeContent(page, content);
          logger.info('본문 입력 완료 (contenteditable 방식)');
          return;
        }
      } catch {
        continue;
      }
    }
    
    // 방법 3: iframe 내 에디터 (구버전)
    const editorSelectors = SELECTORS.WRITE_EDITOR_FRAME;
    for (const frameSelector of editorSelectors) {
      try {
        const frame = page.frameLocator(frameSelector);
        const body = frame.locator('body, .se-content, [contenteditable="true"]').first();
        
        const isVisible = await body.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) {
          await body.click();
          await page.waitForTimeout(300);
          await this.typeContent(page, content);
          logger.info('본문 입력 완료 (iframe 방식)');
          return;
        }
      } catch {
        // 다음 셀렉터 시도
      }
    }

    // 방법 4: textarea에 입력 (fallback)
    const textareaEl = await page.$('textarea[name="content"], textarea#content, textarea.textarea_content');
    if (textareaEl) {
      await textareaEl.fill(content);
      logger.info('본문 입력 완료 (textarea 방식)');
      return;
    }

    // 디버깅: 스크린샷 저장
    await this.saveScreenshot('content-editor-not-found');
    throw new Error('본문 입력 영역을 찾을 수 없습니다');
  }
  
  /**
   * 키보드로 내용 타이핑 (줄바꿈 처리)
   */
  private async typeContent(page: Page, content: string): Promise<void> {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 0) {
        await page.keyboard.type(lines[i], { delay: 20 });
      }
      if (i < lines.length - 1) {
        await page.keyboard.press('Enter');
      }
    }
  }

  // ============================================
  // 내가 쓴 글 동기화
  // ============================================

  /**
   * "내가 쓴 글" 목록 동기화
   */
  async syncMyPosts(cafeId: string, maxPages: number = 1): Promise<SyncedPostInfo[]> {
    const page = await this.getPage();
    const posts: SyncedPostInfo[] = [];
    
    try {
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const myPostsUrl = `${NAVER_CAFE_URLS.MY_POSTS(cafeId)}?page=${pageNum}`;
        logger.info(`내가 쓴 글 페이지 이동: ${myPostsUrl}`);
        
        await page.goto(myPostsUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);

        // 게시글 목록 파싱
        const articleElements = await findElements(page, 'MY_POSTS_ITEM');
        
        if (articleElements.length === 0) {
          logger.info(`페이지 ${pageNum}: 게시글 없음`);
          break;
        }

        for (const element of articleElements) {
          try {
            // 제목과 링크 찾기
            const titleLink = await element.$('a[href*="article"]');
            if (!titleLink) continue;

            const title = (await titleLink.textContent())?.trim() || '';
            const href = await titleLink.getAttribute('href') || '';
            
            // URL에서 articleId 추출
            const articleIdMatch = href.match(/articles\/(\d+)|articleid=(\d+)/i);
            const articleId = articleIdMatch ? (articleIdMatch[1] || articleIdMatch[2]) : '';

            if (articleId) {
              posts.push({
                cafeId,
                boardId: '', // URL에서 추출 필요
                articleId,
                articleUrl: href.startsWith('http') ? href : `https://cafe.naver.com${href}`,
                title,
              });
            }
          } catch (parseError) {
            continue;
          }
        }

        logger.info(`페이지 ${pageNum}: ${articleElements.length}개 파싱`);

        // 다음 페이지 확인
        const nextButton = await page.$('[class*="next"], .pgR a');
        if (!nextButton) break;
      }

      logger.info(`동기화 완료: 총 ${posts.length}개 게시글`);
      return posts;
    } catch (error) {
      logger.error('내가 쓴 글 동기화 실패:', error);
      return posts; // 부분 결과라도 반환
    }
  }

  // ============================================
  // 게시글 삭제
  // ============================================

  /**
   * 게시글 삭제
   */
  async deletePost(cafeId: string, articleId: string, articleUrl?: string): Promise<boolean> {
    const page = await this.getPage();
    
    try {
      // 게시글 페이지로 이동
      const url = articleUrl || 
        `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles/${articleId}`;
      
      logger.info(`게시글 삭제 시작: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // 삭제 버튼 찾기
      const deleteButton = await waitForElement(page, 'DELETE_BUTTON', 5000);
      if (!deleteButton) {
        throw new Error('삭제 버튼을 찾을 수 없습니다 (권한 없음 또는 UI 변경)');
      }

      await deleteButton.click();
      await page.waitForTimeout(1000);

      // 확인 팝업 처리
      const confirmButton = await findElement(page, 'DELETE_CONFIRM', 3000);
      if (confirmButton) {
        await confirmButton.click();
      }

      await page.waitForTimeout(2000);

      // 삭제 확인
      const currentUrl = page.url();
      const isDeleted = !currentUrl.includes(articleId);
      
      if (isDeleted) {
        logger.info(`게시글 삭제 완료: ${articleId}`);
        return true;
      }

      // 성공 메시지 확인
      const successEl = await page.$('[class*="success"], [class*="complete"]');
      if (successEl) {
        logger.info(`게시글 삭제 완료: ${articleId}`);
        return true;
      }

      throw new Error('삭제 결과를 확인할 수 없습니다');
    } catch (error) {
      logger.error('게시글 삭제 실패:', error);
      return false;
    }
  }

  /**
   * 여러 게시글 삭제
   */
  async deleteMultiplePosts(
    cafeId: string,
    articleIds: string[]
  ): Promise<{ success: string[]; failed: string[] }> {
    const result = { success: [] as string[], failed: [] as string[] };
    
    for (const articleId of articleIds) {
      const deleted = await this.deletePost(cafeId, articleId);
      if (deleted) {
        result.success.push(articleId);
      } else {
        result.failed.push(articleId);
      }
      // 연속 삭제 시 딜레이 (차단 방지)
      await this.page?.waitForTimeout(1000 + Math.random() * 1000);
    }
    
    return result;
  }

  // ============================================
  // 유틸리티 메서드
  // ============================================

  /**
   * 페이지 닫기
   */
  async close(): Promise<void> {
    if (this.page && !this.page.isClosed()) {
      await this.page.close();
      this.page = null;
    }
  }

  /**
   * 스크린샷 저장
   */
  async saveScreenshot(name: string): Promise<string | null> {
    try {
      const page = await this.getPage();
      const path = `screenshots/${name}-${Date.now()}.png`;
      await page.screenshot({ path, fullPage: true });
      logger.info(`스크린샷 저장: ${path}`);
      return path;
    } catch (error) {
      logger.error('스크린샷 저장 실패:', error);
      return null;
    }
  }
}
