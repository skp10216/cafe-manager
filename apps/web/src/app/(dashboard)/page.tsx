'use client';

/**
 * 대시보드 페이지
 */

import { useEffect, useState } from 'react';
import { Grid, Typography, Box, Skeleton } from '@mui/material';
import {
  TrendingUp,
  CheckCircle,
  Error,
  Schedule,
  Article,
  Sync,
} from '@mui/icons-material';
import AppCard from '@/components/common/AppCard';
import AppButton from '@/components/common/AppButton';
import StatusChip from '@/components/common/StatusChip';
import { jobApi, managedPostApi, naverSessionApi } from '@/lib/api-client';

interface DashboardStats {
  todayJobs: number;
  completedJobs: number;
  failedJobs: number;
  activePosts: number;
  sessionStatus: 'ACTIVE' | 'EXPIRED' | 'PENDING' | 'ERROR' | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [jobSummary, postStats, sessions] = await Promise.all([
        jobApi.recentSummary(),
        managedPostApi.stats(),
        naverSessionApi.list(),
      ]);

      setStats({
        todayJobs: jobSummary.todayCount,
        completedJobs: jobSummary.byStatus.completed,
        failedJobs: jobSummary.byStatus.failed,
        activePosts: postStats.active,
        sessionStatus: sessions.length > 0 ? sessions[0].status : null,
      });

      setRecentJobs(jobSummary.recentJobs);
    } catch (error) {
      console.error('대시보드 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
  }: {
    title: string;
    value: number | string;
    icon: typeof TrendingUp;
    color: string;
  }) => (
    <AppCard>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            backgroundColor: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sx={{ color, fontSize: 24 }} />
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          {loading ? (
            <Skeleton width={60} height={32} />
          ) : (
            <Typography variant="h2">{value}</Typography>
          )}
        </Box>
      </Box>
    </AppCard>
  );

  const getJobTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      INIT_SESSION: '세션 초기화',
      CREATE_POST: '게시글 작성',
      SYNC_POSTS: '게시글 동기화',
      DELETE_POST: '게시글 삭제',
    };
    return labels[type] || type;
  };

  return (
    <Box>
      {/* 페이지 타이틀 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h1" sx={{ mb: 1 }}>
          대시보드
        </Typography>
        <Typography variant="body2" color="text.secondary">
          카페매니저 운영 현황을 한눈에 확인하세요
        </Typography>
      </Box>

      {/* 통계 카드 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="오늘 작업"
            value={stats?.todayJobs ?? 0}
            icon={TrendingUp}
            color="#2563EB"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="완료된 작업"
            value={stats?.completedJobs ?? 0}
            icon={CheckCircle}
            color="#10B981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="실패한 작업"
            value={stats?.failedJobs ?? 0}
            icon={Error}
            color="#DC2626"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="게시 중인 글"
            value={stats?.activePosts ?? 0}
            icon={Article}
            color="#F59E0B"
          />
        </Grid>
      </Grid>

      {/* 두 번째 행 */}
      <Grid container spacing={3}>
        {/* 네이버 연동 상태 */}
        <Grid item xs={12} md={4}>
          <AppCard title="네이버 연동 상태">
            <Box sx={{ textAlign: 'center', py: 2 }}>
              {loading ? (
                <Skeleton width={100} height={32} sx={{ mx: 'auto' }} />
              ) : stats?.sessionStatus ? (
                <StatusChip status={stats.sessionStatus} />
              ) : (
                <Typography color="text.secondary">연동된 계정 없음</Typography>
              )}
              <Box sx={{ mt: 2 }}>
                <AppButton
                  variant="outlined"
                  size="small"
                  href="/settings"
                >
                  연동 관리
                </AppButton>
              </Box>
            </Box>
          </AppCard>
        </Grid>

        {/* 최근 작업 */}
        <Grid item xs={12} md={8}>
          <AppCard
            title="최근 작업"
            action={
              <AppButton
                variant="text"
                size="small"
                href="/logs"
              >
                전체 보기
              </AppButton>
            }
          >
            {loading ? (
              <Box>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={40} sx={{ mb: 1 }} />
                ))}
              </Box>
            ) : recentJobs.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                최근 작업이 없습니다
              </Typography>
            ) : (
              <Box>
                {recentJobs.slice(0, 5).map((job) => (
                  <Box
                    key={job.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 1.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Schedule sx={{ color: 'text.secondary', fontSize: 18 }} />
                      <Typography variant="body2">
                        {getJobTypeLabel(job.type)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(job.createdAt).toLocaleString('ko-KR')}
                      </Typography>
                      <StatusChip status={job.status as 'COMPLETED' | 'FAILED' | 'PENDING'} />
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </AppCard>
        </Grid>
      </Grid>
    </Box>
  );
}

