'use client';

/**
 * Run Detail 컴포넌트 - 프리미엄 v3
 * 
 * Linear/Notion 스타일 콘솔 감성:
 * - 타이포그래피 토큰 적용
 * - tabular-nums로 숫자 정렬
 * - 담백하고 전문적인 UI
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
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
  Timer,
  TrendingUp,
  Replay,
  Download,
  Timeline,
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

const statusConfig: Record<RunStatus, {
  icon: typeof PlayCircle;
  color: string;
  label: string;
  animate: boolean;
}> = {
  RUNNING: { icon: PlayCircle, color: colors.running, label: '실행 중', animate: true },
  QUEUED: { icon: HourglassEmpty, color: colors.queued, label: '대기 중', animate: false },
  COMPLETED: { icon: CheckCircle, color: colors.success, label: '완료', animate: false },
  FAILED: { icon: ErrorIcon, color: colors.error, label: '실패', animate: false },
  PARTIAL: { icon: Warning, color: colors.warning, label: '부분 완료', animate: false },
};

const COLLAPSE_STORAGE_KEY = 'runDetail_collapsed_v3';

/**
 * 성공률 도넛 링
 */
function SuccessRateRing({ rate, size = 72 }: { rate: number; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (rate / 100) * circumference;
  const color = getSuccessRateColor(rate);

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,0.04)"
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
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <Typography
          sx={{
            ...typography.kpiNumberMedium,
            fontFamily: monoFontFamily,
            fontSize: '1.25rem',
            color,
            lineHeight: 1,
          }}
        >
          {rate}%
        </Typography>
        <Typography sx={{ ...typography.label, fontSize: '0.55rem', mt: 0.25 }}>
          성공률
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * KPI 카드
 */
function KPICard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: typeof CheckCircle;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 90,
        textAlign: 'center',
        py: 2,
        px: 1.5,
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: '20%',
          bottom: '20%',
          width: 3,
          borderRadius: 1.5,
          backgroundColor: color,
        },
      }}
    >
      <Icon sx={{ fontSize: 20, color, mb: 0.75 }} />
      <Typography
        sx={{
          ...typography.kpiNumberMedium,
          fontFamily: monoFontFamily,
          color,
        }}
      >
        {value}
      </Typography>
      <Typography sx={{ ...typography.label, mt: 0.5 }}>
        {label}
      </Typography>
      {subValue && (
        <Typography sx={{ ...typography.helper, mt: 0.25 }}>
          {subValue}
        </Typography>
      )}
    </Box>
  );
}

/**
 * 소요 시간 포맷팅
 */
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

/**
 * 타임라인 탭
 */
