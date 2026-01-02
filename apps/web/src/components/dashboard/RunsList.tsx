'use client';

/**
 * Runs List 컴포넌트 - 프리미엄 v4
 * 
 * Linear/Notion 스타일 콘솔 감성:
 * - 타이포그래피 토큰 적용 (tabular-nums)
 * - 담백하고 전문적인 카드 디자인
 * - 선택 강조 명확
 */

import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  alpha,
  Paper,
  Stack,
  Tooltip,
  LinearProgress,
  TextField,
  InputAdornment,
  IconButton,
  MenuItem,
  Select,
  FormControl,
} from '@mui/material';
import {
  PlayCircle,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  HourglassEmpty,
  AccessTime,
  Search,
  Clear,
  ExpandMore,
  ExpandLess,
  Replay,
  Sort,
} from '@mui/icons-material';
import { ScheduleRunInfo, RunStatus, calculateProgress } from '@/types/multi-run';
import { formatTimeWithRelative } from '@/lib/time-utils';
import { typography, colors, getStatusColor } from '@/lib/typography';

interface RunsListProps {
  runs: ScheduleRunInfo[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  maxItems?: number;
  searchEnabled?: boolean;
  onRetry?: (runId: string) => void;
}

// 상태별 설정
const statusConfig: Record<RunStatus, {
  icon: typeof PlayCircle;
  label: string;
}> = {
  RUNNING: { icon: PlayCircle, label: '실행중' },
  QUEUED: { icon: HourglassEmpty, label: '대기' },
  COMPLETED: { icon: CheckCircle, label: '완료' },
  FAILED: { icon: ErrorIcon, label: '실패' },
  PARTIAL: { icon: Warning, label: '부분실패' },
};

type SortOption = 'recent' | 'running' | 'failed';

/**
 * 개별 Run 카드 - Linear 스타일
 */
function RunCard({
  run,
  isSelected,
  onSelect,
  onRetry,
}: {
  run: ScheduleRunInfo;
  isSelected: boolean;
  onSelect: () => void;
  onRetry?: () => void;
}) {
  const config = statusConfig[run.status];
  const StatusIcon = config.icon;
  const progress = calculateProgress(run.processedCount, run.totalTarget);
  const statusColor = getStatusColor(run.status);
  const hasError = run.failedCount > 0;
  const isRunning = run.status === 'RUNNING';
  const isCompleted = run.status === 'COMPLETED' || run.status === 'FAILED' || run.status === 'PARTIAL';

  return (
    <Paper
      elevation={0}
      onClick={onSelect}
      sx={{
        position: 'relative',
        borderRadius: 2,
        cursor: 'pointer',
        backgroundColor: isSelected ? alpha(colors.running, 0.02) : 'background.paper',
        border: '1px solid',
        borderColor: isSelected ? alpha(colors.running, 0.25) : 'divider',
        overflow: 'hidden',
        transition: 'all 0.12s ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: isSelected ? 4 : 3,
          backgroundColor: isSelected ? colors.running : statusColor,
          transition: 'all 0.12s ease',
        },
        '&:hover': {
          backgroundColor: isSelected ? alpha(colors.running, 0.04) : alpha('#000', 0.01),
          borderColor: isSelected ? alpha(colors.running, 0.35) : alpha('#000', 0.1),
          transform: 'translateY(-1px)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        },
      }}
    >
      <Box sx={{ p: 1.75, pl: 2.25 }}>
        {/* Header: 상태칩 + 스케줄명 + 시간 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
          <Chip
            icon={
              <StatusIcon
                sx={{
                  fontSize: 13,
                  animation: isRunning ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.4 },
                  },
                }}
              />
            }
            label={config.label}
            size="small"
            sx={{
              height: 22,
              ...typography.chip,
              backgroundColor: alpha(statusColor, 0.08),
              color: statusColor,
              border: `1px solid ${alpha(statusColor, 0.15)}`,
              '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
              flexShrink: 0,
            }}
          />
          
          <Typography
            sx={{
              ...typography.cardTitle,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {run.scheduleName}
          </Typography>

          <Tooltip title={new Date(run.updatedAt).toLocaleString('ko-KR')}>
            <Typography sx={{ ...typography.timestamp, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTime sx={{ fontSize: 10 }} />
              {formatTimeWithRelative(run.updatedAt)}
            </Typography>
          </Tooltip>
        </Box>

        {/* Body: 진행률 + Progress Bar */}
        <Box sx={{ mb: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography
              sx={{
                ...typography.kpiNumberSmall,
                color: isCompleted ? statusColor : colors.running,
              }}
            >
              {run.processedCount}
              <Typography component="span" sx={{ color: 'text.disabled', fontWeight: 400, mx: 0.25 }}>/</Typography>
              {run.totalTarget}
            </Typography>
            <Typography
              sx={{
                ...typography.labelNormal,
                fontWeight: 600,
              }}
            >
              {progress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: alpha('#000', 0.04),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                backgroundColor: isCompleted ? statusColor : colors.running,
              },
            }}
          />
        </Box>

        {/* Footer: 성공/실패 배지 + 재시도 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          {/* 성공 배지 */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.875,
              py: 0.375,
              borderRadius: 1.25,
              backgroundColor: alpha(colors.success, 0.06),
              border: '1px solid',
              borderColor: alpha(colors.success, 0.12),
            }}
          >
            <CheckCircle sx={{ fontSize: 13, color: colors.success }} />
            <Typography
              sx={{
                ...typography.kpiNumberSmall,
                fontSize: '0.8rem',
                color: colors.success,
              }}
            >
              {run.successCount}
            </Typography>
            <Typography sx={{ ...typography.chip, color: colors.success, fontSize: '0.6rem' }}>
              성공
            </Typography>
          </Box>

          {/* 실패 배지 */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.875,
              py: 0.375,
              borderRadius: 1.25,
              backgroundColor: hasError ? alpha(colors.error, 0.06) : alpha(colors.queued, 0.06),
              border: '1px solid',
              borderColor: hasError ? alpha(colors.error, 0.12) : alpha(colors.queued, 0.08),
            }}
          >
            <ErrorIcon sx={{ fontSize: 13, color: hasError ? colors.error : colors.queued }} />
            <Typography
              sx={{
                ...typography.kpiNumberSmall,
                fontSize: '0.8rem',
                color: hasError ? colors.error : colors.queued,
              }}
            >
              {run.failedCount}
            </Typography>
            <Typography sx={{ ...typography.chip, color: hasError ? colors.error : colors.queued, fontSize: '0.6rem' }}>
              실패
            </Typography>
          </Box>

