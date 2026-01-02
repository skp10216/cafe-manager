'use client';

/**
 * Multi Run Tracker 컨테이너 - 프리미엄 v3
 * 
 * 핵심 개선:
 * - 실행 모니터 전체를 하나의 컨테이너로 통합
 * - 접기/펼치기(Collapsible) 기능 지원
 * - 실행 목록 + 실행 상세를 내부에 포함
 * - 반응형 완벽 지원
 */

import { useState, useCallback, useEffect } from 'react';
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
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import { 
  Schedule, 
  PlayCircle, 
  ListAlt,
  Assignment,
  ErrorOutline,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { useMultiRunPolling, UseMultiRunPollingOptions } from '@/hooks/useMultiRunPolling';
import { RunFilter } from '@/types/multi-run';
import GlobalRunOverview from './GlobalRunOverview';
import RunsList from './RunsList';
import RunDetail from './RunDetail';

/** 접힘 상태 저장 키 */
const COLLAPSE_STORAGE_KEY = 'multiRunTracker_collapsed';

interface MultiRunTrackerProps {
  pollingOptions?: UseMultiRunPollingOptions;
  onViewLogs?: (runId: string) => void;
  onRetry?: (runId: string) => void;
  /** 기본 펼침 상태 (true면 펼침 우선, localStorage 무시) */
  defaultExpanded?: boolean;
}

/**
 * 내부 섹션 헤더 (실행 목록, 실행 상세용)
 */
function InnerSectionHeader({
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
        py: 1.25,
        borderBottom: '1px solid',
        borderColor: alpha('#2563EB', 0.1),
        backgroundColor: alpha('#2563EB', 0.02),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Icon sx={{ fontSize: 18, color: '#2563EB' }} />
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'text.primary' }}>
          {title}
        </Typography>
        {badge !== undefined && badge > 0 && (
          <Box
            sx={{
              px: 0.875,
              py: 0.125,
              borderRadius: 1.25,
              fontSize: '0.7rem',
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
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '2px solid',
        borderColor: alpha('#2563EB', 0.25),
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 2.5 }}>
        <Skeleton variant="rounded" width="100%" height={60} sx={{ mb: 2, borderRadius: 2 }} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Box sx={{ width: { xs: '100%', md: 360 }, flexShrink: 0 }}>
            <Skeleton variant="rounded" width="100%" height={200} sx={{ borderRadius: 2 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="rounded" width="100%" height={200} sx={{ borderRadius: 2 }} />
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}

/**
 * 빈 목록 상태 - 실행 목록 패널 내부
 */
function EmptyListState() {
  return (
    <Box
      sx={{
        py: 4,
        px: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        borderRadius: 2,
        border: '1px dashed',
        borderColor: alpha('#2563EB', 0.2),
        backgroundColor: alpha('#2563EB', 0.01),
      }}
    >
      <Schedule sx={{ fontSize: 36, color: '#2563EB', opacity: 0.3 }} />
      <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', textAlign: 'center' }}>
        현재 실행 중인 작업이 없습니다
      </Typography>
      <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', textAlign: 'center' }}>
        스케줄이 실행되면 여기에 표시됩니다
      </Typography>
    </Box>
  );
}

/**
 * 빈 상세 상태 - 실행 상세 패널 내부
 */
function EmptyDetailState() {
  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 280,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 4,
        borderRadius: 2,
        border: '1px dashed',
        borderColor: alpha('#2563EB', 0.2),
        backgroundColor: alpha('#2563EB', 0.01),
      }}
    >
      <Schedule sx={{ fontSize: 48, color: '#2563EB', opacity: 0.2, mb: 2 }} />
      <Typography color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
        실행 정보가 없습니다
      </Typography>
      <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center' }}>
        스케줄이 실행되면 상세 정보가 표시됩니다
      </Typography>
    </Box>
  );
}

/**
 * Multi Run Tracker - 프리미엄 v3
 * 
 * 구조:
 * [실행 모니터] - 접기/펼치기 가능한 컨테이너
 *   └─ [실행 목록] + [실행 상세] - 2-Pane 레이아웃
 */
export default function MultiRunTracker({
  pollingOptions,
  onViewLogs,
  onRetry,
  defaultExpanded,
}: MultiRunTrackerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // 접힘 상태 (localStorage 연동)
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filter, setFilter] = useState<RunFilter>('ALL');
  const [mobileTab, setMobileTab] = useState<'list' | 'detail'>('list');

  // localStorage에서 접힘 상태 복원 (defaultExpanded가 true면 무조건 펼침)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // defaultExpanded가 true면 펼침 상태로 강제 설정
      if (defaultExpanded === true) {
        setIsCollapsed(false);
        localStorage.setItem(COLLAPSE_STORAGE_KEY, 'false');
        return;
      }
      const saved = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (saved === 'true') {
        setIsCollapsed(true);
      }
    }
  }, [defaultExpanded]);

  // 접힘 상태 토글
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const newValue = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(newValue));
      return newValue;
    });
  }, []);

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

  // 빈 상태 여부
  const isEmpty = runs.length === 0;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '2px solid',
        borderColor: alpha('#2563EB', 0.25),
        overflow: 'hidden',
        backgroundColor: 'background.paper',
      }}
    >
      {/* ========== 실행 모니터 헤더 ========== */}
      <Box
        onClick={toggleCollapse}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 2,
          cursor: 'pointer',
          backgroundColor: alpha('#2563EB', 0.04),
          borderBottom: isCollapsed ? 'none' : '1px solid',
          borderColor: alpha('#2563EB', 0.15),
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: alpha('#2563EB', 0.06),
          },
        }}
      >
        {/* 아이콘 */}
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            backgroundColor: alpha('#2563EB', 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <PlayCircle 
            sx={{ 
              fontSize: 22, 
              color: '#2563EB',
              animation: activeCount > 0 ? 'pulse 1.5s ease-in-out infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }} 
          />
        </Box>

        {/* 제목 + 설명 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2, color: 'text.primary' }}>
            실행 모니터
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            {isEmpty ? '대기 중' : `${activeCount > 0 ? `${activeCount}개 실행중` : '실행 완료'}`}
          </Typography>
        </Box>

        {/* 상태 배지들 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {activeCount > 0 && (
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5,
                px: 1,
                py: 0.375,
                borderRadius: 1.5,
                backgroundColor: alpha('#2563EB', 0.1),
              }}
            >
              <PlayCircle sx={{ fontSize: 14, color: '#2563EB' }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563EB' }}>
                {activeCount}
              </Typography>
            </Box>
          )}
          {failedCount > 0 && (
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5,
                px: 1,
                py: 0.375,
                borderRadius: 1.5,
                backgroundColor: alpha('#EF4444', 0.1),
              }}
            >
              <ErrorOutline sx={{ fontSize: 14, color: '#EF4444' }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#EF4444' }}>
                {failedCount}
              </Typography>
            </Box>
          )}
          {!isEmpty && runs.length > 0 && (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 500 }}>
              총 {runs.length}개
            </Typography>
          )}
        </Box>

        {/* 접기/펼치기 버튼 */}
        <Tooltip title={isCollapsed ? '펼치기' : '접기'}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse();
            }}
            sx={{
              ml: 0.5,
              width: 32,
              height: 32,
              backgroundColor: alpha('#2563EB', 0.08),
              color: '#2563EB',
              '&:hover': {
                backgroundColor: alpha('#2563EB', 0.15),
              },
            }}
          >
            {isCollapsed ? <ExpandMore /> : <ExpandLess />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* ========== 콘텐츠 영역 (접기/펼치기) ========== */}
      <Collapse in={!isCollapsed} timeout={300}>
        <Box sx={{ p: 2 }}>
          {/* Global Overview - 데이터 있을 때만 */}
          {!isEmpty && (
            <Box sx={{ mb: 2 }}>
              <GlobalRunOverview
                overview={overview}
                currentFilter={filter}
                onFilterChange={setFilter}
                onRefresh={refetch}
                loading={loading}
                runs={runs}
              />
            </Box>
          )}

          {/* 모바일 탭 */}
          {isMobile && (
            <Box sx={{ mb: 2 }}>
              <Tabs
                value={mobileTab}
                onChange={(_, v) => setMobileTab(v)}
                variant="fullWidth"
                sx={{
                  minHeight: 44,
                  borderRadius: 2,
                  backgroundColor: alpha('#2563EB', 0.04),
                  '& .MuiTab-root': {
                    minHeight: 44,
                    py: 1,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    textTransform: 'none',
                  },
                  '& .MuiTabs-indicator': {
                    height: 3,
                    borderRadius: '3px 3px 0 0',
                    backgroundColor: '#2563EB',
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
                          fontSize: '0.65rem',
                          height: 18,
                          minWidth: 18,
                        },
                      }}
                    >
                      <ListAlt sx={{ fontSize: 20 }} />
                    </Badge>
                  }
                  iconPosition="start"
                  label="실행 목록" 
                  value="list" 
                />
                <Tab 
                  icon={<Assignment sx={{ fontSize: 20 }} />}
                  iconPosition="start"
                  label="실행 상세" 
                  value="detail" 
                  disabled={!selectedRun && !isEmpty}
                />
              </Tabs>
            </Box>
          )}

          {/* 메인: 2-Pane 레이아웃 */}
          {isMobile ? (
            // 모바일: 탭 기반
            <Box>
              {mobileTab === 'list' ? (
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: alpha('#2563EB', 0.15),
                    overflow: 'hidden',
                    backgroundColor: alpha('#2563EB', 0.01),
                  }}
                >
                  <InnerSectionHeader
                    icon={ListAlt}
                    title="실행 목록"
                    badge={displayRuns.length > 0 ? displayRuns.length : undefined}
                  />
                  <Box sx={{ p: 1.5 }}>
                    {isEmpty ? (
                      <EmptyListState />
                    ) : (
                      <RunsList
                        runs={displayRuns}
                        selectedRunId={selectedRunId}
                        onSelectRun={handleSelectRun}
                        maxItems={10}
                        searchEnabled
                        onRetry={onRetry}
                      />
                    )}
                  </Box>
                </Paper>
              ) : (
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: alpha('#2563EB', 0.15),
                    overflow: 'hidden',
                    backgroundColor: alpha('#2563EB', 0.01),
                  }}
                >
                  <InnerSectionHeader icon={Assignment} title="실행 상세" />
                  <Box sx={{ p: 1.5 }}>
                    {isEmpty ? (
                      <EmptyDetailState />
                    ) : (
                      <RunDetail
                        run={selectedRun}
                        onViewLogs={onViewLogs}
                        onRetry={onRetry}
                      />
                    )}
                  </Box>
                </Paper>
              )}
            </Box>
          ) : (
            // 데스크톱: 2-Pane
            <Stack direction="row" spacing={2}>
              {/* 좌측: 실행 목록 */}
              <Paper
                elevation={0}
                sx={{
                  width: { md: 360, lg: 400 },
                  flexShrink: 0,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: alpha('#2563EB', 0.15),
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: alpha('#2563EB', 0.01),
                }}
              >
                <InnerSectionHeader
                  icon={ListAlt}
                  title="실행 목록"
                  badge={displayRuns.length > 0 ? displayRuns.length : undefined}
                />
                <Box
                  sx={{
                    flex: 1,
                    maxHeight: 500,
                    overflowY: 'auto',
                    p: 1.5,
                    '&::-webkit-scrollbar': { width: 5 },
                    '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: alpha('#2563EB', 0.2),
                      borderRadius: 2.5,
                    },
                    '&::-webkit-scrollbar-thumb:hover': {
                      backgroundColor: alpha('#2563EB', 0.3),
                    },
                  }}
                >
                  {isEmpty ? (
                    <EmptyListState />
                  ) : (
                    <RunsList
                      runs={displayRuns}
                      selectedRunId={selectedRunId}
                      onSelectRun={handleSelectRun}
                      maxItems={10}
                      searchEnabled={displayRuns.length > 3}
                      onRetry={onRetry}
                    />
                  )}
                </Box>
              </Paper>

              {/* 우측: 실행 상세 */}
              <Paper
                elevation={0}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: alpha('#2563EB', 0.15),
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: alpha('#2563EB', 0.01),
                }}
              >
                <InnerSectionHeader 
                  icon={Assignment} 
                  title="실행 상세"
                  extra={
                    selectedRun && (
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 500 }}>
                        {selectedRun.scheduleName}
                      </Typography>
                    )
                  }
                />
                <Box sx={{ flex: 1, p: 1.5 }}>
                  {isEmpty ? (
                    <EmptyDetailState />
                  ) : selectedRun ? (
                    <RunDetail
                      run={selectedRun}
                      onViewLogs={onViewLogs}
                      onRetry={onRetry}
                    />
                  ) : (
                    <Box
                      sx={{
                        height: '100%',
                        minHeight: 280,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 4,
                      }}
                    >
                      <Schedule sx={{ fontSize: 48, color: '#2563EB', opacity: 0.15, mb: 2 }} />
                      <Typography color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
                        실행 정보를 선택해주세요
                      </Typography>
                      <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center' }}>
                        왼쪽 목록에서 실행을 선택하면 상세 정보가 표시됩니다
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Stack>
          )}
        </Box>
      </Collapse>

      {/* 접힌 상태일 때 요약 정보 */}
      {isCollapsed && !isEmpty && (
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: alpha('#2563EB', 0.1),
            backgroundColor: alpha('#2563EB', 0.02),
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            {activeCount > 0 
              ? `${activeCount}개 스케줄 실행중 · ${overview.totalProcessed}/${overview.totalTarget} 완료`
              : `총 ${runs.length}개 실행 기록`
            }
          </Typography>
          {overview.totalFailed > 0 && (
            <Typography sx={{ fontSize: '0.8rem', color: '#EF4444', fontWeight: 600 }}>
              {overview.totalFailed}건 실패
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
}
