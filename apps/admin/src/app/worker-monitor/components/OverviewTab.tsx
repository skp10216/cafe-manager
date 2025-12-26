'use client';

/**
 * Overview Tab
 * KPI 카드 + Incident 배너 (P2)
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Skeleton,
  Chip,
  alpha,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Memory,
  HourglassEmpty,
  Schedule,
  Error as ErrorIcon,
  CheckCircle,
  Speed,
  Refresh,
} from '@mui/icons-material';
import IncidentBanner from './IncidentBanner';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Incident {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  queueName?: string;
  title: string;
  description?: string;
  recommendedAction?: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  startedAt: string;
  affectedJobs: number;
}

interface OverviewData {
  queues: {
    [key: string]: {
      name: string;
      displayName: string;
      waiting: number;
      active: number;
      delayed: number;
      completed: number;
      failed: number;
      paused: boolean;
    };
  };
  workers: {
    online: number;
    total: number;
  };
  performance: {
    jobsPerMin: number;
    successRate24h: number;
    failed24h: number;
    completed24h: number;
  };
  incidents: Incident[];
  timestamp: string;
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
  status?: 'normal' | 'warning' | 'danger';
  loading?: boolean;
}

function KPICard({
  title,
  value,
  subtitle,
  icon,
  color,
  status = 'normal',
  loading = false,
}: KPICardProps) {
  const statusColors = {
    normal: 'success.main',
    warning: 'warning.main',
    danger: 'error.main',
  };

  return (
    <Card
      sx={{
        height: '100%',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: color,
          boxShadow: (theme) => `0 4px 20px ${alpha(theme.palette.primary.main, 0.15)}`,
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
              color: color,
            }}
          >
            {icon}
          </Box>
          {status !== 'normal' && (
            <Chip
              size="small"
              label={status === 'warning' ? '주의' : '경고'}
              color={status === 'warning' ? 'warning' : 'error'}
              sx={{ height: 24, fontSize: '0.75rem' }}
            />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {title}
        </Typography>

        {loading ? (
          <Skeleton width={80} height={36} />
        ) : (
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: status !== 'normal' ? statusColors[status] : 'text.primary',
            }}
          >
            {value}
          </Typography>
        )}

        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/worker-monitor/overview`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('데이터를 불러오는데 실패했습니다.');
      }

      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleAcknowledge = async (id: string) => {
    try {
      await fetch(`${API_BASE_URL}/admin/worker-monitor/incidents/${id}/acknowledge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
    } catch (err) {
      console.error('Incident 확인 실패:', err);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await fetch(`${API_BASE_URL}/admin/worker-monitor/incidents/${id}/resolve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: '' }),
      });
      fetchData();
    } catch (err) {
      console.error('Incident 해결 실패:', err);
    }
  };

  useEffect(() => {
    fetchData();

    // 30초마다 자동 갱신
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // 큐 데이터 추출 (단일 큐 가정)
  const queueData = data?.queues?.['cafe-jobs'];
  const totalWaiting = queueData?.waiting ?? 0;
  const totalDelayed = queueData?.delayed ?? 0;
  const totalFailed = data?.performance?.failed24h ?? 0;
  const successRate = data?.performance?.successRate24h ?? 100;
  const jobsPerMin = data?.performance?.jobsPerMin ?? 0;
  const onlineWorkers = data?.workers?.online ?? 0;
  const totalWorkers = data?.workers?.total ?? 0;

  // 상태 판정
  const waitingStatus = totalWaiting > 200 ? 'danger' : totalWaiting > 100 ? 'warning' : 'normal';
  const failedStatus = totalFailed > 50 ? 'danger' : totalFailed > 20 ? 'warning' : 'normal';
  const successStatus = successRate < 70 ? 'danger' : successRate < 90 ? 'warning' : 'normal';
  const workerStatus = onlineWorkers === 0 ? 'danger' : 'normal';

  return (
    <Box>
      {/* 헤더 */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 600 }}>
            시스템 현황
          </Typography>
          {lastUpdated && (
            <Typography variant="caption" color="text.secondary">
              마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
            </Typography>
          )}
        </Box>

        <Tooltip title="새로고침">
          {/* disabled 버튼은 이벤트를 발생시키지 않으므로 span으로 감싸야 함 */}
          <span>
            <IconButton onClick={fetchData} disabled={loading}>
              <Refresh />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* 에러 표시 */}
      {error && (
        <Box
          sx={{
            p: 2,
            mb: 3,
            bgcolor: 'error.dark',
            borderRadius: 2,
            color: 'error.contrastText',
          }}
        >
          <Typography>{error}</Typography>
        </Box>
      )}

      {/* KPI 카드 그리드 */}
      <Grid container spacing={2.5}>
        {/* 워커 상태 */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KPICard
            title="Online Workers"
            value={`${onlineWorkers}/${totalWorkers}`}
            subtitle={onlineWorkers > 0 ? '정상 동작 중' : '워커 없음'}
            icon={<Memory />}
            color="primary.main"
            status={workerStatus}
            loading={loading}
          />
        </Grid>

        {/* 대기 중 */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KPICard
            title="Waiting"
            value={totalWaiting.toLocaleString()}
            subtitle="대기 중인 작업"
            icon={<HourglassEmpty />}
            color="warning.main"
            status={waitingStatus}
            loading={loading}
          />
        </Grid>

        {/* 지연됨 */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KPICard
            title="Delayed"
            value={totalDelayed.toLocaleString()}
            subtitle="지연된 작업"
            icon={<Schedule />}
            color="info.main"
            loading={loading}
          />
        </Grid>

        {/* 24시간 실패 */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KPICard
            title="Failed (24h)"
            value={totalFailed.toLocaleString()}
            subtitle="24시간 기준"
            icon={<ErrorIcon />}
            color="error.main"
            status={failedStatus}
            loading={loading}
          />
        </Grid>

        {/* 성공률 */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KPICard
            title="Success Rate"
            value={`${successRate}%`}
            subtitle="24시간 기준"
            icon={<CheckCircle />}
            color="success.main"
            status={successStatus}
            loading={loading}
          />
        </Grid>

        {/* 처리량 */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KPICard
            title="Throughput"
            value={`${jobsPerMin}/min`}
            subtitle="분당 처리량"
            icon={<Speed />}
            color="secondary.main"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Incident 배너 */}
      {data?.incidents && data.incidents.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <IncidentBanner
            incidents={data.incidents}
            onAcknowledge={handleAcknowledge}
            onResolve={handleResolve}
          />
        </Box>
      )}
    </Box>
  );
}

