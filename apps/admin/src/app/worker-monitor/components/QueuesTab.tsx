'use client';

/**
 * Queues Tab
 * 큐 목록 테이블 + 트렌드 차트 + Queue Actions
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Skeleton,
  IconButton,
  Tooltip,
  Collapse,
  alpha,
  Button,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Refresh,
  ExpandMore,
  ExpandLess,
  PlayArrow,
  Pause,
  TrendingUp,
  Replay,
  DeleteSweep,
  CleaningServices,
} from '@mui/icons-material';
import DangerActionDialog from './DangerActionDialog';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface QueueInfo {
  name: string;
  displayName: string;
  status: 'RUNNING' | 'PAUSED' | 'DEGRADED';
  counts: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
  };
  jobsPerMin: number;
  onlineWorkers: number;
  lastUpdated: string | null;
}

interface TrendDataPoint {
  timestamp: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  jobsPerMin: number | null;
  onlineWorkers: number;
  paused: boolean;
}

interface TrendData {
  queueName: string;
  period: string;
  dataPoints: number;
  data: TrendDataPoint[];
}

function StatusChip({ status }: { status: QueueInfo['status'] }) {
  const config = {
    RUNNING: { label: 'Running', color: 'success' as const, icon: <PlayArrow sx={{ fontSize: 14 }} /> },
    PAUSED: { label: 'Paused', color: 'warning' as const, icon: <Pause sx={{ fontSize: 14 }} /> },
    DEGRADED: { label: 'Degraded', color: 'error' as const, icon: <TrendingUp sx={{ fontSize: 14 }} /> },
  };

  const { label, color, icon } = config[status];

  return (
    <Chip
      size="small"
      label={label}
      color={color}
      icon={icon}
      sx={{ fontWeight: 500 }}
    />
  );
}

function MiniTrendChart({ data }: { data: TrendDataPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        트렌드 데이터 없음
      </Typography>
    );
  }

  // 최근 30개 데이터만 사용
  const recentData = data.slice(-30);
  const maxWaiting = Math.max(...recentData.map(d => d.waiting), 1);

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 40 }}>
      {recentData.map((point, i) => {
        const height = (point.waiting / maxWaiting) * 100;
        return (
          <Tooltip
            key={i}
            title={`${new Date(point.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}: ${point.waiting}개 대기`}
          >
            <Box
              sx={{
                width: 4,
                height: `${Math.max(height, 5)}%`,
                bgcolor: point.waiting > 100 ? 'error.main' : point.waiting > 50 ? 'warning.main' : 'primary.main',
                borderRadius: 0.5,
                transition: 'height 0.2s',
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

function QueueRow({ queue, onRefresh }: { queue: QueueInfo; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [drainDialogOpen, setDrainDialogOpen] = useState(false);
  const [cleanDialogOpen, setCleanDialogOpen] = useState(false);

  const fetchTrend = async () => {
    setLoadingTrend(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/admin/worker-monitor/queues/${queue.name}/trend?hours=1`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setTrend(data);
      }
    } catch (err) {
      console.error('트렌드 조회 실패:', err);
    } finally {
      setLoadingTrend(false);
    }
  };

  useEffect(() => {
    if (expanded && !trend) {
      fetchTrend();
    }
  }, [expanded]);

  // Queue Actions
  const executeAction = async (action: string, method = 'POST', body?: object) => {
    setActionLoading(action);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/admin/worker-monitor/queues/${queue.name}/${action}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || '작업 실행 실패');
      }

      onRefresh();
    } catch (err) {
      console.error('Action 실행 실패:', err);
      throw err;
    } finally {
      setActionLoading(null);
    }
  };

  const handlePauseResume = async () => {
    const action = queue.status === 'PAUSED' ? 'resume' : 'pause';
    await executeAction(action, 'POST', { reason: '관리자 조작' });
  };

  const handleRetryFailed = async () => {
    await executeAction('retry-failed');
  };

  const handleDrain = async () => {
    await executeAction('drain', 'DELETE');
  };

  const handleClean = async () => {
    await executeAction('clean?status=completed&limit=1000', 'DELETE');
  };

  return (
    <>
      <TableRow
        hover
        sx={{
          cursor: 'pointer',
          '&:hover': {
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
          },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell>
          <IconButton size="small">
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {queue.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {queue.name}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          <StatusChip status={queue.status} />
        </TableCell>
        <TableCell align="right">
          <Typography
            fontWeight={600}
            color={queue.counts.waiting > 100 ? 'error.main' : 'text.primary'}
          >
            {queue.counts.waiting.toLocaleString()}
          </Typography>
        </TableCell>
        <TableCell align="right">{queue.counts.active}</TableCell>
        <TableCell align="right">{queue.counts.delayed}</TableCell>
        <TableCell align="right">
          <Typography color="error.main" fontWeight={queue.counts.failed > 0 ? 600 : 400}>
            {queue.counts.failed.toLocaleString()}
          </Typography>
        </TableCell>
        <TableCell align="right">{queue.jobsPerMin}/min</TableCell>
        <TableCell align="right">{queue.onlineWorkers}</TableCell>
        <TableCell>
          {queue.lastUpdated ? (
            <Typography variant="caption" color="text.secondary">
              {new Date(queue.lastUpdated).toLocaleTimeString('ko-KR')}
            </Typography>
          ) : (
            '-'
          )}
        </TableCell>
      </TableRow>

      {/* 확장 영역: 트렌드 차트 + Actions */}
      <TableRow>
        <TableCell colSpan={10} sx={{ p: 0, border: 0 }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box
              sx={{
                p: 3,
                bgcolor: (theme) => alpha(theme.palette.background.paper, 0.5),
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                최근 1시간 트렌드
              </Typography>

              {loadingTrend ? (
                <Skeleton height={60} />
              ) : trend ? (
                <Box>
                  <MiniTrendChart data={trend.data} />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {trend.dataPoints}개 데이터 포인트
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  트렌드 데이터가 없습니다. 잠시 후 다시 시도해주세요.
                </Typography>
              )}

              {/* Queue Actions */}
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                큐 제어
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {/* Pause / Resume */}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={
                    actionLoading === 'pause' || actionLoading === 'resume' ? (
                      <CircularProgress size={14} />
                    ) : queue.status === 'PAUSED' ? (
                      <PlayArrow />
                    ) : (
                      <Pause />
                    )
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePauseResume();
                  }}
                  disabled={!!actionLoading}
                  color={queue.status === 'PAUSED' ? 'success' : 'warning'}
                >
                  {queue.status === 'PAUSED' ? '재개' : '일시정지'}
                </Button>

                {/* Retry Failed */}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={
                    actionLoading === 'retry-failed' ? (
                      <CircularProgress size={14} />
                    ) : (
                      <Replay />
                    )
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRetryFailed();
                  }}
                  disabled={!!actionLoading || queue.counts.failed === 0}
                >
                  실패 재시도 ({queue.counts.failed})
                </Button>

                {/* Drain - Danger */}
                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  startIcon={<DeleteSweep />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDrainDialogOpen(true);
                  }}
                  disabled={!!actionLoading || queue.counts.waiting === 0}
                >
                  대기 작업 삭제
                </Button>

                {/* Clean Completed */}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CleaningServices />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCleanDialogOpen(true);
                  }}
                  disabled={!!actionLoading}
                >
                  완료 작업 정리
                </Button>
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      {/* Drain Confirmation Dialog */}
      <DangerActionDialog
        open={drainDialogOpen}
        onClose={() => setDrainDialogOpen(false)}
        onConfirm={handleDrain}
        title="대기 작업 전체 삭제"
        description={`${queue.displayName}의 대기 중인 모든 작업(${queue.counts.waiting}개)을 삭제합니다.`}
        confirmText={queue.name}
        impact="대기 중인 모든 작업이 삭제되며, 복구할 수 없습니다."
        buttonLabel="삭제 실행"
      />

      {/* Clean Confirmation Dialog */}
      <DangerActionDialog
        open={cleanDialogOpen}
        onClose={() => setCleanDialogOpen(false)}
        onConfirm={handleClean}
        title="완료 작업 정리"
        description={`${queue.displayName}의 완료된 작업 기록을 정리합니다.`}
        confirmText="clean"
        impact="완료된 작업 기록이 삭제됩니다. 통계에 영향을 줄 수 있습니다."
        buttonLabel="정리 실행"
      />
    </>
  );
}

