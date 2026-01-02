/**
 * Dashboard DTO 모음
 * 대시보드 API 응답 타입 정의
 */

// ==============================================
// 공통 타입
// ==============================================

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

// ==============================================
// 1. 연동 상태 API 응답
// ==============================================

/** 연동 상태 타입 */
export type IntegrationStatusType =
  | 'OK'              // 정상 (자동 실행 가능)
  | 'WARNING'         // 주의 (곧 만료/확인 필요)
  | 'ACTION_REQUIRED' // 조치 필요 (재연동 필요)
  | 'NOT_CONNECTED';  // 미연결

/** 세션 상태 타입 (스키마의 SessionStatus와 일치) */
export type SessionStatusType =
  | 'PENDING'
  | 'HEALTHY'
  | 'EXPIRING'
  | 'EXPIRED'
  | 'CHALLENGE_REQUIRED'
  | 'ERROR';

/** 연동 상태 응답 */
export interface IntegrationStatusResponse {
  /** 전체 연동 상태 */
  status: IntegrationStatusType;
  /** 상태 사유 (사용자용 메시지) */
  statusReason: string;
  /** 연동된 계정 정보 */
  account: {
    /** 로그인 ID (마스킹됨) */
    loginId: string;
    /** 표시 이름 */
    displayName: string | null;
  } | null;
  /** 세션 정보 */
  session: {
    /** 세션 ID */
    id: string;
    /** 세션 상태 */
    status: SessionStatusType;
    /** 마지막 검증 시간 */
    lastVerifiedAt: string | null;
    /** 에러 메시지 */
    errorMessage: string | null;
    /** 네이버 닉네임 */
    naverNickname: string | null;
  } | null;
}

// ==============================================
// 2. 작업 요약 API 응답
// ==============================================

/** 미니 작업 항목 (카드 내 리스트용) */
export interface MiniJobItem {
  /** 작업 ID */
  jobId: string;
  /** 작업 타입 */
  type: string;
  /** 템플릿명 */
  templateName: string | null;
  /** 스케줄명 (없으면 수동 실행) */
  scheduleName: string | null;
  /** 카페명 */
  cafeName: string | null;
  /** 게시판명 */
  boardName: string | null;
  /** 생성 시간 */
  createdAt: string;
  /** 완료 시간 */
  finishedAt: string | null;
  /** 상태 */
  status: string;
  /** 결과 URL (성공 시) */
  resultUrl: string | null;
  /** 에러 카테고리 (실패 시) */
  errorCategory: ErrorCategory | null;
  /** 에러 요약 (실패 시, 사용자용) */
  errorSummary: string | null;
}

/** 카드별 데이터 */
export interface CardData {
  /** 개수 */
  count: number;
  /** 최근 항목 (최대 3개) */
  recent: MiniJobItem[];
}

/** 작업 요약 응답 */
export interface JobSummaryResponse {
  /** 오늘 통계 */
  today: {
    total: number;
    completed: number;
    failed: number;
    processing: number;
  };
  /** 카드별 데이터 */
  cards: {
    todayJobs: CardData;
    completed: CardData;
    failed: CardData;
    processing: CardData;
  };
}

// ==============================================
// 3. 오늘 타임라인 API 응답
// ==============================================

/** 타임라인 상태 */
export type TimelineStatus = 'SCHEDULED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/** 타임라인 항목 */
export interface TimelineItem {
  /** 스케줄 ID */
  scheduleId: string;
  /** 스케줄명 */
  scheduleName: string;
  /** 템플릿 ID */
  templateId: string;
  /** 템플릿명 */
  templateName: string;
  /** 카페 ID */
  cafeId: string;
  /** 카페명 */
  cafeName: string;
  /** 게시판 ID */
  boardId: string;
  /** 게시판명 */
  boardName: string;
  /** 다음 실행 시간 */
  nextRunAt: string;
  /** 상태 */
  status: TimelineStatus;
  /** 미리보기 정보 */
  preview: {
    /** 제목 미리보기 */
    subject: string;
    /** 본문 미리보기 (100자 제한) */
    contentSnippet: string;
    /** 썸네일 URL */
    thumbnailUrl: string | null;
    /** 이미지 개수 */
    imageCount: number;
  };
  /** 관련 Job ID (실행된 경우) */
  relatedJobId?: string;
  /** 결과 URL (성공 시) */
  resultUrl?: string;
  /** 에러 요약 (실패 시) */
  errorSummary?: string;
}

