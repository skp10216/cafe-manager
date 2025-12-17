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

/** 네이버 프로필 정보 */
export interface NaverProfile {
  nickname: string;
  profileImageUrl?: string;
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
      // ⚠️ 기존 구현은 특정 클래스명에 의존하여 네이버 UI 변경 시 "로그인"을 오판(항상 true)할 수 있다.
      // 가장 안정적인 방식: "내정보" 페이지 접근 시 로그인 페이지로 리다이렉트 되는지 확인한다.
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

      // 쿠키 기반 보조 확인 (NID_AUT/NID_SES는 로그인 세션을 의미하는 경우가 많음)
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

      // 리다이렉트도 없고 로그인 폼도 없으면 로그인 상태로 판단
      return true;
    } catch (error) {
      logger.error('로그인 상태 확인 실패:', error);
      return false;
    }
  }

  /**
   * 네이버 프로필 정보 가져오기
   * 로그인 상태에서 닉네임과 프로필 이미지 URL을 추출
   */
  async getProfile(): Promise<NaverProfile | null> {
    try {
      const page = await this.getPage();
      let nickname: string | null = null;
      let profileImageUrl: string | undefined;

      // 먼저 "내정보" 페이지에서 닉네임을 최대한 안정적으로 시도한다.
      // (네이버 메인/Pay/카페는 영역 구조/클래스명이 더 자주 바뀜)
      logger.info('프로필 확인 - 네이버 내정보 페이지(우선) 시도');
      try {
        await page.goto('https://nid.naver.com/user2/help/myInfo', {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        await page.waitForTimeout(1200);

        // 1) 입력/텍스트 기반 후보 셀렉터들
        const myInfoSelectors = [
          'input[name="nickname"]',
          'input#nickname',
          '[class*="nickname"]',
          '.nickname',
          '.profile_info .name',
          '.user_info .name',
          '[data-testid*="nickname"]',
        ];

        for (const selector of myInfoSelectors) {
          const el = await page.$(selector);
          if (!el) continue;
          const tagName = await el.evaluate((e) => e.tagName.toLowerCase());
          const text =
            tagName === 'input' ? await el.getAttribute('value') : await el.textContent();
          if (text && text.trim().length > 0 && text.trim().length < 30) {
            nickname = text.trim();
            logger.info(`프로필 확인 성공 (내정보): ${nickname}`);
            break;
          }
        }

        // 2) DOM 구조 변화에 강한 휴리스틱: "닉네임" 라벨 주변에서 값 찾기
        if (!nickname) {
          const heuristic = await page.evaluate((): string | null => {
            // Worker(tsconfig)에서는 DOM lib가 없어서 document/navigator 타입이 없다.
            // 런타임은 브라우저 컨텍스트이므로 globalThis.document를 사용해 TS 에러를 피한다.
            const doc = (globalThis as any).document as any;
            if (!doc) return null;

            const isGood = (s: any) => typeof s === 'string' && s.trim().length > 0 && s.trim().length < 30;

            const labelCandidates = Array.from(
              doc.querySelectorAll('label, dt, th, span, strong, p') as any
            ).filter((el: any) => String(el?.textContent || '').includes('닉네임'));

            for (const label of labelCandidates as any[]) {
              const container =
                (label?.closest && label.closest('tr, li, dl, div, section')) || label?.parentElement;
              if (!container) continue;

              const input = container.querySelector(
                'input[name="nickname"], input#nickname, input[type="text"]'
              ) as any;
              if (input && isGood(input.value)) return String(input.value).trim();

              const textNodes = Array.from(container.querySelectorAll('span, strong, em, b, p') as any)
                .map((el: any) => String(el?.textContent || '').trim())
                .filter((t: any) => isGood(t));

              // "닉네임" 자체 문구를 제외하고 가장 그럴듯한 텍스트 반환
              const picked = (textNodes as string[]).find((t) => !t.includes('닉네임'));
              if (picked) return picked.trim();
            }

            return null;
          });

          if (heuristic) {
            nickname = heuristic.trim();
            logger.info(`프로필 확인 성공 (내정보-휴리스틱): ${nickname}`);
          }
        }
      } catch {
        logger.warn('내정보 페이지 접근/추출 실패');
      }

      // 방법 1: 네이버 메인 페이지 프로필 영역
      if (!nickname) {
        logger.info('프로필 확인 - 네이버 메인 페이지 시도');
        await page.goto('https://www.naver.com', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);

        // 다양한 선택자로 프로필 이름 찾기 (네이버는 클래스명을 자주 변경함)
        const mainSelectors = [
          '[class*="MyView"] [class*="name"]',
          '[class*="myview"] [class*="name"]',
          '#account [class*="name"]',
          '.sc_login .name',
          '#header [class*="profile"] [class*="name"]',
          'a[href*="nid.naver.com"] + * [class*="name"]',
          // 최근 UI에서 "내정보" 링크 주변 텍스트 케이스 대응
          'a[href*="my.naver.com"] [class*="name"]',
          'a[href*="nid.naver.com"] [class*="name"]',
        ];

        for (const selector of mainSelectors) {
          const el = await page.$(selector);
          if (el) {
            const text = await el.textContent();
            if (text && text.trim().length > 0 && text.trim().length < 30) {
              nickname = text.trim();
              logger.info(`프로필 확인 성공 (메인페이지): ${nickname}`);
              break;
            }
          }
        }
      }

      // 방법 2: 네이버 Pay 주문 페이지 (닉네임이 잘 표시됨)
      if (!nickname) {
        logger.info('프로필 확인 - 네이버 Pay 페이지 시도');
        try {
          await page.goto('https://order.pay.naver.com/home', { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
          });
          await page.waitForTimeout(1500);

          const paySelectors = [
            '.my_info .name',
            '[class*="userName"]',
            '[class*="user_name"]',
            '.user_area .name',
            '[class*="MyInfo"] [class*="name"]',
          ];

          for (const selector of paySelectors) {
            const el = await page.$(selector);
            if (el) {
              const text = await el.textContent();
              if (text && text.trim().length > 0 && text.trim().length < 30) {
                nickname = text.trim();
                logger.info(`프로필 확인 성공 (Pay): ${nickname}`);
                break;
              }
            }
          }
        } catch {
          logger.warn('Pay 페이지 접근 실패');
        }
      }

      // 방법 3: 네이버 계정 설정 페이지
      if (!nickname) {
        logger.info('프로필 확인 - 네이버 계정 설정 페이지 시도');
        try {
          await page.goto('https://nid.naver.com/user2/help/myInfo', { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
          });
          await page.waitForTimeout(1500);

          const accountSelectors = [
            '.nickname',
            '[class*="nickname"]',
            '.user_info .name',
            '.profile_info .name',
            'input[name="nickname"]',
            '[data-testid*="nickname"]',
          ];

          for (const selector of accountSelectors) {
            const el = await page.$(selector);
            if (el) {
              // input 요소인 경우 value 가져오기
              const tagName = await el.evaluate(e => e.tagName.toLowerCase());
              let text: string | null = null;
              if (tagName === 'input') {
                text = await el.getAttribute('value');
              } else {
                text = await el.textContent();
              }
              if (text && text.trim().length > 0 && text.trim().length < 30) {
                nickname = text.trim();
                logger.info(`프로필 확인 성공 (계정설정): ${nickname}`);
                break;
              }
            }
          }
        } catch {
          logger.warn('계정 설정 페이지 접근 실패');
        }
      }

      // 방법 4: 네이버 카페 내 프로필
      if (!nickname) {
        logger.info('프로필 확인 - 네이버 카페 마이페이지 시도');
        try {
          await page.goto('https://cafe.naver.com/ca-fe/home/profile', { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
          });
          await page.waitForTimeout(1500);

          const cafeSelectors = [
            '.nick_name',
            '.nickname',
            '[class*="nickName"]',
            '[class*="nick_name"]',
            '.profile_area .name',
          ];

          for (const selector of cafeSelectors) {
            const el = await page.$(selector);
            if (el) {
              const text = await el.textContent();
              if (text && text.trim().length > 0 && text.trim().length < 30) {
                nickname = text.trim();
                logger.info(`프로필 확인 성공 (카페): ${nickname}`);
                break;
              }
            }
          }
        } catch {
          logger.warn('카페 프로필 페이지 접근 실패');
        }
      }

      // 프로필 이미지 URL (선택적)
      const imgSelectors = [
        '[class*="MyView"] img',
        '[class*="profile"] img',
        '.user_area img',
      ];
      for (const selector of imgSelectors) {
        const imgEl = await page.$(selector);
        if (imgEl) {
          const src = await imgEl.getAttribute('src');
          if (src && src.includes('phinf.pstatic.net')) {
            profileImageUrl = src;
            break;
          }
        }
      }

      if (nickname) {
        return {
          nickname,
          profileImageUrl,
        };
      }

      logger.warn('네이버 닉네임을 가져올 수 없습니다 (모든 방법 실패)');
      return null;
    } catch (error) {
      logger.error('프로필 정보 가져오기 실패:', error);
      return null;
    }
  }

  /**
   * 세션 검증 - 로그인 상태 확인 및 프로필 정보 반환
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

  /**
   * 네이버 자동 로그인
   * NaverAccount의 loginId와 복호화된 password로 로그인 시도
   *
   * @param loginId 네이버 아이디
   * @param password 복호화된 비밀번호
   * @returns 로그인 성공 여부
   */
  async login(loginId: string, password: string): Promise<{ success: boolean; error?: string }> {
    const page = await this.getPage();

    try {
      logger.info(`네이버 로그인 시도: ${loginId}`);

      // 로그인 페이지로 이동
      await page.goto(NAVER_CAFE_URLS.LOGIN, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // 아이디 입력
      // - 클립보드+붙여넣기는 보안 입력 정책을 우회하는 데 유리하지만
      //   실행 환경에 따라 clipboard API가 막혀 있을 수 있어 fallback이 필요하다.
      // - ⚠️ navigator.clipboard.writeText()는 Promise를 반환하므로 반드시 await 해야 함
      const idInput = await page.$('#id');
      if (!idInput) {
        throw new Error('아이디 입력 필드를 찾을 수 없습니다');
      }
      await idInput.click();
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
        // fallback: fill/type
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

      // 로그인 결과 대기 (최대 30초)
      try {
        // 로그인 성공: 네이버 메인으로 리다이렉트
        await page.waitForURL('https://www.naver.com/**', { timeout: 30000 });

        // 추가 확인
        const isLoggedIn = await this.isLoggedIn();
        if (isLoggedIn) {
          logger.info(`네이버 로그인 성공: ${loginId}`);
          return { success: true };
        }

        return { success: false, error: '로그인 후 상태 확인 실패' };
      } catch {
        // 로그인 실패 (타임아웃 또는 에러 페이지)
        // 에러 메시지 확인
        const errorEl = await page.$('.error_message, .err_msg');
        const rawErrorText = errorEl ? await errorEl.textContent() : null;
        const errorText = rawErrorText ? rawErrorText.trim() : null;

        if (errorText) {
          // ⚠️ 네이버 로그인 UI는 "Caps Lock이 켜져 있습니다" 같은 입력 경고를 에러 영역에 노출하기도 함.
          // 이 문구는 실제 로그인 실패 원인이 아니므로 실패로 확정하지 않는다.
          if (errorText.includes('Caps Lock') || errorText.includes('caps lock')) {
            logger.warn(`네이버 로그인 경고 감지(무시): ${errorText}`);
          } else {
            logger.error(`네이버 로그인 실패: ${errorText}`);
            return { success: false, error: errorText };
          }
        }

        // CAPTCHA 또는 2FA 감지
        const captchaEl = await page.$('#captcha');
        if (captchaEl) {
          logger.error('네이버 로그인 실패: CAPTCHA 필요');
          return { success: false, error: 'CAPTCHA 인증이 필요합니다. 수동 로그인이 필요합니다.' };
        }

        // 2단계 인증 감지
        const twoFactorEl = await page.$('[class*="two_factor"], [class*="auth_"]');
        if (twoFactorEl) {
          logger.error('네이버 로그인 실패: 2단계 인증 필요');
          return { success: false, error: '2단계 인증이 필요합니다. 수동 로그인이 필요합니다.' };
        }

        // 여기까지 오면: 성공 URL로 이동하지도 않았고, 명확한 에러/캡차/2FA도 확인되지 않은 상태
        // -> 네이버 보안 화면(추가 인증/보호조치/약관동의 등) 가능성이 높다.
        //    자동화는 여기서 멈추고 "수동 로그인" 플로우로 유도하는 것이 가장 안정적이다.
        const url = page.url();
        let title = '';
        try {
          title = await page.title();
        } catch {
          // ignore
        }
        let bodyText = '';
        try {
          bodyText = await page.locator('body').innerText({ timeout: 1000 });
        } catch {
          // ignore
        }

        const securityKeywords = [
          '보호조치',
          '비정상적인',
          '추가 인증',
          '본인확인',
          '약관',
          '동의',
          '휴대폰',
          '인증',
          'CAPTCHA',
          '캡차',
          '자동입력',
        ];
        const matched = securityKeywords.find((k) => bodyText.includes(k)) || null;

        const hint = matched ? `감지됨: ${matched}` : '감지되지 않음';
        logger.warn(`네이버 로그인 타임아웃/보안화면 의심 (${hint}) url=${url} title=${title}`);

        // IMPORTANT: JobProcessor가 "수동 로그인" 문자열을 기준으로 5분 대기 플로우로 전환한다.
        return {
          success: false,
          error: `수동 로그인이 필요합니다. (추가 인증/보안 화면 가능) url=${url} title=${title || '-'} ${hint}`,
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
   * CAPTCHA/2FA 상황에서 사용자가 직접 로그인할 수 있도록
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
