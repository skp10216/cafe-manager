'use client';

/**
 * 대시보드 페이지 - Premium Edition v2
 *
 * 프리미엄 UX 목표:
 * - 첫 3초 안에 '오늘 성과'와 '현재 상태'가 읽히는 강한 정보 계층
 * - 빈 상태는 "작고 고급스럽게" 처리
 * - 메인 정보는 결과/리스크/다음 행동에 집중
 *
 * 레이아웃 순서:
 * 1. KPI (Primary + Secondary)
 * 2. 최근 결과 + 인사이트 카드 (핵심)
 * 3. 예정 작업 (컴팩트)
 * 4. 현재 실행 중 (있을 때만)
 */

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Grid } from '@mui/material';
import { useRouter } from 'next/navigation';
import { TrendingUp, Schedule } from '@mui/icons-material';

// 대시보드 컴포넌트
import {
  JobSummaryCards,
  NextRunCards,
  TodayTimeline,
  RecentResultsList,
  FailureSummary,
  OnboardingChecklist,
  StatusSummaryHeader,
  MultiRunTracker,
} from '@/components/dashboard';

// API
import {
  dashboardApi,
  naverSessionApi,
  templateApi,
  scheduleApi,
  IntegrationStatusResponse,
  JobSummaryResponse,
  TodayTimelineResponse,
  NextRunResponse,
  RecentResultsResponse,
  FailureSummaryResponse,
} from '@/lib/api-client';

// Onboarding 상태 타입
import { OnboardingStatus } from '@/components/dashboard/OnboardingChecklist';

// 토스트
import { useToast } from '@/components/common/ToastProvider';

// 세션 상태 유틸리티 (SSOT)
import { isIntegrationOK } from '@/lib/session-status';


/** 대시보드 데이터 상태 */
interface DashboardData {
  integrationStatus: IntegrationStatusResponse | null;
  jobSummary: JobSummaryResponse | null;
  todayTimeline: TodayTimelineResponse | null;
  nextRun: NextRunResponse | null;
  recentResults: RecentResultsResponse | null;
  failureSummary: FailureSummaryResponse | null;
  onboarding: OnboardingStatus;
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();

  // 데이터 상태
  const [data, setData] = useState<DashboardData>({
    integrationStatus: null,
    jobSummary: null,
    todayTimeline: null,
    nextRun: null,
    recentResults: null,
    failureSummary: null,
    onboarding: {
      naverConnected: false,
      hasTemplate: false,
      hasSchedule: false,
      sessionStatus: null,
    },
  });

  // Onboarding 체크리스트 숨김 상태
  const [hideOnboarding, setHideOnboarding] = useState(false);

  // 로딩 상태
  const [loading, setLoading] = useState({
    integrationStatus: true,
    jobSummary: true,
    todayTimeline: true,
    nextRun: true,
    recentResults: true,
    failureSummary: true,
  });


  // ==============================================
  // 데이터 로딩
  // ==============================================

