'use client';

/**
 * Run Detail 컴포넌트 - 프리미엄 v4
 * 
 * 최고급 상용 버전 디자인:
 * - 글래스모피즘 + 그라데이션 배경
 * - 부드러운 애니메이션
 * - 세련된 타이포그래피
 * - 깊이감 있는 레이어 구조
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  alpha,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Collapse,
  useMediaQuery,
  useTheme,
  Tabs,
  Tab,
  Button,
  keyframes,
} from '@mui/material';
import {
  PlayCircle,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  HourglassEmpty,
  Schedule,
  OpenInNew,
  KeyboardArrowUp,
  KeyboardArrowDown,
  AccessTime,
  TrendingUp,
  Replay,
  Download,
  Timeline,
  Bolt,
} from '@mui/icons-material';
import { ScheduleRunInfo, RunStatus, calculateProgress, calculateSuccessRate } from '@/types/multi-run';
import { formatTimeWithRelative } from '@/lib/time-utils';
import { typography, colors, monoFontFamily, getSuccessRateColor } from '@/lib/typography';

interface RunDetailProps {
  run: ScheduleRunInfo | null;
  onViewLogs?: (runId: string) => void;
  onRetry?: (runId: string) => void;
  onDownloadLogs?: (runId: string) => void;
  loading?: boolean;
}

// ============================================
// 애니메이션 정의
// ============================================

const pulseGlow = keyframes`
  0%, 100% { 
    box-shadow: 0 0 20px rgba(37, 99, 235, 0.2);
    opacity: 1;
  }
  50% { 
    box-shadow: 0 0 30px rgba(37, 99, 235, 0.4);
    opacity: 0.8;
  }
`;

const shimmer = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`;

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const rotateGlow = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// ============================================
// 상태 설정
// ============================================

const statusConfig: Record<RunStatus, {
  icon: typeof PlayCircle;
  color: string;
  bgGradient: string;
  label: string;
  animate: boolean;
}> = {
  RUNNING: { 
    icon: PlayCircle, 
    color: colors.running, 
    bgGradient: `linear-gradient(135deg, ${alpha(colors.running, 0.08)} 0%, ${alpha(colors.running, 0.02)} 100%)`,
    label: '실행 중', 
    animate: true 
  },
  QUEUED: { 
    icon: HourglassEmpty, 
    color: colors.queued, 
    bgGradient: `linear-gradient(135deg, ${alpha(colors.queued, 0.08)} 0%, ${alpha(colors.queued, 0.02)} 100%)`,
    label: '대기 중', 
    animate: false 
  },
  COMPLETED: { 
    icon: CheckCircle, 
    color: colors.success, 
    bgGradient: `linear-gradient(135deg, ${alpha(colors.success, 0.08)} 0%, ${alpha(colors.success, 0.02)} 100%)`,
    label: '완료', 
    animate: false 
  },
  FAILED: { 
    icon: ErrorIcon, 
    color: colors.error, 
    bgGradient: `linear-gradient(135deg, ${alpha(colors.error, 0.08)} 0%, ${alpha(colors.error, 0.02)} 100%)`,
    label: '실패', 
    animate: false 
  },
  PARTIAL: { 
    icon: Warning, 
    color: colors.warning, 
    bgGradient: `linear-gradient(135deg, ${alpha(colors.warning, 0.08)} 0%, ${alpha(colors.warning, 0.02)} 100%)`,
    label: '부분 완료', 
    animate: false 
  },
};

const COLLAPSE_STORAGE_KEY = 'runDetail_collapsed_v4';

// ============================================
// 미니 성공률 링 (아이콘 크기)
// ============================================

function MiniSuccessRing({ rate, size = 18 }: { rate: number; size?: number }) {
  const strokeWidth = 2;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (rate / 100) * circumference;
  const color = getSuccessRateColor(rate);

  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
    </Box>
  );
}

// ============================================
// 콤팩트 스탯 바 (성공/실패/전체/성공률) - 배지 스타일
// ============================================

function CompactStatsBar({
  successCount,
  failedCount,
  processedCount,
  totalTarget,
  successRate,
  status,
}: {
  successCount: number;
  failedCount: number;
  processedCount: number;
  totalTarget: number;
  successRate: number;
  status: RunStatus;
}) {
  const hasErrors = failedCount > 0;
  const rateColor = getSuccessRateColor(successRate);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {/* 성공 배지 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.375,
          borderRadius: 1.5,
          backgroundColor: alpha(colors.success, 0.1),
        }}
      >
        <CheckCircle sx={{ fontSize: 14, color: colors.success }} />
        <Typography
          sx={{
            fontFamily: monoFontFamily,
            fontSize: '0.8rem',
            fontWeight: 700,
            color: colors.success,
          }}
        >
          {successCount}
        </Typography>
      </Box>

      {/* 실패 배지 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.375,
          borderRadius: 1.5,
          backgroundColor: hasErrors ? alpha(colors.error, 0.1) : alpha('#000', 0.04),
        }}
      >
        <ErrorIcon sx={{ fontSize: 14, color: hasErrors ? colors.error : 'text.disabled' }} />
        <Typography
          sx={{
            fontFamily: monoFontFamily,
            fontSize: '0.8rem',
            fontWeight: 700,
            color: hasErrors ? colors.error : 'text.disabled',
          }}
        >
          {failedCount}
        </Typography>
      </Box>

      {/* 진행 배지 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.375,
          borderRadius: 1.5,
          backgroundColor: alpha(colors.running, 0.08),
        }}
      >
        <TrendingUp sx={{ fontSize: 14, color: colors.running }} />
        <Typography
          sx={{
            fontFamily: monoFontFamily,
            fontSize: '0.8rem',
            fontWeight: 700,
            color: colors.running,
          }}
        >
          {processedCount}/{totalTarget}
        </Typography>
      </Box>

      {/* 성공률 배지 (처리된 작업이 있을 때만) */}
      {processedCount > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.375,
            borderRadius: 1.5,
            backgroundColor: alpha(rateColor, 0.1),
          }}
        >
          <MiniSuccessRing rate={successRate} size={18} />
          <Typography
            sx={{
              fontFamily: monoFontFamily,
              fontSize: '0.8rem',
              fontWeight: 700,
              color: rateColor,
            }}
          >
            {successRate}%
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ============================================
// 프로그레스 바 (프리미엄)
// ============================================

