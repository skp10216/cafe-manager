'use client';

/**
 * 현재 실행 중인 작업 추적 카드 - Premium Edition v2
 *
 * 프리미엄 UI/UX 목표:
 * - 첫 1초에 "상태 + 성공/실패 + 진행"이 읽히는 정보 계층 구조
 * - KPI 숫자 가독성 극대화 (32-40px급 큰 숫자)
 * - 보조 지표는 "미니 KPI 카드/칩" 형태로 정돈
 * - 접기/펼치기 UX (더블클릭 + 버튼)
 * - 접힌 상태에서는 핵심만 한 줄 요약 바
 *
 * 버그 수정:
 * - 카운트(processedCount/totalTarget) 기반으로 완료 상태 판정
 * - status 필드만 의존하지 않음 (갱신 지연/누락 대응)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  alpha,
  Chip,
  Skeleton,
  IconButton,
  Tooltip,
  Stack,
  Collapse,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  PlayCircle,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
  OpenInNew,
  Warning,
  HourglassEmpty,
  KeyboardArrowUp,
  KeyboardArrowDown,
  AccessTime,
  Timer,
  Assignment,
  TrendingUp,
} from '@mui/icons-material';
import { ActiveRunResponse } from '@/lib/api-client';
import { formatTimeWithRelative } from '@/lib/time-utils';

// ============================================
// 타입 정의
// ============================================

interface ActiveRunCardProps {
  /** Active Run 데이터 */
  data: ActiveRunResponse | null;
  /** 로딩 상태 */
  loading?: boolean;
  /** 로그 보기 클릭 핸들러 */
  onViewLogs?: (runId: string) => void;
}

/**
 * 파생 상태 타입 (UI 표시용)
 * - 카운트 기반으로 최종 판정된 상태
 */
type DerivedStatus =
  | 'RUNNING'           // 실행 중 (processedCount < totalTarget)
  | 'COMPLETED'         // 완료 - 모두 성공
  | 'COMPLETED_PARTIAL' // 완료 - 일부 실패
  | 'QUEUED'            // 대기 중
  | 'FAILED'            // 전체 실패
  | 'UNKNOWN';          // 알 수 없음

interface StatusStyle {
  borderColor: string;
  bgColor: string;
  icon: typeof CheckCircle;
  label: string;
  emoji: string;
  animate: boolean;
}

// ============================================
// 상태 유틸리티 함수
// ============================================

/**
 * 카운트 기반 상태 파생 함수
 * - processedCount === totalTarget → 완료 계열
 * - status 필드는 참고용으로만 사용
 */
function deriveStatusFromCounts(
  status: string,
  processedCount: number,
  totalTarget: number,
  successCount: number,
  failedCount: number
): DerivedStatus {
  if (totalTarget === 0) {
    return status === 'QUEUED' || status === 'PENDING' ? 'QUEUED' : 'UNKNOWN';
  }

  const isProcessingDone = processedCount >= totalTarget;

  if (isProcessingDone) {
    if (failedCount === 0) return 'COMPLETED';
    if (successCount === 0) return 'FAILED';
    return 'COMPLETED_PARTIAL';
  }

  if (status === 'QUEUED' || status === 'PENDING') {
    return 'QUEUED';
  }

  return 'RUNNING';
}

/**
 * 상태별 스타일 가져오기
 */
