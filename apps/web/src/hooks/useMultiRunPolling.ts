'use client';

/**
 * 복수 스케줄 실행 폴링 훅
 * 
 * 핵심 원칙:
 * - activeRuns 컬렉션으로 복수 실행 관리
 * - selectedRunId로 상세 보기 관리
 * - 새 실행이 생겨도 선택된 상세가 자동으로 바뀌지 않음
 * - 완료된 실행은 일정 시간 후 자동 제거
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { dashboardApi, ActiveRunsResponse, ActiveRunInfo, ActiveRunEvent } from '@/lib/api-client';
import { useToast } from '@/components/common/ToastProvider';
import {
  ScheduleRunInfo,
  RunStatus,
  RunEvent,
  GlobalRunOverview,
  deriveRunStatus,
  calculateGlobalOverview,
  RunFilter,
} from '@/types/multi-run';

// ============================================
// 상수 정의
// ============================================

/** 완료된 run 유지 시간 (30초) */
const COMPLETED_RUN_TTL_MS = 30_000;

/** 토스트 쿨다운 (1초) */
const TOAST_COOLDOWN_MS = 1000;

/** 최대 보관 run 수 */
const MAX_RUNS_HISTORY = 10;

// ============================================
// 타입 정의
// ============================================

export interface UseMultiRunPollingOptions {
  /** 폴링 간격 (ms) - 기본값 3000 (3초) */
  intervalMs?: number;
  /** 폴링 활성화 여부 */
  enabled?: boolean;
  /** 성공 토스트 표시 여부 */
  showSuccessToast?: boolean;
  /** 실패 토스트 표시 여부 */
  showFailureToast?: boolean;
}