function TimelineTab({ run }: { run: ScheduleRunInfo }) {
  const events = run.recentEvents.slice(0, 15);

  if (events.length === 0) {
    return (
      <Box sx={{ py: 5, textAlign: 'center' }}>
        <Timeline sx={{ fontSize: 36, color: 'text.disabled', opacity: 0.15, mb: 1.5 }} />
        <Typography sx={{ ...typography.cardTitle, color: 'text.secondary' }}>
          아직 이벤트가 없습니다
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', pl: 3.5 }}>
      <Box
        sx={{
          position: 'absolute',
          left: 10,
          top: 0,
          bottom: 0,
          width: 2,
          backgroundColor: 'divider',
        }}
      />
      
      <Stack spacing={1.5}>
        {events.map((event, idx) => {
          const isSuccess = event.result === 'SUCCESS';
          const isLatest = idx === 0;
          
          return (
            <Box key={idx} sx={{ position: 'relative' }}>
              <Box
                sx={{
                  position: 'absolute',
                  left: -26,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: isLatest ? 14 : 10,
                  height: isLatest ? 14 : 10,
                  borderRadius: '50%',
                  backgroundColor: isSuccess ? colors.success : colors.error,
                  border: '2px solid white',
                  boxShadow: isLatest 
                    ? `0 0 0 3px ${alpha(isSuccess ? colors.success : colors.error, 0.15)}` 
                    : '0 0 3px rgba(0,0,0,0.08)',
                }}
              />
              
              <Box
                sx={{
                  py: 1.25,
                  px: 1.5,
                  borderRadius: 1.5,
                  backgroundColor: isSuccess 
                    ? alpha(colors.success, 0.03)
                    : alpha(colors.error, 0.03),
                  border: '1px solid',
                  borderColor: isSuccess 
                    ? alpha(colors.success, 0.12)
                    : alpha(colors.error, 0.12),
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  {isSuccess ? (
                    <CheckCircle sx={{ fontSize: 16, color: colors.success }} />
                  ) : (
                    <ErrorIcon sx={{ fontSize: 16, color: colors.error }} />
                  )}
                  <Typography
                    sx={{
                      ...typography.cardTitle,
                      fontSize: '0.8rem',
                      color: isSuccess ? colors.success : colors.error,
                    }}
                  >
                    <Box component="span" sx={{ fontFamily: monoFontFamily }}>#{event.index}</Box>
                    /{run.totalTarget} {isSuccess ? '게시 성공' : '게시 실패'}
                  </Typography>
                  
                  {event.errorCode && (
                    <Chip
                      size="small"
                      label={event.errorCode}
                      sx={{
                        height: 20,
                        ...typography.chip,
                        fontFamily: monoFontFamily,
                        backgroundColor: alpha(colors.error, 0.08),
                        color: colors.error,
                        ml: 'auto',
                      }}
                    />
                  )}
                  
                  <Typography sx={{ ...typography.timestamp, ml: event.errorCode ? 0 : 'auto' }}>
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

/**
 * 에러 탭
 */
function ErrorsTab({ run, onRetry }: { run: ScheduleRunInfo; onRetry?: () => void }) {
  const failedEvents = run.recentEvents.filter(e => e.result === 'FAILED');

  if (failedEvents.length === 0) {
    return (
      <Box sx={{ py: 5, textAlign: 'center' }}>
        <CheckCircle sx={{ fontSize: 40, color: colors.success, opacity: 0.25, mb: 1.5 }} />
        <Typography sx={{ ...typography.cardTitle, color: 'text.secondary' }}>
          실패한 작업이 없습니다
        </Typography>
      </Box>
    );
  }

  const errorGroups = failedEvents.reduce((acc, event) => {
    const code = event.errorCode || 'UNKNOWN';
    if (!acc[code]) acc[code] = [];
    acc[code].push(event);
    return acc;
  }, {} as Record<string, typeof failedEvents>);

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderRadius: 2,
          backgroundColor: alpha(colors.error, 0.03),
          border: '1px solid',
          borderColor: alpha(colors.error, 0.15),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              backgroundColor: alpha(colors.error, 0.08),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ErrorIcon sx={{ fontSize: 22, color: colors.error }} />
          </Box>
          <Box>
            <Typography sx={{ ...typography.kpiNumberSmall, color: colors.error }}>
              {run.failedCount}건 실패
            </Typography>
            <Typography sx={{ ...typography.helper }}>
              {Object.keys(errorGroups).length}종류 에러
            </Typography>
          </Box>
        </Box>
        {onRetry && (
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<Replay sx={{ fontSize: 14 }} />}
            onClick={onRetry}
            sx={{
              ...typography.chip,
              borderRadius: 1.5,
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            재시도
          </Button>
        )}
      </Box>

      {Object.entries(errorGroups).map(([code, events]) => (
        <Box
          key={code}
          sx={{
            p: 1.5,
            borderRadius: 1.5,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip
              size="small"
              label={code}
              sx={{
                height: 22,
                ...typography.chip,
                fontFamily: monoFontFamily,
                backgroundColor: alpha(colors.error, 0.08),
                color: colors.error,
              }}
            />
            <Typography sx={{ ...typography.labelNormal, fontWeight: 600 }}>
              {events.length}건
            </Typography>
          </Box>
          <Typography sx={{ ...typography.helper, fontFamily: monoFontFamily }}>
            작업: #{events.map(e => e.index).join(', #')}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

/**
 * Run Detail - 프리미엄 v3
 */
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

  if (!run) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 5,
          borderRadius: 2.5,
          border: '1px dashed',
          borderColor: 'divider',
          backgroundColor: alpha('#000', 0.01),
          textAlign: 'center',
        }}
      >
        <Schedule sx={{ fontSize: 48, color: 'text.disabled', mb: 2, opacity: 0.15 }} />
        <Typography sx={{ ...typography.sectionTitle, color: 'text.secondary', mb: 0.5 }}>
          실행 정보를 선택해주세요
        </Typography>
        <Typography sx={{ ...typography.helper }}>
          왼쪽 목록에서 실행을 선택하면 상세 정보가 표시됩니다
        </Typography>
      </Paper>
    );
  }

  const config = statusConfig[run.status];
  const StatusIcon = config.icon;
  const hasErrors = run.failedCount > 0;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {/* 헤더 */}
      <Box
        role="button"
        tabIndex={0}
        onDoubleClick={toggleCollapse}
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: isCollapsed ? 'none' : '1px solid',
          borderColor: 'divider',
          backgroundColor: alpha(config.color, 0.03),
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background-color 0.12s ease',
          '&:hover': { backgroundColor: alpha(config.color, 0.05) },
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            backgroundColor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid',
            borderColor: alpha(config.color, 0.15),
          }}
        >
          <StatusIcon
            sx={{
              fontSize: 22,
              color: config.color,
              animation: config.animate ? 'pulse 1.5s ease-in-out infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.35 },
              },
            }}
          />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ ...typography.sectionTitle, color: config.color }}>
            {config.label}
          </Typography>
          <Typography
            sx={{
              ...typography.helper,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {run.scheduleName}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Chip
            size="small"
            icon={<AccessTime sx={{ fontSize: 12 }} />}
            label={formatTimeWithRelative(run.updatedAt)}
            sx={{
              height: 24,
              ...typography.chip,
              backgroundColor: 'white',
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
                  width: 28,
                  height: 28,
                  backgroundColor: 'white',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { backgroundColor: alpha('#000', 0.02) },
                }}
              >
                <OpenInNew sx={{ fontSize: 14 }} color="primary" />
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
                width: 28,
                height: 28,
                backgroundColor: 'white',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': { backgroundColor: alpha('#000', 0.02) },
              }}
            >
              {isCollapsed ? <KeyboardArrowDown sx={{ fontSize: 16 }} /> : <KeyboardArrowUp sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 접힌 요약 */}
      {isCollapsed && computed && (
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 2.5,
            flexWrap: 'wrap',
            backgroundColor: alpha('#000', 0.01),
          }}
        >
          <Typography sx={{ ...typography.cardTitle, fontFamily: monoFontFamily }}>
            <Box component="span" sx={{ color: colors.success }}>성공 {run.successCount}</Box>
            <Box component="span" sx={{ mx: 0.75, color: 'text.disabled' }}>·</Box>
            <Box component="span" sx={{ color: hasErrors ? colors.error : 'text.secondary' }}>
              실패 {run.failedCount}
            </Box>
            <Box component="span" sx={{ mx: 0.75, color: 'text.disabled' }}>·</Box>
            <Box component="span" sx={{ color: colors.running }}>
              {run.processedCount}/{run.totalTarget}
            </Box>
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400, ml: 0.5 }}>
              ({computed.progress}%)
            </Box>
          </Typography>
          <Typography sx={{ ...typography.timestamp, ml: 'auto' }}>
            {computed.elapsedTime.label} {computed.elapsedTime.value}
          </Typography>
        </Box>
      )}

      {/* 펼쳐진 상세 */}
      <Collapse in={!isCollapsed} timeout={200}>
        {computed && (
          <Box>
            {/* KPI 카드 */}
            <Box
              sx={{
                px: 2.5,
                py: 2.5,
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'center' },
                gap: { xs: 1.5, sm: 2 },
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flex: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <KPICard icon={CheckCircle} label="성공" value={run.successCount} color={colors.success} />
                <Box sx={{ width: 1, backgroundColor: 'divider' }} />
                <KPICard icon={ErrorIcon} label="실패" value={run.failedCount} color={hasErrors ? colors.error : colors.queued} />
                <Box sx={{ width: 1, backgroundColor: 'divider' }} />
                <KPICard
                  icon={TrendingUp}
                  label="전체"
                  value={`${run.processedCount}/${run.totalTarget}`}
                  subValue={`${computed.progress}%`}
                  color={colors.running}
                />
              </Box>

              {run.processedCount > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <SuccessRateRing rate={computed.successRate} size={72} />
                </Box>
              )}
            </Box>

            {/* 보조 지표 */}
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
                borderBottom: '1px solid',
                borderColor: 'divider',
                backgroundColor: alpha('#000', 0.01),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Timer sx={{ fontSize: 15, color: 'text.secondary' }} />
                <Typography sx={{ ...typography.helper }}>
                  <Box component="span">{computed.elapsedTime.label}: </Box>
                  <Box component="span" sx={{ fontWeight: 600, fontFamily: monoFontFamily }}>{computed.elapsedTime.value}</Box>
                </Typography>
              </Box>

              {!computed.isCompleted && computed.remaining > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.375,
                    borderRadius: 1.25,
                    backgroundColor: alpha(colors.running, 0.06),
                  }}
                >
                  <HourglassEmpty sx={{ fontSize: 13, color: colors.running }} />
                  <Typography sx={{ ...typography.chip, color: colors.running, fontFamily: monoFontFamily }}>
                    남은 작업 {computed.remaining}개
                  </Typography>
                </Box>
              )}
            </Box>

            {/* 탭 */}
            <Box>
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                sx={{
                  px: 2.5,
                  minHeight: 42,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '& .MuiTab-root': {
                    minHeight: 42,
                    ...typography.cardTitle,
                    textTransform: 'none',
                  },
                }}
              >
                <Tab
                  icon={<Timeline sx={{ fontSize: 16 }} />}
                  iconPosition="start"
                  label="타임라인"
                  value="timeline"
                />
                <Tab
                  icon={<ErrorIcon sx={{ fontSize: 16, color: hasErrors ? colors.error : 'inherit' }} />}
                  iconPosition="start"
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      에러
                      {hasErrors && (
                        <Chip
                          size="small"
                          label={run.failedCount}
                          sx={{
                            height: 18,
                            ...typography.chip,
                            fontFamily: monoFontFamily,
                            backgroundColor: alpha(colors.error, 0.1),
                            color: colors.error,
                          }}
                        />
                      )}
                    </Box>
                  }
                  value="errors"
                />
              </Tabs>

              <Box sx={{ p: 2.5, minHeight: 180 }}>
                {activeTab === 'timeline' && <TimelineTab run={run} />}
                {activeTab === 'errors' && (
                  <ErrorsTab 
                    run={run} 
                    onRetry={onRetry ? () => onRetry(run.id) : undefined} 
                  />
                )}
              </Box>
            </Box>

            {/* 하단 액션 */}
            {(onRetry || onDownloadLogs) && (
              <Box
                sx={{
                  px: 2.5,
                  py: 1.5,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 1,
                  backgroundColor: alpha('#000', 0.01),
                }}
              >
                {onDownloadLogs && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Download sx={{ fontSize: 14 }} />}
                    onClick={() => onDownloadLogs(run.id)}
                    sx={{ ...typography.chip, borderRadius: 1.5 }}
                  >
                    로그 다운로드
                  </Button>
                )}
                {onRetry && hasErrors && (
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    startIcon={<Replay sx={{ fontSize: 14 }} />}
                    onClick={() => onRetry(run.id)}
                    sx={{ ...typography.chip, borderRadius: 1.5, boxShadow: 'none' }}
                  >
                    실패 작업 재시도
                  </Button>
                )}
              </Box>
            )}
          </Box>
        )}
      </Collapse>
    </Paper>
  );
}
