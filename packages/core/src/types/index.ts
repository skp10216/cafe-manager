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
export type JobType = 'INIT_SESSION' | 'VERIFY_SESSION' | 'CREATE_POST' | 'SYNC_POSTS' | 'DELETE_POST';

/** Job 상태 */
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/** 에러 카테고리 (실패 원인 분류) */
export type ErrorCategory =
  | 'LOGIN_REQUIRED'      // 로그인 필요
  | 'PERMISSION_DENIED'   // 권한 부족
  | 'EDITOR_LOAD_FAIL'    // 에디터 로딩 실패
  | 'IMAGE_UPLOAD_FAIL'   // 이미지 업로드 실패
  | 'NETWORK_ERROR'       // 네트워크 오류
  | 'CAFE_NOT_FOUND'      // 카페/게시판 없음
  | 'RATE_LIMITED'        // 요청 제한
  | 'UNKNOWN';            // 알 수 없음

/** 에러 카테고리 한글 라벨 */
export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  LOGIN_REQUIRED: '로그인 필요',
  PERMISSION_DENIED: '권한 부족',
  EDITOR_LOAD_FAIL: '에디터 로딩 실패',
  IMAGE_UPLOAD_FAIL: '이미지 업로드 실패',
  NETWORK_ERROR: '네트워크 오류',
  CAFE_NOT_FOUND: '카페/게시판 없음',
  RATE_LIMITED: '요청 제한',
  UNKNOWN: '알 수 없음',
};

/** 에러 카테고리별 사용자 안내 문구 */
export const ERROR_CATEGORY_GUIDES: Record<ErrorCategory, string> = {
  LOGIN_REQUIRED: '설정 > 네이버 연동에서 재연동해주세요',
  PERMISSION_DENIED: '카페 가입 상태와 등급을 확인해주세요',
  EDITOR_LOAD_FAIL: '네이버 카페 점검 중일 수 있습니다. 잠시 후 재시도해주세요',
  IMAGE_UPLOAD_FAIL: '이미지 파일을 확인하거나 잠시 후 재시도해주세요',
  NETWORK_ERROR: '인터넷 연결을 확인하고 재시도해주세요',
  CAFE_NOT_FOUND: '템플릿의 카페/게시판 설정을 확인해주세요',
  RATE_LIMITED: '잠시 후(약 10분) 자동으로 재시도됩니다',
  UNKNOWN: '로그를 확인하거나 고객센터에 문의해주세요',
};

/**
 * Job Payload 확장 타입
 * Worker에서 저장하는 대시보드용 추가 정보
 */
export interface JobPayloadExtension {
  // 대상 정보 (대시보드 표시용)
  templateId?: string;
  templateName?: string;
  scheduleId?: string;
  scheduleName?: string;
  cafeId?: string;
  cafeName?: string;
  boardId?: string;
  boardName?: string;
  
  // 결과 정보 (성공 시)
  resultUrl?: string;           // 게시 성공 시 URL
  resultArticleId?: string;     // 게시 성공 시 articleId
  screenshotUrl?: string;       // 성공/실패 스크린샷
  
  // 실패 정보 (사용자 친화적)
  errorCategory?: ErrorCategory;
  errorSummary?: string;        // "네이버 로그인이 필요합니다"
  errorDetails?: string;        // 기술적 상세 (로그용)
}

/** Job 정보 */
export interface Job {
  id: string;
  type: JobType;
  userId: string;
  payload: Record<string, unknown> & Partial<JobPayloadExtension>;
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

