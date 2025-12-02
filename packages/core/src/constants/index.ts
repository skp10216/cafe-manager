/**
 * 공통 상수 정의
 */

// ============================================
// Job 관련 상수
// ============================================

/** Job 타입 상수 */
export const JOB_TYPES = {
  INIT_SESSION: 'INIT_SESSION',
  CREATE_POST: 'CREATE_POST',
  SYNC_POSTS: 'SYNC_POSTS',
  DELETE_POST: 'DELETE_POST',
} as const;

/** Job 상태 상수 */
export const JOB_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

/** 기본 Job 재시도 횟수 */
export const DEFAULT_JOB_MAX_ATTEMPTS = 3;

/** Job 큐 이름 */
export const QUEUE_NAMES = {
  CAFE_JOBS: 'cafe-jobs',
} as const;

// ============================================
// 네이버 세션 관련 상수
// ============================================

/** 네이버 세션 상태 상수 */
export const NAVER_SESSION_STATUS = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  ERROR: 'ERROR',
} as const;

// ============================================
// 스케줄 관련 상수
// ============================================

/** 스케줄 상태 상수 */
export const SCHEDULE_STATUS = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
} as const;

/** 기본 하루 최대 포스팅 수 */
export const DEFAULT_MAX_POSTS_PER_DAY = 10;

// ============================================
// 게시글 관련 상수
// ============================================

/** 게시글 상태 상수 */
export const MANAGED_POST_STATUS = {
  ACTIVE: 'ACTIVE',
  DELETED: 'DELETED',
  UNKNOWN: 'UNKNOWN',
} as const;

// ============================================
// API 관련 상수
// ============================================

/** 기본 페이지네이션 설정 */
export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/** HTTP 상태 코드 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// ============================================
// 네이버 카페 관련 상수
// ============================================

/** 네이버 카페 URL 패턴 */
export const NAVER_CAFE_URLS = {
  BASE: 'https://cafe.naver.com',
  LOGIN: 'https://nid.naver.com/nidlogin.login',
  MY_POSTS: (cafeId: string) => `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles/mine`,
  WRITE: (cafeId: string, boardId: string) =>
    `https://cafe.naver.com/ca-fe/cafes/${cafeId}/menus/${boardId}/articles/write`,
} as const;




