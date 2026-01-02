/**
 * 카페매니저 에러 코드 정의
 * 모든 에러는 코드와 메시지를 포함합니다.
 */

export enum ErrorCode {
  // ===========================================
  // 인증 관련 (1xxx)
  // ===========================================
  AUTH_INVALID_CREDENTIALS = 'AUTH_1001',
  AUTH_TOKEN_EXPIRED = 'AUTH_1002',
  AUTH_TOKEN_INVALID = 'AUTH_1003',
  AUTH_UNAUTHORIZED = 'AUTH_1004',
  AUTH_FORBIDDEN = 'AUTH_1005',
  
  // ===========================================
  // 네이버 계정 관련 (2xxx)
  // ===========================================
  NAVER_LOGIN_FAILED = 'NAVER_2001',
  NAVER_SESSION_EXPIRED = 'NAVER_2002',
  NAVER_CAPTCHA_REQUIRED = 'NAVER_2003',
  NAVER_2FA_REQUIRED = 'NAVER_2004',
  NAVER_ACCOUNT_BLOCKED = 'NAVER_2005',
  NAVER_NETWORK_ERROR = 'NAVER_2006',
  NAVER_SESSION_NOT_FOUND = 'NAVER_2007',
  
  // ===========================================
  // 템플릿 관련 (3xxx)
  // ===========================================
  TEMPLATE_NOT_FOUND = 'TEMPLATE_3001',
  TEMPLATE_INVALID_DATA = 'TEMPLATE_3002',
  TEMPLATE_IMAGE_UPLOAD_FAILED = 'TEMPLATE_3003',
  TEMPLATE_IMAGE_LIMIT_EXCEEDED = 'TEMPLATE_3004',
  TEMPLATE_IMAGE_INVALID_TYPE = 'TEMPLATE_3005',
  TEMPLATE_IMAGE_TOO_LARGE = 'TEMPLATE_3006',
  
  // ===========================================
  // 스케줄 관련 (4xxx)
  // ===========================================
  SCHEDULE_NOT_FOUND = 'SCHEDULE_4001',
  SCHEDULE_INVALID_CRON = 'SCHEDULE_4002',
  SCHEDULE_MAX_POSTS_REACHED = 'SCHEDULE_4003',
  SCHEDULE_TEMPLATE_REQUIRED = 'SCHEDULE_4004',
  
  // ===========================================
  // 게시글 작성 관련 (5xxx)
  // ===========================================
  POST_CREATE_FAILED = 'POST_5001',
  POST_TITLE_SELECTOR_NOT_FOUND = 'POST_5002',
  POST_EDITOR_NOT_FOUND = 'POST_5003',
  POST_SUBMIT_BUTTON_NOT_FOUND = 'POST_5004',
  POST_IMAGE_UPLOAD_FAILED = 'POST_5005',
  POST_CAFE_ACCESS_DENIED = 'POST_5006',
  POST_BOARD_NOT_FOUND = 'POST_5007',
  POST_CONTENT_BLOCKED = 'POST_5008',
  POST_RATE_LIMITED = 'POST_5009',
  
  // ===========================================
  // 게시글 관리 관련 (6xxx)
  // ===========================================
  MANAGED_POST_NOT_FOUND = 'MANAGED_POST_6001',
  MANAGED_POST_SYNC_FAILED = 'MANAGED_POST_6002',
  MANAGED_POST_DELETE_FAILED = 'MANAGED_POST_6003',
  
  // ===========================================
  // Job 관련 (7xxx)
  // ===========================================
  JOB_NOT_FOUND = 'JOB_7001',
  JOB_ALREADY_PROCESSING = 'JOB_7002',
  JOB_FAILED = 'JOB_7003',
  JOB_QUEUE_ERROR = 'JOB_7004',
  JOB_MAX_ATTEMPTS_EXCEEDED = 'JOB_7005',
  
  // ===========================================
  // 일반 오류 (9xxx)
  // ===========================================
  UNKNOWN_ERROR = 'UNKNOWN_9000',
  VALIDATION_ERROR = 'VALIDATION_9001',
  DATABASE_ERROR = 'DATABASE_9002',
  NETWORK_ERROR = 'NETWORK_9003',
  BROWSER_ERROR = 'BROWSER_9004',
  FILE_NOT_FOUND = 'FILE_9005',
  PERMISSION_DENIED = 'PERMISSION_9006',
}

