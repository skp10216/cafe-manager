'use client';

/**
 * Multi Run Tracker 컨테이너 - 프리미엄 v2
 * 
 * 핵심 개선:
 * - 영역 구분 명확화 (섹션 헤더 + 배경 + 카드)
 * - 정보 계층 강화
 * - 반응형 완벽 지원
 * - 2-Pane + Global Summary 레이아웃
 */

import { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  alpha,
  Skeleton,
  Stack,
  useMediaQuery,
  useTheme,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import { 
  Schedule, 
  PlayCircle, 
  ListAlt,
  Assignment,
  ErrorOutline,
  CheckCircle,
} from '@mui/icons-material';
import { useMultiRunPolling, UseMultiRunPollingOptions } from '@/hooks/useMultiRunPolling';
import { RunFilter } from '@/types/multi-run';
import GlobalRunOverview from './GlobalRunOverview';
import RunsList from './RunsList';
import RunDetail from './RunDetail';

interface MultiRunTrackerProps {
  pollingOptions?: UseMultiRunPollingOptions;
  onViewLogs?: (runId: string) => void;
  onRetry?: (runId: string) => void;
}

/**
 * 섹션 헤더
 */
function SectionHeader({
  icon: Icon,
  title,
  badge,
  badgeColor = 'primary',
  extra,
}: {
  icon: typeof ListAlt;
  title: string;
  badge?: number;
  badgeColor?: 'primary' | 'success' | 'error' | 'warning';
  extra?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        backgroundColor: alpha('#000', 0.015),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Icon sx={{ fontSize: 20, color: 'text.secondary' }} />
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'text.primary' }}>
          {title}
        </Typography>
        {badge !== undefined && badge > 0 && (
          <Box
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 1.5,
              fontSize: '0.75rem',
              fontWeight: 700,
              backgroundColor: alpha(
                badgeColor === 'success' ? '#10B981' :
                badgeColor === 'error' ? '#EF4444' :
                badgeColor === 'warning' ? '#F59E0B' : '#2563EB',
                0.12
              ),
              color: 
                badgeColor === 'success' ? '#10B981' :
                badgeColor === 'error' ? '#EF4444' :
                badgeColor === 'warning' ? '#F59E0B' : '#2563EB',
            }}
          >
            {badge}
          </Box>
        )}
      </Box>
      {extra}
    </Box>
  );
}

/**
 * 로딩 스켈레톤
 */
function LoadingSkeleton() {
  return (
    <Box>
      <Skeleton variant="rounded" width="100%" height={180} sx={{ mb: 3, borderRadius: 3 }} />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Box sx={{ width: { xs: '100%', md: 380 }, flexShrink: 0 }}>
          <Skeleton variant="rounded" width="100%" height={140} sx={{ mb: 2, borderRadius: 3 }} />
          <Skeleton variant="rounded" width="100%" height={140} sx={{ borderRadius: 3 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="rounded" width="100%" height={450} sx={{ borderRadius: 3 }} />
        </Box>
      </Stack>
    </Box>
  );
}

/**
 * 빈 상태 - 최근 결과와 높이 맞춤 버전
 */
function EmptyState() {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: alpha('#2563EB', 0.15),
        backgroundColor: alpha('#2563EB', 0.02),
        overflow: 'hidden',
      }}
    >
      {/* 헤더 - 최근 결과 헤더와 높이 맞춤 */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid',
          borderColor: alpha('#2563EB', 0.1),
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            backgroundColor: alpha('#2563EB', 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PlayCircle sx={{ fontSize: 20, color: '#2563EB' }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.2, color: 'text.primary' }}>
            실행 모니터
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            실시간 진행 상황
          </Typography>
        </Box>
      </Box>
      
      {/* 본문 - 컴팩트 빈 상태 */}
      <Box
        sx={{
          py: 3,
          px: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
        }}
      >
        <Schedule sx={{ fontSize: 20, color: '#2563EB', opacity: 0.5 }} />
        <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
          현재 실행 중인 작업이 없습니다
        </Typography>
      </Box>
    </Paper>
  );
}

/**
 * Multi Run Tracker - 프리미엄 v2
 */
