/**
 * 복수 스케줄 동시 실행 지원을 위한 타입 정의
 * 
 * 문제: 기존 ActiveRunResponse는 단일 run만 지원
 * 해결: 프론트엔드에서 activeRuns 컬렉션으로 관리
 */

/** 스케줄 실행 상태 */
export type RunStatus = 
  | 'QUEUED'    // 대기 중
  | 'RUNNING'   // 실행 중
  | 'COMPLETED' // 완료 (성공)
  | 'FAILED'    // 완료 (전체 실패)
  | 'PARTIAL';  // 완료 (일부 실패)

/** 개별 실행 정보 */
export interface ScheduleRunInfo {
  id: string;
  scheduleId: string;
  scheduleName: string;
  status: RunStatus;
  
  // 카운트
  totalTarget: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  
  // 시간
  startedAt: string | null;
  updatedAt: string;
  
  // 최근 이벤트 (최대 3개)
  recentEvents: RunEvent[];
}

/** 실행 이벤트 */
export interface RunEvent {
  index: number;
  result: 'SUCCESS' | 'FAILED';
  errorCode?: string;
  createdAt: string;
}

/** 복수 실행 응답 (프론트엔드 관리용) */
export interface MultiRunState {
  /** 현재 활성 실행 목록 (실행중 + 최근 완료) */
  runs: ScheduleRunInfo[];
  /** 선택된 run ID */
  selectedRunId: string | null;
  /** 마지막 업데이트 시간 */
  lastUpdated: string;
}

/** Global Overview 데이터 */
export interface GlobalRunOverview {
  /** 실행중 스케줄 수 */
  runningCount: number;
  /** 전체 진행 (완료/총) */
  totalProcessed: number;
  totalTarget: number;
  /** 전체 성공/실패 */
  totalSuccess: number;
  totalFailed: number;
  /** 세션 오류 여부 */
  hasSessionError: boolean;
  /** 마지막 업데이트 */
  lastUpdated: string;
}

/** Run 목록 필터 */
export type RunFilter = 'ALL' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/**
 * 카운트 기반 상태 파생 함수
 * - processedCount >= totalTarget → 완료 계열
 */
export function deriveRunStatus(
  processedCount: number,
  totalTarget: number,
  successCount: number,
  failedCount: number,
  originalStatus?: string
): RunStatus {
  if (totalTarget === 0) {
    return originalStatus === 'QUEUED' || originalStatus === 'PENDING' ? 'QUEUED' : 'RUNNING';
  }

  const isProcessingDone = processedCount >= totalTarget;

  if (isProcessingDone) {
    if (failedCount === 0) return 'COMPLETED';
    if (successCount === 0) return 'FAILED';
    return 'PARTIAL';
  }

  if (originalStatus === 'QUEUED' || originalStatus === 'PENDING') {
    return 'QUEUED';
  }

  return 'RUNNING';
}

/**
 * GlobalOverview 계산
 */
export function calculateGlobalOverview(runs: ScheduleRunInfo[]): GlobalRunOverview {
  const runningRuns = runs.filter(r => r.status === 'RUNNING' || r.status === 'QUEUED');
  
  const totalProcessed = runs.reduce((sum, r) => sum + r.processedCount, 0);
  const totalTarget = runs.reduce((sum, r) => sum + r.totalTarget, 0);
  const totalSuccess = runs.reduce((sum, r) => sum + r.successCount, 0);
  const totalFailed = runs.reduce((sum, r) => sum + r.failedCount, 0);
  
  // 세션 오류 체크 (에러 코드에 SESSION 포함)
  const hasSessionError = runs.some(r => 
    r.recentEvents.some(e => 
      e.result === 'FAILED' && 
      e.errorCode?.includes('SESSION')
    )
  );

  return {
    runningCount: runningRuns.length,
    totalProcessed,
    totalTarget,
    totalSuccess,
    totalFailed,
    hasSessionError,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * 진행률 계산
 */
export function calculateProgress(processedCount: number, totalTarget: number): number {
  if (totalTarget === 0) return 0;
  return Math.round((processedCount / totalTarget) * 100);
}

/**
 * 성공률 계산
 */
export function calculateSuccessRate(successCount: number, processedCount: number): number {
  if (processedCount === 0) return 0;
  return Math.round((successCount / processedCount) * 100);
}