function getStatusStyle(derivedStatus: DerivedStatus): StatusStyle {
  switch (derivedStatus) {
    case 'COMPLETED':
      return {
        borderColor: 'success.main',
        bgColor: 'success.main',
        icon: CheckCircle,
        label: '완료',
        emoji: '✅',
        animate: false,
      };
    case 'COMPLETED_PARTIAL':
      return {
        borderColor: 'warning.main',
        bgColor: 'warning.main',
        icon: Warning,
        label: '완료 (일부 실패)',
        emoji: '⚠️',
        animate: false,
      };
    case 'FAILED':
      return {
        borderColor: 'error.main',
        bgColor: 'error.main',
        icon: ErrorIcon,
        label: '실패',
        emoji: '❌',
        animate: false,
      };
    case 'QUEUED':
      return {
        borderColor: 'grey.400',
        bgColor: 'grey.400',
        icon: HourglassEmpty,
        label: '대기 중',
        emoji: '⏳',
        animate: false,
      };
    case 'RUNNING':
      return {
        borderColor: 'primary.main',
        bgColor: 'primary.main',
        icon: PlayCircle,
        label: '실행 중',
        emoji: '🔄',
        animate: true,
      };
    default:
      return {
        borderColor: 'grey.300',
        bgColor: 'grey.300',
        icon: Schedule,
        label: '알 수 없음',
        emoji: '❓',
        animate: false,
      };
  }
}

/**
 * 소요 시간 계산 및 포맷팅
 * - 1초 미만은 "<1초"로 표시
 * - 진행 중이면 "경과", 완료면 "총"
 */
function formatElapsedTime(
  startedAt: string | null,
  updatedAt: string,
  isCompleted: boolean
): { label: string; value: string } {
  if (!startedAt) {
    return { label: '소요 시간', value: '—' };
  }

  const start = new Date(startedAt).getTime();
  const end = new Date(updatedAt).getTime();
  const diffMs = Math.max(0, end - start);

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  let value: string;
  if (seconds < 1) {
    value = '<1초';
  } else if (hours > 0) {
    value = `${hours}시간 ${minutes % 60}분`;
  } else if (minutes > 0) {
    value = `${minutes}분 ${seconds % 60}초`;
  } else {
    value = `${seconds}초`;
  }

  return {
    label: isCompleted ? '총 소요' : '경과',
    value,
  };
}

// ============================================
// localStorage 키
// ============================================
const COLLAPSE_STORAGE_KEY = 'activeRunCard_collapsed';

// ============================================
// 서브 컴포넌트: 확장된 뷰
// ============================================

interface ExpandedViewProps {
  run: NonNullable<ActiveRunResponse['run']>;
  recentEvents: ActiveRunResponse['recentEvents'];
  derivedStatus: DerivedStatus;
  statusStyle: StatusStyle;
  progress: number;
  successRate: number;
  elapsedTime: { label: string; value: string };
  isCompleted: boolean;
  isMobile: boolean;
}