export interface UseMultiRunPollingReturn {
  /** 현재 활성 실행 목록 */
  runs: ScheduleRunInfo[];
  /** 선택된 run ID */
  selectedRunId: string | null;
  /** 선택된 run 정보 */
  selectedRun: ScheduleRunInfo | null;
  /** Global Overview */
  overview: GlobalRunOverview;
  /** 로딩 상태 (첫 로드) */
  loading: boolean;
  /** 에러 */
  error: Error | null;
  /** run 선택 */
  selectRun: (runId: string | null) => void;
  /** 필터링된 runs */
  filteredRuns: (filter: RunFilter) => ScheduleRunInfo[];
  /** 수동 리페치 */
  refetch: () => Promise<void>;
  /** 실행중인 run 개수 */
  runningCount: number;
  /** 완료된 run 개수 */
  completedCount: number;
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * ActiveRunInfo → ScheduleRunInfo 변환
 */
function toScheduleRunInfo(
  run: ActiveRunInfo,
  events: ActiveRunEvent[]
): ScheduleRunInfo {
  const status = deriveRunStatus(
    run.processedCount,
    run.totalTarget,
    run.successCount,
    run.failedCount,
    run.status
  );

  const recentEvents: RunEvent[] = events.map(e => ({
    index: e.index,
    result: e.result,
    errorCode: e.errorCode,
    createdAt: e.createdAt,
  }));

  return {
    id: run.id,
    scheduleId: run.scheduleId,
    scheduleName: run.scheduleName,
    status,
    totalTarget: run.totalTarget,
    processedCount: run.processedCount,
    successCount: run.successCount,
    failedCount: run.failedCount,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    recentEvents,
  };
}

/**
 * run 상태가 완료 계열인지 확인
 */
function isCompleted(status: RunStatus): boolean {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'PARTIAL';
}

// ============================================
// 메인 훅
// ============================================

export function useMultiRunPolling(
  options: UseMultiRunPollingOptions = {}
): UseMultiRunPollingReturn {
  const {
    intervalMs = 3000,
    enabled = true,
    showSuccessToast = true,
    showFailureToast = true,
  } = options;

  const toast = useToast();

  // 상태
  const [runs, setRuns] = useState<ScheduleRunInfo[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const prevRunsRef = useRef<Map<string, ScheduleRunInfo>>(new Map());
  const lastToastTimeRef = useRef<number>(0);
  const completedAtRef = useRef<Map<string, number>>(new Map()); // run ID → 완료 시간

  /**
   * 증가분 감지 및 토스트 표시
   */
  const handleRunUpdate = useCallback(
    (prevRun: ScheduleRunInfo | null, newRun: ScheduleRunInfo) => {
      if (!prevRun) return;

      const now = Date.now();
      if (now - lastToastTimeRef.current < TOAST_COOLDOWN_MS) return;

      const successDiff = newRun.successCount - prevRun.successCount;
      const failedDiff = newRun.failedCount - prevRun.failedCount;

      // 성공 증가
      if (successDiff > 0 && showSuccessToast) {
        lastToastTimeRef.current = now;
        
        if (successDiff === 1) {
          toast.success(
            `✅ ${newRun.scheduleName}: 게시 성공 (${newRun.successCount}/${newRun.totalTarget})`
          );
        } else {
          toast.success(
            `✅ ${newRun.scheduleName}: ${successDiff}건 게시 성공 (${newRun.successCount}/${newRun.totalTarget})`
          );
        }
      }

      // 실패 증가
      if (failedDiff > 0 && showFailureToast) {
        lastToastTimeRef.current = now;

        const latestError = newRun.recentEvents.find(e => e.result === 'FAILED');

        if (failedDiff === 1) {
          toast.error(
            `❌ ${newRun.scheduleName}: 게시 실패 (${newRun.failedCount}/${newRun.totalTarget})`,
            { description: latestError?.errorCode ?? '알 수 없는 오류' }
          );
        } else {
          toast.error(
            `❌ ${newRun.scheduleName}: ${failedDiff}건 게시 실패`,
            { description: '로그에서 상세 내용을 확인하세요' }
          );
        }
      }
    },
    [showSuccessToast, showFailureToast, toast]
  );

  /**
   * runs 업데이트 로직 (복수 runs 지원)
   */
  const updateRuns = useCallback((newData: ActiveRunsResponse) => {
    setRuns(prevRuns => {
      const now = Date.now();
      const runMap = new Map(prevRuns.map(r => [r.id, r]));

      // 1. API에서 반환된 모든 runs 처리
      for (const apiRun of newData.runs) {
        const events = newData.recentEventsByRunId[apiRun.id] || [];
        const newRun = toScheduleRunInfo(apiRun, events);
        const prevRun = runMap.get(newRun.id) || prevRunsRef.current.get(newRun.id);
        
        // 토스트 처리
        handleRunUpdate(prevRun ?? null, newRun);
        
        // 맵 업데이트
        runMap.set(newRun.id, newRun);
        prevRunsRef.current.set(newRun.id, newRun);

        // 완료 시간 기록
        if (isCompleted(newRun.status) && !completedAtRef.current.has(newRun.id)) {
          completedAtRef.current.set(newRun.id, now);
        }
      }

      // 2. API에서 반환되지 않은 기존 실행중 run은 완료된 것으로 처리
      //    (서버에서 이미 완료 처리됨 → TTL 대기)
      const apiRunIds = new Set(newData.runs.map(r => r.id));
      for (const [runId, existingRun] of runMap) {
        if (!apiRunIds.has(runId) && !isCompleted(existingRun.status)) {
          // 실행중이었는데 API에서 안 온 경우 → 완료된 것으로 처리
          const completedRun: ScheduleRunInfo = {
            ...existingRun,
            status: existingRun.failedCount > 0 ? 'FAILED' : 'COMPLETED',
          };
          runMap.set(runId, completedRun);
          completedAtRef.current.set(runId, now);
        }
      }

      // 3. 완료된 run 중 TTL 초과한 것 제거
      const runsArray = Array.from(runMap.values());
      const filteredRuns = runsArray.filter(run => {
        if (!isCompleted(run.status)) return true;
        
        const completedAt = completedAtRef.current.get(run.id);
        if (!completedAt) return true;
        
        const elapsed = now - completedAt;
        if (elapsed > COMPLETED_RUN_TTL_MS) {
          completedAtRef.current.delete(run.id);
          prevRunsRef.current.delete(run.id);
          return false;
        }
        return true;
      });

      // 4. 최대 개수 제한
      const sortedRuns = filteredRuns
        .sort((a, b) => {
          // 실행중 > 대기중 > 완료 순서로 정렬
          const statusOrder = { RUNNING: 0, QUEUED: 1, PARTIAL: 2, COMPLETED: 3, FAILED: 4 };
          const orderA = statusOrder[a.status] ?? 5;
          const orderB = statusOrder[b.status] ?? 5;
          if (orderA !== orderB) return orderA - orderB;
          // 같은 상태면 최근 업데이트 순
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        })
        .slice(0, MAX_RUNS_HISTORY);

      return sortedRuns;
    });
  }, [handleRunUpdate]);

  /**
   * 폴링 fetch (복수 runs 지원)
   */
  const fetchActiveRuns = useCallback(async () => {
    try {
      const newData = await dashboardApi.getActiveRuns();
      updateRuns(newData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [updateRuns]);

  /**
   * run 선택
   */
  const selectRun = useCallback((runId: string | null) => {
    setSelectedRunId(runId);
  }, []);

  /**
   * 필터링된 runs
   */
  const filteredRuns = useCallback((filter: RunFilter): ScheduleRunInfo[] => {
    switch (filter) {
      case 'RUNNING':
        return runs.filter(r => r.status === 'RUNNING' || r.status === 'QUEUED');
      case 'COMPLETED':
        return runs.filter(r => r.status === 'COMPLETED');
      case 'FAILED':
        return runs.filter(r => r.status === 'FAILED' || r.status === 'PARTIAL');
      default:
        return runs;
    }
  }, [runs]);

  // 선택된 run
  const selectedRun = useMemo(() => {
    if (!selectedRunId) return null;
    return runs.find(r => r.id === selectedRunId) ?? null;
  }, [runs, selectedRunId]);

  // Global Overview 계산
  const overview = useMemo(() => calculateGlobalOverview(runs), [runs]);

  // 실행중/완료 카운트
  const runningCount = useMemo(
    () => runs.filter(r => r.status === 'RUNNING' || r.status === 'QUEUED').length,
    [runs]
  );
  const completedCount = useMemo(
    () => runs.filter(r => isCompleted(r.status)).length,
    [runs]
  );

  // 첫 run 자동 선택 (선택된 게 없을 때)
  useEffect(() => {
    if (!selectedRunId && runs.length > 0) {
      // 실행중인 것 우선, 없으면 첫번째
      const runningRun = runs.find(r => r.status === 'RUNNING');
      setSelectedRunId(runningRun?.id ?? runs[0].id);
    }
    // 선택된 run이 목록에서 사라지면 자동 재선택
    if (selectedRunId && !runs.find(r => r.id === selectedRunId)) {
      const runningRun = runs.find(r => r.status === 'RUNNING');
      setSelectedRunId(runningRun?.id ?? runs[0]?.id ?? null);
    }
  }, [runs, selectedRunId]);

  // 폴링 시작
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    fetchActiveRuns();
    const intervalId = setInterval(fetchActiveRuns, intervalMs);
    return () => clearInterval(intervalId);
  }, [enabled, intervalMs, fetchActiveRuns]);

  return {
    runs,
    selectedRunId,
    selectedRun,
    overview,
    loading,
    error,
    selectRun,
    filteredRuns,
    refetch: fetchActiveRuns,
    runningCount,
    completedCount,
  };
}

export default useMultiRunPolling;


