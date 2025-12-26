/**
 * 공통 타입 정의
 * 운영형 SaaS 고도화
 */

// ============================================
// 사용자 관련 타입
// ============================================

/** 사용자 역할 */
export type UserRole = 'USER' | 'ADMIN';

/** 사용자 플랜 타입 */
export type PlanType = 'FREE' | 'MONTHLY' | 'YEARLY';

/** 사용자 정보 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  planType: PlanType | null;
  expireAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 네이버 계정 관련 타입
// ============================================

/** 네이버 계정 상태 */
export type NaverAccountStatus = 'ACTIVE' | 'LOGIN_FAILED' | 'DISABLED';

/** 네이버 계정 정보 */
export interface NaverAccount {
  id: string;
  userId: string;
  loginId: string;
  passwordEncrypted: string;
  displayName: string | null;
  status: NaverAccountStatus;
  lastLoginAt: Date | null;
  lastLoginStatus: string | null;
  lastLoginError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 네이버 세션 관련 타입 (5단계 운영형)
// ============================================

/** 세션 상태 (5단계 운영형) */
export type SessionStatus = 
  | 'PENDING'             // 세션 초기화 대기 중
  | 'HEALTHY'             // 정상 동작
  | 'EXPIRING'            // 곧 만료 예정 (7일 내)
  | 'EXPIRED'             // 만료됨
  | 'CHALLENGE_REQUIRED'  // 추가 인증 필요 (CAPTCHA/2FA)
  | 'ERROR';              // 오류 발생

/** 레거시 세션 상태 (마이그레이션용) */
export type LegacyNaverSessionStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'ERROR';

/** 세션 상태 한글 라벨 */
export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  PENDING: '연결 대기',
  HEALTHY: '정상',
  EXPIRING: '만료 임박',
  EXPIRED: '만료됨',
  CHALLENGE_REQUIRED: '추가 인증 필요',
  ERROR: '오류',
};

/** 세션 상태 컬러 (UI용) */
export const SESSION_STATUS_COLORS: Record<SessionStatus, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  PENDING: 'default',
  HEALTHY: 'success',
  EXPIRING: 'warning',
  EXPIRED: 'error',
  CHALLENGE_REQUIRED: 'warning',
  ERROR: 'error',
};

/** 네이버 세션 정보 */
export interface NaverSession {
  id: string;
  naverAccountId: string;
  profileDir: string;
  status: SessionStatus;
  lastVerifiedAt: Date | null;
  lastCheckedAt: Date | null;
  expiresAt: Date | null;
  errorMessage: string | null;
  errorCode: string | null; // Prisma ErrorCode enum 참조
  naverNickname: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 템플릿 관련 타입
// ============================================

/** 템플릿 정보 */
export interface Template {
  id: string;
  userId: string;
  name: string;
  cafeId: string;
  boardId: string;
  cafeName: string | null;
  boardName: string | null;
  subjectTemplate: string;
  contentTemplate: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 스케줄 관련 타입 (운영형 SaaS)
// ============================================

/** 관리자 게이트 상태 */
export type AdminStatus = 
  | 'NEEDS_REVIEW'   // 승인 대기
  | 'APPROVED'       // 승인됨
  | 'SUSPENDED'      // 일시 정지
  | 'BANNED';        // 영구 차단

/** 관리자 상태 한글 라벨 */
export const ADMIN_STATUS_LABELS: Record<AdminStatus, string> = {
  NEEDS_REVIEW: '승인 대기',
  APPROVED: '승인됨',
  SUSPENDED: '일시 정지',
  BANNED: '영구 차단',
};

/** 관리자 상태 컬러 (UI용) */
export const ADMIN_STATUS_COLORS: Record<AdminStatus, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  NEEDS_REVIEW: 'warning',
  APPROVED: 'success',
  SUSPENDED: 'error',
  BANNED: 'error',
};

/** 스케줄 상태 (레거시 호환) */
export type ScheduleStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';

/** 스케줄 정보 */
export interface Schedule {
  id: string;
  userId: string;
  templateId: string;
  name: string;
  runTime: string;
  dailyPostCount: number;
  postIntervalMinutes: number;
  timezone: string;
  
  // 운영형 SaaS 필드
  userEnabled: boolean;
  adminStatus: AdminStatus;
  adminReason: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  suspendedAt: Date | null;
  
  // 레거시 호환
  status: ScheduleStatus;
  
