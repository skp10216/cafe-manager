'use client';

/**
 * Admin 대시보드 페이지
 */

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  Skeleton,
  alpha,
} from '@mui/material';
import {
  People,
  Schedule,
  Link as LinkIcon,
  WorkHistory,
  CheckCircle,
  Error,
  Warning,
  HourglassEmpty,
  Refresh,
} from '@mui/icons-material';
import AdminLayout from '@/components/AdminLayout';

/** 대시보드 통계 타입 */
interface DashboardStats {
  users: {
    total: number;
    activeToday: number;
  };
  schedules: {
    total: number;
    needsReview: number;
    suspended: number;
    banned: number;
  };
  sessions: {
    total: number;
    healthy: number;
    expired: number;
    challengeRequired: number;
    error: number;
  };
  jobs: {
    todayTotal: number;
    todayCompleted: number;
    todayFailed: number;
  };
}

/** 통계 카드 컴포넌트 */
function StatCard({
  title,
  value,
  icon,
  color,
  subStats,
  loading,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subStats?: { label: string; value: number; color?: string }[];
  loading?: boolean;
}) {
  return (
    <Card
      sx={{
        height: '100%',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: alpha(color, 0.15),
              color,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {title}
            </Typography>
            {loading ? (
              <Skeleton width={60} height={36} />
            ) : (
              <Typography variant="h2" sx={{ fontWeight: 700, fontSize: '1.75rem' }}>
                {value.toLocaleString()}
              </Typography>
            )}
          </Box>
        </Box>
        {subStats && subStats.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {subStats.map((stat) => (
              <Chip
                key={stat.label}
                label={`${stat.label}: ${stat.value}`}
                size="small"
                sx={{
                  bgcolor: alpha(stat.color || color, 0.1),
                  color: stat.color || color,
                  fontWeight: 500,
                }}
              />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/admin/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('대시보드 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <AdminLayout>
      <Box>
        {/* 헤더 */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 4,
          }}
        >
          <Box>
            <Typography variant="h1" sx={{ mb: 0.5 }}>
              관리자 대시보드
            </Typography>
            <Typography variant="body2" color="text.secondary">
              카페매니저 운영 현황을 한눈에 확인하세요
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadStats}
            disabled={loading}
          >
            새로고침
          </Button>
        </Box>

        {/* 통계 카드 그리드 */}
        <Grid container spacing={3}>
          {/* 사용자 */}
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              title="전체 사용자"
              value={stats?.users.total ?? 0}
              icon={<People />}
              color="#60A5FA"
              subStats={[
                { label: '오늘 활성', value: stats?.users.activeToday ?? 0 },
              ]}
              loading={loading}
            />
          </Grid>

          {/* 스케줄 */}
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              title="전체 스케줄"
              value={stats?.schedules.total ?? 0}
              icon={<Schedule />}
              color="#A78BFA"
              subStats={[
                { label: '승인 대기', value: stats?.schedules.needsReview ?? 0, color: '#FBBF24' },
                { label: '중지', value: stats?.schedules.suspended ?? 0, color: '#F87171' },
              ]}
              loading={loading}
            />
          </Grid>

          {/* 세션 */}
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              title="네이버 연동"
              value={stats?.sessions.total ?? 0}
              icon={<LinkIcon />}
              color="#34D399"
              subStats={[
                { label: '정상', value: stats?.sessions.healthy ?? 0, color: '#34D399' },
                { label: '만료', value: stats?.sessions.expired ?? 0, color: '#F87171' },
                { label: '인증필요', value: stats?.sessions.challengeRequired ?? 0, color: '#FBBF24' },
              ]}
              loading={loading}
            />
          </Grid>

          {/* 오늘 작업 */}
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              title="오늘 작업"
              value={stats?.jobs.todayTotal ?? 0}
              icon={<WorkHistory />}
              color="#F472B6"
              subStats={[
                { label: '완료', value: stats?.jobs.todayCompleted ?? 0, color: '#34D399' },
                { label: '실패', value: stats?.jobs.todayFailed ?? 0, color: '#F87171' },
              ]}
              loading={loading}
            />
          </Grid>
        </Grid>

        {/* 빠른 작업 */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h2" sx={{ mb: 2 }}>
            빠른 작업
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="contained"
                color="warning"
                startIcon={<HourglassEmpty />}
                href="/schedules?status=NEEDS_REVIEW"
                sx={{ py: 1.5 }}
              >
                승인 대기 ({stats?.schedules.needsReview ?? 0})
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<Error />}
                href="/sessions?status=EXPIRED"
                sx={{ py: 1.5 }}
              >
                만료 세션 ({stats?.sessions.expired ?? 0})
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                color="warning"
                startIcon={<Warning />}
                href="/sessions?status=CHALLENGE_REQUIRED"
                sx={{ py: 1.5 }}
              >
                인증 필요 ({stats?.sessions.challengeRequired ?? 0})
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<CheckCircle />}
                href="/audit"
                sx={{ py: 1.5 }}
              >
                감사 로그
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </AdminLayout>
  );
}