          {/* 재시도 버튼 */}
          {onRetry && (run.status === 'FAILED' || run.status === 'PARTIAL') && (
            <Tooltip title="재시도">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
                sx={{
                  ml: 'auto',
                  width: 26,
                  height: 26,
                  border: '1px solid',
                  borderColor: alpha(colors.error, 0.2),
                  color: colors.error,
                  '&:hover': { backgroundColor: alpha(colors.error, 0.06) },
                }}
              >
                <Replay sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

/**
 * Runs List - 프리미엄 v4
 */
export default function RunsList({
  runs,
  selectedRunId,
  onSelectRun,
  maxItems = 10,
  searchEnabled = true,
  onRetry,
}: RunsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  // 정렬
  const sortedRuns = useMemo(() => {
    const sorted = [...runs];
    switch (sortBy) {
      case 'running':
        sorted.sort((a, b) => {
          const orderA = a.status === 'RUNNING' ? 0 : a.status === 'QUEUED' ? 1 : 2;
          const orderB = b.status === 'RUNNING' ? 0 : b.status === 'QUEUED' ? 1 : 2;
          if (orderA !== orderB) return orderA - orderB;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        break;
      case 'failed':
        sorted.sort((a, b) => {
          const failedA = a.status === 'FAILED' || a.status === 'PARTIAL' ? 0 : 1;
          const failedB = b.status === 'FAILED' || b.status === 'PARTIAL' ? 0 : 1;
          if (failedA !== failedB) return failedA - failedB;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        break;
      default:
        sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return sorted;
  }, [runs, sortBy]);

  // 검색 필터링
  const filteredRuns = useMemo(() => {
    if (!searchQuery.trim()) return sortedRuns;
    const query = searchQuery.toLowerCase();
    return sortedRuns.filter(run => 
      run.scheduleName.toLowerCase().includes(query) ||
      run.recentEvents.some(e => e.errorCode?.toLowerCase().includes(query))
    );
  }, [sortedRuns, searchQuery]);

  const displayRuns = showAll ? filteredRuns : filteredRuns.slice(0, maxItems);
  const hasMore = filteredRuns.length > maxItems;

  if (runs.length === 0) {
    return (
      <Box
        sx={{
          py: 1.5,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderRadius: 1.5,
          border: '1px dashed',
          borderColor: 'divider',
          backgroundColor: alpha('#000', 0.01),
        }}
      >
        <HourglassEmpty sx={{ fontSize: 18, opacity: 0.2, color: 'text.disabled' }} />
        <Typography sx={{ ...typography.helper, color: 'text.secondary' }}>
          현재 실행 중인 작업이 없습니다
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.25}>
      {/* 검색 + 정렬 */}
      {searchEnabled && runs.length > 2 && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder="스케줄명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 15, color: 'text.disabled' }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.25 }}>
                    <Clear sx={{ fontSize: 13 }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              flex: 1,
              '& .MuiOutlinedInput-root': {
                borderRadius: 1.5,
                backgroundColor: alpha('#000', 0.02),
                '& fieldset': { borderColor: 'divider' },
                '&:hover fieldset': { borderColor: alpha('#000', 0.1) },
                '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 1 },
              },
              '& .MuiInputBase-input': { ...typography.helper, fontSize: '0.8rem', py: 0.875 },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 95 }}>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              startAdornment={<Sort sx={{ fontSize: 13, color: 'text.disabled', mr: 0.25 }} />}
              sx={{
                borderRadius: 1.5,
                ...typography.chip,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
              }}
            >
              <MenuItem value="recent" sx={{ ...typography.helper }}>최신순</MenuItem>
              <MenuItem value="running" sx={{ ...typography.helper }}>실행중</MenuItem>
              <MenuItem value="failed" sx={{ ...typography.helper }}>실패</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

      {/* 실행 목록 */}
      {filteredRuns.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography sx={{ ...typography.helper }}>검색 결과가 없습니다</Typography>
        </Box>
      ) : (
        <>
          {displayRuns.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              isSelected={selectedRunId === run.id}
              onSelect={() => onSelectRun(run.id)}
              onRetry={onRetry ? () => onRetry(run.id) : undefined}
            />
          ))}

          {/* 더보기/접기 */}
          {hasMore && (
            <Box
              onClick={() => setShowAll(!showAll)}
              sx={{
                py: 0.875,
                textAlign: 'center',
                borderRadius: 1.5,
                cursor: 'pointer',
                border: '1px dashed',
                borderColor: 'divider',
                transition: 'all 0.12s ease',
                '&:hover': {
                  backgroundColor: alpha('#000', 0.02),
                  borderColor: alpha('#000', 0.1),
                },
              }}
            >
              <Typography
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  ...typography.chip,
                  color: 'text.secondary',
                }}
              >
                {showAll ? (
                  <>
                    <ExpandLess sx={{ fontSize: 15 }} />
                    접기
                  </>
                ) : (
                  <>
                    <ExpandMore sx={{ fontSize: 15 }} />
                    {filteredRuns.length - maxItems}개 더 보기
                  </>
                )}
              </Typography>
            </Box>
          )}
        </>
      )}
    </Stack>
  );
}