/** 오늘 타임라인 응답 */
export interface TodayTimelineResponse {
  /** 타임라인 항목들 */
  items: TimelineItem[];
  /** 오늘 총 예정 수 */
  totalScheduledToday: number;
  /** 오늘 완료 수 */
  completedToday: number;
  /** 오늘 실패 수 */
  failedToday: number;
}

// ==============================================
// 4. Next Run TOP N 응답
// ==============================================

/** Next Run 항목 */
export interface NextRunItem {
  /** 스케줄 ID */
  scheduleId: string;
  /** 스케줄명 */
  scheduleName: string;
  /** 템플릿명 */
  templateName: string;
  /** 카페명 */
  cafeName: string;
  /** 게시판명 */
  boardName: string;
  /** 다음 실행 시간 */
  nextRunAt: string;
  /** 남은 시간(분) */
  remainingMinutes: number;
}

/** Next Run 응답 */
export interface NextRunResponse {
  /** 항목들 (최대 N개) */
  items: NextRunItem[];
}

// ==============================================
// 5. 실패 요약 API 응답
// ==============================================

/** 실패 카테고리 항목 */
export interface FailureCategoryItem {
  /** 카테고리 */
  category: ErrorCategory;
  /** 한글 라벨 */
  label: string;
  /** 발생 횟수 */
  count: number;
  /** 비율 (%) */
  percentage: number;
  /** 최근 발생 Job ID */
  latestJobId: string;
}

/** 실패 요약 응답 */
export interface FailureSummaryResponse {
  /** Top 카테고리들 */
  topCategories: FailureCategoryItem[];
  /** 총 실패 수 */
  totalFailures: number;
  /** 기간 */
  period: 'TODAY' | 'WEEK';
}

// ==============================================
// 6. 최근 결과 API 응답
// ==============================================

/** 최근 결과 항목 */
export interface RecentResultItem {
  /** 작업 ID */
  jobId: string;
  /** 작업 타입 */
  type: string;
  /** 템플릿명 */
  templateName: string | null;
  /** 스케줄명 (없으면 '수동 실행') */
  scheduleName: string | null;
  /** 카페명 */
  cafeName: string | null;
  /** 게시판명 */
  boardName: string | null;
  /** 상태 */
  status: string;
  /** 생성 시간 */
  createdAt: string;
  /** 완료 시간 */
  finishedAt: string | null;
  /** 소요 시간(초) */
  durationSeconds: number | null;
  /** 결과 URL (성공 시) */
  resultUrl: string | null;
  /** 스크린샷 URL */
  screenshotUrl: string | null;
  /** 에러 카테고리 (실패 시) */
  errorCategory: ErrorCategory | null;
  /** 에러 요약 (실패 시, 사용자용) */
  errorSummary: string | null;
}

/** 최근 결과 응답 */
export interface RecentResultsResponse {
  /** 결과 항목들 */
  items: RecentResultItem[];
  /** 총 개수 */
  total: number;
}

// ==============================================
// 7. Active Run API 응답 (실행 중 프로세스 추적)
// ==============================================

/** Active Run 정보 */
export interface ActiveRunInfo {
  /** Run ID */
  id: string;
  /** 스케줄 ID */
  scheduleId: string;
  /** 스케줄명 */
  scheduleName: string;
  /** 실행 상태 */
  status: string;
  /** 목표 수 (총 게시글 수) */
  totalTarget: number;
  /** 처리된 수 (성공 + 실패) */
  processedCount: number;
  /** 성공 수 */
  successCount: number;
  /** 실패 수 */
  failedCount: number;
  /** 마지막 업데이트 시간 */
  updatedAt: string;
  /** 시작 시간 */
  startedAt: string | null;
}

/** Active Run 이벤트 (최근 결과) */
export interface ActiveRunEvent {
  /** 시퀀스 번호 (n번째 시도) */
  index: number;
  /** 결과 */
  result: 'SUCCESS' | 'FAILED';
  /** 에러 코드 (실패 시) */
  errorCode?: string;
  /** 발생 시간 */
  createdAt: string;
}

/** Active Run 응답 (단일 - 레거시 호환용) */
export interface ActiveRunResponse {
  /** 실행 중인 Run 정보 (없으면 null) */
  run: ActiveRunInfo | null;
  /** 최근 이벤트들 (최대 5개) */
  recentEvents: ActiveRunEvent[];
}

/** Active Runs 응답 (복수 - 다중 스케줄 동시 실행 지원) */
export interface ActiveRunsResponse {
  /** 실행 중인 Run 목록 */
  runs: ActiveRunInfo[];
  /** Run ID별 최근 이벤트들 (최대 5개씩) */
  recentEventsByRunId: Record<string, ActiveRunEvent[]>;
}


