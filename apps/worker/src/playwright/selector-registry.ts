/**
 * Selector Registry
 * 네이버 카페 UI 변경에 대응하기 위한 다중 셀렉터 관리
 * 
 * 네이버는 클래스명, ID, 구조를 자주 변경하므로
 * 여러 후보 셀렉터를 정의하고 순차적으로 시도합니다.
 */

import { Page, ElementHandle } from 'playwright';
import { createLogger } from '../utils/logger';

const logger = createLogger('SelectorRegistry');

/**
 * 셀렉터 그룹 정의
 * 
 * 네이버 카페 글쓰기 페이지 구조:
 * - 새 에디터: textarea.textarea_input (제목), .se-content (본문)
 * - 구 에디터: input[name="subject"] (제목), iframe 내 에디터 (본문)
 */
export const SELECTORS = {
  // ===========================================
  // 글쓰기 페이지 셀렉터
  // ===========================================
  
  /** 제목 입력 필드 (textarea 또는 input) */
  WRITE_TITLE: [
    // 새 에디터 (textarea 기반)
    'textarea.textarea_input',
    'textarea[placeholder*="제목"]',
    '.editor_title textarea',
    '.ArticleWriteTitle textarea',
    // 구 에디터 (input 기반)
    'input.input_title',
    'input[placeholder*="제목"]',
    'input[name="subject"]',
    '.ArticleWriteTitle input',
    '[class*="titleArea"] input',
    '[class*="title_area"] input',
    '[class*="title"] input[type="text"]',
    '#subject',
    '.write_title input',
    // 범용 셀렉터
    '[class*="Title"] input',
    '[class*="Title"] textarea',
  ],
  
  /** 본문 에디터 영역 (스마트에디터 ONE) */
  WRITE_EDITOR_FRAME: [
    'iframe.se-frame',
    'iframe[src*="smarteditor"]',
    '.se-container iframe',
    '.se-component-content iframe',
    '#editorArea iframe',
    'iframe[id*="editor"]',
  ],
  
  /** 본문 에디터 내 편집 영역 (contenteditable) */
  WRITE_EDITOR_BODY: [
    // 새 에디터 (SE ONE)
    '.se-component.se-text .se-text-paragraph',
    '.se-content',
    '.se-component-content',
    // 범용
    '[contenteditable="true"]',
    '.ProseMirror',
    '[class*="editor"] [contenteditable="true"]',
  ],
  
  /** 이미지 추가 버튼 */
  WRITE_IMAGE_BUTTON: [
    'button[data-name="image"]',
    'button[data-log="image"]',
    '.se-toolbar-item-image',
    '[class*="image_btn"]',
    '[aria-label*="사진"]',
    '[aria-label*="이미지"]',
    '.se-toolbar button[class*="image"]',
    '.tool_image',
  ],
  
  /** 파일 업로드 input */
  WRITE_FILE_INPUT: [
    'input[type="file"][accept*="image"]',
    'input[type="file"][multiple]',
    'input[type="file"]',
    '.se-image-uploader input[type="file"]',
  ],
  
  /** 등록/게시 버튼 (녹색 "등록" 버튼, "임시등록" 제외) */
  /** 버튼 구조: <a role="button" class="BaseButton BaseButton--skinGreen"><span class="BaseButton__txt">등록</span></a> */
  WRITE_SUBMIT_BUTTON: [
    // skinGreen 등록 버튼 (<a> 태그) - 최우선
    'a.BaseButton--skinGreen',
    'a[class*="skinGreen"]',
    '[class*="BaseButton--skinGreen"]',
    // 녹색 등록 버튼 (button 태그)
    'button.BaseButton--green',
    'button.BaseButton--skinGreen',
    // role="button" + span
    '[role="button"]:has(span.BaseButton__txt)',
    // 범용
    '.BaseButton:has(span.BaseButton__txt)',
    '[class*="submitBtn"]',
    '#writeFormBtn',
  ],
  
  // ===========================================
  // 내가 쓴 글 페이지 셀렉터
  // ===========================================
  
  /** 게시글 목록 컨테이너 */
  MY_POSTS_LIST: [
    '.article-board',
    '[class*="ArticleList"]',
    '.board-list',
    'table.board',
  ],
  
  /** 개별 게시글 항목 */
  MY_POSTS_ITEM: [
    '.article-board .inner_list',
    '[class*="ArticleItem"]',
    'li[class*="article"]',
    'tr[class*="article"]',
    'tr[data-article-id]',
  ],
  
  /** 게시글 제목 링크 */
  MY_POSTS_TITLE_LINK: [
    '.article a',
    'a[class*="article"]',
    '.board-list a.title',
    'td.title a',
  ],
  
  // ===========================================
  // 게시글 삭제 관련 셀렉터
  // ===========================================
  
  /** 삭제 버튼 */
  DELETE_BUTTON: [
    'button:has-text("삭제")',
    'a:has-text("삭제")',
    '[class*="delete"]',
    '[class*="Delete"]',
    '.article_btn .del',
    '[aria-label*="삭제"]',
  ],
  
  /** 삭제 확인 버튼 */
  DELETE_CONFIRM: [
    'button:has-text("확인")',
    'button:has-text("삭제")',
    '.btn_confirm',
    '[class*="confirm"]',
    'button.BaseButton--confirm',
  ],
  
  // ===========================================
  // 공통 셀렉터
  // ===========================================
  
  /** 로딩 스피너 */
  LOADING_SPINNER: [
    '.loading',
    '[class*="spinner"]',
    '[class*="Spinner"]',
    '.se-loading',
  ],
  
  /** 에러 메시지 */
  ERROR_MESSAGE: [
    '.error_message',
    '.err_msg',
    '[class*="error"]',
    '[role="alert"]',
  ],
} as const;

