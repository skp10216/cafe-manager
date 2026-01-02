'use client';

/**
 * Global Run Overview 컴포넌트 - 프리미엄 v4
 * 
 * Linear/Notion 스타일 콘솔 감성:
 * - KPI 4개를 가로 그리드로 배치 (Desktop 4열, Mobile 2열)
 * - 타이포그래피 토큰 적용 (tabular-nums)
 * - 담백하고 전문적인 UI
 */

import { useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  alpha,
  Tooltip,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  PlayCircle,
  CheckCircle,
  Error as ErrorIcon,
  Refresh,
  FilterList,
  Timer,
  Speed,
  TrendingUp,
  Warning,
} from '@mui/icons-material';
import { GlobalRunOverview as GlobalOverviewData, RunFilter, ScheduleRunInfo } from '@/types/multi-run';
import { typography, colors, getSuccessRateColor } from '@/lib/typography';

interface GlobalRunOverviewProps {
  overview: GlobalOverviewData;
  currentFilter: RunFilter;
  onFilterChange: (filter: RunFilter) => void;
  onRefresh?: () => void;
  loading?: boolean;
  runs?: ScheduleRunInfo[];
}

/**
 * 컴팩트 KPI 카드 - Linear 스타일
 */
function CompactKPICard({
  icon: Icon,
  label,
  value,
  subLabel,
  accentColor,
  pulse = false,
}: {
  icon: typeof PlayCircle;
  label: string;
  value: string | number;
  subLabel?: string;
  accentColor: string;
  pulse?: boolean;
}) {
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        height: { xs: 72, sm: 76 },
        px: { xs: 1.5, sm: 2 },
        py: 1.5,
        borderRadius: 2,
        backgroundColor: alpha(accentColor, 0.03),
        border: '1px solid',
        borderColor: alpha(accentColor, 0.12),
        overflow: 'hidden',
        transition: 'all 0.15s ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: accentColor,
        },
        '&:hover': {
          backgroundColor: alpha(accentColor, 0.05),
          borderColor: alpha(accentColor, 0.2),
        },
      }}
    >
      {/* 아이콘 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: { xs: 34, sm: 38 },
          height: { xs: 34, sm: 38 },
          borderRadius: 1.5,
          backgroundColor: alpha(accentColor, 0.08),
          flexShrink: 0,
        }}
      >
        <Icon
          sx={{
            fontSize: { xs: 18, sm: 20 },
            color: accentColor,
            animation: pulse ? 'kpiPulse 1.5s ease-in-out infinite' : 'none',
            '@keyframes kpiPulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.4 },
            },
          }}
        />
      </Box>

      {/* 텍스트 영역 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* 라벨 */}
        <Typography sx={{ ...typography.label, mb: 0.25 }}>
          {label}
        </Typography>
        
        {/* 값 */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
          <Typography
            sx={{
              ...typography.kpiNumberMedium,
              color: accentColor,
            }}
          >
            {value}
          </Typography>
          {subLabel && (
            <Typography sx={{ ...typography.helper, fontSize: '0.7rem' }}>
              {subLabel}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Global Run Overview - 프리미엄 v4
 */
export default function GlobalRunOverview({
  overview,
  currentFilter,
  onFilterChange,
  onRefresh,
  loading = false,
  runs = [],
}: GlobalRunOverviewProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    runningCount,
    totalProcessed,
    totalTarget,
    totalSuccess,
    totalFailed,
    hasSessionError,
    lastUpdated,
  } = overview;

  const computed = useMemo(() => {
    const progress = totalTarget > 0 ? Math.round((totalProcessed / totalTarget) * 100) : 0;
    const successRate = totalProcessed > 0 ? Math.round((totalSuccess / totalProcessed) * 100) : 100;
    const queuedCount = runs.filter(r => r.status === 'QUEUED').length;
    const completedCount = runs.filter(r => 
      r.status === 'COMPLETED' || r.status === 'FAILED' || r.status === 'PARTIAL'
    ).length;
    const failedRunCount = runs.filter(r => r.status === 'FAILED' || r.status === 'PARTIAL').length;
    
    return { progress, successRate, queuedCount, completedCount, failedRunCount };
  }, [totalTarget, totalProcessed, totalSuccess, runs]);

  const filters: { value: RunFilter; label: string; count?: number }[] = [
    { value: 'ALL', label: '전체', count: runs.length },
    { value: 'RUNNING', label: '실행중', count: runningCount + computed.queuedCount },
    { value: 'COMPLETED', label: '완료', count: computed.completedCount },
    { value: 'FAILED', label: '실패', count: computed.failedRunCount },
  ];

  // 아무 데이터도 없으면 렌더링 안함
  if (totalTarget === 0 && runningCount === 0 && runs.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        borderRadius: 2.5,
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {/* 세션 오류 경고 배너 */}
      {hasSessionError && (
        <Box
          sx={{
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            backgroundColor: alpha(colors.error, 0.04),
            borderBottom: '1px solid',
            borderColor: alpha(colors.error, 0.12),
          }}
        >
          <Warning sx={{ fontSize: 16, color: colors.error }} />
          <Typography sx={{ ...typography.helper, color: colors.error, fontWeight: 500 }}>
            세션 오류가 감지되었습니다. 네이버 연동 상태를 확인하세요.
          </Typography>
        </Box>
      )}

      <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
        {/* ========== KPI 그리드 ========== */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(4, 1fr)',
            },
            gap: { xs: 1.25, sm: 1.5 },
            mb: 2,
          }}
        >
          {/* KPI 1: 실행중 */}
          <CompactKPICard
            icon={PlayCircle}
            label="실행중"
            value={runningCount}
            subLabel={computed.queuedCount > 0 ? `+${computed.queuedCount} 대기` : undefined}
            accentColor={runningCount > 0 ? colors.running : colors.queued}
            pulse={runningCount > 0}
          />

          {/* KPI 2: 성공 */}
          <CompactKPICard
            icon={CheckCircle}
            label="성공"
            value={totalSuccess}
            accentColor={colors.success}
          />

          {/* KPI 3: 전체 진행 */}
          <CompactKPICard
            icon={Speed}
            label="전체 진행"
            value={totalTarget > 0 ? `${computed.progress}%` : '-'}
            subLabel={totalTarget > 0 ? `${totalProcessed}/${totalTarget}` : undefined}
            accentColor={colors.running}
          />

          {/* KPI 4: 성공률 */}
          <CompactKPICard
            icon={TrendingUp}
            label="성공률"
            value={totalProcessed > 0 ? `${computed.successRate}%` : '-'}
            subLabel={totalFailed > 0 ? `실패 ${totalFailed}` : undefined}
            accentColor={getSuccessRateColor(computed.successRate)}
          />
        </Box>

        {/* ========== 필터 + 컨트롤 ========== */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
            pt: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          {/* 필터 칩들 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <FilterList sx={{ fontSize: 15, color: 'text.disabled', mr: 0.25 }} />
            {filters.map((filter) => (
              <Chip
                key={filter.value}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography component="span" sx={{ ...typography.chip }}>
                      {filter.label}
                    </Typography>
                    {filter.count !== undefined && filter.count > 0 && (
                      <Box
                        component="span"
                        sx={{
                          px: 0.5,
                          py: 0.125,
                          borderRadius: 0.75,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          backgroundColor: currentFilter === filter.value
                            ? alpha(theme.palette.primary.main, 0.2)
                            : alpha(theme.palette.grey[500], 0.1),
                          minWidth: 16,
                          textAlign: 'center',
                        }}
                      >
                        {filter.count}
                      </Box>
                    )}
                  </Box>
                }
                size="small"
                onClick={() => onFilterChange(filter.value)}
                sx={{
                  height: 26,
                  backgroundColor: currentFilter === filter.value
                    ? alpha(theme.palette.primary.main, 0.08)
                    : 'transparent',
                  color: currentFilter === filter.value ? 'primary.main' : 'text.secondary',
                  border: '1px solid',
                  borderColor: currentFilter === filter.value
                    ? alpha(theme.palette.primary.main, 0.3)
                    : 'divider',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.06),
                    borderColor: alpha(theme.palette.primary.main, 0.25),
                  },
                }}
              />
            ))}
          </Box>

          {/* 새로고침 + 업데이트 시간 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {onRefresh && (
              <Tooltip title="새로고침">
                <IconButton
                  size="small"
                  onClick={onRefresh}
                  disabled={loading}
                  sx={{
                    width: 30,
                    height: 30,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    '&:hover': { backgroundColor: alpha('#000', 0.04) },
                  }}
                >
                  <Refresh
                    sx={{
                      fontSize: 15,
                      animation: loading ? 'spin 1s linear infinite' : 'none',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' },
                      },
                    }}
                  />
                </IconButton>
              </Tooltip>
            )}
            <Typography sx={{ ...typography.timestamp, display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.5 }}>
              <Timer sx={{ fontSize: 11 }} />
              {new Date(lastUpdated).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