function ProgressBar({ 
  progress, 
  status,
  animate = false,
}: { 
  progress: number; 
  status: RunStatus;
  animate?: boolean;
}) {
  const config = statusConfig[status];
  const isRunning = status === 'RUNNING';

  return (
    <Box sx={{ position: 'relative', width: '100%', height: 6, borderRadius: 3 }}>
      {/* 배경 트랙 */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundColor: alpha('#000', 0.04),
          borderRadius: 3,
        }}
      />
      
      {/* 진행 바 */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${progress}%`,
          borderRadius: 3,
          background: `linear-gradient(90deg, ${config.color} 0%, ${alpha(config.color, 0.7)} 100%)`,
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
      >
        {/* 시머 효과 (실행 중일 때만) */}
        {isRunning && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(90deg, transparent 0%, ${alpha('#fff', 0.4)} 50%, transparent 100%)`,
              animation: `${shimmer} 1.5s ease-in-out infinite`,
            }}
          />
        )}
      </Box>
    </Box>
  );
}


// ============================================
// 소요 시간 포맷팅
// ============================================

function formatElapsedTime(startedAt: string | null, updatedAt: string, isCompleted: boolean): { label: string; value: string } {
  if (!startedAt) return { label: '소요 시간', value: '—' };

  const start = new Date(startedAt).getTime();
  const end = new Date(updatedAt).getTime();
  const diffMs = Math.max(0, end - start);

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  let value: string;
  if (seconds < 1) value = '<1초';
  else if (hours > 0) value = `${hours}시간 ${minutes % 60}분`;
  else if (minutes > 0) value = `${minutes}분 ${seconds % 60}초`;
  else value = `${seconds}초`;

  return { label: isCompleted ? '총 소요' : '경과', value };
}