function ExpandedView({
  run,
  recentEvents,
  derivedStatus,
  statusStyle,
  progress,
  successRate,
  elapsedTime,
  isCompleted,
  isMobile,
}: ExpandedViewProps) {
  const remaining = Math.max(0, run.totalTarget - run.processedCount);

  return (
    <Box sx={{ p: 3 }}>
      {/* ========================================
          A. 핵심 KPI 3개 - 대형 카드
          ======================================== */}
      <Stack
        direction={isMobile ? 'column' : 'row'}
        spacing={2}
        sx={{ mb: 3 }}
      >
        {/* 성공 KPI */}
        <Box
          sx={{
            flex: 1,
            p: 2.5,
            borderRadius: 3,
            backgroundColor: (theme) => alpha(theme.palette.success.main, 0.08),
            border: '2px solid',
            borderColor: (theme) => alpha(theme.palette.success.main, 0.25),
            textAlign: 'center',
            minWidth: isMobile ? 'auto' : 140,
          }}
        >
          <CheckCircle sx={{ fontSize: 28, color: 'success.main', mb: 1 }} />
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              color: 'success.main',
              fontSize: { xs: '2.25rem', sm: '2.5rem' },
              lineHeight: 1,
              mb: 0.5,
            }}
          >
            {run.successCount}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            fontWeight={600}
          >
            성공
          </Typography>
        </Box>

        {/* 실패 KPI */}
        <Box
          sx={{
            flex: 1,
            p: 2.5,
            borderRadius: 3,
            backgroundColor: (theme) =>
              run.failedCount > 0
                ? alpha(theme.palette.error.main, 0.08)
                : alpha(theme.palette.grey[500], 0.04),
            border: '2px solid',
            borderColor: (theme) =>
              run.failedCount > 0
                ? alpha(theme.palette.error.main, 0.25)
                : alpha(theme.palette.grey[500], 0.12),
            textAlign: 'center',
            minWidth: isMobile ? 'auto' : 140,
          }}
        >
          <ErrorIcon
            sx={{
              fontSize: 28,
              color: run.failedCount > 0 ? 'error.main' : 'text.disabled',
              mb: 1,
            }}
          />
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              color: run.failedCount > 0 ? 'error.main' : 'text.disabled',
              fontSize: { xs: '2.25rem', sm: '2.5rem' },
              lineHeight: 1,
              mb: 0.5,
            }}
          >
            {run.failedCount}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            fontWeight={600}
          >
            실패
          </Typography>
        </Box>

        {/* 전체/진행률 KPI */}
        <Box
          sx={{
            flex: 1.2,
            p: 2.5,
            borderRadius: 3,
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.06),
            border: '2px solid',
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
            textAlign: 'center',
            minWidth: isMobile ? 'auto' : 160,
          }}
        >
          <Assignment sx={{ fontSize: 28, color: 'primary.main', mb: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5 }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                color: 'primary.main',
                fontSize: { xs: '2.25rem', sm: '2.5rem' },
                lineHeight: 1,
              }}
            >
              {run.processedCount}
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                color: 'text.secondary',
                fontSize: { xs: '1.25rem', sm: '1.5rem' },
              }}
            >
              /{run.totalTarget}
            </Typography>
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            fontWeight={600}
            sx={{ mt: 0.5 }}
          >
            전체 · {progress}%
          </Typography>
          {/* 미니 Progress Bar */}
          <Box
            sx={{
              mt: 1.5,
              height: 6,
              borderRadius: 3,
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.15),
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                height: '100%',
                width: `${progress}%`,
                borderRadius: 3,
                backgroundColor: isCompleted
                  ? derivedStatus === 'COMPLETED'
                    ? 'success.main'
                    : derivedStatus === 'FAILED'
                    ? 'error.main'
                    : 'warning.main'
                  : 'primary.main',
                transition: 'width 0.3s ease',
              }}
            />
          </Box>
        </Box>
      </Stack>

      {/* ========================================
          B. 보조 지표 - 미니 KPI 칩/카드
          ======================================== */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          mb: 3,
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        {/* 성공률 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: 2,
            backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.06),
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <TrendingUp
            sx={{
              fontSize: 18,
              color:
                run.processedCount === 0
                  ? 'text.disabled'
                  : successRate >= 80
                  ? 'success.main'
                  : successRate >= 50
                  ? 'warning.main'
                  : 'error.main',
            }}
          />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
              성공률
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color:
                  run.processedCount === 0
                    ? 'text.disabled'
                    : successRate >= 80
                    ? 'success.main'
                    : successRate >= 50
                    ? 'warning.main'
                    : 'error.main',
              }}
            >
              {run.processedCount > 0 ? `${successRate}%` : '—'}
            </Typography>
          </Box>
        </Box>

        {/* 소요 시간 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: 2,
            backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.06),
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Timer sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
              {elapsedTime.label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {elapsedTime.value}
            </Typography>
          </Box>
        </Box>

        {/* 남은 작업 (진행 중일 때만 강조) */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: 2,
            backgroundColor: (theme) =>
              !isCompleted && remaining > 0
                ? alpha(theme.palette.info.main, 0.08)
                : alpha(theme.palette.grey[500], 0.06),
            border: '1px solid',
            borderColor: (theme) =>
              !isCompleted && remaining > 0
                ? alpha(theme.palette.info.main, 0.2)
                : 'divider',
          }}
        >
          <HourglassEmpty
            sx={{
              fontSize: 18,
              color: !isCompleted && remaining > 0 ? 'info.main' : 'text.secondary',
            }}
          />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
              남은 작업
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: !isCompleted && remaining > 0 ? 'info.main' : 'text.primary',
              }}
            >
              {remaining}개
            </Typography>
          </Box>
        </Box>
      </Stack>

      {/* ========================================
          C. 최근 이벤트 로그 (기존 구조 유지)
          ======================================== */}
      {recentEvents.length > 0 && (
        <Box
          sx={{
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 1.5, display: 'block', fontWeight: 600 }}
          >
            📋 최근 이벤트
          </Typography>
          <Stack spacing={0.75}>
            {recentEvents.slice(0, 3).map((event, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.5,
                  px: 1.5,
                  borderRadius: 1.5,
                  backgroundColor: (theme) =>
                    event.result === 'SUCCESS'
                      ? alpha(theme.palette.success.main, 0.06)
                      : alpha(theme.palette.error.main, 0.06),
                }}
              >
                {event.result === 'SUCCESS' ? (
                  <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                ) : (
                  <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />
                )}
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 500,
                    color: event.result === 'SUCCESS' ? 'success.dark' : 'error.dark',
                  }}
                >
                  #{event.index}/{run.totalTarget}{' '}
                  {event.result === 'SUCCESS' ? '게시 성공' : '게시 실패'}
                </Typography>
                {event.errorCode && (
                  <Chip
                    size="small"
                    label={event.errorCode}
                    sx={{
                      ml: 'auto',
                      height: 18,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      backgroundColor: (theme) => alpha(theme.palette.error.main, 0.15),
                      color: 'error.main',
                    }}
                  />
                )}
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ ml: event.errorCode ? 0 : 'auto', fontSize: '0.65rem' }}
                >
                  {new Date(event.createdAt).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

// ============================================
// 서브 컴포넌트: 접힌 요약 바
// ============================================

interface CollapsedSummaryBarProps {
  run: NonNullable<ActiveRunResponse['run']>;
  derivedStatus: DerivedStatus;
  statusStyle: StatusStyle;
  progress: number;
  elapsedTime: { label: string; value: string };
  updatedAt: string;
}

function CollapsedSummaryBar({
  run,
  derivedStatus,
  statusStyle,
  progress,
  elapsedTime,
  updatedAt,
}: CollapsedSummaryBarProps) {
  const remaining = Math.max(0, run.totalTarget - run.processedCount);
  const StatusIcon = statusStyle.icon;

  return (
    <Box
      sx={{
        px: 3,
        py: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      {/* 좌: 상태 Chip + 스케줄명 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Chip
          icon={<StatusIcon sx={{ fontSize: 16 }} />}
          label={statusStyle.label}
          size="small"
          sx={{
            fontWeight: 700,
            backgroundColor: (theme) => alpha(theme.palette[
              derivedStatus === 'COMPLETED'
                ? 'success'
                : derivedStatus === 'COMPLETED_PARTIAL'
                ? 'warning'
                : derivedStatus === 'FAILED'
                ? 'error'
                : derivedStatus === 'RUNNING'
                ? 'primary'
                : 'grey'
            ].main, 0.15),
            color: statusStyle.borderColor,
            '& .MuiChip-icon': {
              color: 'inherit',
            },
          }}
        />
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: 'text.secondary' }}
        >
          {run.scheduleName}
        </Typography>
      </Box>

      {/* 중앙: KPI 요약 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flex: 1,
          justifyContent: 'center',
          minWidth: 200,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          <Box component="span" sx={{ color: 'success.main' }}>
            성공 {run.successCount}
          </Box>
          <Box component="span" sx={{ mx: 1, color: 'text.disabled' }}>·</Box>
          <Box component="span" sx={{ color: run.failedCount > 0 ? 'error.main' : 'text.secondary' }}>
            실패 {run.failedCount}
          </Box>
          <Box component="span" sx={{ mx: 1, color: 'text.disabled' }}>·</Box>
          <Box component="span" sx={{ color: 'primary.main' }}>
            전체 {run.processedCount}/{run.totalTarget}
          </Box>
          <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            ({progress}%)
          </Box>
        </Typography>
      </Box>

      {/* 우: 남은작업 + 경과시간 + 업데이트 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          color: 'text.secondary',
        }}
      >
        {remaining > 0 && (
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            남은 {remaining}개
          </Typography>
        )}
        <Typography variant="caption" sx={{ fontWeight: 500 }}>
          {elapsedTime.label} {elapsedTime.value}
        </Typography>
        <Tooltip title="마지막 업데이트">
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            <AccessTime sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
            {formatTimeWithRelative(updatedAt)}
          </Typography>
        </Tooltip>
      </Box>
    </Box>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export default function ActiveRunCard({
  data,
  loading = false,
  onViewLogs,
}: ActiveRunCardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // 접기/펼치기 상태 (localStorage 기반 초기값)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
  });

  // 접기/펼치기 토글
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const newValue = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(newValue));
      return newValue;
    });
  }, []);

  // 더블클릭 핸들러
  const handleDoubleClick = useCallback(() => {
    toggleCollapse();
  }, [toggleCollapse]);

  // 키보드 핸들러 (Enter/Space)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleCollapse();
      }
    },
    [toggleCollapse]
  );

  // 로딩 상태
  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Skeleton variant="circular" width={28} height={28} />
          <Skeleton width="25%" height={28} />
          <Skeleton width="15%" height={24} sx={{ ml: 'auto' }} />
        </Box>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Skeleton variant="rounded" width="32%" height={120} sx={{ borderRadius: 3 }} />
          <Skeleton variant="rounded" width="32%" height={120} sx={{ borderRadius: 3 }} />
          <Skeleton variant="rounded" width="32%" height={120} sx={{ borderRadius: 3 }} />
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <Skeleton variant="rounded" width={100} height={48} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rounded" width={100} height={48} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rounded" width={100} height={48} sx={{ borderRadius: 2 }} />
        </Stack>
      </Paper>
    );
  }

  // 실행 중 run이 없으면 empty state
  if (!data?.run) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 3,
          border: '1px dashed',
          borderColor: 'divider',
          backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.02),
          textAlign: 'center',
        }}
      >
        <Schedule
          sx={{ fontSize: 44, color: 'text.disabled', mb: 1.5, opacity: 0.4 }}
        />
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ fontWeight: 500, mb: 0.5 }}
        >
          현재 실행 중인 작업이 없습니다
        </Typography>
        <Typography variant="caption" color="text.disabled">
          스케줄이 실행되면 여기에 진행 상황이 실시간으로 표시됩니다
        </Typography>
      </Paper>
    );
  }

  const { run, recentEvents } = data;

  // 카운트 기반 상태 판정
  const derivedStatus = deriveStatusFromCounts(
    run.status,
    run.processedCount,
    run.totalTarget,
    run.successCount,
    run.failedCount
  );

  const statusStyle = getStatusStyle(derivedStatus);
  const progress =
    run.totalTarget > 0
      ? Math.round((run.processedCount / run.totalTarget) * 100)
      : 0;
  const successRate =
    run.processedCount > 0
      ? Math.round((run.successCount / run.processedCount) * 100)
      : 0;
  const isCompleted =
    derivedStatus === 'COMPLETED' ||
    derivedStatus === 'COMPLETED_PARTIAL' ||
    derivedStatus === 'FAILED';
  const elapsedTime = formatElapsedTime(run.startedAt, run.updatedAt, isCompleted);

  const StatusIcon = statusStyle.icon;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '2px solid',
        borderColor: statusStyle.borderColor,
        backgroundColor: 'background.paper',
        overflow: 'hidden',
        transition: 'all 0.25s ease',
      }}
    >
      {/* ========================================
          헤더 (더블클릭으로 토글)
          ======================================== */}
      <Box
        role="button"
        tabIndex={0}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        sx={{
          px: 3,
          py: 2,
          borderBottom: isCollapsed ? 'none' : '1px solid',
          borderColor: 'divider',
          backgroundColor: (theme) =>
            alpha(
              theme.palette[
                derivedStatus === 'COMPLETED'
                  ? 'success'
                  : derivedStatus === 'COMPLETED_PARTIAL'
                  ? 'warning'
                  : derivedStatus === 'FAILED'
                  ? 'error'
                  : derivedStatus === 'RUNNING'
                  ? 'primary'
                  : 'grey'
              ].main,
              0.06
            ),
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': {
            backgroundColor: (theme) =>
              alpha(
                theme.palette[
                  derivedStatus === 'COMPLETED'
                    ? 'success'
                    : derivedStatus === 'COMPLETED_PARTIAL'
                    ? 'warning'
                    : derivedStatus === 'FAILED'
                    ? 'error'
                    : derivedStatus === 'RUNNING'
                    ? 'primary'
                    : 'grey'
                ].main,
                0.1
              ),
          },
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -2,
          },
        }}
      >
        {/* 상태 아이콘 + 라벨 */}
        <StatusIcon
          sx={{
            color: statusStyle.borderColor,
            fontSize: 26,
            animation: statusStyle.animate ? 'pulse 1.5s ease-in-out infinite' : 'none',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.5 },
            },
          }}
        />
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: statusStyle.borderColor,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontSize: '1.1rem',
            }}
          >
            {statusStyle.emoji} {statusStyle.label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {run.scheduleName}
          </Typography>
        </Box>

        {/* 마지막 업데이트 */}
        <Tooltip title="마지막 업데이트">
          <Chip
            size="small"
            icon={<AccessTime sx={{ fontSize: 14 }} />}
            label={formatTimeWithRelative(run.updatedAt)}
            sx={{
              fontSize: '0.7rem',
              fontWeight: 500,
              backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.1),
            }}
          />
        </Tooltip>

        {/* 로그 보기 버튼 */}
        {onViewLogs && (
          <Tooltip title="상세 로그 보기">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onViewLogs(run.id);
              }}
              sx={{
                backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.2),
                },
              }}
            >
              <OpenInNew fontSize="small" color="primary" />
            </IconButton>
          </Tooltip>
        )}

        {/* 접기/펼치기 버튼 */}
        <Tooltip title={isCollapsed ? '펼치기' : '접기'}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse();
            }}
            sx={{
              backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.08),
              '&:hover': {
                backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.15),
              },
            }}
          >
            {isCollapsed ? (
              <KeyboardArrowDown fontSize="small" />
            ) : (
              <KeyboardArrowUp fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* ========================================
          접힌 상태: 요약 바
          ======================================== */}
      {isCollapsed && (
        <CollapsedSummaryBar
          run={run}
          derivedStatus={derivedStatus}
          statusStyle={statusStyle}
          progress={progress}
          elapsedTime={elapsedTime}
          updatedAt={run.updatedAt}
        />
      )}

      {/* ========================================
          펼쳐진 상태: 전체 뷰
          ======================================== */}
      <Collapse in={!isCollapsed} timeout={250}>
        <ExpandedView
          run={run}
          recentEvents={recentEvents}
          derivedStatus={derivedStatus}
          statusStyle={statusStyle}
          progress={progress}
          successRate={successRate}
          elapsedTime={elapsedTime}
          isCompleted={isCompleted}
          isMobile={isMobile}
        />
      </Collapse>
    </Paper>
  );
}