export default function QueuesTab() {
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueues = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/admin/worker-monitor/queues`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('큐 목록을 불러오는데 실패했습니다.');
      }

      const data = await res.json();
      setQueues(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueues();

    // 30초마다 자동 갱신
    const interval = setInterval(fetchQueues, 30000);
    return () => clearInterval(interval);
  }, [fetchQueues]);

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
        <Typography variant="h2" sx={{ fontWeight: 600 }}>
          큐 현황
        </Typography>

        <Tooltip title="새로고침">
          <IconButton onClick={fetchQueues} disabled={loading}>
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

      {/* 테이블 */}
      <Card
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={50} />
                <TableCell>큐 이름</TableCell>
                <TableCell>상태</TableCell>
                <TableCell align="right">Waiting</TableCell>
                <TableCell align="right">Active</TableCell>
                <TableCell align="right">Delayed</TableCell>
                <TableCell align="right">Failed</TableCell>
                <TableCell align="right">처리량</TableCell>
                <TableCell align="right">Workers</TableCell>
                <TableCell>마지막 업데이트</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                // 로딩 스켈레톤
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={10}>
                      <Skeleton height={40} />
                    </TableCell>
                  </TableRow>
                ))
              ) : queues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      등록된 큐가 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                queues.map((queue) => (
                  <QueueRow key={queue.name} queue={queue} onRefresh={fetchQueues} />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}

