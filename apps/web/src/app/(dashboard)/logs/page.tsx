'use client';

/**
 * 작업 로그 페이지
 * Job 목록 조회 + 필터링 + 상세 보기
 */

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Button,
  TextField,
  MenuItem,
  Drawer,
  Skeleton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Refresh,
  OpenInNew,
  Close,
  Error as ErrorIcon,
  Schedule,
  Sync,
  Article,
  Login,
  Delete,
  Info,
  Warning,
  BugReport,
} from '@mui/icons-material';
import { jobApi, Job, JobLog } from '@/lib/api-client';
import StatusChip from '@/components/common/StatusChip';
import { useToast } from '@/components/common/ToastProvider';

/** Job 타입 라벨 */
const JOB_TYPE_LABELS: Record<string, string> = {
  INIT_SESSION: '세션 연동',
  VERIFY_SESSION: '세션 검증',
  CREATE_POST: '게시글 작성',
  SYNC_POSTS: '동기화',
  DELETE_POST: '삭제',
};

/** 에러 코드 라벨 */
const ERROR_CODE_LABELS: Record<string, string> = {
  AUTH_EXPIRED: '인증 만료',
  AUTH_INVALID: '인증 정보 오류',
  CHALLENGE_REQUIRED: '추가 인증 필요',
  LOGIN_FAILED: '로그인 실패',
  PERMISSION_DENIED: '권한 부족',
  CAFE_NOT_FOUND: '카페/게시판 없음',
  RATE_LIMIT: '요청 제한',
  DAILY_LIMIT: '일일 제한 초과',
  UI_CHANGED: '네이버 UI 변경',
  UPLOAD_FAILED: '업로드 실패',
  NETWORK_ERROR: '네트워크 오류',
  TIMEOUT: '타임아웃',
  BROWSER_ERROR: '브라우저 오류',
  VALIDATION_ERROR: '입력값 오류',
  UNKNOWN: '알 수 없음',
};

/** 에러 코드별 해결 가이드 */
const ERROR_CODE_GUIDES: Record<string, string> = {
  AUTH_EXPIRED: '네이버 연동 상태를 확인하고 재연동해주세요.',
  AUTH_INVALID: '네이버 계정 정보를 확인해주세요.',
  CHALLENGE_REQUIRED: '네이버에서 추가 인증(CAPTCHA/2FA)이 필요합니다.',
  LOGIN_FAILED: '네이버 계정 비밀번호가 변경되었을 수 있습니다. 재연동해주세요.',
  PERMISSION_DENIED: '해당 카페/게시판에 글을 쓸 권한이 있는지 확인해주세요.',
  CAFE_NOT_FOUND: '템플릿에 설정된 카페/게시판을 확인해주세요.',
  RATE_LIMIT: '잠시 후 다시 시도해주세요. 네이버 요청 제한입니다.',
  DAILY_LIMIT: '오늘 일일 게시 한도에 도달했습니다.',
  UI_CHANGED: '네이버 UI가 변경되었습니다. 관리자에게 문의해주세요.',
  UPLOAD_FAILED: '이미지 파일을 확인하고 다시 시도해주세요.',
  NETWORK_ERROR: '네트워크 연결을 확인해주세요.',
  TIMEOUT: '서버 응답이 지연되었습니다. 다시 시도해주세요.',
  BROWSER_ERROR: '시스템 오류입니다. 관리자에게 문의해주세요.',
  VALIDATION_ERROR: '템플릿 내용을 확인해주세요.',
  UNKNOWN: '알 수 없는 오류입니다. 관리자에게 문의해주세요.',
};

/** Job 타입 아이콘 */
const JOB_TYPE_ICONS: Record<string, React.ElementType> = {
  INIT_SESSION: Login,
  VERIFY_SESSION: Login,
  CREATE_POST: Article,
  SYNC_POSTS: Sync,
  DELETE_POST: Delete,
};

/** 로그 레벨 아이콘/색상 */
const LOG_LEVEL_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  DEBUG: { icon: BugReport, color: '#64748B' },
  INFO: { icon: Info, color: '#2563EB' },
  WARN: { icon: Warning, color: '#F59E0B' },
  ERROR: { icon: ErrorIcon, color: '#EF4444' },
};