// ============================================
// 타임라인 탭 (프리미엄)
// ============================================

function TimelineTab({ run }: { run: ScheduleRunInfo }) {
  // 타임라인에 최근 3개 항목만 표시
  const events = run.recentEvents.slice(0, 3);

  if (events.length === 0) {
    return (
      <Box 
        sx={{ 
          py: 6, 
          textAlign: 'center',
          animation: `${fadeInUp} 0.4s ease-out`,
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: 3,
            backgroundColor: alpha('#000', 0.02),
            mb: 2,
          }}
        >
          <Timeline sx={{ fontSize: 32, color: 'text.disabled', opacity: 0.3 }} />
        </Box>
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'text.secondary' }}>
          아직 이벤트가 없습니다
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.5 }}>
          작업이 시작되면 여기에 표시됩니다
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', pl: 4 }}>
      {/* 타임라인 라인 */}
      <Box
        sx={{
          position: 'absolute',
          left: 11,
          top: 8,
          bottom: 8,
          width: 2,
          background: `linear-gradient(180deg, ${colors.running} 0%, ${alpha(colors.running, 0.1)} 100%)`,
          borderRadius: 1,
        }}
      />
      
      <Stack spacing={1.5}>
        {events.map((event, idx) => {
          const isSuccess = event.result === 'SUCCESS';
          const isLatest = idx === 0;
          const color = isSuccess ? colors.success : colors.error;
          
          return (
            <Box 
              key={idx} 
              sx={{ 
                position: 'relative',
                animation: `${fadeInUp} 0.4s ease-out`,
                animationDelay: `${idx * 0.05}s`,
                animationFillMode: 'both',
              }}
            >
              {/* 타임라인 도트 */}
              <Box
                sx={{
                  position: 'absolute',
                  left: -28,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: isLatest ? 16 : 12,
                  height: isLatest ? 16 : 12,
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: '3px solid white',
                  boxShadow: isLatest 
                    ? `0 0 0 4px ${alpha(color, 0.2)}, 0 2px 8px ${alpha(color, 0.3)}` 
                    : `0 2px 4px ${alpha('#000', 0.1)}`,
                  zIndex: 1,
                  transition: 'all 0.2s ease',
                }}
              />
              
              {/* 이벤트 카드 */}
              <Box
                sx={{
                  py: 1.5,
                  px: 2,
                  borderRadius: 2,
                  backgroundColor: isLatest 
                    ? alpha(color, 0.04)
                    : 'transparent',
                  border: '1px solid',
                  borderColor: isLatest 
                    ? alpha(color, 0.15)
                    : alpha('#000', 0.05),
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: alpha(color, 0.06),
                    borderColor: alpha(color, 0.2),
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {isSuccess ? (
                    <CheckCircle sx={{ fontSize: 18, color: colors.success }} />
                  ) : (
                    <ErrorIcon sx={{ fontSize: 18, color: colors.error }} />
                  )}
                  
                  <Typography
                    sx={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: color,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <Box 
                      component="span" 
                      sx={{ 
                        fontFamily: monoFontFamily,
                        fontSize: '0.8rem',
                        opacity: 0.8,
                      }}
                    >
                      #{event.index}
                    </Box>
                    <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>/</Box>
                    <Box component="span" sx={{ fontFamily: monoFontFamily, fontSize: '0.8rem', color: 'text.secondary', fontWeight: 500 }}>
                      {run.totalTarget}
                    </Box>
                    <Box component="span" sx={{ ml: 0.5 }}>
                      {isSuccess ? '게시 성공' : '게시 실패'}
                    </Box>
                  </Typography>
                  
                  {event.errorCode && (
                    <Chip
                      size="small"
                      label={event.errorCode}
                      sx={{
                        height: 22,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        fontFamily: monoFontFamily,
                        backgroundColor: alpha(colors.error, 0.1),
                        color: colors.error,
                        border: 'none',
                        ml: 'auto',
                      }}
                    />
                  )}
                  
                  <Typography 
                    sx={{ 
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      fontFamily: monoFontFamily,
                      color: 'text.disabled',
                      ml: event.errorCode ? 0 : 'auto',
                    }}
                  >
                    {new Date(event.createdAt).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </Typography>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

// ============================================
// 에러 탭 (프리미엄)
// ============================================

function ErrorsTab({ run, onRetry }: { run: ScheduleRunInfo; onRetry?: () => void }) {
  const failedEvents = run.recentEvents.filter(e => e.result === 'FAILED');

  if (failedEvents.length === 0) {
    return (
      <Box 
        sx={{ 
          py: 6, 
          textAlign: 'center',
          animation: `${fadeInUp} 0.4s ease-out`,
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: 3,
            background: `linear-gradient(135deg, ${alpha(colors.success, 0.15)} 0%, ${alpha(colors.success, 0.05)} 100%)`,
            mb: 2,
          }}
        >
          <CheckCircle sx={{ fontSize: 32, color: colors.success }} />
        </Box>
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: colors.success }}>
          모든 작업이 성공했습니다
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.5 }}>
          실패한 작업이 없습니다
        </Typography>
      </Box>
    );
  }

  // 에러 코드별 그룹핑
  const errorGroups = failedEvents.reduce((acc, event) => {
    const code = event.errorCode || 'UNKNOWN';
    if (!acc[code]) acc[code] = [];
    acc[code].push(event);
    return acc;
  }, {} as Record<string, typeof failedEvents>);

  return (
    <Stack spacing={2.5} sx={{ animation: `${fadeInUp} 0.4s ease-out` }}>
      {/* 에러 요약 헤더 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2.5,
          borderRadius: 2.5,
          background: `linear-gradient(135deg, ${alpha(colors.error, 0.08)} 0%, ${alpha(colors.error, 0.02)} 100%)`,
          border: '1px solid',
          borderColor: alpha(colors.error, 0.15),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              background: `linear-gradient(135deg, ${alpha(colors.error, 0.15)} 0%, ${alpha(colors.error, 0.08)} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ErrorIcon sx={{ fontSize: 24, color: colors.error }} />
          </Box>
          <Box>
            <Typography 
              sx={{ 
                fontSize: '1.25rem', 
                fontWeight: 800, 
                color: colors.error,
                fontFamily: monoFontFamily,
              }}
            >
              {run.failedCount}건 실패
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {Object.keys(errorGroups).length}종류의 에러 발생
            </Typography>
          </Box>
        </Box>
        {onRetry && (
          <Button
            variant="contained"
            size="small"
            startIcon={<Replay sx={{ fontSize: 16 }} />}
            onClick={onRetry}
            sx={{
              fontSize: '0.8rem',
              fontWeight: 700,
              borderRadius: 2,
              px: 2.5,
              py: 1,
              backgroundColor: colors.error,
              boxShadow: `0 4px 12px ${alpha(colors.error, 0.3)}`,
              '&:hover': { 
                backgroundColor: colors.error,
                boxShadow: `0 6px 16px ${alpha(colors.error, 0.4)}`,
                transform: 'translateY(-1px)',
              },
            }}
          >
            재시도
          </Button>
        )}
      </Box>

      {/* 에러 코드별 상세 */}
      {Object.entries(errorGroups).map(([code, events], idx) => (
        <Box
          key={code}
          sx={{
            p: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: alpha('#000', 0.06),
            backgroundColor: alpha('#000', 0.01),
            animation: `${fadeInUp} 0.4s ease-out`,
            animationDelay: `${idx * 0.1}s`,
            animationFillMode: 'both',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Chip
              size="small"
              label={code}
              sx={{
                height: 24,
                fontSize: '0.7rem',
                fontWeight: 700,
                fontFamily: monoFontFamily,
                backgroundColor: alpha(colors.error, 0.1),
                color: colors.error,
              }}
            />
            <Typography 
              sx={{ 
                fontSize: '0.85rem', 
                fontWeight: 700,
                color: 'text.primary',
              }}
            >
              {events.length}건
            </Typography>
          </Box>
          <Typography 
            sx={{ 
              fontSize: '0.75rem',
              fontFamily: monoFontFamily,
              color: 'text.secondary',
            }}
          >
            작업 번호: #{events.map(e => e.index).join(', #')}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

// ============================================
// Run Detail - 프리미엄 v4 메인 컴포넌트
// ============================================

export default function RunDetail({
  run,
  onViewLogs,
  onRetry,
  onDownloadLogs,
  loading = false,
}: RunDetailProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [activeTab, setActiveTab] = useState<'timeline' | 'errors'>('timeline');
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
  });

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const newValue = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(newValue));
      return newValue;
    });
  }, []);

  const computed = useMemo(() => {
    if (!run) return null;
    const progress = calculateProgress(run.processedCount, run.totalTarget);
    const successRate = calculateSuccessRate(run.successCount, run.processedCount);
    const isCompleted = run.status === 'COMPLETED' || run.status === 'FAILED' || run.status === 'PARTIAL';
    const elapsedTime = formatElapsedTime(run.startedAt, run.updatedAt, isCompleted);
    const remaining = Math.max(0, run.totalTarget - run.processedCount);
    return { progress, successRate, isCompleted, elapsedTime, remaining };
  }, [run]);

  // 빈 상태
  if (!run) {
    return (
      <Box
        sx={{
          p: 4,
          borderRadius: 2,
          textAlign: 'center',
          animation: `${fadeInUp} 0.3s ease-out`,
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            height: 80,
            borderRadius: 3,
            backgroundColor: alpha('#000', 0.02),
            mb: 3,
          }}
        >
          <Schedule sx={{ fontSize: 40, color: 'text.disabled', opacity: 0.3 }} />
        </Box>
        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>
          실행 정보를 선택해주세요
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>
          왼쪽 목록에서 실행을 선택하면 상세 정보가 표시됩니다
        </Typography>
      </Box>
    );
  }

  const config = statusConfig[run.status];
  const StatusIcon = config.icon;
  const hasErrors = run.failedCount > 0;
  const isRunning = run.status === 'RUNNING';

  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        animation: `${fadeInUp} 0.3s ease-out`,
      }}
    >
      {/* ========== 헤더 섹션 ========== */}
      <Box
        role="button"
        tabIndex={0}
        onDoubleClick={toggleCollapse}
        sx={{
          px: 3,
          py: 2.5,
          background: config.bgGradient,
          borderBottom: isCollapsed ? 'none' : '1px solid',
          borderColor: alpha(config.color, 0.1),
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.2s ease',
          '&:hover': { 
            background: `linear-gradient(135deg, ${alpha(config.color, 0.1)} 0%, ${alpha(config.color, 0.03)} 100%)`,
          },
        }}
      >
        {/* 상태 아이콘 */}
        <Box
          sx={{
            position: 'relative',
            width: 52,
            height: 52,
            borderRadius: 2.5,
            backgroundColor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid',
            borderColor: alpha(config.color, 0.2),
            boxShadow: `0 4px 12px ${alpha(config.color, 0.15)}`,
            ...(isRunning && {
              animation: `${pulseGlow} 2s ease-in-out infinite`,
            }),
          }}
        >
          {/* 회전 글로우 (실행 중일 때) */}
          {isRunning && (
            <Box
              sx={{
                position: 'absolute',
                inset: -2,
                borderRadius: 3,
                background: `conic-gradient(from 0deg, transparent, ${alpha(config.color, 0.3)}, transparent)`,
                animation: `${rotateGlow} 2s linear infinite`,
                opacity: 0.5,
              }}
            />
          )}
          <StatusIcon
            sx={{
              fontSize: 26,
              color: config.color,
              position: 'relative',
              zIndex: 1,
            }}
          />
        </Box>

        {/* 타이틀 영역 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography 
            sx={{ 
              fontSize: '1.1rem', 
              fontWeight: 800, 
              color: config.color,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            {config.label}
            {isRunning && (
              <Bolt sx={{ fontSize: 16, color: config.color, opacity: 0.7 }} />
            )}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.8rem',
              fontWeight: 500,
              color: 'text.secondary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {run.scheduleName}
          </Typography>
        </Box>

        {/* 우측 액션 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            size="small"
            icon={<AccessTime sx={{ fontSize: 14 }} />}
            label={formatTimeWithRelative(run.updatedAt)}
            sx={{
              height: 28,
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: 'white',
              border: '1px solid',
              borderColor: alpha('#000', 0.08),
              boxShadow: `0 2px 4px ${alpha('#000', 0.04)}`,
            }}
          />

          {onViewLogs && (
            <Tooltip title="상세 로그">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewLogs(run.id);
                }}
                sx={{
                  width: 32,
                  height: 32,
                  backgroundColor: 'white',
                  border: '1px solid',
                  borderColor: alpha('#000', 0.08),
                  boxShadow: `0 2px 4px ${alpha('#000', 0.04)}`,
                  '&:hover': { 
                    backgroundColor: alpha(colors.running, 0.05),
                    borderColor: alpha(colors.running, 0.2),
                  },
                }}
              >
                <OpenInNew sx={{ fontSize: 16 }} color="primary" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title={isCollapsed ? '펼치기' : '접기'}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse();
              }}
              sx={{
                width: 32,
                height: 32,
                backgroundColor: 'white',
                border: '1px solid',
                borderColor: alpha('#000', 0.08),
                boxShadow: `0 2px 4px ${alpha('#000', 0.04)}`,
                '&:hover': { 
                  backgroundColor: alpha('#000', 0.02),
                },
              }}
            >
              {isCollapsed ? <KeyboardArrowDown sx={{ fontSize: 18 }} /> : <KeyboardArrowUp sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ========== 접힌 상태 요약 ========== */}
      {isCollapsed && computed && (
        <Box
          sx={{
            px: 3,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            flexWrap: 'wrap',
            backgroundColor: alpha('#000', 0.01),
          }}
        >
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: monoFontFamily }}>
            <Box component="span" sx={{ color: colors.success }}>성공 {run.successCount}</Box>
            <Box component="span" sx={{ mx: 1, color: 'text.disabled' }}>·</Box>
            <Box component="span" sx={{ color: hasErrors ? colors.error : 'text.secondary' }}>
              실패 {run.failedCount}
            </Box>
            <Box component="span" sx={{ mx: 1, color: 'text.disabled' }}>·</Box>
            <Box component="span" sx={{ color: colors.running }}>
              {run.processedCount}/{run.totalTarget}
            </Box>
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400, ml: 0.5 }}>
              ({computed.progress}%)
            </Box>
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', ml: 'auto' }}>
            {computed.elapsedTime.label} {computed.elapsedTime.value}
          </Typography>
        </Box>
      )}

      {/* ========== 펼쳐진 상세 내용 ========== */}
      <Collapse in={!isCollapsed} timeout={300}>
        {computed && (
          <Box>
            {/* 통합 스탯 영역 - 프로그레스 바 + 스탯 */}
            <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid', borderColor: alpha('#000', 0.05) }}>
              {/* 프로그레스 바 */}
              <ProgressBar progress={computed.progress} status={run.status} animate={isRunning} />
              
              {/* 스탯 + 시간 (가로 한 줄) */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mt: 2,
                  flexWrap: 'wrap',
                  gap: 1.5,
                }}
              >
                {/* 좌측: 스탯 바 */}
                <CompactStatsBar
                  successCount={run.successCount}
                  failedCount={run.failedCount}
                  processedCount={run.processedCount}
                  totalTarget={run.totalTarget}
                  successRate={computed.successRate}
                  status={run.status}
                />

                {/* 우측: 소요 시간 + 남은 작업 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
                    {computed.elapsedTime.label}
                    <Box 
                      component="span" 
                      sx={{ fontWeight: 700, fontFamily: monoFontFamily, color: 'text.secondary', ml: 0.5 }}
                    >
                      {computed.elapsedTime.value}
                    </Box>
                  </Typography>

                  {!computed.isCompleted && computed.remaining > 0 && (
                    <Typography 
                      sx={{ 
                        fontSize: '0.7rem', 
                        fontWeight: 600, 
                        color: colors.running,
                      }}
                    >
                      · {computed.remaining}개 남음
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {/* 탭 영역 */}
            <Box>
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                sx={{
                  px: 3,
                  minHeight: 48,
                  borderBottom: '1px solid',
                  borderColor: alpha('#000', 0.05),
                  '& .MuiTab-root': {
                    minHeight: 48,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    color: 'text.secondary',
                    '&.Mui-selected': {
                      color: 'text.primary',
                    },
                  },
                  '& .MuiTabs-indicator': {
                    height: 3,
                    borderRadius: '3px 3px 0 0',
                    backgroundColor: colors.running,
                  },
                }}
              >
                <Tab
                  icon={<Timeline sx={{ fontSize: 18 }} />}
                  iconPosition="start"
                  label="타임라인"
                  value="timeline"
                />
                <Tab
                  icon={<ErrorIcon sx={{ fontSize: 18, color: hasErrors ? colors.error : 'inherit' }} />}
                  iconPosition="start"
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      에러
                      {hasErrors && (
                        <Chip
                          size="small"
                          label={run.failedCount}
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            fontFamily: monoFontFamily,
                            backgroundColor: alpha(colors.error, 0.12),
                            color: colors.error,
                          }}
                        />
                      )}
                    </Box>
                  }
                  value="errors"
                />
              </Tabs>

              <Box sx={{ p: 3, minHeight: 200 }}>
                {activeTab === 'timeline' && <TimelineTab run={run} />}
                {activeTab === 'errors' && (
                  <ErrorsTab 
                    run={run} 
                    onRetry={onRetry ? () => onRetry(run.id) : undefined} 
                  />
                )}
              </Box>
            </Box>

            {/* 하단 액션 바 */}
            {(onRetry || onDownloadLogs) && (
              <Box
                sx={{
                  px: 3,
                  py: 2,
                  borderTop: '1px solid',
                  borderColor: alpha('#000', 0.05),
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 1.5,
                  backgroundColor: alpha('#000', 0.01),
                }}
              >
                {onDownloadLogs && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Download sx={{ fontSize: 16 }} />}
                    onClick={() => onDownloadLogs(run.id)}
                    sx={{ 
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: 2,
                      px: 2,
                      borderColor: alpha('#000', 0.15),
                      '&:hover': {
                        borderColor: alpha('#000', 0.25),
                        backgroundColor: alpha('#000', 0.02),
                      },
                    }}
                  >
                    로그 다운로드
                  </Button>
                )}
                {onRetry && hasErrors && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Replay sx={{ fontSize: 16 }} />}
                    onClick={() => onRetry(run.id)}
                    sx={{ 
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      borderRadius: 2,
                      px: 2.5,
                      backgroundColor: colors.error,
                      boxShadow: `0 4px 12px ${alpha(colors.error, 0.25)}`,
                      '&:hover': { 
                        backgroundColor: colors.error,
                        boxShadow: `0 6px 16px ${alpha(colors.error, 0.35)}`,
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    실패 작업 재시도
                  </Button>
                )}
              </Box>
            )}
          </Box>
        )}
      </Collapse>
    </Box>
  );
}