  const loadDashboardData = useCallback(async () => {
    // 중요: 로딩 전 이전 데이터 초기화 (다른 사용자 데이터 노출 방지)
    setData((prev) => ({
      ...prev,
      integrationStatus: null,
      jobSummary: null,
      todayTimeline: null,
      nextRun: null,
      recentResults: null,
      failureSummary: null,
    }));

    setLoading({
      integrationStatus: true,
      jobSummary: true,
      todayTimeline: true,
      nextRun: true,
      recentResults: true,
      failureSummary: true,
    });

    // 모든 API를 병렬로 호출 (Onboarding 체크용 템플릿/스케줄 포함)
    const [
      integrationStatusRes,
      jobSummaryRes,
      todayTimelineRes,
      nextRunRes,
      recentResultsRes,
      failureSummaryRes,
      templatesRes,
      schedulesRes,
    ] = await Promise.allSettled([
      dashboardApi.getIntegrationStatus(),
      dashboardApi.getJobSummary(),
      dashboardApi.getTodayTimeline(),
      dashboardApi.getNextRun(3),
      dashboardApi.getRecentResults({ limit: 3 }),
      dashboardApi.getFailureSummary('TODAY'),
      templateApi.list(1, 1),
      scheduleApi.list(1, 1),
    ]);

    // Onboarding 상태 계산
    const integrationData =
      integrationStatusRes.status === 'fulfilled'
        ? integrationStatusRes.value
        : null;
    const hasTemplates =
      templatesRes.status === 'fulfilled' && templatesRes.value.meta.total > 0;
    const hasSchedules =
      schedulesRes.status === 'fulfilled' && schedulesRes.value.meta.total > 0;
    // SSOT: isIntegrationOK 사용하여 연동 상태 판단
    const naverConnected = isIntegrationOK(integrationData?.status);
    const sessionStatus =
      (integrationData?.session?.status as OnboardingStatus['sessionStatus']) ??
      null;

    // 결과 처리
    setData({
      integrationStatus: integrationData,
      jobSummary:
        jobSummaryRes.status === 'fulfilled' ? jobSummaryRes.value : null,
      todayTimeline:
        todayTimelineRes.status === 'fulfilled' ? todayTimelineRes.value : null,
      nextRun: nextRunRes.status === 'fulfilled' ? nextRunRes.value : null,
      recentResults:
        recentResultsRes.status === 'fulfilled'
          ? recentResultsRes.value
          : null,
      failureSummary:
        failureSummaryRes.status === 'fulfilled'
          ? failureSummaryRes.value
          : null,
      onboarding: {
        naverConnected,
        hasTemplate: hasTemplates,
        hasSchedule: hasSchedules,
        sessionStatus,
      },
    });

    setLoading({
      integrationStatus: false,
      jobSummary: false,
      todayTimeline: false,
      nextRun: false,
      recentResults: false,
      failureSummary: false,
    });
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // ==============================================
  // 이벤트 핸들러
  // ==============================================

  /** 재연동 */
  const handleReconnect = async () => {
    if (!data.integrationStatus?.session?.id) {
      toast.error('세션 정보를 찾을 수 없습니다');
      return;
    }

    try {
      await naverSessionApi.reconnect(data.integrationStatus.session.id);
      toast.success('재연동이 시작되었습니다', {
        description: '잠시 후 상태가 업데이트됩니다',
      });
      // 잠시 후 데이터 새로고침
      setTimeout(() => loadDashboardData(), 2000);
    } catch {
      toast.error('재연동에 실패했습니다');
    }
  };

  /** 세션 검증 */
  const handleVerify = async () => {
    if (!data.integrationStatus?.session?.id) {
      toast.error('세션 정보를 찾을 수 없습니다');
      return;
    }

    try {
      await naverSessionApi.verify(data.integrationStatus.session.id);
      toast.info('상태 확인이 시작되었습니다');
      setTimeout(() => loadDashboardData(), 3000);
    } catch {
      toast.error('상태 확인에 실패했습니다');
    }
  };

  /** 작업 상세 보기 */
  const handleJobClick = (jobId: string) => {
    router.push(`/logs?jobId=${jobId}`);
  };

  /** 스케줄 편집 */
  const handleScheduleEdit = (scheduleId: string) => {
    router.push(`/schedules/${scheduleId}`);
  };

  /** 지금 실행 */
  const handleRunNow = (scheduleId: string) => {
    toast.info('즉시 실행 기능은 준비 중입니다', {
      description: '스케줄 상세에서 수동 실행할 수 있습니다',
    });
  };

  /** 스케줄 일시중지 */
  const handlePause = (scheduleId: string) => {
    toast.info('스케줄 일시중지 기능은 준비 중입니다', {
      description: '스케줄 상세에서 일시중지할 수 있습니다',
    });
  };

  /** 재시도 */
  const handleRetry = (jobId: string) => {
    toast.info('재시도 기능은 준비 중입니다');
  };

  /** 로그 보기 */
  const handleViewLog = (jobId: string) => {
    router.push(`/logs?jobId=${jobId}`);
  };

  /** Active Run 로그 보기 */
  const handleViewRunLogs = (runId: string) => {
    router.push(`/logs?runId=${runId}`);
  };

  /** 결과 필터 변경 */
  const handleResultFilterChange = async (
    filter: 'ALL' | 'SUCCESS' | 'FAILED'
  ) => {
    setLoading((prev) => ({ ...prev, recentResults: true }));
    try {
      const results = await dashboardApi.getRecentResults({ limit: 3, filter });
      setData((prev) => ({ ...prev, recentResults: results }));
    } catch {
      toast.error('결과 조회에 실패했습니다');
    } finally {
      setLoading((prev) => ({ ...prev, recentResults: false }));
    }
  };

  // ==============================================
  // 렌더링
  // ==============================================

  // 예정 작업이 있는지 확인
  const hasScheduledItems =
    (data.todayTimeline?.items?.length ?? 0) > 0 ||
    (data.nextRun?.items?.length ?? 0) > 0;

  return (
    <Box sx={{ minHeight: '100%' }}>
      {/* ========================================
          섹션 0: 상태 요약 헤더 (감성 문구 대체)
          - 실시간 시계 (초 단위)
          - 운영 상태 요약 문장
          ======================================== */}
      <StatusSummaryHeader
        integration={data.integrationStatus}
        jobSummary={data.jobSummary}
        activeRun={null}
        loading={loading.integrationStatus || loading.jobSummary}
        onReconnect={handleReconnect}
        onVerify={handleVerify}
      />

      {/* ========================================
          섹션 1: Onboarding 체크리스트
          ======================================== */}
      {!hideOnboarding && (
        <OnboardingChecklist
          status={data.onboarding}
          onDismiss={() => setHideOnboarding(true)}
        />
      )}

      {/* ========================================
          섹션 2: 현재 실행 중인 작업 (Multi Run Tracker)
          - 복수 스케줄 동시 실행 지원
          - 마스터-디테일 UI 구조
          ======================================== */}
      <Box sx={{ mb: 3 }}>
        <MultiRunTracker
          pollingOptions={{
            intervalMs: 3000,
            showSuccessToast: true,
            showFailureToast: true,
          }}
          onViewLogs={handleViewRunLogs}
        />
      </Box>

      {/* ========================================
          섹션 3: 오늘 작업 현황 (KPI 카드)
          - Primary: 성공/실패 (크게)
          - Secondary: 시도/진행중 (작게)
          ======================================== */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h3"
          sx={{
            fontSize: '1rem',
            fontWeight: 700,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'text.primary',
          }}
        >
          <TrendingUp sx={{ fontSize: 20, color: 'primary.main' }} />
          오늘 작업 현황
        </Typography>
        <JobSummaryCards
          data={data.jobSummary}
          loading={loading.jobSummary}
          onJobClick={handleJobClick}
        />
      </Box>

      {/* ========================================
          섹션 4: 최근 결과 & 인사이트 카드 (핵심)
          - 좌: 최근 결과 리스트
          - 우: 인사이트 카드 (상태 기반)
          ======================================== */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* 최근 게시 결과 */}
        <Grid item xs={12} lg={8}>
          <RecentResultsList
            items={data.recentResults?.items ?? []}
            total={data.recentResults?.total ?? 0}
            loading={loading.recentResults}
            onRetry={handleRetry}
            onViewLog={handleViewLog}
            onFilterChange={handleResultFilterChange}
          />
        </Grid>

        {/* 인사이트 카드 (실패 분석 / 축하) */}
        <Grid item xs={12} lg={4}>
          <FailureSummary
            topCategories={data.failureSummary?.topCategories ?? []}
            totalFailures={data.failureSummary?.totalFailures ?? 0}
            period={data.failureSummary?.period ?? 'TODAY'}
            loading={loading.failureSummary}
            onViewJob={handleViewLog}
          />
        </Grid>
      </Grid>

      {/* ========================================
          섹션 5: 오늘 예정 + 다음 실행 (컴팩트)
          - 예정이 있을 때만 전체 표시
          - 없으면 컴팩트한 빈 상태
          ======================================== */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h3"
          sx={{
            fontSize: '1rem',
            fontWeight: 700,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'text.primary',
          }}
        >
          <Schedule sx={{ fontSize: 20, color: 'primary.main' }} />
          예정된 작업
        </Typography>

        <Grid container spacing={2.5}>
          {/* 오늘 예정 타임라인 */}
          <Grid item xs={12} lg={7}>
            <TodayTimeline
              items={data.todayTimeline?.items ?? []}
              stats={{
                totalScheduledToday: data.todayTimeline?.totalScheduledToday ?? 0,
                completedToday: data.todayTimeline?.completedToday ?? 0,
                failedToday: data.todayTimeline?.failedToday ?? 0,
              }}
              loading={loading.todayTimeline}
              onRunNow={handleRunNow}
              onEdit={handleScheduleEdit}
              onPause={handlePause}
            />
          </Grid>

          {/* Next Run TOP 3 */}
          <Grid item xs={12} lg={5}>
            <NextRunCards
              items={data.nextRun?.items ?? []}
              loading={loading.nextRun}
              onRunNow={handleRunNow}
              onEdit={handleScheduleEdit}
            />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