type SelectorKey = keyof typeof SELECTORS;

/**
 * 다중 셀렉터로 요소 찾기
 * @param page Playwright 페이지 객체
 * @param selectorKey 셀렉터 그룹 키
 * @param timeout 타임아웃 (ms)
 * @returns 찾은 요소 또는 null
 */
export async function findElement(
  page: Page,
  selectorKey: SelectorKey,
  timeout: number = 5000
): Promise<ElementHandle | null> {
  const selectors = SELECTORS[selectorKey];
  const startTime = Date.now();
  
  // 각 셀렉터를 순차적으로 시도
  while (Date.now() - startTime < timeout) {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          logger.debug(`[${selectorKey}] 요소 찾음: ${selector}`);
          return element;
        }
      } catch {
        // 셀렉터 오류는 무시하고 다음 시도
      }
    }
    // 짧은 대기 후 재시도
    await page.waitForTimeout(200);
  }
  
  logger.warn(`[${selectorKey}] 요소를 찾을 수 없음. 시도한 셀렉터: ${selectors.join(', ')}`);
  return null;
}

/**
 * 다중 셀렉터로 여러 요소 찾기
 */
export async function findElements(
  page: Page,
  selectorKey: SelectorKey
): Promise<ElementHandle[]> {
  const selectors = SELECTORS[selectorKey];
  
  for (const selector of selectors) {
    try {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        logger.debug(`[${selectorKey}] ${elements.length}개 요소 찾음: ${selector}`);
        return elements;
      }
    } catch {
      // 셀렉터 오류는 무시
    }
  }
  
  return [];
}

/**
 * 요소가 나타날 때까지 대기
 */
export async function waitForElement(
  page: Page,
  selectorKey: SelectorKey,
  timeout: number = 10000
): Promise<ElementHandle | null> {
  const selectors = SELECTORS[selectorKey];
  
  try {
    // 모든 셀렉터를 OR로 결합한 표현식 생성
    const combinedSelector = selectors.join(', ');
    await page.waitForSelector(combinedSelector, { timeout });
    return findElement(page, selectorKey, 1000);
  } catch {
    logger.warn(`[${selectorKey}] 대기 타임아웃`);
    return null;
  }
}

/**
 * iframe 내에서 요소 찾기
 */
export async function findInFrame(
  page: Page,
  frameSelectorKey: SelectorKey,
  contentSelectorKey: SelectorKey
): Promise<ElementHandle | null> {
  const frameSelectors = SELECTORS[frameSelectorKey];
  const contentSelectors = SELECTORS[contentSelectorKey];
  
  for (const frameSelector of frameSelectors) {
    try {
      const frameLocator = page.frameLocator(frameSelector);
      
      for (const contentSelector of contentSelectors) {
        try {
          const element = await frameLocator.locator(contentSelector).first().elementHandle();
          if (element) {
            logger.debug(`[Frame] 요소 찾음: ${frameSelector} > ${contentSelector}`);
            return element;
          }
        } catch {
          // 계속 시도
        }
      }
    } catch {
      // 프레임을 찾을 수 없으면 다음 시도
    }
  }
  
  return null;
}

/**
 * 현재 페이지의 유효한 셀렉터 보고서 생성 (디버깅용)
 */
export async function generateSelectorReport(page: Page): Promise<Record<string, string | null>> {
  const report: Record<string, string | null> = {};
  
  for (const [key, selectors] of Object.entries(SELECTORS)) {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          report[key] = selector;
          break;
        }
      } catch {
        // 무시
      }
    }
    if (!report[key]) {
      report[key] = null;
    }
  }
  
  return report;
}