  lastRunDate: Date | null;
  consecutiveFailures: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 스케줄 실행 가능 상태 계산 결과 */
export interface ScheduleExecutability {
  canExecute: boolean;
  userEnabled: boolean;
  adminApproved: boolean;
  sessionHealthy: boolean;
  blockCode: BlockCode | null;
  blockMessage: string | null;
}

// ============================================
// 스케줄 실행 (ScheduleRun) 타입
// ============================================

/** 실행 상태 */
export type RunStatus = 
  | 'PENDING'    // 생성됨
  | 'QUEUED'     // 큐에 등록됨
  | 'RUNNING'    // 실행 중
  | 'COMPLETED'  // 완료 (SUCCESS)
  | 'FAILED'     // 실패
  | 'SKIPPED'    // 스킵됨
  | 'BLOCKED'    // 차단됨
  | 'CANCELLED'; // 취소됨

/** 실행 상태 한글 라벨 */
export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  PENDING: '대기 중',
  QUEUED: '큐 등록됨',
  RUNNING: '실행 중',
  COMPLETED: '완료',
  FAILED: '실패',
  SKIPPED: '스킵됨',
  BLOCKED: '차단됨',
  CANCELLED: '취소됨',
};

/** 실행 상태 컬러 */
export const RUN_STATUS_COLORS: Record<RunStatus, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  PENDING: 'default',
  QUEUED: 'info',
  RUNNING: 'info',
  COMPLETED: 'success',
  FAILED: 'error',
  SKIPPED: 'warning',
  BLOCKED: 'error',
  CANCELLED: 'default',
};

/** 차단/스킵 사유 코드 */
export type BlockCode = 
  | 'USER_DISABLED'       // 사용자가 비활성화
  | 'ADMIN_NOT_APPROVED'  // 관리자 미승인
  | 'ADMIN_SUSPENDED'     // 관리자가 중지
  | 'ADMIN_BANNED'        // 관리자가 차단
  | 'SESSION_EXPIRED'     // 세션 만료
  | 'SESSION_CHALLENGE'   // 추가 인증 필요
  | 'SESSION_ERROR'       // 세션 오류
  | 'DAILY_LIMIT'         // 일일 제한 초과
  | 'DUPLICATE';          // 중복 실행 방지

/** 차단 코드 한글 라벨 */
export const BLOCK_CODE_LABELS: Record<BlockCode, string> = {
  USER_DISABLED: '사용자가 스케줄을 비활성화했습니다',
  ADMIN_NOT_APPROVED: '관리자 승인이 필요합니다',
  ADMIN_SUSPENDED: '관리자에 의해 일시 중지되었습니다',
  ADMIN_BANNED: '관리자에 의해 차단되었습니다',
  SESSION_EXPIRED: '네이버 연동이 만료되었습니다',
  SESSION_CHALLENGE: '네이버 추가 인증이 필요합니다',
  SESSION_ERROR: '네이버 연동에 문제가 있습니다',
  DAILY_LIMIT: '일일 실행 제한을 초과했습니다',
  DUPLICATE: '오늘 이미 실행되었습니다',
};

/** 차단 코드별 해결 방법 */
export const BLOCK_CODE_SOLUTIONS: Record<BlockCode, string> = {
  USER_DISABLED: '스케줄 설정에서 활성화해주세요',
  ADMIN_NOT_APPROVED: '관리자의 승인을 기다려주세요',
  ADMIN_SUSPENDED: '중지 사유를 확인하고 문제를 해결해주세요',
  ADMIN_BANNED: '고객센터에 문의해주세요',
  SESSION_EXPIRED: '설정 > 네이버 연동에서 재연동해주세요',
  SESSION_CHALLENGE: '네이버 연동 페이지에서 추가 인증을 완료해주세요',
  SESSION_ERROR: '설정 > 네이버 연동에서 상태를 확인해주세요',
  DAILY_LIMIT: '내일 자동으로 실행됩니다',
  DUPLICATE: '내일 자동으로 실행됩니다',
};

