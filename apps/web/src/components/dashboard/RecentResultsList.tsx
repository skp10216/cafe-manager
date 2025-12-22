'use client';

/**
 * 섹션 D: 최근 결과 리스트 컴포넌트
 * 컴팩트 프리미엄 디자인 - 최근 성공/실패 작업 결과 표시
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Skeleton,
  Chip,
  Button,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Avatar,
  alpha,
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  OpenInNew,
  Refresh,
  Article,
  AccessTime,
  HistoryToggleOff,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

/** 에러 카테고리 타입 */
type ErrorCategory =
  | 'LOGIN_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'EDITOR_LOAD_FAIL'
  | 'IMAGE_UPLOAD_FAIL'
  | 'NETWORK_ERROR'
  | 'CAFE_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

/** 최근 결과 아이템 */
export interface RecentResultItem {
  jobId: string;
  type: string;
  templateName: string | null;
  scheduleName: string | null;
  cafeName: string | null;
  boardName: string | null;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  resultUrl: string | null;
  screenshotUrl: string | null;
  errorCategory: ErrorCategory | null;
  errorSummary: string | null;
}

interface RecentResultsListProps {
  /** 결과 아이템들 */
  items: RecentResultItem[];
  /** 총 개수 */
  total: number;
  /** 로딩 상태 */
  loading?: boolean;
  /** 재시도 핸들러 */
  onRetry?: (jobId: string) => void;
  /** 로그 보기 핸들러 */
  onViewLog?: (jobId: string) => void;
  /** 필터 변경 핸들러 */
  onFilterChange?: (filter: 'ALL' | 'SUCCESS' | 'FAILED') => void;
}

/** 소요 시간 포맷 */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  if (seconds < 60) return `${seconds}초`;
  const mins = Math.floor(seconds / 60);
  return `${mins}분`;
}

/** 시간 포맷 */
function formatTime(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RecentResultsList({
  items,
  total,
  loading = false,
  onRetry,
  onViewLog,
  onFilterChange,
}: RecentResultsListProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');

  const handleFilterChange = (newFilter: 'ALL' | 'SUCCESS' | 'FAILED') => {
    setFilter(newFilter);
    onFilterChange?.(newFilter);
  };

  // 로딩 상태
  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Skeleton width="40%" height={24} sx={{ mb: 2 }} />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rounded" height={48} sx={{ mb: 1 }} />
        ))}
      </Paper>
    );
  }

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
        sx={{
          px: 2.5,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.8),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              backgroundColor: (theme) => alpha(theme.palette.info.main, 0.1),
            }}
          >
            <HistoryToggleOff sx={{ fontSize: 18, color: 'info.main' }} />
          </Avatar>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              최근 결과
            </Typography>
            <Typography variant="caption" color="text.secondary">
              총 {total}건
            </Typography>
          </Box>
        </Box>

        {/* 필터 탭 */}
        <Tabs
          value={filter}
          onChange={(_, v) => handleFilterChange(v)}
          sx={{
            minHeight: 32,
            '& .MuiTabs-indicator': {
              height: 2,
            },
            '& .MuiTab-root': {
              minHeight: 32,
              py: 0.5,
              px: 1.5,
              fontSize: '0.8125rem',
              minWidth: 'auto',
            },
          }}
        >
          <Tab label="전체" value="ALL" />
          <Tab label="성공" value="SUCCESS" />
          <Tab label="실패" value="FAILED" />
        </Tabs>
      </Box>

      {/* 빈 상태 */}
      {items.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Avatar
            sx={{
              width: 48,
              height: 48,
              mb: 2,
              mx: 'auto',
              backgroundColor: (theme) => alpha(theme.palette.text.disabled, 0.1),
            }}
          >
            <Article sx={{ fontSize: 24, color: 'text.disabled' }} />
          </Avatar>
          <Typography variant="body2" color="text.secondary">
            아직 게시 결과가 없습니다
          </Typography>
        </Box>
      ) : (
        /* 결과 리스트 */
        <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
          {items.map((item, index) => {
            const isSuccess = item.status === 'COMPLETED';

            return (
              <Box
                key={item.jobId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2.5,
                  py: 1.5,
                  borderBottom: index < items.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  transition: 'background-color 0.15s ease',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                {/* 상태 아이콘 */}
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    backgroundColor: isSuccess 
                      ? (theme) => alpha(theme.palette.success.main, 0.1)
                      : (theme) => alpha(theme.palette.error.main, 0.1),
                    flexShrink: 0,
                  }}
                >
                  {isSuccess ? (
                    <CheckCircle sx={{ color: 'success.main', fontSize: 18 }} />
                  ) : (
                    <ErrorIcon sx={{ color: 'error.main', fontSize: 18 }} />
                  )}
                </Avatar>

                {/* 내용 */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.templateName || '템플릿'}
                    </Typography>
                    {!isSuccess && item.errorSummary && (
                      <Chip
                        label="실패"
                        size="small"
                        color="error"
                        sx={{ height: 18, fontSize: 10 }}
                      />
                    )}
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.cafeName} · {formatTime(item.finishedAt || item.createdAt)}
                    {item.durationSeconds !== null && ` · ${formatDuration(item.durationSeconds)}`}
                  </Typography>
                </Box>

                {/* 액션 버튼 */}
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  {isSuccess && item.resultUrl && (
                    <Tooltip title="결과 보기">
                      <IconButton
                        size="small"
                        href={item.resultUrl}
                        target="_blank"
                        sx={{ color: 'success.main' }}
                      >
                        <OpenInNew sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {!isSuccess && (
                    <Tooltip title="재시도">
                      <IconButton
                        size="small"
                        onClick={() => onRetry?.(item.jobId)}
                        sx={{ color: 'primary.main' }}
                      >
                        <Refresh sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => onViewLog?.(item.jobId)}
                    sx={{ minWidth: 'auto', px: 1, fontSize: '0.75rem' }}
                  >
                    로그
                  </Button>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* 더보기 버튼 */}
      {items.length > 0 && total > items.length && (
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
            backgroundColor: (theme) => alpha(theme.palette.action.hover, 0.3),
          }}
        >
          <Button
            size="small"
            variant="text"
            onClick={() => router.push('/logs?type=CREATE_POST')}
          >
            전체 {total}건 보기
          </Button>
        </Box>
      )}
    </Paper>
  );
}
