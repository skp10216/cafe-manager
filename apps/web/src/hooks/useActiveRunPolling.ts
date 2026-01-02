'use client';

/**
 * Active Run 폴링 훅
 * 
 * 대시보드에서 실행 중인 ScheduleRun을 추적하기 위한 전용 훅
 * - 지정된 간격으로 폴링
 * - 증가분 감지 시 토스트 알림
 * - 과도한 알림 방지 로직 포함
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { dashboardApi, ActiveRunResponse } from '@/lib/api-client';
import { useToast } from '@/components/common/ToastProvider';

interface UseActiveRunPollingOptions {
  /** 폴링 간격 (ms) - 기본값 3000 (3초) */
  intervalMs?: number;
  /** 폴링 활성화 여부 */
  enabled?: boolean;
  /** 성공 토스트 표시 여부 */
  showSuccessToast?: boolean;
  /** 실패 토스트 표시 여부 */
  showFailureToast?: boolean;
}

interface UseActiveRunPollingReturn {
  /** Active Run 데이터 */
  data: ActiveRunResponse | null;
  /** 로딩 상태 (첫 로드) */
  loading: boolean;
  /** 에러 */
  error: Error | null;
  /** 수동 리페치 */
  refetch: () => Promise<void>;
}

/**
 * Active Run 폴링 훅
 * 
 * @example
 * const { data, loading, error } = useActiveRunPolling({
 *   intervalMs: 3000,
 *   enabled: true,
 * });
 * 
 * if (data?.run) {
 *   // 실행 중인 run 표시
 * }
 */
export function useActiveRunPolling(
  options: UseActiveRunPollingOptions = {}
): UseActiveRunPollingReturn {
  const {
    intervalMs = 3000,
    enabled = true,
    showSuccessToast = true,
    showFailureToast = true,
  } = options;

  const toast = useToast();

  const [data, setData] = useState<ActiveRunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 이전 데이터 참조 (증가분 감지용)
  const prevDataRef = useRef<ActiveRunResponse | null>(null);
  
  // 마지막 토스트 시간 (과도한 알림 방지)
  const lastToastTimeRef = useRef<number>(0);
  const TOAST_COOLDOWN_MS = 1000; // 토스트 간 최소 간격

  /**
   * 증가분 감지 및 토스트 표시
   */
  const handleDataChange = useCallback(
    (prevData: ActiveRunResponse | null, newData: ActiveRunResponse) => {
      // 실행 중인 run이 없으면 무시
      if (!prevData?.run || !newData.run) return;

      // 같은 run인지 확인
      if (prevData.run.id !== newData.run.id) return;

      const now = Date.now();
      
      // 쿨다운 체크
      if (now - lastToastTimeRef.current < TOAST_COOLDOWN_MS) return;

      const successDiff = newData.run.successCount - prevData.run.successCount;
      const failedDiff = newData.run.failedCount - prevData.run.failedCount;

      // 성공 증가
      if (successDiff > 0 && showSuccessToast) {
        lastToastTimeRef.current = now;
        
        if (successDiff === 1) {
          toast.success(
            `✅ 게시 성공 (${newData.run.successCount}/${newData.run.totalTarget})`
          );
        } else {
          // 여러 개 동시 성공 시 요약 메시지
          toast.success(
            `✅ ${successDiff}건 게시 성공 (${newData.run.successCount}/${newData.run.totalTarget})`
          );
        }
      }

      // 실패 증가
      if (failedDiff > 0 && showFailureToast) {
        lastToastTimeRef.current = now;

        // 최근 실패 이벤트에서 에러 코드 추출
        const latestError = newData.recentEvents.find(
          (e) => e.result === 'FAILED'
        );

        if (failedDiff === 1) {
          toast.error(
            `❌ 게시 실패 (${newData.run.failedCount}/${newData.run.totalTarget})`,
            { description: latestError?.errorCode ?? '알 수 없는 오류' }
          );
        } else {
          toast.error(
            `❌ ${failedDiff}건 게시 실패 (${newData.run.failedCount}/${newData.run.totalTarget})`,
            { description: '로그에서 상세 내용을 확인하세요' }
          );
        }
      }
    },
    [showSuccessToast, showFailureToast, toast]
  );

  /**
   * Active Run 조회
   * 
   * 깜빡임 방지:
   * - run이 null로 변경되어도 이전 완료된 run이 있으면 잠시 유지
   * - 새 RUNNING run이 나타나면 즉시 전환
   */
  const fetchActiveRun = useCallback(async () => {
    try {
      const newData = await dashboardApi.getActiveRun();

      // 증가분 감지 및 토스트
      if (prevDataRef.current) {
        handleDataChange(prevDataRef.current, newData);
      }

      // 깜빡임 방지: null이 오면 이전 완료된 데이터를 잠시 유지
      // (단, 새 RUNNING이 있으면 즉시 전환)
      const shouldKeepPrevData =
        !newData.run &&
        prevDataRef.current?.run &&
        (prevDataRef.current.run.status === 'COMPLETED' ||
          prevDataRef.current.run.status === 'FAILED');

      if (!shouldKeepPrevData) {
        prevDataRef.current = newData;
        setData(newData);
      }
      // shouldKeepPrevData가 true면 이전 데이터 유지 (30초 타임아웃은 API에서 처리)

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [handleDataChange]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // 초기 로드
    fetchActiveRun();

    // 폴링
    const intervalId = setInterval(fetchActiveRun, intervalMs);

    return () => clearInterval(intervalId);
  }, [enabled, intervalMs, fetchActiveRun]);

  return { data, loading, error, refetch: fetchActiveRun };
}

export default useActiveRunPolling;