/** 스케줄 실행 정보 */
export interface ScheduleRun {
  id: string;
  scheduleId: string;
  userId: string;
  runDate: Date;
  status: RunStatus;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  skippedJobs: number;
  blockReason: string | null;
  blockCode: BlockCode | null;
  triggeredAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

// ============================================
// 게시글 관련 타입
// ============================================

/** 게시글 상태 */
export type ManagedPostStatus = 'ACTIVE' | 'DELETED' | 'UNKNOWN';

/** 동기화된 게시글 정보 */
export interface ManagedPost {
  id: string;
  userId: string;
  cafeId: string;
  boardId: string;
  articleId: string;
  articleUrl: string;
  title: string;
  status: ManagedPostStatus;
  createdAtRemote: Date | null;
  lastSyncedAt: Date;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Job 관련 타입 (에러 코드 체계 추가)
// ============================================

/** Job 타입 */
export type JobType = 'INIT_SESSION' | 'VERIFY_SESSION' | 'CREATE_POST' | 'SYNC_POSTS' | 'DELETE_POST';

/** Job 상태 */
export type JobStatus = 
  | 'PENDING'     // 대기 중
  | 'QUEUED'      // 큐에 등록됨
  | 'PROCESSING'  // 처리 중
  | 'COMPLETED'   // 완료
  | 'FAILED'      // 실패
  | 'SKIPPED'     // 스킵됨
  | 'BLOCKED'     // 차단됨
  | 'CANCELLED';  // 취소됨

/** Job 상태 한글 라벨 */
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  PENDING: '대기 중',
  QUEUED: '큐 등록됨',
  PROCESSING: '처리 중',
  COMPLETED: '완료',
  FAILED: '실패',
  SKIPPED: '스킵됨',
  BLOCKED: '차단됨',
  CANCELLED: '취소됨',
};

/** 실행 모드 */
export type RunMode = 'HEADLESS' | 'DEBUG';

// ErrorCode는 errors/error-codes.ts에서 enum으로 정의됨
// 중복 방지를 위해 여기서는 타입만 re-export
// import { ErrorCode } from '../errors/error-codes.js';

/** Job Payload 확장 타입 */
export interface JobPayloadExtension {
  templateId?: string;
  templateName?: string;
  scheduleId?: string;
  scheduleName?: string;
  cafeId?: string;
  cafeName?: string;
  boardId?: string;
  boardName?: string;
  
  resultUrl?: string;
  resultArticleId?: string;
  screenshotUrl?: string;
  
