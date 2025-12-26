/**
 * Worker 공통 상수 정의
 * @cafe-manager/core의 상수를 로컬에서 정의 (빌드 의존성 제거)
 */

// ============================================
// Job 관련 상수
// ============================================

/** Job 타입 상수 */
export const JOB_TYPES = {
  INIT_SESSION: 'INIT_SESSION',
  VERIFY_SESSION: 'VERIFY_SESSION',  // 세션 검증 (실제 로그인 상태 + 닉네임 확인)
  CREATE_POST: 'CREATE_POST',
  SYNC_POSTS: 'SYNC_POSTS',
  DELETE_POST: 'DELETE_POST',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

/** Job 큐 이름 */
export const QUEUE_NAMES = {
  CAFE_JOBS: 'cafe-jobs',
  SYSTEM_JOBS: 'system-jobs',  // Worker Monitor 시스템 작업용
} as const;

/** 시스템 Job 타입 */
export const SYSTEM_JOB_TYPES = {
  COLLECT_STATS_SNAPSHOT: 'COLLECT_STATS_SNAPSHOT',  // 큐 통계 스냅샷 수집
} as const;

/** 기본 Job 재시도 횟수 */
export const DEFAULT_JOB_MAX_ATTEMPTS = 3;

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




