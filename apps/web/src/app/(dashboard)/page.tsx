'use client';

/**
 * 대시보드 페이지
 * 프리미엄 UX: 연동 상태, 오늘 예정, 작업 현황, 최근 결과
 * 최고급 디자인 - 스크롤 최소화, 컴팩트 레이아웃
 */

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Grid, alpha } from '@mui/material';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  CalendarMonth,
} from '@mui/icons-material';

// 대시보드 컴포넌트
import {
  IntegrationStatusBanner,
  JobSummaryCards,
  NextRunCards,
  TodayTimeline,
  RecentResultsList,
  FailureSummary,
} from '@/components/dashboard';

// API
import {
  dashboardApi,
  naverSessionApi,
  IntegrationStatusResponse,
  JobSummaryResponse,
  TodayTimelineResponse,
  NextRunResponse,
  RecentResultsResponse,
  FailureSummaryResponse,
} from '@/lib/api-client';

// 토스트
import { useToast } from '@/components/common/ToastProvider';

/** 대시보드 데이터 상태 */
interface DashboardData {
  integrationStatus: IntegrationStatusResponse | null;
  jobSummary: JobSummaryResponse | null;
  todayTimeline: TodayTimelineResponse | null;
  nextRun: NextRunResponse | null;
  recentResults: RecentResultsResponse | null;
  failureSummary: FailureSummaryResponse | null;
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
  });
  
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
    setData({
      integrationStatus: null,
      jobSummary: null,
      todayTimeline: null,
      nextRun: null,
      recentResults: null,
      failureSummary: null,
    });
    
    setLoading({
      integrationStatus: true,
      jobSummary: true,
      todayTimeline: true,
      nextRun: true,
      recentResults: true,
      failureSummary: true,
    });

    // 모든 API를 병렬로 호출
    const [
      integrationStatusRes,
      jobSummaryRes,
      todayTimelineRes,
      nextRunRes,
      recentResultsRes,
      failureSummaryRes,
    ] = await Promise.allSettled([
      dashboardApi.getIntegrationStatus(),
      dashboardApi.getJobSummary(),
      dashboardApi.getTodayTimeline(),
      dashboardApi.getNextRun(3),
      dashboardApi.getRecentResults({ limit: 5 }), // 5개로 줄임
      dashboardApi.getFailureSummary('TODAY'),
    ]);

    // 결과 처리
    setData({
      integrationStatus:
        integrationStatusRes.status === 'fulfilled'
          ? integrationStatusRes.value
          : null,
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
    } catch (error) {
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
    } catch (error) {
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

  /** 결과 필터 변경 */
  const handleResultFilterChange = async (filter: 'ALL' | 'SUCCESS' | 'FAILED') => {
    setLoading((prev) => ({ ...prev, recentResults: true }));
    try {
      const results = await dashboardApi.getRecentResults({ limit: 5, filter });
      setData((prev) => ({ ...prev, recentResults: results }));
    } catch (error) {
      toast.error('결과 조회에 실패했습니다');
    } finally {
      setLoading((prev) => ({ ...prev, recentResults: false }));
    }
  };

  // ==============================================
  // 렌더링
  // ==============================================

  // 현재 시간대 인사말
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '좋은 아침이에요';
    if (hour < 18) return '좋은 오후에요';
    return '좋은 저녁이에요';
  };

  // 오늘 날짜
  const getFormattedDate = () => {
    return new Date().toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  return (
    <Box sx={{ minHeight: '100%' }}>
      {/* ========================================
          페이지 헤더 - 프리미엄 스타일
          ======================================== */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          mb: 3,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontWeight: 500,
              mb: 0.5,
            }}
          >
            {getFormattedDate()}
          </Typography>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '1.5rem', sm: '1.75rem' },
              fontWeight: 700,
              color: 'text.primary',
            }}
          >
            {getGreeting()} 👋
          </Typography>
        </Box>

        {/* 오늘 통계 미니 뱃지 */}
        <Box
          sx={{
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
              borderRadius: 2,
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
            }}
          >
            <TrendingUp sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              오늘 {data.jobSummary?.today?.total ?? 0}건 처리
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
              borderRadius: 2,
              backgroundColor: (theme) => alpha(theme.palette.success.main, 0.08),
            }}
          >
            <CalendarMonth sx={{ fontSize: 18, color: 'success.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {data.todayTimeline?.totalScheduledToday ?? 0}건 예정
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ========================================
          섹션 A: 연동 상태 배너
          ======================================== */}
      <IntegrationStatusBanner
        status={data.integrationStatus?.status ?? 'NOT_CONNECTED'}
        statusReason={data.integrationStatus?.statusReason ?? ''}
        account={data.integrationStatus?.account ?? null}
        session={data.integrationStatus?.session ?? null}
        loading={loading.integrationStatus}
        onReconnect={handleReconnect}
        onVerify={handleVerify}
      />

      {/* ========================================
          섹션 B: 오늘 작업 현황 (컴팩트)
          ======================================== */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h3"
          sx={{
            fontSize: '1rem',
            fontWeight: 600,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
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
          섹션 C: 오늘 예정 + 다음 실행
          ======================================== */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
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

      {/* ========================================
          섹션 D: 최근 결과 & 실패 분석
          ======================================== */}
      <Grid container spacing={2.5}>
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

        {/* 실패 원인 분석 */}
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
    </Box>
  );
}
