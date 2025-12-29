'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { History, ReportProblem } from '@mui/icons-material';
import AppButton from './AppButton';
import { scheduleRunApi, ScheduleRun } from '@/lib/api-client';

interface FailureHistoryDialogProps {
  open: boolean;
  scheduleId: string;
  scheduleName?: string;
  onClose: () => void;
}

export default function FailureHistoryDialog({ open, scheduleId, scheduleName, onClose }: FailureHistoryDialogProps) {
  const [runs, setRuns] = useState<ScheduleRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const loadFailures = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await scheduleRunApi.getBySchedule(scheduleId, 1, 30);
        const failedRuns = response.data.filter((run) => run.failedJobs > 0 || run.status === 'FAILED');
        setRuns(failedRuns);
      } catch (err) {
        setError('실패 이력을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadFailures();
  }, [open, scheduleId]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 3 }}>
          <LinearProgress sx={{ flex: 1 }} />
          <Typography variant="body2" color="text.secondary">
            실패 이력을 불러오는 중...
          </Typography>
        </Box>
      );
    }

    if (error) {
      return (
        <Typography variant="body2" color="error" sx={{ py: 2 }}>
          {error}
        </Typography>
      );
    }

    if (runs.length === 0) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <History color="disabled" sx={{ fontSize: 36, mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            최근 실패 이력이 없습니다.
          </Typography>
        </Box>
      );
    }

    return (
      <Stack divider={<Divider flexItem />} spacing={2} sx={{ pt: 1 }}>
        {runs.map((run) => {
          const runDate = new Date(run.runDate);
          const dateLabel = runDate.toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric',
            weekday: 'short',
          });

          return (
            <Box key={run.id} sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1.5 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {dateLabel}
                  </Typography>
                  <Chip size="small" color="error" label={`실패 ${run.failedJobs}건`} />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {run.startedAt ? new Date(run.startedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '시작 정보 없음'}
                  {run.finishedAt && ` · 완료 ${new Date(run.finishedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ReportProblem sx={{ fontSize: 16, color: 'error.main' }} />
                    실패한 작업 {run.failedJobs}개를 확인해주세요.
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    총 {run.totalJobs}개 중 {run.completedJobs}개 성공
                  </Typography>
                </Box>
              </Box>
              <Stack spacing={0.5} alignItems="flex-end">
                <Chip
                  size="small"
                  label={run.status === 'FAILED' ? '실패' : '부분 실패'}
                  color="error"
                  variant={run.status === 'FAILED' ? 'filled' : 'outlined'}
                />
                <Chip size="small" color="info" variant="outlined" label={`완료 ${run.completedJobs}`} />
              </Stack>
            </Box>
          );
        })}
      </Stack>
    );
  }, [error, loading, runs]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <History fontSize="small" />
        {scheduleName ? `${scheduleName} 실패 이력` : '실패 이력'}
      </DialogTitle>
      <DialogContent dividers>{content}</DialogContent>
      <DialogActions>
        <AppButton variant="contained" onClick={onClose}>
          닫기
        </AppButton>
      </DialogActions>
    </Dialog>
  );
}