export default function MultiRunTracker({
  pollingOptions,
  onViewLogs,
  onRetry,
}: MultiRunTrackerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  const [filter, setFilter] = useState<RunFilter>('ALL');
  const [mobileTab, setMobileTab] = useState<'list' | 'detail'>('list');

  const {
    runs,
    selectedRunId,
    selectedRun,
    overview,
    loading,
    error,
    selectRun,
    filteredRuns,
    refetch,
    runningCount,
    completedCount,
  } = useMultiRunPolling({
    intervalMs: 3000,
    enabled: true,
    showSuccessToast: true,
    showFailureToast: true,
    ...pollingOptions,
  });

  const displayRuns = filteredRuns(filter);
  const failedCount = runs.filter(r => r.status === 'FAILED' || r.status === 'PARTIAL').length;
  const activeCount = runs.filter(r => r.status === 'RUNNING' || r.status === 'QUEUED').length;

  const handleSelectRun = useCallback((runId: string) => {
    selectRun(runId);
    if (isMobile) {
      setMobileTab('detail');
    }
  }, [selectRun, isMobile]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (runs.length === 0) {
    return <EmptyState />;
  }

  return (
    <Box>
      {/* 상단: Global Dashboard Summary */}
      <Box sx={{ mb: 3 }}>
        <GlobalRunOverview
          overview={overview}
          currentFilter={filter}
          onFilterChange={setFilter}
          onRefresh={refetch}
          loading={loading}
          runs={runs}
        />
      </Box>

      {/* 모바일 탭 */}
      {isMobile && (
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            borderRadius: 3,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Tabs
            value={mobileTab}
            onChange={(_, v) => setMobileTab(v)}
            variant="fullWidth"
            sx={{
              minHeight: 52,
              '& .MuiTab-root': {
                minHeight: 52,
                py: 1.5,
                fontSize: '0.95rem',
                fontWeight: 700,
                textTransform: 'none',
              },
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
              },
            }}
          >
            <Tab 
              icon={
                <Badge 
                  badgeContent={displayRuns.length} 
                  color="primary"
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.7rem',
                      height: 20,
                      minWidth: 20,
                    },
                  }}
                >
                  <ListAlt sx={{ fontSize: 22 }} />
                </Badge>
              }
              iconPosition="start"
              label="실행 목록" 
              value="list" 
            />
            <Tab 
              icon={<Assignment sx={{ fontSize: 22 }} />}
              iconPosition="start"
              label="실행 상세" 
              value="detail" 
              disabled={!selectedRun}
            />
          </Tabs>
        </Paper>
      )}

      {/* 메인: 2-Pane */}
      {isMobile ? (
        <Box>
          {mobileTab === 'list' ? (
            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
              }}
            >
              <SectionHeader
                icon={ListAlt}
                title="실행 목록"
                badge={displayRuns.length}
                extra={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {activeCount > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PlayCircle sx={{ fontSize: 14, color: '#2563EB' }} />
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563EB' }}>
                          {activeCount}
                        </Typography>
                      </Box>
                    )}
                    {failedCount > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ErrorOutline sx={{ fontSize: 14, color: '#EF4444' }} />
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#EF4444' }}>
                          {failedCount}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                }
              />
              <Box sx={{ p: 2 }}>
                <RunsList
                  runs={displayRuns}
                  selectedRunId={selectedRunId}
                  onSelectRun={handleSelectRun}
                  maxItems={10}
                  searchEnabled
                  onRetry={onRetry}
                />
              </Box>
            </Paper>
          ) : (
            <RunDetail
              run={selectedRun}
              onViewLogs={onViewLogs}
              onRetry={onRetry}
            />
          )}
        </Box>
      ) : (
        <Stack direction="row" spacing={3}>
          {/* 좌측: 실행 목록 */}
          <Paper
            elevation={0}
            sx={{
              width: { md: 380, lg: 420 },
              flexShrink: 0,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SectionHeader
              icon={ListAlt}
              title="실행 목록"
              badge={displayRuns.length}
              extra={
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  {activeCount > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PlayCircle sx={{ fontSize: 16, color: '#2563EB' }} />
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563EB' }}>
                        {activeCount} 실행중
                      </Typography>
                    </Box>
                  )}
                  {failedCount > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ErrorOutline sx={{ fontSize: 16, color: '#EF4444' }} />
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#EF4444' }}>
                        {failedCount} 실패
                      </Typography>
                    </Box>
                  )}
                </Box>
              }
            />
            <Box
              sx={{
                flex: 1,
                maxHeight: 650,
                overflowY: 'auto',
                p: 2,
                '&::-webkit-scrollbar': { width: 6 },
                '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: alpha('#000', 0.1),
                  borderRadius: 3,
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  backgroundColor: alpha('#000', 0.2),
                },
              }}
            >
              <RunsList
                runs={displayRuns}
                selectedRunId={selectedRunId}
                onSelectRun={handleSelectRun}
                maxItems={10}
                searchEnabled={displayRuns.length > 3}
                onRetry={onRetry}
              />
            </Box>
          </Paper>

          {/* 우측: 실행 상세 */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {selectedRun ? (
              <Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    mb: 2,
                    px: 0.5,
                  }}
                >
                  <Assignment sx={{ fontSize: 20, color: 'text.secondary' }} />
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'text.primary' }}>
                    실행 상세
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: 'text.disabled', fontWeight: 500 }}>
                    — {selectedRun.scheduleName}
                  </Typography>
                </Box>
                <RunDetail
                  run={selectedRun}
                  onViewLogs={onViewLogs}
                  onRetry={onRetry}
                />
              </Box>
            ) : (
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                }}
              >
                <SectionHeader icon={Assignment} title="실행 상세" />
                <Box sx={{ p: 6, textAlign: 'center' }}>
                  <Schedule sx={{ fontSize: 56, color: 'text.disabled', opacity: 0.2, mb: 2 }} />
                  <Typography color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
                    실행 정보를 선택해주세요
                  </Typography>
                  <Typography variant="body2" color="text.disabled">
                    왼쪽 목록에서 실행을 선택하면 상세 정보가 표시됩니다
                  </Typography>
                </Box>
              </Paper>
            )}
          </Box>
        </Stack>
      )}
    </Box>
  );
}
