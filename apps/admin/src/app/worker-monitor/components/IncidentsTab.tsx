'use client';

/**
 * Incidents Tab
 * Incident 목록, 상세, 확인/해결 액션
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Refresh,
  Warning,
  Error as ErrorIcon,
  Info,
  CheckCircle,
  Done,
  Schedule,
} from '@mui/icons-material';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Incident {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  queueName?: string;
  title: string;
  description?: string;
  recommendedAction?: string;
  affectedJobs: number;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  startedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

const severityConfig = {
  CRITICAL: { icon: ErrorIcon, color: '#d32f2f', label: '심각' },
  HIGH: { icon: ErrorIcon, color: '#f57c00', label: '높음' },
  MEDIUM: { icon: Warning, color: '#fbc02d', label: '보통' },
  LOW: { icon: Info, color: '#1976d2', label: '낮음' },
};

const statusConfig = {
  ACTIVE: { color: 'error', label: '활성' },
  ACKNOWLEDGED: { color: 'warning', label: '확인됨' },
  RESOLVED: { color: 'success', label: '해결됨' },
};

function getRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function IncidentsTab() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');

  // 해결 다이얼로그
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<Incident | null>(null);
  const [resolveReason, setResolveReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/admin/worker-monitor/incidents`;
      if (statusFilter === 'active') {
        url = `${API_BASE_URL}/admin/worker-monitor/incidents/active`;
      } else if (statusFilter === 'resolved') {
        url += '?status=RESOLVED';
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Incident 목록 조회 실패');
      const data = await res.json();
      setIncidents(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 30000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  const handleAcknowledge = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/worker-monitor/incidents/${id}/acknowledge`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error('Incident 확인 처리 실패');
      setSnackbar({ open: true, message: 'Incident가 확인 처리되었습니다.', severity: 'success' });
      fetchIncidents();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '확인 처리 실패',
        severity: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/worker-monitor/incidents/${resolveTarget.id}/resolve`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: resolveReason }),
        }
      );
      if (!res.ok) throw new Error('Incident 해결 처리 실패');
      setSnackbar({ open: true, message: 'Incident가 해결 처리되었습니다.', severity: 'success' });
      setResolveDialogOpen(false);
      setResolveTarget(null);
      setResolveReason('');
      fetchIncidents();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '해결 처리 실패',
        severity: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const openResolveDialog = (incident: Incident) => {
    setResolveTarget(incident);
    setResolveDialogOpen(true);
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
        }}
      >
        <Typography variant="h2" sx={{ fontWeight: 600 }}>
          이상 징후 (Incidents)
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <ToggleButtonGroup
            value={statusFilter}
            exclusive
            onChange={(_, val) => val && setStatusFilter(val)}
            size="small"
          >
            <ToggleButton value="all">전체</ToggleButton>
            <ToggleButton value="active">활성</ToggleButton>
            <ToggleButton value="resolved">해결됨</ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="새로고침">
            <IconButton onClick={fetchIncidents} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 에러 메시지 */}
      {error && (
        <Box sx={{ p: 2, mb: 3, bgcolor: 'error.dark', borderRadius: 2 }}>
          <Typography color="error.contrastText">{error}</Typography>
        </Box>
      )}

      {/* 로딩 */}
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={120} />
          ))}
        </Box>
      ) : incidents.length === 0 ? (
        <Card
          sx={{
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <CardContent
            sx={{
              textAlign: 'center',
              py: 8,
            }}
          >
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" fontWeight={600} mb={1}>
              이상 징후 없음
            </Typography>
            <Typography color="text.secondary">
              현재 감지된 이상 징후가 없습니다. 시스템이 정상 운영 중입니다.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {incidents.map((incident) => {
            const sevConfig = severityConfig[incident.severity] || severityConfig.MEDIUM;
            const statConfig = statusConfig[incident.status] || statusConfig.ACTIVE;
            const IconComponent = sevConfig.icon;

            return (
              <Card
                key={incident.id}
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor:
                    incident.status === 'RESOLVED'
                      ? 'divider'
                      : alpha(sevConfig.color, 0.3),
                  borderLeft: `4px solid ${incident.status === 'RESOLVED' ? '#4caf50' : sevConfig.color}`,
                  opacity: incident.status === 'RESOLVED' ? 0.7 : 1,
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {/* 아이콘 */}
                    <Box>
                      <IconComponent
                        sx={{
                          fontSize: 32,
                          color:
                            incident.status === 'RESOLVED'
                              ? 'text.disabled'
                              : sevConfig.color,
                        }}
                      />
                    </Box>

                    {/* 내용 */}
                    <Box sx={{ flex: 1 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <Typography
                          variant="h6"
                          fontWeight={700}
                          color={
                            incident.status === 'RESOLVED'
                              ? 'text.disabled'
                              : 'text.primary'
                          }
                        >
                          {incident.title}
                        </Typography>
                        <Chip
                          size="small"
                          label={sevConfig.label}
                          sx={{
                            bgcolor: alpha(sevConfig.color, 0.15),
                            color: sevConfig.color,
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }}
                        />
                        <Chip
                          size="small"
                          label={statConfig.label}
                          color={statConfig.color as any}
                          sx={{ fontWeight: 500, fontSize: '0.7rem' }}
                        />
                      </Box>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        {incident.description}
                      </Typography>

                      {incident.recommendedAction && incident.status !== 'RESOLVED' && (
                        <Typography
                          variant="body2"
                          sx={{
                            mb: 1,
                            p: 1,
                            borderRadius: 1,
                            bgcolor: alpha(sevConfig.color, 0.08),
                          }}
                        >
                          💡 <strong>권장 조치:</strong> {incident.recommendedAction}
                        </Typography>
                      )}

                      <Box
                        sx={{
                          display: 'flex',
                          gap: 3,
                          mt: 1,
                          color: 'text.secondary',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Schedule sx={{ fontSize: 16 }} />
                          <Typography variant="caption">
                            발생: {formatDateTime(incident.startedAt)} ({getRelativeTime(incident.startedAt)})
                          </Typography>
                        </Box>
                        {incident.queueName && (
                          <Typography variant="caption">
                            큐: {incident.queueName}
                          </Typography>
                        )}
                        {incident.affectedJobs > 0 && (
                          <Typography variant="caption">
                            영향: {incident.affectedJobs}개 작업
                          </Typography>
                        )}
                        {incident.resolvedAt && (
                          <Typography variant="caption">
                            해결: {formatDateTime(incident.resolvedAt)}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* 액션 버튼 */}
                    {incident.status !== 'RESOLVED' && (
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                          justifyContent: 'center',
                        }}
                      >
                        {incident.status === 'ACTIVE' && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleAcknowledge(incident.id)}
                            disabled={actionLoading}
                            startIcon={<CheckCircle />}
                          >
                            확인
                          </Button>
                        )}
                        <Button
                          variant="contained"
                          size="small"
                          color="success"
                          onClick={() => openResolveDialog(incident)}
                          disabled={actionLoading}
                          startIcon={<Done />}
                        >
                          해결
                        </Button>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      {/* 해결 다이얼로그 */}
      <Dialog
        open={resolveDialogOpen}
        onClose={() => setResolveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Incident 해결</DialogTitle>
        <DialogContent>
          {resolveTarget && (
            <>
              <Typography variant="body1" fontWeight={600} mb={2}>
                {resolveTarget.title}
              </Typography>
              <TextField
                autoFocus
                margin="dense"
                label="해결 사유 (선택)"
                fullWidth
                multiline
                rows={3}
                value={resolveReason}
                onChange={(e) => setResolveReason(e.target.value)}
                placeholder="어떻게 해결했는지 기록해주세요..."
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={() => setResolveDialogOpen(false)}
            disabled={actionLoading}
            color="inherit"
          >
            취소
          </Button>
          <Button
            onClick={handleResolve}
            disabled={actionLoading}
            variant="contained"
            color="success"
          >
            해결 완료
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

