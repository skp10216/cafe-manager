'use client';

/**
 * Workers Tab
 * Redis ZSET 기반 워커 목록
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Skeleton,
  IconButton,
  Tooltip,
  alpha,
  Avatar,
} from '@mui/material';
import {
  Refresh,
  Memory,
  Computer,
  AccessTime,
  CheckCircle,
  Error as ErrorIcon,
  PlayArrow,
} from '@mui/icons-material';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface WorkerInfo {
  workerId: string;
  hostname?: string;
  pid?: number;
  queueName?: string;
  status: 'ONLINE' | 'OFFLINE';
  activeJobs?: number;
  processedJobs?: number;
  failedJobs?: number;
  startedAt?: string;
  timestamp?: string;
}

interface WorkersResponse {
  workers: WorkerInfo[];
  summary: {
    online: number;
    total: number;
  };
}

function WorkerCard({ worker }: { worker: WorkerInfo }) {
  const isOnline = worker.status === 'ONLINE';
  const uptime = worker.startedAt
    ? formatUptime(new Date(worker.startedAt))
    : '-';
  const lastSeen = worker.timestamp
    ? formatRelativeTime(new Date(worker.timestamp))
    : '-';

  const failRate =
    worker.processedJobs && worker.failedJobs
      ? ((worker.failedJobs / (worker.processedJobs + worker.failedJobs)) * 100).toFixed(1)
      : '0.0';

  return (
    <Card
      sx={{
        height: '100%',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: isOnline ? 'success.dark' : 'divider',
        transition: 'all 0.2s',
        '&:hover': {
          boxShadow: (theme) =>
            `0 4px 20px ${alpha(
              isOnline ? theme.palette.success.main : theme.palette.grey[500],
              0.2
            )}`,
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        {/* 헤더 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor: isOnline ? 'success.main' : 'grey.600',
              }}
            >
              <Memory />
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 160 }}>
                {worker.workerId.split('-').slice(-1)[0] || worker.workerId}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                PID: {worker.pid || '-'}
              </Typography>
            </Box>
          </Box>

          <Chip
            size="small"
            label={isOnline ? 'Online' : 'Offline'}
            color={isOnline ? 'success' : 'default'}
            sx={{ fontWeight: 500 }}
          />
        </Box>

        {/* 상세 정보 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* 호스트 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Computer sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {worker.hostname || '-'}
            </Typography>
          </Box>

          {/* 큐 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlayArrow sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {worker.queueName || '-'}
            </Typography>
          </Box>

          {/* Uptime */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTime sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              Uptime: {uptime}
            </Typography>
          </Box>
        </Box>

        {/* 처리 통계 */}
        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Active
            </Typography>
            <Typography variant="body1" fontWeight={600} color="primary.main">
              {worker.activeJobs ?? 0}
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Processed
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircle sx={{ fontSize: 14, color: 'success.main' }} />
              <Typography variant="body1" fontWeight={600}>
                {worker.processedJobs?.toLocaleString() ?? 0}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Failed
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} />
              <Typography variant="body1" fontWeight={600}>
                {worker.failedJobs?.toLocaleString() ?? 0}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Fail Rate
            </Typography>
            <Typography
              variant="body1"
              fontWeight={600}
              color={parseFloat(failRate) > 10 ? 'error.main' : 'text.primary'}
            >
              {failRate}%
            </Typography>
          </Box>
        </Box>

        {/* 마지막 확인 */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 1.5, textAlign: 'right' }}
        >
          마지막 확인: {lastSeen}
        </Typography>
      </CardContent>
    </Card>
  );
}

function formatUptime(startedAt: Date): string {
  const now = new Date();
  const diff = now.getTime() - startedAt.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}일 ${hours % 24}시간`;
  }
  return `${hours}시간 ${minutes}분`;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return `${seconds}초 전`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  return `${Math.floor(seconds / 3600)}시간 전`;
}

export default function WorkersTab() {
  const [data, setData] = useState<WorkersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/admin/worker-monitor/workers`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('워커 목록을 불러오는데 실패했습니다.');
      }

      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkers();

    // 10초마다 자동 갱신 (워커 상태는 더 자주 확인)
    const interval = setInterval(fetchWorkers, 10000);
    return () => clearInterval(interval);
  }, [fetchWorkers]);

  const onlineCount = data?.summary?.online ?? 0;
  const totalCount = data?.summary?.total ?? 0;
  const workers = data?.workers ?? [];

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
            워커 현황
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Online: {onlineCount} / Total: {totalCount}
          </Typography>
        </Box>

        <Tooltip title="새로고침">
          <IconButton onClick={fetchWorkers} disabled={loading}>
            <Refresh />
          </IconButton>
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
          }}
        >
          <Typography color="error.contrastText">{error}</Typography>
        </Box>
      )}

      {/* 워커 카드 그리드 */}
      {loading ? (
        <Grid container spacing={2.5}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Skeleton height={180} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : workers.length === 0 ? (
        <Card
          sx={{
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <Memory sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              온라인 워커가 없습니다
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Worker 프로세스가 실행 중인지 확인해주세요.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2.5}>
          {workers.map((worker) => (
            <Grid item xs={12} sm={6} md={4} key={worker.workerId}>
              <WorkerCard worker={worker} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

