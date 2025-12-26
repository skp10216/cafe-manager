'use client';

/**
 * Jobs Tab
 * Job 목록 조회 + 상세 + 재시도/취소
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Drawer,
  Divider,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  Refresh,
  Replay,
  Cancel,
  Close,
  Info,
  Error as ErrorIcon,
  CheckCircle,
  Schedule,
  PlayArrow,
} from '@mui/icons-material';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const QUEUE_NAME = 'cafe-jobs';

type JobStatus = 'all' | 'waiting' | 'active' | 'delayed' | 'completed' | 'failed';

interface JobInfo {
  id: string;
  name: string;
  data: Record<string, unknown>;
  opts: {
    attempts?: number;
    delay?: number;
    priority?: number;
  };
  progress: number | object;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  returnvalue?: unknown;
}

interface JobDetail extends JobInfo {
  state: string;
  logs: string[];
  logsCount: number;
}

function StatusChip({ status }: { status: string }) {
  const config: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default'; icon: JSX.Element }> = {
    waiting: { label: '대기', color: 'default', icon: <Schedule sx={{ fontSize: 14 }} /> },
    active: { label: '실행 중', color: 'info', icon: <PlayArrow sx={{ fontSize: 14 }} /> },
    delayed: { label: '지연', color: 'warning', icon: <Schedule sx={{ fontSize: 14 }} /> },
    completed: { label: '완료', color: 'success', icon: <CheckCircle sx={{ fontSize: 14 }} /> },
    failed: { label: '실패', color: 'error', icon: <ErrorIcon sx={{ fontSize: 14 }} /> },
  };

  const { label, color, icon } = config[status] || { label: status, color: 'default', icon: <Info /> };

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

function formatTimestamp(ts?: number): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('ko-KR');
}

function formatDuration(start?: number, end?: number): string {
  if (!start || !end) return '-';
  const diff = end - start;
  if (diff < 1000) return `${diff}ms`;
  if (diff < 60000) return `${(diff / 1000).toFixed(1)}s`;
  return `${(diff / 60000).toFixed(1)}m`;
}

export default function JobsTab() {
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobStatus>('all');
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/admin/worker-monitor/queues/${QUEUE_NAME}/jobs?status=${statusFilter}&start=0&end=99`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        throw new Error('Job 목록을 불러오는데 실패했습니다.');
      }

      const data = await res.json();
      setJobs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const fetchJobDetail = async (jobId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/admin/worker-monitor/queues/${QUEUE_NAME}/jobs/${jobId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        throw new Error('Job 상세 정보를 불러오는데 실패했습니다.');
      }

      const data = await res.json();
      setSelectedJob(data);
      setDrawerOpen(true);
    } catch (err) {
      console.error('Job 상세 조회 실패:', err);
    }
  };

  const executeAction = async (jobId: string, action: 'retry' | 'cancel') => {
    setActionLoading(`${jobId}-${action}`);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/admin/worker-monitor/queues/${QUEUE_NAME}/jobs/${jobId}/${action}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || '작업 실행 실패');
      }

      // 목록 새로고침
      fetchJobs();
      
      // Drawer 닫기
      if (selectedJob?.id === jobId) {
        setDrawerOpen(false);
        setSelectedJob(null);
      }
    } catch (err) {
      console.error('Action 실행 실패:', err);
      alert(err instanceof Error ? err.message : '작업 실행 실패');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Box>
      {/* 헤더 */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="h2" sx={{ fontWeight: 600 }}>
          Job 목록
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* 상태 필터 */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>상태</InputLabel>
            <Select
              value={statusFilter}
              label="상태"
              onChange={(e) => setStatusFilter(e.target.value as JobStatus)}
            >
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="waiting">대기</MenuItem>
              <MenuItem value="active">실행 중</MenuItem>
              <MenuItem value="delayed">지연</MenuItem>
              <MenuItem value="completed">완료</MenuItem>
              <MenuItem value="failed">실패</MenuItem>
            </Select>
          </FormControl>

          <Tooltip title="새로고침">
            <IconButton onClick={fetchJobs} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
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
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Job ID</TableCell>
                <TableCell>타입</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>시도</TableCell>
                <TableCell>생성</TableCell>
                <TableCell>처리 시간</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton height={40} />
                    </TableCell>
                  </TableRow>
                ))
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      {statusFilter === 'all'
                        ? 'Job이 없습니다.'
                        : `${statusFilter} 상태의 Job이 없습니다.`}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow
                    key={job.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                      },
                    }}
                    onClick={() => fetchJobDetail(job.id)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                        {job.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={job.name}
                        variant="outlined"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusChip status={job.finishedOn ? (job.failedReason ? 'failed' : 'completed') : job.processedOn ? 'active' : 'waiting'} />
                    </TableCell>
                    <TableCell>
                      {job.attemptsMade}/{job.opts.attempts || 3}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {formatTimestamp(job.timestamp)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {formatDuration(job.processedOn, job.finishedOn)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        {/* 실패 Job: 재시도 버튼 */}
                        {job.failedReason && (
                          <Tooltip title="재시도">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                executeAction(job.id, 'retry');
                              }}
                              disabled={actionLoading === `${job.id}-retry`}
                            >
                              {actionLoading === `${job.id}-retry` ? (
                                <CircularProgress size={16} />
                              ) : (
                                <Replay fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                        {/* 대기 Job: 취소 버튼 */}
                        {!job.processedOn && !job.finishedOn && (
                          <Tooltip title="취소">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                executeAction(job.id, 'cancel');
                              }}
                              disabled={actionLoading === `${job.id}-cancel`}
                            >
                              {actionLoading === `${job.id}-cancel` ? (
                                <CircularProgress size={16} />
                              ) : (
                                <Cancel fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="상세 보기">
                          <IconButton size="small">
                            <Info fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Job Detail Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 480 },
            bgcolor: 'background.paper',
          },
        }}
      >
        {selectedJob && (
          <Box sx={{ p: 3 }}>
            {/* Drawer Header */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
              }}
            >
              <Typography variant="h6" fontWeight={600}>
                Job 상세
              </Typography>
              <IconButton onClick={() => setDrawerOpen(false)}>
                <Close />
              </IconButton>
            </Box>

            {/* Job Info */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="overline" color="text.secondary">
                Job ID
              </Typography>
              <Typography variant="body2" fontFamily="monospace" sx={{ mb: 2 }}>
                {selectedJob.id}
              </Typography>

              <Typography variant="overline" color="text.secondary">
                타입
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Chip label={selectedJob.name} size="small" />
              </Box>

              <Typography variant="overline" color="text.secondary">
                상태
              </Typography>
              <Box sx={{ mb: 2 }}>
                <StatusChip status={selectedJob.state} />
              </Box>

              <Typography variant="overline" color="text.secondary">
                시도 횟수
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {selectedJob.attemptsMade}/{selectedJob.opts.attempts || 3}
              </Typography>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Timestamps */}
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              타임스탬프
            </Typography>
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                생성: {formatTimestamp(selectedJob.timestamp)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                처리 시작: {formatTimestamp(selectedJob.processedOn)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                완료: {formatTimestamp(selectedJob.finishedOn)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                소요 시간: {formatDuration(selectedJob.processedOn, selectedJob.finishedOn)}
              </Typography>
            </Box>

            {/* Error */}
            {selectedJob.failedReason && (
              <>
                <Divider sx={{ mb: 3 }} />
                <Typography variant="subtitle2" color="error.main" sx={{ mb: 1 }}>
                  에러 메시지
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
                    borderRadius: 1,
                    mb: 3,
                    overflow: 'auto',
                    maxHeight: 200,
                  }}
                >
                  <Typography
                    variant="body2"
                    fontFamily="monospace"
                    fontSize="0.8rem"
                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                  >
                    {selectedJob.failedReason}
                  </Typography>
                </Box>
              </>
            )}

            {/* Payload */}
            <Divider sx={{ mb: 3 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Payload
            </Typography>
            <Box
              sx={{
                p: 2,
                bgcolor: 'action.hover',
                borderRadius: 1,
                mb: 3,
                overflow: 'auto',
                maxHeight: 200,
              }}
            >
              <Typography
                variant="body2"
                fontFamily="monospace"
                fontSize="0.75rem"
                sx={{ whiteSpace: 'pre-wrap' }}
              >
                {JSON.stringify(selectedJob.data, null, 2)}
              </Typography>
            </Box>

            {/* Logs */}
            {selectedJob.logs && selectedJob.logs.length > 0 && (
              <>
                <Divider sx={{ mb: 3 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  로그 ({selectedJob.logsCount})
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    mb: 3,
                    overflow: 'auto',
                    maxHeight: 200,
                  }}
                >
                  {selectedJob.logs.map((log, i) => (
                    <Typography
                      key={i}
                      variant="body2"
                      fontFamily="monospace"
                      fontSize="0.75rem"
                      sx={{ mb: 0.5 }}
                    >
                      {log}
                    </Typography>
                  ))}
                </Box>
              </>
            )}

            {/* Actions */}
            <Divider sx={{ mb: 3 }} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              {selectedJob.state === 'failed' && (
                <Button
                  variant="contained"
                  startIcon={<Replay />}
                  onClick={() => executeAction(selectedJob.id, 'retry')}
                  disabled={!!actionLoading}
                >
                  재시도
                </Button>
              )}
              {(selectedJob.state === 'waiting' || selectedJob.state === 'delayed') && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Cancel />}
                  onClick={() => executeAction(selectedJob.id, 'cancel')}
                  disabled={!!actionLoading}
                >
                  취소
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}

