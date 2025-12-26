/**
 * API 공통 상수 정의
 * @cafe-manager/core의 상수를 로컬에서 정의 (빌드 의존성 제거)
 */

// ============================================
// Job 관련 상수
// ============================================

/** Job 타입 상수 */
export const JOB_TYPES = {
  INIT_SESSION: 'INIT_SESSION',
  VERIFY_SESSION: 'VERIFY_SESSION',  // 세션 검증 (로그인 상태 + 닉네임 확인)
  CREATE_POST: 'CREATE_POST',
  SYNC_POSTS: 'SYNC_POSTS',
  DELETE_POST: 'DELETE_POST',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

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
  SYSTEM_JOBS: 'system-jobs',  // Worker Monitor 시스템 작업용
} as const;

/** 시스템 Job 타입 */
export const SYSTEM_JOB_TYPES = {
  COLLECT_STATS_SNAPSHOT: 'COLLECT_STATS_SNAPSHOT',  // 큐 통계 스냅샷 수집
} as const;

// ============================================
// Worker Monitor 관련 상수
// ============================================

/** Redis 키 (Worker Heartbeat) */
export const HEARTBEAT_REDIS_KEYS = {
  HEARTBEAT_KEY: 'cafe-manager:workers:heartbeat',       // ZSET
  WORKER_INFO_PREFIX: 'cafe-manager:workers:info:',      // STRING + TTL
} as const;

/** 워커 온라인 판정 임계값 (ms) */
export const WORKER_ONLINE_THRESHOLD_MS = 30_000;  // 30초

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




