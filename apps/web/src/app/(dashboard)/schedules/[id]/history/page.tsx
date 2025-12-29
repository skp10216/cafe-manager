'use client';

/**
 * 스케줄 실행 이력 페이지
 * ScheduleRun 단위로 실행 이력 조회
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Chip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Divider,
  Link as MuiLink,
} from '@mui/material';
import { ArrowBack, ExpandMore, ExpandLess, OpenInNew } from '@mui/icons-material';
import AppButton from '@/components/common/AppButton';
import StatusChip from '@/components/common/StatusChip';
import { scheduleRunApi, scheduleApi, ScheduleRun, Job, Schedule } from '@/lib/api-client';
import { toWorkerErrorGuide } from '@/lib/worker-error';

export default function ScheduleHistoryPage() {
  const router = useRouter();
  const params = useParams();
  const scheduleId = params.id as string;

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [runs, setRuns] = useState<ScheduleRun[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
    loadRuns();
  }, [scheduleId]);

  const loadSchedule = async () => {
    try {
      const data = await scheduleApi.get(scheduleId);
      setSchedule(data);
    } catch (error) {
      console.error('스케줄 로딩 실패:', error);
    }
  };

  const loadRuns = async () => {
    try {
      setLoading(true);
      const response = await scheduleRunApi.getBySchedule(scheduleId, 1, 50);
      setRuns(response.data);
    } catch (error) {
      console.error('실행 이력 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExpand = async (runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }

    try {
      const jobsData = await scheduleRunApi.getJobs(runId);
      setJobs(jobsData);
      setExpandedRunId(runId);
    } catch (error) {
      alert('Job 목록 로딩 실패');
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatTime = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const isToday = (dateStr: string): boolean => {
    const date = new Date(dateStr);
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const getArticleUrl = (payload: any): string | null => {
    // Job payload에서 articleUrl이나 articleId로 URL 구성
    if (payload?.articleUrl) return payload.articleUrl;
    if (payload?.cafeId && payload?.articleId) {
      return `https://cafe.naver.com/${payload.cafeId}/${payload.articleId}`;
    }
    return null;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <AppButton
          variant="text"
          startIcon={<ArrowBack />}
          onClick={() => router.push('/schedules')}
        >
          목록으로
        </AppButton>
      </Box>

      <Typography variant="h1" sx={{ mb: 1 }}>
        실행 이력
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {schedule?.name || '스케줄'}의 실행 이력을 확인할 수 있습니다
      </Typography>

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 5 }}>
          <Typography>로딩 중...</Typography>
        </Box>
      ) : runs.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 5 }}>
            <Typography color="text.secondary">실행 이력이 없습니다.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Box>
          {runs.map((run) => {
            const progress = run.totalJobs > 0 ? (run.completedJobs / run.totalJobs) * 100 : 0;
            const isExpanded = expandedRunId === run.id;

            return (
              <Card key={run.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Grid container alignItems="center" spacing={2}>
                    {/* 날짜 */}
                    <Grid item xs={12} md={3}>
                      <Typography variant="h6">
                        {formatDate(run.runDate)}
                        {isToday(run.runDate) && (
                          <Chip label="오늘" size="small" color="primary" sx={{ ml: 1 }} />
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(run.startedAt)} 시작
                        {run.finishedAt && ` · ${formatTime(run.finishedAt)} 완료`}
                      </Typography>
                    </Grid>

                    {/* 진행률 */}
                    <Grid item xs={12} md={5}>
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {run.completedJobs}/{run.totalJobs} ({Math.round(progress)}%)
                      </Typography>
                    </Grid>

                    {/* 상태 */}
                    <Grid item xs={12} md={3}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip
                          label={`✅ ${run.completedJobs}개 성공`}
                          color="success"
                          size="small"
                        />
                        {run.failedJobs > 0 && (
                          <Chip label={`❌ ${run.failedJobs}개 실패`} color="error" size="small" />
                        )}
                      </Box>
                    </Grid>

                    {/* 확장 버튼 */}
                    <Grid item xs={12} md={1}>
                      <IconButton onClick={() => handleExpand(run.id)}>
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </Grid>
                  </Grid>

                  {/* Job 목록 (확장 시) */}
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ mt: 2 }}>
                      <Divider sx={{ mb: 2 }} />
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        실행 상세
                      </Typography>
                      <List dense>
                        {jobs
                          .filter((job) => job.scheduleRunId === run.id)
                          .sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0))
                          .map((job) => {
                            const articleUrl = getArticleUrl(job.payload);
                            const jobErrorGuide = toWorkerErrorGuide(
                              job.errorMessage,
                              (job as Job)?.errorCode || undefined,
                              job.type === 'VERIFY_SESSION' || job.type === 'INIT_SESSION' ? job.type : 'JOB'
                            );
                            const jobErrorText =
                              jobErrorGuide?.headline ||
                              jobErrorGuide?.description ||
                              job.errorMessage ||
                              '알 수 없는 오류';

                            return (
                              <ListItem
                                key={job.id}
                                sx={{
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: 1,
                                  mb: 1,
                                }}
                              >
                                <ListItemText
                                  primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Typography variant="body2" fontWeight="bold">
                                        {job.sequenceNumber}/{run.totalJobs}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {formatTime(job.createdAt)}
                                      </Typography>
                                      <StatusChip status={job.status} size="small" />
                                    </Box>
                                  }
                                  secondary={
                                    <Box sx={{ mt: 0.5 }}>
                                      {job.status === 'COMPLETED' && articleUrl && (
                                        <MuiLink
                                          href={articleUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                                        >
                                          글 보기 <OpenInNew fontSize="small" />
                                        </MuiLink>
                                      )}
                                      {job.status === 'FAILED' && (
                                        <Typography variant="caption" color="error">
                                          {jobErrorText}
                                        </Typography>
                                      )}
                                      {job.status === 'PROCESSING' && (
                                        <Typography variant="caption" color="info.main">
                                          실행 중...
                                        </Typography>
                                      )}
                                      {job.status === 'PENDING' && (
                                        <Typography variant="caption" color="text.secondary">
                                          대기 중
                                        </Typography>
                                      )}
                                    </Box>
                                  }
                                />
                              </ListItem>
                            );
                          })}
                      </List>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
