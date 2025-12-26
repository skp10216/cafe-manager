/**
 * 공통 상수 정의
 * 운영형 SaaS 고도화
 */

// ============================================
// Job 관련 상수
// ============================================

/** Job 타입 */
export const JOB_TYPES = {
  INIT_SESSION: 'INIT_SESSION',
  VERIFY_SESSION: 'VERIFY_SESSION',
  CREATE_POST: 'CREATE_POST',
  SYNC_POSTS: 'SYNC_POSTS',
  DELETE_POST: 'DELETE_POST',
} as const;

/** Job 상태 */
export const JOB_STATUS = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
  BLOCKED: 'BLOCKED',
  CANCELLED: 'CANCELLED',
} as const;

/** Job 기본 설정 */
export const JOB_DEFAULTS = {
  MAX_ATTEMPTS: 3,
  BACKOFF_DELAY_MS: 60000, // 1분
  TIMEOUT_MS: 300000,      // 5분
} as const;

// ============================================
// 세션 관련 상수
// ============================================

/** 세션 상태 */
export const SESSION_STATUS = {
  PENDING: 'PENDING',
  HEALTHY: 'HEALTHY',
  EXPIRING: 'EXPIRING',
  EXPIRED: 'EXPIRED',
  CHALLENGE_REQUIRED: 'CHALLENGE_REQUIRED',
  ERROR: 'ERROR',
} as const;

/** 세션 만료 임박 기준 (일) */
export const SESSION_EXPIRING_THRESHOLD_DAYS = 7;

// ============================================
// 스케줄 관련 상수
// ============================================

/** 관리자 상태 */
export const ADMIN_STATUS = {
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  APPROVED: 'APPROVED',
  SUSPENDED: 'SUSPENDED',
  BANNED: 'BANNED',
} as const;

/** 스케줄 상태 (레거시) */
export const SCHEDULE_STATUS = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
} as const;

/** 실행 상태 */
export const RUN_STATUS = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
  BLOCKED: 'BLOCKED',
  CANCELLED: 'CANCELLED',
} as const;

/** 차단 코드 */
export const BLOCK_CODE = {
  USER_DISABLED: 'USER_DISABLED',
  ADMIN_NOT_APPROVED: 'ADMIN_NOT_APPROVED',
  ADMIN_SUSPENDED: 'ADMIN_SUSPENDED',
  ADMIN_BANNED: 'ADMIN_BANNED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_CHALLENGE: 'SESSION_CHALLENGE',
  SESSION_ERROR: 'SESSION_ERROR',
  DAILY_LIMIT: 'DAILY_LIMIT',
  DUPLICATE: 'DUPLICATE',
} as const;

// ============================================
// 에러 코드 상수
// ============================================