  errorCode?: string; // Prisma ErrorCode enum 문자열
  errorSummary?: string;
  errorDetails?: string;
}

/** Job 정보 */
export interface Job {
  id: string;
  type: JobType;
  userId: string;
  payload: Record<string, unknown> & Partial<JobPayloadExtension>;
  status: JobStatus;
  errorMessage: string | null;
  errorCode: string | null; // Prisma ErrorCode enum 문자열
  attempts: number;
  maxAttempts: number;
  runMode: RunMode;
  screenshotPath: string | null;
  htmlPath: string | null;
  scheduleRunId: string | null;
  sequenceNumber: number | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  updatedAt: Date;
}

/** Job 로그 레벨 */
export type JobLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

/** Job 로그 정보 */
export interface JobLog {
  id: string;
  jobId: string;
  level: JobLogLevel;
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: Date;
}

// ============================================
// 감사 로그 타입 (Admin)
// ============================================

/** 행위자 타입 */
export type ActorType = 'ADMIN' | 'USER' | 'SYSTEM';

/** 대상 엔티티 타입 */
export type EntityType = 'USER' | 'SCHEDULE' | 'SESSION' | 'TEMPLATE' | 'JOB' | 'POLICY';

/** 감사 행위 타입 */
export type AuditAction = 
  | 'SCHEDULE_APPROVE'
  | 'SCHEDULE_SUSPEND'
  | 'SCHEDULE_BAN'
  | 'SCHEDULE_UNSUSPEND'
  | 'SCHEDULE_TOGGLE'
  | 'USER_SUSPEND'
  | 'USER_BAN'
  | 'USER_UNSUSPEND'
  | 'SESSION_INVALIDATE'
  | 'SESSION_RECONNECT'
  | 'POLICY_UPDATE'
  | 'AUTO_SUSPEND';

/** 감사 행위 한글 라벨 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  SCHEDULE_APPROVE: '스케줄 승인',
  SCHEDULE_SUSPEND: '스케줄 일시 중지',
  SCHEDULE_BAN: '스케줄 영구 차단',
  SCHEDULE_UNSUSPEND: '스케줄 중지 해제',
  SCHEDULE_TOGGLE: '스케줄 ON/OFF',
  USER_SUSPEND: '사용자 정지',
  USER_BAN: '사용자 차단',
  USER_UNSUSPEND: '사용자 정지 해제',
  SESSION_INVALIDATE: '세션 무효화',
  SESSION_RECONNECT: '세션 재연결',
  POLICY_UPDATE: '정책 변경',
  AUTO_SUSPEND: '자동 중지',
};

/** 감사 로그 정보 */
export interface AuditLog {
  id: string;
  actorId: string | null;
  actorType: ActorType;
  actorEmail: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  reason: string | null;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ============================================
// API 응답 타입
// ============================================

/** 페이지네이션 메타 정보 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** 페이지네이션 응답 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/** API 에러 응답 */
export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  timestamp: string;
  path: string;
}

// ============================================
// 3조건 실행 체크 유틸리티
// ============================================

/** 
 * 스케줄 실행 가능 여부 계산
 * 3조건: userEnabled + adminStatus=APPROVED + sessionStatus=HEALTHY
 */
export function checkScheduleExecutability(
  schedule: Pick<Schedule, 'userEnabled' | 'adminStatus'>,
  sessionStatus: SessionStatus | null
): ScheduleExecutability {
  const userEnabled = schedule.userEnabled;
  const adminApproved = schedule.adminStatus === 'APPROVED';
  const sessionHealthy = sessionStatus === 'HEALTHY';
  
  let blockCode: BlockCode | null = null;
  let blockMessage: string | null = null;
  
  // 우선순위에 따라 차단 사유 결정
  if (!userEnabled) {
    blockCode = 'USER_DISABLED';
    blockMessage = BLOCK_CODE_LABELS.USER_DISABLED;
  } else if (schedule.adminStatus === 'NEEDS_REVIEW') {
    blockCode = 'ADMIN_NOT_APPROVED';
    blockMessage = BLOCK_CODE_LABELS.ADMIN_NOT_APPROVED;
  } else if (schedule.adminStatus === 'SUSPENDED') {
    blockCode = 'ADMIN_SUSPENDED';
    blockMessage = BLOCK_CODE_LABELS.ADMIN_SUSPENDED;
  } else if (schedule.adminStatus === 'BANNED') {
    blockCode = 'ADMIN_BANNED';
    blockMessage = BLOCK_CODE_LABELS.ADMIN_BANNED;
  } else if (sessionStatus === 'EXPIRED') {
    blockCode = 'SESSION_EXPIRED';
    blockMessage = BLOCK_CODE_LABELS.SESSION_EXPIRED;
  } else if (sessionStatus === 'CHALLENGE_REQUIRED') {
    blockCode = 'SESSION_CHALLENGE';
    blockMessage = BLOCK_CODE_LABELS.SESSION_CHALLENGE;
  } else if (sessionStatus === 'ERROR' || sessionStatus === null || sessionStatus === 'PENDING') {
    blockCode = 'SESSION_ERROR';
    blockMessage = BLOCK_CODE_LABELS.SESSION_ERROR;
  }
  
  return {
    canExecute: userEnabled && adminApproved && sessionHealthy,
    userEnabled,
    adminApproved,
    sessionHealthy,
    blockCode,
    blockMessage,
  };
}

/**
 * 에러 메시지에서 에러 코드 추출
 * 반환값은 Prisma ErrorCode enum 문자열
 */
export function classifyErrorCode(errorMessage: string): string {
  const msg = errorMessage.toLowerCase();
  
  if (msg.includes('로그인') && (msg.includes('만료') || msg.includes('expired'))) {
    return 'AUTH_EXPIRED';
  }
  if (msg.includes('captcha') || msg.includes('2단계') || msg.includes('추가 인증')) {
    return 'CHALLENGE_REQUIRED';
  }
  if (msg.includes('로그인 실패') || msg.includes('login failed')) {
    return 'LOGIN_FAILED';
  }
  if (msg.includes('권한') || msg.includes('permission')) {
    return 'PERMISSION_DENIED';
  }
  if (msg.includes('카페') && (msg.includes('없') || msg.includes('not found'))) {
    return 'CAFE_NOT_FOUND';
  }
  if (msg.includes('rate') || msg.includes('제한') || msg.includes('too many')) {
    return 'RATE_LIMIT';
  }
  if (msg.includes('ui') && msg.includes('변경')) {
    return 'UI_CHANGED';
  }
  if (msg.includes('업로드') || msg.includes('upload')) {
    return 'UPLOAD_FAILED';
  }
  if (msg.includes('network') || msg.includes('네트워크') || msg.includes('연결')) {
    return 'NETWORK_ERROR';
  }
  if (msg.includes('timeout') || msg.includes('시간 초과')) {
    return 'TIMEOUT';
  }
  if (msg.includes('browser') || msg.includes('브라우저')) {
    return 'BROWSER_ERROR';
  }
  
  return 'UNKNOWN';
}
