'use client';

/**
 * 섹션 D: 최근 결과 리스트 컴포넌트 - Premium Edition v2
 * 
 * 개선 사항:
 * - embedded 모드 지원 (다른 컨테이너에 포함될 때)
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
  /** 내장 모드 (다른 컨테이너에 포함될 때) */
  embedded?: boolean;
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
  embedded = false,
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
    if (embedded) {
      return (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Skeleton width="40%" height={32} />
          </Box>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={52} sx={{ mb: 1, borderRadius: 1.5 }} />
          ))}
        </Box>
      );
    }

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

  // 내용 렌더링
  const renderContent = () => (
    <>
      {/* 필터 (embedded 모드에서도 표시) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1.5,
          gap: 1,
        }}
      >
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={handleFilterChange}
          size="small"
          sx={{
            backgroundColor: (theme) => alpha(theme.palette.grey[500], 0.06),
            borderRadius: 1.5,
            p: 0.375,
            '& .MuiToggleButtonGroup-grouped': {
              border: 'none',
              borderRadius: '6px !important',
              px: 1.5,
              py: 0.375,
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'none',
              color: 'text.secondary',
              '&.Mui-selected': {
                backgroundColor: 'background.paper',
                color: 'primary.main',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
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
            <CheckCircle sx={{ fontSize: 12, mr: 0.5, color: 'success.main' }} />
            성공
          </ToggleButton>
          <ToggleButton value="FAILED">
            <ErrorIcon sx={{ fontSize: 12, mr: 0.5, color: 'error.main' }} />
            실패
          </ToggleButton>
        </ToggleButtonGroup>

        {failedCount > 0 && filter === 'ALL' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Warning sx={{ fontSize: 14, color: 'error.main' }} />
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'error.main' }}>
              {failedCount}건 실패
            </Typography>
          </Box>
        )}
      </Box>

      {/* 빈 상태 */}
      {items.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Article sx={{ fontSize: 40, color: 'text.disabled', opacity: 0.3, mb: 1 }} />
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
            아직 게시 결과가 없습니다
          </Typography>
          <Typography variant="caption" color="text.disabled">
            스케줄을 실행하면 여기에 결과가 표시됩니다
          </Typography>
        </Box>
      ) : (
        /* 결과 리스트 */
        <Box sx={{ maxHeight: embedded ? 260 : 320, overflow: 'auto' }}>
          {items.map((item, index) => {
            const isSuccess = item.status === 'COMPLETED';

            return (
              <Box
                key={item.jobId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 1.5,
                  mb: index < items.length - 1 ? 0.75 : 0,
                  transition: 'background-color 0.15s ease',
                  backgroundColor: isSuccess
                    ? 'transparent'
                    : (theme) => alpha(theme.palette.error.main, 0.03),
                  border: '1px solid',
                  borderColor: isSuccess
                    ? (theme) => alpha(theme.palette.success.main, 0.1)
                    : (theme) => alpha(theme.palette.error.main, 0.15),
                  '&:hover': {
                    backgroundColor: (theme) =>
                      isSuccess
                        ? alpha(theme.palette.success.main, 0.04)
                        : alpha(theme.palette.error.main, 0.06),
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

                {/* 템플릿명 */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: '0.8rem',
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
                    sx={{
                      fontSize: '0.7rem',
                      color: 'text.secondary',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.cafeName || '카페'}
                  </Typography>
                </Box>

                {/* 시간 */}
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    color: 'text.secondary',
                    flexShrink: 0,
                  }}
                >
                  {formatRelativeTime(item.finishedAt || item.createdAt)}
                </Typography>

                {/* CTA */}
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  {isSuccess && item.resultUrl && (
                    <Tooltip title="게시글 보기">
                      <IconButton
                        size="small"
                        href={item.resultUrl}
                        target="_blank"
                        sx={{
                          width: 28,
                          height: 28,
                          color: 'success.main',
                          backgroundColor: (theme) => alpha(theme.palette.success.main, 0.08),
                          '&:hover': {
                            backgroundColor: (theme) => alpha(theme.palette.success.main, 0.15),
                          },
                        }}
                      >
                        <OpenInNew sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {!isSuccess && (
                    <Tooltip title="재시도">
                      <IconButton
                        size="small"
                        onClick={() => onRetry?.(item.jobId)}
                        sx={{
                          width: 28,
                          height: 28,
                          color: 'white',
                          backgroundColor: 'error.main',
                          '&:hover': {
                            backgroundColor: 'error.dark',
                          },
                        }}
                      >
                        <Refresh sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="로그 보기">
                    <IconButton
                      size="small"
                      onClick={() => onViewLog?.(item.jobId)}
                      sx={{
                        width: 28,
                        height: 28,
                        border: '1px solid',
                        borderColor: 'divider',
                        color: 'text.secondary',
                        '&:hover': {
                          borderColor: 'primary.main',
                          color: 'primary.main',
                        },
                      }}
                    >
                      <OpenInNew sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* 더보기 */}
      {items.length > 0 && total > items.length && (
        <Box sx={{ mt: 1.5, textAlign: 'right' }}>
          <Button
            size="small"
            variant="text"
            endIcon={<OpenInNew sx={{ fontSize: 12 }} />}
            onClick={() => router.push('/logs?type=CREATE_POST')}
            sx={{ fontSize: '0.75rem', fontWeight: 600 }}
          >
            전체 {total}건 보기
          </Button>
        </Box>
      )}
    </>
  );

  // embedded 모드
  if (embedded) {
    return <Box>{renderContent()}</Box>;
  }

  // 독립 모드 (기존 스타일)
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette.success.main, 0.15),
        overflow: 'hidden',
        backgroundColor: (theme) => alpha(theme.palette.success.main, 0.02),
      }}
    >
      {/* 헤더 */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid',
          borderColor: (theme) => alpha(theme.palette.success.main, 0.12),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
          backgroundColor: (theme) => alpha(theme.palette.success.main, 0.04),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              backgroundColor: (theme) => alpha(theme.palette.success.main, 0.1),
            }}
          >
            <HistoryToggleOff sx={{ fontSize: 20, color: 'success.main' }} />
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
      </Box>

      {/* 콘텐츠 */}
      <Box sx={{ p: 2 }}>{renderContent()}</Box>
    </Paper>
  );
}