/**
 * 에러 코드별 기본 메시지
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // 인증
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: '아이디 또는 비밀번호가 올바르지 않습니다',
  [ErrorCode.AUTH_TOKEN_EXPIRED]: '인증 토큰이 만료되었습니다. 다시 로그인해주세요',
  [ErrorCode.AUTH_TOKEN_INVALID]: '유효하지 않은 인증 토큰입니다',
  [ErrorCode.AUTH_UNAUTHORIZED]: '인증이 필요합니다',
  [ErrorCode.AUTH_FORBIDDEN]: '접근 권한이 없습니다',
  
  // 네이버
  [ErrorCode.NAVER_LOGIN_FAILED]: '네이버 로그인에 실패했습니다',
  [ErrorCode.NAVER_SESSION_EXPIRED]: '네이버 세션이 만료되었습니다. 다시 연동해주세요',
  [ErrorCode.NAVER_CAPTCHA_REQUIRED]: 'CAPTCHA 인증이 필요합니다. 수동으로 로그인해주세요',
  [ErrorCode.NAVER_2FA_REQUIRED]: '2단계 인증이 필요합니다. 수동으로 로그인해주세요',
  [ErrorCode.NAVER_ACCOUNT_BLOCKED]: '네이버 계정이 차단되었습니다',
  [ErrorCode.NAVER_NETWORK_ERROR]: '네이버 서버 연결에 실패했습니다',
  [ErrorCode.NAVER_SESSION_NOT_FOUND]: '활성화된 네이버 세션이 없습니다',
  
  // 템플릿
  [ErrorCode.TEMPLATE_NOT_FOUND]: '템플릿을 찾을 수 없습니다',
  [ErrorCode.TEMPLATE_INVALID_DATA]: '템플릿 데이터가 유효하지 않습니다',
  [ErrorCode.TEMPLATE_IMAGE_UPLOAD_FAILED]: '이미지 업로드에 실패했습니다',
  [ErrorCode.TEMPLATE_IMAGE_LIMIT_EXCEEDED]: '최대 10개의 이미지만 업로드할 수 있습니다',
  [ErrorCode.TEMPLATE_IMAGE_INVALID_TYPE]: '허용되지 않는 이미지 형식입니다',
  [ErrorCode.TEMPLATE_IMAGE_TOO_LARGE]: '이미지 크기가 너무 큽니다 (최대 10MB)',
  
  // 스케줄
  [ErrorCode.SCHEDULE_NOT_FOUND]: '스케줄을 찾을 수 없습니다',
  [ErrorCode.SCHEDULE_INVALID_CRON]: '올바르지 않은 cron 표현식입니다',
  [ErrorCode.SCHEDULE_MAX_POSTS_REACHED]: '오늘 최대 포스팅 수에 도달했습니다',
  [ErrorCode.SCHEDULE_TEMPLATE_REQUIRED]: '스케줄에 연결된 템플릿이 필요합니다',
  
  // 게시글 작성
  [ErrorCode.POST_CREATE_FAILED]: '게시글 작성에 실패했습니다',
  [ErrorCode.POST_TITLE_SELECTOR_NOT_FOUND]: '제목 입력 필드를 찾을 수 없습니다',
  [ErrorCode.POST_EDITOR_NOT_FOUND]: '본문 에디터를 찾을 수 없습니다',
  [ErrorCode.POST_SUBMIT_BUTTON_NOT_FOUND]: '등록 버튼을 찾을 수 없습니다',
  [ErrorCode.POST_IMAGE_UPLOAD_FAILED]: '이미지 첨부에 실패했습니다',
  [ErrorCode.POST_CAFE_ACCESS_DENIED]: '카페에 접근할 수 없습니다',
  [ErrorCode.POST_BOARD_NOT_FOUND]: '게시판을 찾을 수 없습니다',
  [ErrorCode.POST_CONTENT_BLOCKED]: '게시글 내용이 차단되었습니다',
  [ErrorCode.POST_RATE_LIMITED]: '너무 빠르게 게시하고 있습니다. 잠시 후 다시 시도해주세요',
  
  // 게시글 관리
  [ErrorCode.MANAGED_POST_NOT_FOUND]: '게시글을 찾을 수 없습니다',
  [ErrorCode.MANAGED_POST_SYNC_FAILED]: '게시글 동기화에 실패했습니다',
  [ErrorCode.MANAGED_POST_DELETE_FAILED]: '게시글 삭제에 실패했습니다',
  
  // Job
  [ErrorCode.JOB_NOT_FOUND]: '작업을 찾을 수 없습니다',
  [ErrorCode.JOB_ALREADY_PROCESSING]: '이미 처리 중인 작업입니다',
  [ErrorCode.JOB_FAILED]: '작업 처리에 실패했습니다',
  [ErrorCode.JOB_QUEUE_ERROR]: '작업 대기열 오류가 발생했습니다',
  [ErrorCode.JOB_MAX_ATTEMPTS_EXCEEDED]: '최대 재시도 횟수를 초과했습니다',
  
  // 일반
  [ErrorCode.UNKNOWN_ERROR]: '알 수 없는 오류가 발생했습니다',
  [ErrorCode.VALIDATION_ERROR]: '입력값이 유효하지 않습니다',
  [ErrorCode.DATABASE_ERROR]: '데이터베이스 오류가 발생했습니다',
  [ErrorCode.NETWORK_ERROR]: '네트워크 연결 오류가 발생했습니다',
  [ErrorCode.BROWSER_ERROR]: '브라우저 오류가 발생했습니다',
  [ErrorCode.FILE_NOT_FOUND]: '파일을 찾을 수 없습니다',
  [ErrorCode.PERMISSION_DENIED]: '권한이 거부되었습니다',
};

/**
 * 에러 코드로 메시지 가져오기
 */
export function getErrorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
}

/**
 * 애플리케이션 에러 클래스
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message || getErrorMessage(code));
    this.name = 'AppError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}




