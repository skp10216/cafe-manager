'use client';

/**
 * 스케줄 목록 페이지 - Premium Edition
 * 프리미엄 B2B SaaS 스타일 UI
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Switch,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
  alpha,
  Stack,
  Theme,
  Divider,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  MoreVert,
  PlayArrow,
  PlayCircle,
  PauseCircle,
  History,
  Lock,
  CheckCircle,
  Warning,
  Error,
  Schedule,
  AccessTime,
  Description,
  Bolt,
  CalendarMonth,
  Timeline,
} from '@mui/icons-material';
import AppCard from '@/components/common/AppCard';
import AppButton from '@/components/common/AppButton';
import AppTable, { Column } from '@/components/common/AppTable';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { scheduleApi, dashboardApi, Schedule as ScheduleType } from '@/lib/api-client';
import { useToast } from '@/components/common/ToastProvider';
import FailureHistoryDialog from '@/components/common/FailureHistoryDialog';

/** 실행 설정 미리보기 컴포넌트 */
function ExecutionPreview({
  scheduleType,
  runTime,
  dailyPostCount,
  postIntervalMinutes,
}: {
  scheduleType: 'IMMEDIATE' | 'SCHEDULED';
  runTime: string;
  dailyPostCount: number;
  postIntervalMinutes: number;
}) {
  const isImmediate = scheduleType === 'IMMEDIATE';

  // 총 소요 시간 계산 (분)
  const totalDuration = (dailyPostCount - 1) * postIntervalMinutes;

  // 예상 게시 시간 목록 생성
  const getPostTimes = () => {
    if (isImmediate) return null;

    const times: string[] = [];
    const [hours, minutes] = runTime.split(':').map(Number);
    let currentMinutes = hours * 60 + minutes;

    for (let i = 0; i < Math.min(dailyPostCount, 3); i++) {
      const h = Math.floor(currentMinutes / 60) % 24;
      const m = currentMinutes % 60;
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      currentMinutes += postIntervalMinutes;
    }

    return times;
  };

  const postTimes = getPostTimes();

  // 소요 시간 포맷팅
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}분`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  };

  return (
    <Box>
      {/* 실행 타입 배지 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <Chip
          size="small"
          icon={isImmediate ? <Bolt sx={{ fontSize: 14 }} /> : <CalendarMonth sx={{ fontSize: 14 }} />}
          label={isImmediate ? '즉시 실행' : '예약 설정'}
          sx={{
            height: 22,
            fontWeight: 600,
            fontSize: '0.7rem',
            bgcolor: (theme) =>
              alpha(isImmediate ? theme.palette.success.main : theme.palette.primary.main, 0.1),
            color: isImmediate ? 'success.dark' : 'primary.dark',
            '& .MuiChip-icon': { ml: 0.5, color: 'inherit' },
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
        {!isImmediate && (
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {runTime} 시작
          </Typography>
        )}
      </Box>

      {/* 실행 미리보기 문구 */}
      <Box sx={{ pl: 0.25 }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            display: 'block',
            lineHeight: 1.5,
          }}
        >
          {isImmediate ? (
            <>
              <Box component="span" sx={{ fontWeight: 500, color: 'success.main' }}>
                저장 즉시
              </Box>
              {' '}게시 시작 →{' '}
              <Box component="span" sx={{ fontWeight: 500 }}>
                {dailyPostCount}개
              </Box>
              를{' '}
              <Box component="span" sx={{ fontWeight: 500 }}>
                {postIntervalMinutes}분 간격
              </Box>
              으로 게시
            </>
          ) : (
            <>
              {postTimes && postTimes.length > 0 && (
                <>
                  <Box component="span" sx={{ fontWeight: 500, color: 'primary.main' }}>
                    {postTimes[0]}
                  </Box>
                  {postTimes.slice(1).map((time, idx) => (
                    <span key={idx}> → {time}</span>
                  ))}
                  {dailyPostCount > 3 && (
                    <span> → ... 외 {dailyPostCount - 3}개</span>
                  )}
                </>
              )}
            </>
          )}
        </Typography>

        {/* 총 소요 시간 안내 */}
        {dailyPostCount > 1 && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.disabled',
              fontSize: '0.7rem',
              display: 'block',
              mt: 0.25,
            }}
          >
            약 {formatDuration(totalDuration)} 소요 · 총 {dailyPostCount}개 게시
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** 실행 상태 뱃지 컴포넌트 */
function ExecutionStatusBadge({
  userEnabled,
  adminStatus,
  sessionHealthy,
}: {
  userEnabled: boolean;
  adminStatus: string;
  sessionHealthy: boolean;
}) {
  const adminApproved = adminStatus === 'APPROVED';
  const canExecute = userEnabled && adminApproved && sessionHealthy;

  if (canExecute) {
    return (
      <Chip
        size="small"
        icon={<CheckCircle sx={{ fontSize: 14 }} />}
        label="실행 가능"
        color="success"
        sx={{
          height: 24,
          fontWeight: 600,
          '& .MuiChip-label': { px: 0.75, fontSize: '0.75rem' },
          '& .MuiChip-icon': { ml: 0.5 },
        }}
      />
    );
  }

  // 문제가 있는 경우
  const issues = [];
  if (!userEnabled) issues.push('비활성화');
  if (!adminApproved) issues.push(adminStatus === 'NEEDS_REVIEW' ? '승인대기' : '관리자중지');
  if (!sessionHealthy) issues.push('연동필요');

  return (
    <Tooltip title={issues.join(' · ')}>
      <Chip
        size="small"
        icon={<Warning sx={{ fontSize: 14 }} />}
        label={issues[0]}
        color="warning"
        sx={{
          height: 24,
          fontWeight: 600,
          '& .MuiChip-label': { px: 0.75, fontSize: '0.75rem' },
          '& .MuiChip-icon': { ml: 0.5 },
        }}
      />
    </Tooltip>
  );
}

export default function SchedulesPage() {
  const router = useRouter();
  const toast = useToast();
  const [schedules, setSchedules] = useState<ScheduleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleType | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; schedule: ScheduleType } | null>(
    null
  );
  const [actionTarget, setActionTarget] = useState<{
    type: 'pause' | 'resume' | 'run';
    schedule: ScheduleType;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [failureSchedule, setFailureSchedule] = useState<ScheduleType | null>(null);

  // 세션 상태 (API에서 가져옴)
  const [sessionHealthy, setSessionHealthy] = useState(true);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const response = await scheduleApi.list(page);
      setSchedules(response.data);
      setTotal(response.meta.total);
    } catch (error) {
      console.error('스케줄 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 세션 상태 로드
  const loadSessionStatus = async () => {
    try {
      const integrationStatus = await dashboardApi.getIntegrationStatus();
      const status = integrationStatus.session?.status;
      // ACTIVE면 실행 가능
      setSessionHealthy(status === 'ACTIVE');
    } catch (error) {
      console.error('세션 상태 로딩 실패:', error);
      setSessionHealthy(false);
    }
  };

  useEffect(() => {
    loadSchedules();
    loadSessionStatus();
  }, [page]);

  const validateRunPrerequisites = (schedule: ScheduleType) => {
    if (!schedule.userEnabled) {
      return '스케줄이 비활성화되어 있습니다. 먼저 활성화해주세요.';
    }
    if (schedule.adminStatus !== 'APPROVED') {
      return '관리자 승인이 필요합니다.';
    }
    if (!sessionHealthy) {
      return '네이버 연동이 필요합니다. 설정에서 연동 상태를 확인해주세요.';
    }
    return null;
  };

  const performToggle = async (schedule: ScheduleType, newEnabled: boolean) => {
    if (schedule.adminStatus !== 'APPROVED') {
      toast.warning(
        schedule.adminStatus === 'NEEDS_REVIEW'
          ? '관리자 승인 대기 중입니다. 승인 후 활성화할 수 있습니다.'
          : `관리자에 의해 ${schedule.adminStatus === 'SUSPENDED' ? '일시 중지' : '차단'}되었습니다.${schedule.adminReason ? ` 사유: ${schedule.adminReason}` : ''}`
      );
      return;
    }

    try {
      await scheduleApi.toggleEnabled(schedule.id, newEnabled);
      toast.success(newEnabled ? '스케줄이 재개되었습니다.' : '스케줄이 일시 중지되었습니다.');
      await loadSchedules();
    } catch (error) {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  const performRunNow = async (schedule: ScheduleType) => {
    const validation = validateRunPrerequisites(schedule);
    if (validation) {
      toast.warning(validation);
      return;
    }

    try {
      await scheduleApi.runNow(schedule.id);
      toast.success(`"${schedule.name}" 스케줄이 즉시 실행되었습니다.`);
      await loadSchedules();
    } catch (error: any) {
      if (error?.message?.includes('이미 실행되었습니다')) {
        toast.info('오늘은 이미 실행되어 중복 실행되지 않았습니다.');
      } else {
        toast.error(`즉시 실행 실패: ${error?.message || '알 수 없는 오류'}`);
      }
    } finally {
      setMenuAnchor(null);
    }
  };

  const handleActionConfirm = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    const { type, schedule } = actionTarget;

    try {
      if (type === 'run') {
        await performRunNow(schedule);
      } else {
        await performToggle(schedule, type === 'resume');
      }
    } finally {
      setActionLoading(false);
      setActionTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await scheduleApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      loadSchedules();
    } catch (error) {
      alert('삭제 실패');
    }
  };

  const calculateNextRun = (schedule: ScheduleType): { text: string; subText?: string; isActive: boolean } => {
    // 실행 불가 조건
    if (!schedule.userEnabled) return { text: '-', isActive: false };
    if (schedule.adminStatus !== 'APPROVED') return { text: '-', isActive: false };
    if (!sessionHealthy) return { text: '-', isActive: false };

    // 즉시 실행 타입
    if (schedule.scheduleType === 'IMMEDIATE') {
      return {
        text: '활성화 시 즉시',
        subText: '저장 후 바로 시작',
        isActive: true,
      };
    }

    try {
      const now = new Date();
      const [hours, minutes] = schedule.runTime.split(':').map(Number);
      const nextRun = new Date();
      nextRun.setHours(hours, minutes, 0, 0);

      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      const isToday = nextRun.getDate() === now.getDate();
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      // 남은 시간 계산
      const diffMs = nextRun.getTime() - now.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const remainingText = diffHours > 0 
        ? `${diffHours}시간 ${diffMinutes}분 후`
        : `${diffMinutes}분 후`;

      return {
        text: isToday ? `오늘 ${timeStr}` : `내일 ${timeStr}`,
        subText: remainingText,
        isActive: true,
      };
    } catch {
      return { text: '-', isActive: false };
    }
  };

  const formatRelativeTime = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const diffMs = date.getTime() - Date.now();
    const diffMinutes = Math.round(Math.abs(diffMs) / (1000 * 60));
    const diffHours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));

    if (diffMinutes < 1) return '지금';
    if (diffMinutes < 60) return diffMs >= 0 ? `${diffMinutes}분 후` : `${diffMinutes}분 전`;
    if (diffHours < 24) return diffMs >= 0 ? `${diffHours}시간 후` : `${diffHours}시간 전`;
    const diffDays = Math.round(diffHours / 24);
    return diffMs >= 0 ? `${diffDays}일 후` : `${diffDays}일 전`;
  };

  const getNextRunInfo = (schedule: ScheduleType) => {
    if (schedule.nextRunAt) {
      const date = new Date(schedule.nextRunAt);
      const timeText = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const dayText = date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
      return {
        text: `${dayText} ${timeText}`,
        subText: formatRelativeTime(schedule.nextRunAt) || undefined,
        isActive: true,
      };
    }

    return calculateNextRun(schedule);
  };

  const renderExecutionTimeline = (row: ScheduleType) => {
    const nextRun = getNextRunInfo(row);
    const lastStatus = row.lastRunStatus;
    const lastRunText = row.lastRunFinishedAt || row.lastRunDate;
    const dailyCount = row.dailyRunCount ?? 0;
    const weeklyCount = row.weeklyRunCount ?? 0;

    return (
      <Box
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: '1px dashed',
          borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.03),
        }}
      >
        <Stack spacing={1.25}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AccessTime sx={{ fontSize: 16, color: nextRun.isActive ? 'primary.main' : 'text.disabled' }} />
            <Box>
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: nextRun.isActive ? 'primary.main' : 'text.disabled' }}
              >
                다음 실행 · {nextRun.text}
              </Typography>
              {nextRun.subText && (
                <Typography variant="caption" color="text.secondary">
                  {nextRun.subText}
                </Typography>
              )}
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            {lastStatus === 'SUCCESS' && <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />}
            {lastStatus === 'FAILED' && <Error sx={{ fontSize: 16, color: 'error.main' }} />}
            {!lastStatus && <Timeline sx={{ fontSize: 16, color: 'text.disabled' }} />}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, color: lastStatus === 'FAILED' ? 'error.main' : 'text.primary' }}>
                최근 실행 · {lastStatus === 'SUCCESS' ? '성공' : lastStatus === 'FAILED' ? '실패' : '기록 없음'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatRelativeTime(lastRunText) || '-'}
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ my: 0.5 }} />

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip
              size="small"
              icon={<Bolt sx={{ fontSize: 16 }} />}
              label={`일일 실행 ${dailyCount}회`}
              sx={{ fontWeight: 700 }}
            />
            <Chip
              size="small"
              icon={<CalendarMonth sx={{ fontSize: 16 }} />}
              label={`주간 실행 ${weeklyCount}회`}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
          </Stack>
        </Stack>
      </Box>
    );
  };

  const renderWarningBadges = (row: ScheduleType) => {
    const badges = [];
    if (row.limitExceeded) {
      badges.push(
        <Chip
          key="limit"
          size="small"
          color="error"
          label="한도 초과"
          sx={{ fontWeight: 700 }}
        />
      );
    }
    if (row.queueDelayedMinutes) {
      badges.push(
        <Chip
          key="queue"
          size="small"
          color="warning"
          label={`대기열 지연 ${row.queueDelayedMinutes}분`}
          sx={{ fontWeight: 700 }}
        />
      );
    }
    if (row.recentFailures && row.recentFailures.length > 0) {
      badges.push(
        <Chip
          key="failures"
          size="small"
          color="error"
          variant="outlined"
          label="실패 이력 확인"
          onClick={(e) => {
            e.stopPropagation();
            setFailureSchedule(row);
          }}
          sx={{ fontWeight: 700 }}
        />
      );
    }

    if (badges.length === 0) return null;

    return (
      <Stack direction="row" spacing={0.75} flexWrap="wrap">
        {badges}
      </Stack>
    );
  };

  const columns: Column<ScheduleType>[] = [
    {
      id: 'name',
      label: '스케줄',
      minWidth: 200,
      render: (row: ScheduleType) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
              flexShrink: 0,
            }}
          >
            <Schedule sx={{ fontSize: 18, color: 'primary.main' }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.name}
            </Typography>
            {row.template && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <Description sx={{ fontSize: 12 }} />
                {row.template.name}
              </Typography>
            )}
          </Box>
        </Box>
      ),
    },
    {
      id: 'summary',
      label: '실행 설정',
      minWidth: 240,
      render: (row: ScheduleType) => (
        <ExecutionPreview
          scheduleType={row.scheduleType || 'SCHEDULED'}
          runTime={row.runTime}
          dailyPostCount={row.dailyPostCount}
          postIntervalMinutes={row.postIntervalMinutes}
        />
      ),
    },
    {
      id: 'nextRun',
      label: '실행 현황',
      minWidth: 260,
      render: (row: ScheduleType) => renderExecutionTimeline(row),
    },
    {
      id: 'status',
      label: '상태',
      minWidth: 120,
      render: (row: ScheduleType) => (
        <Stack spacing={0.75} alignItems="flex-start">
          <ExecutionStatusBadge
            userEnabled={row.userEnabled ?? true}
            adminStatus={row.adminStatus ?? 'APPROVED'}
            sessionHealthy={sessionHealthy}
          />
          {renderWarningBadges(row)}
        </Stack>
      ),
    },
    {
      id: 'toggle',
      label: '활성화',
      minWidth: 80,
      align: 'center' as const,
      render: (row: ScheduleType) => {
        const isLocked = row.adminStatus !== 'APPROVED';
        const enabled = row.userEnabled ?? (row.status === 'ACTIVE');

        return (
          <Tooltip
            title={
              isLocked
                ? `관리자 ${row.adminStatus === 'NEEDS_REVIEW' ? '승인 대기' : '중지/차단'}됨`
                : enabled
                ? '클릭하여 비활성화'
                : '클릭하여 활성화'
            }
          >
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <Switch
                checked={enabled}
                onChange={() =>
                  setActionTarget({
                    type: enabled ? 'pause' : 'resume',
                    schedule: row,
                  })
                }
                size="small"
                disabled={isLocked}
              />
              {isLocked && (
                <Lock
                  sx={{
                    position: 'absolute',
                    right: -4,
                    top: -4,
                    fontSize: 14,
                    color: 'warning.main',
                  }}
                />
              )}
            </Box>
          </Tooltip>
        );
      },
    },
    {
      id: 'actions',
      label: '',
      minWidth: 60,
      align: 'center' as const,
      render: (row: ScheduleType) => {
        const enabled = row.userEnabled ?? row.status === 'ACTIVE';
        const runDisabled = !row.userEnabled || row.adminStatus !== 'APPROVED' || !sessionHealthy;

        return (
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
            <AppButton
              size="small"
              variant={enabled ? 'outlined' : 'contained'}
              startIcon={enabled ? <PauseCircle /> : <PlayCircle />}
              disabled={actionLoading}
              onClick={(e) => {
                e.stopPropagation();
                setActionTarget({ type: enabled ? 'pause' : 'resume', schedule: row });
              }}
            >
              {enabled ? '일시정지' : '재개'}
            </AppButton>

            <Tooltip
              title={
                runDisabled
                  ? !row.userEnabled
                    ? '비활성화된 스케줄입니다'
                    : !sessionHealthy
                      ? '연동이 필요합니다'
                      : '관리자 승인 대기'
                  : '즉시 실행'
              }
            >
              <span>
                <AppButton
                  size="small"
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActionTarget({ type: 'run', schedule: row });
                  }}
                  disabled={runDisabled || actionLoading}
                  sx={{ minWidth: 108 }}
                >
                  지금 실행
                </AppButton>
              </span>
            </Tooltip>

            <Tooltip title="실패 이력 보기">
              <AppButton
                size="small"
                variant="text"
                startIcon={<History />}
                onClick={(e) => {
                  e.stopPropagation();
                  setFailureSchedule(row);
                }}
              >
                이력
              </AppButton>
            </Tooltip>

            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchor({ element: e.currentTarget, schedule: row });
              }}
              sx={{
                color: 'text.secondary',
                '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) },
              }}
            >
              <MoreVert fontSize="small" />
            </IconButton>
          </Stack>
        );
      },
    },
  ];

  return (
    <Box>
      {/* 헤더 */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 4,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
            }}
          >
            <Schedule sx={{ fontSize: 24, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h1" sx={{ fontSize: '1.5rem', fontWeight: 700, mb: 0.25 }}>
              스케줄
            </Typography>
            <Typography variant="body2" color="text.secondary">
              자동 포스팅 스케줄을 관리하세요
            </Typography>
          </Box>
        </Box>

        <AppButton
          variant="contained"
          startIcon={<Add />}
          onClick={() => router.push('/schedules/new')}
          sx={{
            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
            px: 2.5,
            '&:hover': {
              background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
            },
          }}
        >
          새 스케줄
        </AppButton>
      </Box>

      {/* 스케줄 테이블 */}
      <AppCard
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          '& .MuiTableHead-root': {
            bgcolor: (theme: Theme) => alpha(theme.palette.grey[100], 0.5),
          },
          '& .MuiTableCell-head': {
            fontWeight: 600,
            color: 'text.secondary',
            fontSize: '0.8125rem',
          },
        }}
      >
        <AppTable
          columns={columns}
          rows={schedules}
          keyField="id"
          loading={loading}
          page={page}
          limit={20}
          total={total}
          onPageChange={setPage}
          emptyMessage={
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 2,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <Schedule sx={{ fontSize: 32, color: 'primary.main', opacity: 0.5 }} />
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                스케줄이 없습니다
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                새 스케줄을 만들어 자동 포스팅을 시작하세요
              </Typography>
              <AppButton
                variant="outlined"
                size="small"
                startIcon={<Add />}
                onClick={() => router.push('/schedules/new')}
              >
                새 스케줄 만들기
              </AppButton>
            </Box>
          }
        />
      </AppCard>

      {/* 액션 메뉴 */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            router.push(`/schedules/${menuAnchor?.schedule.id}`);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>수정</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              setActionTarget({ type: 'run', schedule: menuAnchor.schedule });
              setMenuAnchor(null);
            }
          }}
        >
          <ListItemIcon>
            <PlayArrow fontSize="small" />
          </ListItemIcon>
          <ListItemText>즉시 실행</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            router.push(`/schedules/${menuAnchor?.schedule.id}/history`);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <History fontSize="small" />
          </ListItemIcon>
          <ListItemText>실행 이력</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              setDeleteTarget(menuAnchor.schedule);
              setMenuAnchor(null);
            }
          }}
        >
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>삭제</ListItemText>
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={!!actionTarget}
        title={
          actionTarget?.type === 'run'
            ? '스케줄을 지금 실행할까요?'
            : actionTarget?.type === 'pause'
              ? '스케줄을 일시정지할까요?'
              : '스케줄을 다시 실행할까요?'
        }
        message={
          actionTarget
            ? `"${actionTarget.schedule.name}" 스케줄을 ${actionTarget.type === 'run' ? '즉시 실행' : actionTarget.type === 'pause' ? '일시정지' : '재개'}합니다.`
            : ''
        }
        onConfirm={handleActionConfirm}
        onCancel={() => setActionTarget(null)}
        confirmText="확인"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="스케줄 삭제"
        message={`"${deleteTarget?.name}" 스케줄을 삭제하시겠습니까?`}
        confirmText="삭제"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {failureSchedule && (
        <FailureHistoryDialog
          open={!!failureSchedule}
          scheduleId={failureSchedule.id}
          scheduleName={failureSchedule.name}
          onClose={() => setFailureSchedule(null)}
        />
      )}
    </Box>
  );
}
