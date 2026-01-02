'use client';

/**
 * 섹션 D: 최근 결과 리스트 컴포넌트 - Premium Edition
 * 
 * 개선 사항:
 * - Segmented Control 스타일 필터 (명확한 선택 상태)
 * - 3열 구조: 상태+템플릿 | 시간 | CTA
 * - 실패 항목에 재시도 버튼 강조
 * - 실패 배너 (실패 존재 시)
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Skeleton,
  Button,
  IconButton,
  Tooltip,
  Avatar,
  alpha,
  ToggleButtonGroup,
  ToggleButton,
  Stack,
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  OpenInNew,
  Refresh,
  Article,
  AccessTime,
  HistoryToggleOff,
  Warning,
  FilterList,
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
  if (seconds < 1) return '<1초';
  if (seconds < 60) return `${seconds}초`;
  const mins = Math.floor(seconds / 60);
  return `${mins}분`;
}

/** 상대 시간 포맷 */
function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 60) return `${diffSeconds}초 전`;
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
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

  const handleFilterChange = (
    _: React.MouseEvent<HTMLElement>,
    newFilter: 'ALL' | 'SUCCESS' | 'FAILED' | null
  ) => {
    if (newFilter !== null) {
      setFilter(newFilter);
      onFilterChange?.(newFilter);
    }
  };

  // 실패 항목 개수
  const failedCount = items.filter((item) => item.status !== 'COMPLETED').length;

  // 로딩 상태
  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Skeleton width="30%" height={32} />
          <Skeleton width="40%" height={36} />
        </Box>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 1, borderRadius: 2 }} />
        ))}
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {/* ========================================
          헤더 + Segmented Control 필터
          ======================================== */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
          backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.8),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              backgroundColor: (theme) => alpha(theme.palette.info.main, 0.1),
            }}
          >
            <HistoryToggleOff sx={{ fontSize: 20, color: 'info.main' }} />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
              최근 결과
            </Typography>
            <Typography variant="caption" color="text.secondary">
              총 {total}건
            </Typography>
          </Box>
        </Box>

        {/* Segmented Control 필터 */}
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={handleFilterChange}
          size="small"
          sx={{
            backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.06),
            borderRadius: 2,
            p: 0.5,
            '& .MuiToggleButtonGroup-grouped': {
              border: 'none',
              borderRadius: '8px !important',
              px: 2,
              py: 0.5,
              fontSize: '0.8125rem',
              fontWeight: 600,
              textTransform: 'none',
              color: 'text.secondary',
              '&.Mui-selected': {
                backgroundColor: 'background.paper',
                color: 'primary.main',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                '&:hover': {
                  backgroundColor: 'background.paper',
                },
              },
              '&:hover': {
                backgroundColor: 'transparent',
              },
            },
          }}
        >
          <ToggleButton value="ALL">전체</ToggleButton>
          <ToggleButton value="SUCCESS">
            <CheckCircle sx={{ fontSize: 14, mr: 0.5, color: 'success.main' }} />
            성공
          </ToggleButton>
          <ToggleButton value="FAILED">
            <ErrorIcon sx={{ fontSize: 14, mr: 0.5, color: 'error.main' }} />
            실패
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* ========================================
          실패 경고 배너 (실패가 있을 때만)
          ======================================== */}
      {filter === 'ALL' && failedCount > 0 && (
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: (theme) => alpha(theme.palette.error.main, 0.06),
            borderBottom: '1px solid',
            borderColor: (theme) => alpha(theme.palette.error.main, 0.1),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning sx={{ fontSize: 18, color: 'error.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
              오늘 실패 {failedCount}건
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="text"
              onClick={() => {
                setFilter('FAILED');
                onFilterChange?.('FAILED');
              }}
              sx={{ fontSize: '0.75rem', fontWeight: 600 }}
            >
              실패만 보기
            </Button>
          </Stack>
        </Box>
      )}

      {/* ========================================
          빈 상태
          ======================================== */}
      {items.length === 0 ? (
        <Box sx={{ p: 5, textAlign: 'center' }}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              mb: 2,
              mx: 'auto',
              backgroundColor: (theme) => alpha(theme.palette.text.disabled, 0.08),
            }}
          >
            <Article sx={{ fontSize: 28, color: 'text.disabled' }} />
          </Avatar>
          <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5, color: 'text.secondary' }}>
            아직 게시 결과가 없습니다
          </Typography>
          <Typography variant="body2" color="text.disabled">
            스케줄을 실행하면 여기에 결과가 표시됩니다
          </Typography>
        </Box>
      ) : (
        /* ========================================
           결과 리스트 (3열 구조)
           ======================================== */
        <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
          {items.map((item, index) => {
            const isSuccess = item.status === 'COMPLETED';

            return (
              <Box
                key={item.jobId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  px: 2.5,
                  py: 1.75,
                  borderBottom: index < items.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  transition: 'background-color 0.15s ease',
                  backgroundColor: isSuccess
                    ? 'transparent'
                    : (theme) => alpha(theme.palette.error.main, 0.02),
                  '&:hover': {
                    backgroundColor: (theme) =>
                      isSuccess
                        ? alpha(theme.palette.action.hover, 0.5)
                        : alpha(theme.palette.error.main, 0.04),
                  },
                }}
              >
                {/* 열 1: 상태 아이콘 + 템플릿명 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                  <Avatar
                    sx={{
                      width: 36,
                      height: 36,
                      backgroundColor: isSuccess
                        ? (theme) => alpha(theme.palette.success.main, 0.1)
                        : (theme) => alpha(theme.palette.error.main, 0.1),
                      flexShrink: 0,
                    }}
                  >
                    {isSuccess ? (
                      <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
                    ) : (
                      <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                    )}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: isSuccess ? 'text.primary' : 'error.dark',
                      }}
                    >
                      {item.templateName || '템플릿'}
                    </Typography>
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
                      {item.cafeName || '카페'}
                      {item.boardName && ` · ${item.boardName}`}
                    </Typography>
                  </Box>
                </Box>

                {/* 열 2: 시간 정보 */}
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    minWidth: 80,
                    flexShrink: 0,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: 'text.primary',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <AccessTime sx={{ fontSize: 12 }} />
                    {formatRelativeTime(item.finishedAt || item.createdAt)}
                  </Typography>
                  {item.durationSeconds !== null && (
                    <Typography variant="caption" color="text.secondary">
                      {formatDuration(item.durationSeconds)}
                    </Typography>
                  )}
                </Box>

                {/* 열 3: CTA 버튼 */}
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  {/* 성공: 결과 보기 */}
                  {isSuccess && item.resultUrl && (
                    <Tooltip title="게시글 보기">
                      <IconButton
                        size="small"
                        href={item.resultUrl}
                        target="_blank"
                        sx={{
                          color: 'success.main',
                          backgroundColor: (theme) => alpha(theme.palette.success.main, 0.08),
                          '&:hover': {
                            backgroundColor: (theme) => alpha(theme.palette.success.main, 0.15),
                          },
                        }}
                      >
                        <OpenInNew sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {/* 실패: 재시도 버튼 (강조) */}
                  {!isSuccess && (
                    <Tooltip title="재시도">
                      <IconButton
                        size="small"
                        onClick={() => onRetry?.(item.jobId)}
                        sx={{
                          color: 'white',
                          backgroundColor: 'error.main',
                          '&:hover': {
                            backgroundColor: 'error.dark',
                          },
                        }}
                      >
                        <Refresh sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {/* 로그 보기 버튼 */}
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onViewLog?.(item.jobId)}
                    sx={{
                      minWidth: 'auto',
                      px: 1.5,
                      py: 0.5,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderColor: 'divider',
                      color: 'text.secondary',
                      '&:hover': {
                        borderColor: 'primary.main',
                        color: 'primary.main',
                        backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.04),
                      },
                    }}
                  >
                    로그
                  </Button>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* ========================================
          더보기 링크 (우측 상단 스타일)
          ======================================== */}
      {items.length > 0 && total > items.length && (
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.02),
          }}
        >
          <Button
            size="small"
            variant="text"
            endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
            onClick={() => router.push('/logs?type=CREATE_POST')}
            sx={{ fontWeight: 600 }}
          >
            전체 {total}건 보기
          </Button>
        </Box>
      )}
    </Paper>
  );
}