export default function LogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // 필터 상태
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get('type') || '');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | ''>('');
  const [scheduleNameFilter, setScheduleNameFilter] = useState<string>('');

  // 페이지네이션
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // 데이터
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // 상세 드로어
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobLogs, setJobLogs] = useState<JobLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // ==============================================
  // 날짜 범위 계산
  // ==============================================

  const getDateRange = (preset: string): { from: string; to: string } | null => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case 'today':
        return { from: today.toISOString(), to: now.toISOString() };
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { from: yesterday.toISOString(), to: today.toISOString() };
      }
      case '7days': {
        const week = new Date(today);
        week.setDate(week.getDate() - 7);
        return { from: week.toISOString(), to: now.toISOString() };
      }
      case '30days': {
        const month = new Date(today);
        month.setDate(month.getDate() - 30);
        return { from: month.toISOString(), to: now.toISOString() };
      }
      default:
        return null;
    }
  };

  // ==============================================
  // 데이터 로딩
  // ==============================================

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const dateRange = getDateRange(dateFilter);

      const result = await jobApi.list({
        page: page + 1,
        limit: rowsPerPage,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        dateFrom: dateRange?.from,
        dateTo: dateRange?.to,
        scheduleName: scheduleNameFilter || undefined,
      });
      setJobs(result.data);
      setTotal(result.meta.total);
    } catch (error) {
      toast.error('작업 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, typeFilter, statusFilter, dateFilter, scheduleNameFilter, toast]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // URL 파라미터에서 jobId가 있으면 해당 Job 상세 열기
  useEffect(() => {
    const jobId = searchParams.get('jobId');
    if (jobId && jobs.length > 0) {
      const job = jobs.find((j) => j.id === jobId);
      if (job) {
        handleOpenDetail(job);
      }
    }
  }, [searchParams, jobs]);

  // ==============================================
  // 이벤트 핸들러
  // ==============================================

  const handleOpenDetail = async (job: Job) => {
    setSelectedJob(job);
    setLogsLoading(true);
    try {
      const logs = await jobApi.logs(job.id);
      setJobLogs(logs);
    } catch (error) {
      toast.error('로그를 불러오는데 실패했습니다');
    } finally {
      setLogsLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedJob(null);
    setJobLogs([]);
    // URL에서 jobId 파라미터 제거
    const params = new URLSearchParams(searchParams.toString());
    params.delete('jobId');
    router.replace(`/logs${params.toString() ? `?${params}` : ''}`);
  };

  const handleRefresh = () => {
    loadJobs();
    toast.info('목록을 새로고침했습니다');
  };

  // ==============================================
  // 렌더링
  // ==============================================

  return (
    <Box>
      {/* 페이지 타이틀 */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h1" sx={{ mb: 0.5 }}>
            작업 로그
          </Typography>
          <Typography variant="body2" color="text.secondary">
            모든 자동화 작업의 실행 기록을 확인하세요
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Refresh />} onClick={handleRefresh}>
          새로고침
        </Button>
      </Box>

      {/* 필터 */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Row 1: Type, Status, Schedule Search */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <TextField
            select
            label="작업 유형"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(0);
            }}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">전체</MenuItem>
            <MenuItem value="CREATE_POST">게시글 작성</MenuItem>
            <MenuItem value="SYNC_POSTS">동기화</MenuItem>
            <MenuItem value="INIT_SESSION">세션 연동</MenuItem>
            <MenuItem value="VERIFY_SESSION">세션 검증</MenuItem>
            <MenuItem value="DELETE_POST">삭제</MenuItem>
          </TextField>

          <TextField
            select
            label="상태"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">전체</MenuItem>
            <MenuItem value="PENDING">대기 중</MenuItem>
            <MenuItem value="PROCESSING">처리 중</MenuItem>
            <MenuItem value="COMPLETED">완료</MenuItem>
            <MenuItem value="FAILED">실패</MenuItem>
            <MenuItem value="CANCELLED">취소됨</MenuItem>
          </TextField>

          <TextField
            label="스케줄 검색"
            value={scheduleNameFilter}
            onChange={(e) => {
              setScheduleNameFilter(e.target.value);
              setPage(0);
            }}
            placeholder="스케줄 이름으로 검색"
            size="small"
            sx={{ minWidth: 200 }}
          />
        </Box>

        {/* Row 2: Date Filter Buttons */}
        <Box sx={{ mb: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            날짜 필터
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant={dateFilter === 'today' ? 'contained' : 'outlined'}
              onClick={() => {
                setDateFilter('today');
                setPage(0);
              }}
            >
              오늘
            </Button>
            <Button
              size="small"
              variant={dateFilter === 'yesterday' ? 'contained' : 'outlined'}
              onClick={() => {
                setDateFilter('yesterday');
                setPage(0);
              }}
            >
              어제
            </Button>
            <Button
              size="small"
              variant={dateFilter === '7days' ? 'contained' : 'outlined'}
              onClick={() => {
                setDateFilter('7days');
                setPage(0);
              }}
            >
              최근 7일
            </Button>
            <Button
              size="small"
              variant={dateFilter === '30days' ? 'contained' : 'outlined'}
              onClick={() => {
                setDateFilter('30days');
                setPage(0);
              }}
            >
              최근 30일
            </Button>
            <Button
              size="small"
              variant={dateFilter === '' ? 'contained' : 'outlined'}
              onClick={() => {
                setDateFilter('');
                setPage(0);
              }}
            >
              전체
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* 테이블 */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>유형</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>스케줄/템플릿</TableCell>
              <TableCell>생성 시간</TableCell>
              <TableCell>완료 시간</TableCell>
              <TableCell>소요 시간</TableCell>
              <TableCell align="right">액션</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              // 로딩 스켈레톤
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(7)].map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : jobs.length === 0 ? (
              // 빈 상태
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">작업 기록이 없습니다</Typography>
                </TableCell>
              </TableRow>
            ) : (
              // 데이터
              jobs.map((job) => {
                const TypeIcon = JOB_TYPE_ICONS[job.type] || Schedule;
                const payload = job.payload || {};
                const duration =
                  job.startedAt && job.finishedAt
                    ? Math.round(
                        (new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()) /
                          1000
                      )
                    : null;

                return (
                  <TableRow
                    key={job.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleOpenDetail(job)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TypeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {JOB_TYPE_LABELS[job.type] || job.type}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <StatusChip
                        status={job.status as 'COMPLETED' | 'FAILED' | 'PENDING'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {job.type === 'CREATE_POST' && payload.scheduleName ? (
                        <>
                          <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                            {String(payload.scheduleName)}
                            {job.executionOrder && job.totalExecutions && (
                              <Chip
                                label={`${job.executionOrder}/${job.totalExecutions}`}
                                size="small"
                                sx={{ ml: 1, height: 20, fontSize: '0.75rem' }}
                              />
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            템플릿: {String(payload.templateName || '-')}
                          </Typography>
                          {payload.boardName && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              게시판: {String(payload.boardName)}
                            </Typography>
                          )}
                        </>
                      ) : (
                        <>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {String(payload.templateName || '-')}
                          </Typography>
                          {payload.boardName && (
                            <Typography variant="caption" color="text.secondary">
                              {String(payload.boardName)}
                            </Typography>
                          )}
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(job.createdAt).toLocaleString('ko-KR')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {job.finishedAt ? new Date(job.finishedAt).toLocaleString('ko-KR') : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {duration !== null ? `${duration}초` : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {typeof payload.resultUrl === 'string' && payload.resultUrl && (
                        <IconButton
                          size="small"
                          href={payload.resultUrl}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <OpenInNew fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="페이지당 행"
        />
      </TableContainer>

      {/* 상세 드로어 */}
      <Drawer
        anchor="right"
        open={Boolean(selectedJob)}
        onClose={handleCloseDetail}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 480 } },
        }}
      >
        {selectedJob && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 헤더 */}
            <Box
              sx={{
                p: 2.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography variant="h3" sx={{ fontWeight: 600 }}>
                  작업 상세
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedJob.id}
                </Typography>
              </Box>
              <IconButton onClick={handleCloseDetail}>
                <Close />
              </IconButton>
            </Box>

            {/* 내용 */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
              {/* 기본 정보 */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  기본 정보
                </Typography>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        유형
                      </Typography>
                      <Typography variant="body2">
                        {JOB_TYPE_LABELS[selectedJob.type] || selectedJob.type}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        상태
                      </Typography>
                      <Box>
                        <StatusChip
                          status={selectedJob.status as 'COMPLETED' | 'FAILED' | 'PENDING'}
                          size="small"
                        />
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        생성 시간
                      </Typography>
                      <Typography variant="body2">
                        {new Date(selectedJob.createdAt).toLocaleString('ko-KR')}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        완료 시간
                      </Typography>
                      <Typography variant="body2">
                        {selectedJob.finishedAt
                          ? new Date(selectedJob.finishedAt).toLocaleString('ko-KR')
                          : '-'}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Box>

              {/* 에러 정보 (코드 + 메시지 + 가이드) */}
              {(selectedJob.errorMessage || selectedJob.errorCode) && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    실패 원인
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      backgroundColor: '#FEF2F2',
                      borderColor: '#FECACA',
                    }}
                  >
                    {selectedJob.errorCode && (
                      <Box sx={{ mb: 1 }}>
                        <Chip
                          label={ERROR_CODE_LABELS[selectedJob.errorCode] || selectedJob.errorCode}
                          size="small"
                          color="error"
                          sx={{ mb: 1 }}
                        />
                      </Box>
                    )}
                    {selectedJob.errorMessage && (
                      <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                        {selectedJob.errorMessage}
                      </Typography>
                    )}
                    {selectedJob.errorCode && ERROR_CODE_GUIDES[selectedJob.errorCode] && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                        💡 {ERROR_CODE_GUIDES[selectedJob.errorCode]}
                      </Typography>
                    )}
                  </Paper>
                </Box>
              )}

              {/* 디버그 아티팩트 (스크린샷/HTML) */}
              {(selectedJob.screenshotPath || selectedJob.htmlPath) && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    디버그 정보
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    {selectedJob.screenshotPath && (
                      <Box sx={{ mb: selectedJob.htmlPath ? 2 : 0 }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                          스크린샷
                        </Typography>
                        <Box
                          component="img"
                          src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${selectedJob.screenshotPath}`}
                          alt="실패 시점 스크린샷"
                          sx={{
                            maxWidth: '100%',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </Box>
                    )}
                    {selectedJob.htmlPath && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                          HTML 스냅샷
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${selectedJob.htmlPath}`}
                          target="_blank"
                          startIcon={<OpenInNew />}
                        >
                          HTML 보기
                        </Button>
                      </Box>
                    )}
                  </Paper>
                </Box>
              )}

              {/* 실행 로그 */}
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  실행 로그
                </Typography>
                <Paper variant="outlined" sx={{ p: 0 }}>
                  {logsLoading ? (
                    <Box sx={{ p: 2 }}>
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} height={40} sx={{ mb: 1 }} />
                      ))}
                    </Box>
                  ) : jobLogs.length === 0 ? (
                    <Box sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        로그가 없습니다
                      </Typography>
                    </Box>
                  ) : (
                    <List dense disablePadding>
                      {jobLogs.map((log, index) => {
                        const levelConfig = LOG_LEVEL_CONFIG[log.level] || LOG_LEVEL_CONFIG.INFO;
                        const Icon = levelConfig.icon;

                        return (
                          <ListItem
                            key={log.id}
                            sx={{
                              borderBottom: index < jobLogs.length - 1 ? '1px solid' : 'none',
                              borderColor: 'divider',
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <Icon sx={{ fontSize: 18, color: levelConfig.color }} />
                            </ListItemIcon>
                            <ListItemText
                              primary={log.message}
                              secondary={new Date(log.createdAt).toLocaleTimeString('ko-KR')}
                              primaryTypographyProps={{ variant: 'body2' }}
                              secondaryTypographyProps={{ variant: 'caption' }}
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  )}
                </Paper>
              </Box>
            </Box>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