/** 에러 코드 */
export const ERROR_CODE = {
  // 인증 관련
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  CHALLENGE_REQUIRED: 'CHALLENGE_REQUIRED',
  LOGIN_FAILED: 'LOGIN_FAILED',
  // 권한 관련
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  CAFE_NOT_FOUND: 'CAFE_NOT_FOUND',
  // 제한 관련
  RATE_LIMIT: 'RATE_LIMIT',
  DAILY_LIMIT: 'DAILY_LIMIT',
  // 기술적 오류
  UI_CHANGED: 'UI_CHANGED',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  BROWSER_ERROR: 'BROWSER_ERROR',
  // 기타
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

/** 재시도 가능한 에러 코드 */
export const RETRYABLE_ERROR_CODES = [
  ERROR_CODE.RATE_LIMIT,
  ERROR_CODE.UPLOAD_FAILED,
  ERROR_CODE.NETWORK_ERROR,
  ERROR_CODE.TIMEOUT,
  ERROR_CODE.BROWSER_ERROR,
] as const;

/** 세션 상태 전환이 필요한 에러 코드 */
export const SESSION_TRANSITION_ERROR_CODES = [
  ERROR_CODE.AUTH_EXPIRED,
  ERROR_CODE.CHALLENGE_REQUIRED,
  ERROR_CODE.LOGIN_FAILED,
] as const;

// ============================================
// 운영 정책 상수
// ============================================

/** 정책 키 */
export const POLICY_KEYS = {
  // 플랜별 일일 제한
  FREE_DAILY_LIMIT: 'free_daily_limit',
  MONTHLY_DAILY_LIMIT: 'monthly_daily_limit',
  YEARLY_DAILY_LIMIT: 'yearly_daily_limit',
  
  // 자동 중지 정책
  AUTO_SUSPEND_CONSECUTIVE_FAILURES: 'auto_suspend_consecutive_failures',
  AUTO_SUSPEND_ENABLED: 'auto_suspend_enabled',
  
  // 세션 검증 주기
  SESSION_VERIFY_INTERVAL_HOURS: 'session_verify_interval_hours',
  
  // 디버그 모드 전환 기준
  DEBUG_MODE_FAILURE_THRESHOLD: 'debug_mode_failure_threshold',
} as const;

/** 정책 기본값 */
export const POLICY_DEFAULTS = {
  [POLICY_KEYS.FREE_DAILY_LIMIT]: 10,
  [POLICY_KEYS.MONTHLY_DAILY_LIMIT]: 100,
  [POLICY_KEYS.YEARLY_DAILY_LIMIT]: 500,
  [POLICY_KEYS.AUTO_SUSPEND_CONSECUTIVE_FAILURES]: 5,
  [POLICY_KEYS.AUTO_SUSPEND_ENABLED]: true,
  [POLICY_KEYS.SESSION_VERIFY_INTERVAL_HOURS]: 24,
  [POLICY_KEYS.DEBUG_MODE_FAILURE_THRESHOLD]: 3,
} as const;

// ============================================
// 실행 모드 상수
// ============================================

/** 실행 모드 */
export const RUN_MODE = {
  HEADLESS: 'HEADLESS',
  DEBUG: 'DEBUG',
} as const;

// ============================================
// 감사 로그 상수
// ============================================

/** 행위자 타입 */
export const ACTOR_TYPE = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  SYSTEM: 'SYSTEM',
} as const;

/** 엔티티 타입 */
export const ENTITY_TYPE = {
  USER: 'USER',
  SCHEDULE: 'SCHEDULE',
  SESSION: 'SESSION',
  TEMPLATE: 'TEMPLATE',
  JOB: 'JOB',
  POLICY: 'POLICY',
} as const;

/** 감사 행위 */
export const AUDIT_ACTION = {
  SCHEDULE_APPROVE: 'SCHEDULE_APPROVE',
  SCHEDULE_SUSPEND: 'SCHEDULE_SUSPEND',
  SCHEDULE_BAN: 'SCHEDULE_BAN',
  SCHEDULE_UNSUSPEND: 'SCHEDULE_UNSUSPEND',
  SCHEDULE_TOGGLE: 'SCHEDULE_TOGGLE',
  USER_SUSPEND: 'USER_SUSPEND',
  USER_BAN: 'USER_BAN',
  USER_UNSUSPEND: 'USER_UNSUSPEND',
  SESSION_INVALIDATE: 'SESSION_INVALIDATE',
  SESSION_RECONNECT: 'SESSION_RECONNECT',
  POLICY_UPDATE: 'POLICY_UPDATE',
  AUTO_SUSPEND: 'AUTO_SUSPEND',
} as const;

// ============================================
// 사용자 역할 상수
// ============================================

/** 사용자 역할 */
export const USER_ROLE = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;

// ============================================
// BullMQ 큐 이름
// ============================================

/** 큐 이름 */
export const QUEUE_NAMES = {
  MAIN: 'cafe-manager-jobs',
  SCHEDULED: 'cafe-manager-scheduled',
} as const;
