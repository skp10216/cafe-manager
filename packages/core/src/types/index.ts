/**
 * 공통 타입 정의
 */

// ============================================
// 사용자 관련 타입
// ============================================

/** 사용자 플랜 타입 (3단계에서 활성화) */
export type PlanType = 'FREE' | 'MONTHLY' | 'YEARLY';

/** 사용자 정보 */
export interface User {
  id: string;
  email: string;
  name: string | null;
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

/** 네이버 계정 정보 (로그인 자격 증명) */
export interface NaverAccount {
  id: string;
  userId: string;
  loginId: string;                    // 네이버 로그인 아이디
  passwordEncrypted: string;          // 암호화된 비밀번호
  displayName: string | null;         // 표시 이름
  status: NaverAccountStatus;
  lastLoginAt: Date | null;
  lastLoginStatus: string | null;
  lastLoginError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 네이버 세션 관련 타입
// ============================================

/** 네이버 세션 상태 */
export type NaverSessionStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'ERROR';

/** 네이버 세션 정보 (브라우저 세션/쿠키) */
export interface NaverSession {
  id: string;
  naverAccountId: string;             // NaverAccount 참조
  profileDir: string;
  status: NaverSessionStatus;
  lastVerifiedAt: Date | null;
  errorMessage: string | null;
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
// 스케줄 관련 타입
// ============================================

/** 스케줄 상태 */
export type ScheduleStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';

/** 스케줄 정보 */
export interface Schedule {
  id: string;
  userId: string;
  templateId: string;
  name: string;
  cronExpr: string | null;
  intervalMinutes: number | null;
  maxPostsPerDay: number;
  status: ScheduleStatus;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  todayPostCount: number;
  createdAt: Date;
  updatedAt: Date;
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
// Job 관련 타입
// ============================================

/** Job 타입 */
export type JobType = 'INIT_SESSION' | 'CREATE_POST' | 'SYNC_POSTS' | 'DELETE_POST';

/** Job 상태 */
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/** Job 정보 */
export interface Job {
  id: string;
  type: JobType;
  userId: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  errorMessage: string | null;
  attempts: number;
  maxAttempts: number;
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

